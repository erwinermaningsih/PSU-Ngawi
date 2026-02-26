// ===============================
// INIT MAP
// ===============================
var map = L.map('map').setView([-7.4, 111.4], 13);

// ===============================
// BASEMAP GOOGLE
// ===============================
var googleStreets = L.tileLayer(
  'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
  {
    maxZoom: 20,
    subdomains: ['mt0','mt1','mt2','mt3'],
    attribution: '© Google'
  }
).addTo(map);

var googleSat = L.tileLayer(
  'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
  {
    maxZoom: 20,
    subdomains: ['mt0','mt1','mt2','mt3'],
    attribution: '© Google'
  }
);

var googleHybrid = L.tileLayer(
  'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
  {
    maxZoom: 20,
    subdomains: ['mt0','mt1','mt2','mt3'],
    attribution: '© Google'
  }
);

// ===============================
// GLOBAL VAR
// ===============================
var layerJalan = null;
var layerKelurahan = null;
var controlLayer;

// ===============================
// STYLE
// ===============================
function styleJalan() {
  return {
    color: "red",
    weight: 6
  };
}

function styleKelurahan() {
  return {
    color: "#0047AB",
    weight: 2,
    fillColor: "#00AEEF",
    fillOpacity: 0.15
  };
}

// ===============================
// FUNCTION TAMPILKAN ATRIBUT
// ===============================
function tampilkanAtribut(props) {

  var isi = "";

  for (var key in props) {

    var value = props[key];

    if (value === null || value === "") value = "-";

    if (key.toLowerCase().includes("panjang")) {
      value = value + " meter";
    }

    isi += "<b>" + key + " :</b> " + value + "<br>";
  }

  document.getElementById("info-content").innerHTML = isi;
  document.getElementById("info-panel").classList.remove("hidden");
}

// ===============================
// LOAD JALAN
// ===============================
fetch("./Jalan.geojson")
.then(res => {
  if (!res.ok) throw new Error("Jalan.geojson tidak ditemukan");
  return res.json();
})
.then(data => {

  layerJalan = L.geoJSON(data, {

    style: styleJalan,

    onEachFeature: function (feature, layer) {

      var props = feature.properties;
      var nama = props["Fungsi Jalan"] || "Ruas Jalan";

      layer.bindTooltip(nama, {
        permanent: true,
        direction: "center",
        className: "label-jalan"
      });

      layer.on("click", function () {

        layer.unbindTooltip();

        tampilkanAtribut(props);

        window.layerAktif = layer;
        window.namaTooltip = nama;
      });
    }

  }).addTo(map);

  map.fitBounds(layerJalan.getBounds());

  setLayerControl();

})
.catch(err => console.log("ERROR JALAN:", err));

// ===============================
// LOAD KELURAHAN
// ===============================
fetch("./kelurahankarangtengah.geojson")
.then(res => {
  if (!res.ok) throw new Error("kelurahankarangtengah.geojson tidak ditemukan");
  return res.json();
})
.then(data => {

  layerKelurahan = L.geoJSON(data, {

    style: styleKelurahan,

    onEachFeature: function (feature, layer) {

      var props = feature.properties;

      layer.on("click", function () {

        tampilkanAtribut(props);

        map.fitBounds(layer.getBounds());
      });

    }

  }).addTo(map);

  setLayerControl();

})
.catch(err => console.log("ERROR KELURAHAN:", err));

// ===============================
// CONTROL LAYER
// ===============================
function setLayerControl() {

  if (controlLayer) {
    map.removeControl(controlLayer);
  }

  var baseMaps = {
    "Google Streets": googleStreets,
    "Google Satellite": googleSat,
    "Google Hybrid": googleHybrid
  };

  var overlayMaps = {};

  if (layerJalan) overlayMaps["Jalan"] = layerJalan;
  if (layerKelurahan) overlayMaps["Kelurahan"] = layerKelurahan;

  controlLayer = L.control.layers(baseMaps, overlayMaps, {
    collapsed: false
  }).addTo(map);
}

// ===============================
// TOMBOL TUTUP PANEL
// ===============================
function closePanel() {

  document.getElementById("info-panel").classList.add("hidden");

  if (window.layerAktif) {
    window.layerAktif.bindTooltip(window.namaTooltip, {
      permanent: true,
      direction: "center",
      className: "label-jalan"
    });
  }
}
