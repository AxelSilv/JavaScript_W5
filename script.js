const DATA_URL =
  "https://geo.stat.fi/geoserver/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=tilastointialueet:kunta4500k&outputFormat=json&srsName=EPSG:4326";

const MIGRATION_URL =
  "https://pxdata.stat.fi/PxWeb/api/v1/fi/StatFin/muutl/statfin_muutl_pxt_11a2.px";

// 1) Hae muuttodata PxWebistä käyttäen omaa query-tiedostoa
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

// 2) Muodosta taulukko: { "KU758": {positive, negative}, ... }
//    - Järjestetään kunnat index-arvon mukaan
//    - Poimitaan joka kunnalle values[i*2] = tulo, values[i*2+1] = lähtö
function parseMigrationData(json) {
  const areaIndex = json.dimension.Alue.category.index; // { KU005: 1, KU009: 2, ... }
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

// 3) Muunna WFS:n kuntakoodi PxWeb-muotoon: 758 -> KU758, 7 -> KU007
function toPxCode(props) {
  const raw =
    props.kunta ?? props.kuntanumero ?? props.kuntanro ?? props.kunta_koodi ?? props.id;
  if (raw == null) return null;
  const num = String(raw).padStart(3, "0").slice(-3);
  return "KU" + num;
}

(async function main() {
  const map = L.map("map", { minZoom: -3 });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors",
  }).addTo(map);

  // WFS-kunnat ja PxWeb-muuttodata
  const geo = await (await fetch(DATA_URL)).json();
  const migration = await fetchMigrationData();

  const base = { weight: 2, color: "#3388ff", fillOpacity: 0.2 };
  const hover = { weight: 3, color: "#ff6600", fillOpacity: 0.35 };

  const layer = L.geoJSON(geo, {
    style: base,
    onEachFeature: (feature, lyr) => {
      const p = feature.properties || {};
      const name = p.namefin || p.name || "";
      const pxCode = toPxCode(p); // esim. "KU758"

      if (name) lyr.bindTooltip(name, { sticky: true });

      // Bindaa popup vain kun data löytyy; muuten näytä edes nimi
      if (pxCode && migration[pxCode]) {
        const { positive, negative } = migration[pxCode];
        lyr.bindPopup(
          `<b>${name}</b><br/>Positive migration: ${positive}<br/>Negative migration: ${negative}`
        );
      } else {
        lyr.bindPopup(`<b>${name}</b>`);
      }

      lyr.on("mouseover", () => lyr.setStyle(hover));
      lyr.on("mouseout", () => lyr.setStyle(base));
    },
  }).addTo(map);

  map.fitBounds(layer.getBounds());
})();
