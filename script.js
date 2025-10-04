const DATA_URL =
  "https://geo.stat.fi/geoserver/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=tilastointialueet:kunta4500k&outputFormat=json&srsName=EPSG:4326";

(async function main() {
  try {
    const map = L.map("map", { minZoom: -3 });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors"
    }).addTo(map);

    const res = await fetch(DATA_URL);
    const data = await res.json();

    // GeoJSON-kerros
    const municipalities = L.geoJSON(data, {
      style: { weight: 2 },
      onEachFeature: (feature, layer) => {
        // bindTooltip = näkyy hoverissa
        if (feature.properties && feature.properties.namefin) {
          layer.bindTooltip(feature.properties.namefin, {
            sticky: true   // pysyy kursorin vieressä
          });
        }
      }
    }).addTo(map);

    map.fitBounds(municipalities.getBounds());
  } catch (err) {
    console.error(err);
    alert("Datan haku tai kartan piirtäminen epäonnistui.");
  }
})();
