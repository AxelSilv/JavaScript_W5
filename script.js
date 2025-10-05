const DATA_URL =
  "https://geo.stat.fi/geoserver/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=tilastointialueet:kunta4500k&outputFormat=json&srsName=EPSG:4326";

const MIGRATION_URL =
  "https://pxdata.stat.fi/PxWeb/api/v1/fi/StatFin/muutl/statfin_muutl_pxt_11a2.px";

async function fetchMigrationData() {
  const query = await (await fetch("migration_data_query.json")).json();
  const json = await (
    await fetch(MIGRATION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(query),
    })
  ).json();
  return parseMigrationData(json);
}

function parseMigrationData(json) {
  const areaIndex = json.dimension.Alue.category.index;
  const orderedCodes = Object.entries(areaIndex)
    .sort((a, b) => a[1] - b[1])
    .map(([code]) => code);
  const values = json.value;
  const out = {};
  for (let i = 0; i < orderedCodes.length; i++) {
    out[orderedCodes[i]] = {
      positive: Number(values[i * 2]) || 0,
      negative: Number(values[i * 2 + 1]) || 0,
    };
  }
  return out;
}

function toPxCode(props) {
  const raw =
    props.kunta ?? props.kuntanumero ?? props.kunta_koodi ?? props.id;
  if (raw == null) return null;
  const num = String(raw).padStart(3, "0").slice(-3);
  return "KU" + num;
}

function hueFrom(pos, neg) {
  if (neg <= 0) return pos > 0 ? 120 : 0;
  const ratio = pos / neg;
  const hue = Math.pow(ratio, 3) * 60;
  return Math.min(120, Math.max(0, hue));
}

(async function main() {
  const map = L.map("map", { minZoom: -3 });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors",
  }).addTo(map);

  const geo = await (await fetch(DATA_URL)).json();
  const migration = await fetchMigrationData();

  const layer = L.geoJSON(geo, {
    style: (feature) => {
      const p = feature.properties || {};
      const code = toPxCode(p);
      const m = code ? migration[code] : null;
      const pos = m?.positive ?? 0;
      const neg = m?.negative ?? 0;
      const hue = hueFrom(pos, neg);
      const color = `hsl(${hue}, 75%, 50%)`;
      return {
        weight: 2,
        color,
        fillColor: color,
        fillOpacity: 0.45,
      };
    },
    onEachFeature: (feature, lyr) => {
      const p = feature.properties || {};
      const name = p.namefin || p.name || "";
      const code = toPxCode(p);
      if (name) lyr.bindTooltip(name, { sticky: true });
      if (code && migration[code]) {
        const { positive, negative } = migration[code];
        const net = positive - negative;
        lyr.bindPopup(
          `<b>${name}</b><br>
           Positive migration: ${positive}<br>
           Negative migration: ${negative}<br>
           Net: ${net > 0 ? "+" : ""}${net}`
        );
      } else {
        lyr.bindPopup(`<b>${name}</b>`);
      }
      lyr.on("mouseover", () => lyr.setStyle({ weight: 3, fillOpacity: 0.6 }));
      lyr.on("mouseout", () => lyr.setStyle({ weight: 2, fillOpacity: 0.45 }));
    },
  }).addTo(map);

  map.fitBounds(layer.getBounds());
})();
