// ===============================
// INISIALISASI MAP
// ===============================
var map = L.map('map').setView([-7.4, 111.4], 13);

// ===============================
// BASEMAP
// ===============================
var osm = L.tileLayer(
'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
{
    maxZoom: 19,
    attribution: '© OpenStreetMap'
}
).addTo(map);

// ===============================
// STYLE
// ===============================
function styleJalan() {
    return {
        color: "#e10600",
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
// VARIABLE GLOBAL LAYER
// ===============================
var layerJalan;
var layerKelurahan;

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

            var p = feature.properties;
            var nama = p["Fungsi Jalan"] || "Ruas Jalan";

            // LABEL TENGAH
            layer.bindTooltip(nama, {
                permanent: true,
                direction: "center",
                className: "label-jalan"
            });

            // KLIK JALAN
            layer.on("click", function () {

                layer.unbindTooltip();

                document.getElementById("info-content").innerHTML = `
                    <b>Nama Jalan :</b> ${nama}<br>
                    <b>Kondisi :</b> ${p["Kondisi Jalan "] || "-"}<br>
                    <b>Tipe Perkerasan :</b> ${p["Tipe Perkerasan"] || "-"}<br>
                    <b>Panjang :</b> ${p["Panjang Jln"] || 0} meter
                `;

                document.getElementById("info-panel").classList.remove("hidden");

                window.layerAktif = layer;
                window.namaTooltip = nama;
            });
        }

    }).addTo(map);

    setLayerControl();

    zoomGabungan();

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

            var namaKel = feature.properties.KELURAHAN;

            layer.bindPopup("<b>Kelurahan :</b> " + namaKel);

            // ZOOM SAAT DIKLIK
            layer.on("click", function () {
                map.fitBounds(layer.getBounds());
            });
        }

    }).addTo(map);

    setLayerControl();

    zoomGabungan();

})
.catch(err => console.log("ERROR KELURAHAN:", err));

// ===============================
// CONTROL LAYER
// ===============================
var controlLayer;

function setLayerControl() {

    if (controlLayer) {
        map.removeControl(controlLayer);
    }

    var baseMaps = {
        "OpenStreetMap": osm
    };

    var overlayMaps = {};

    if (layerJalan) overlayMaps["Jalan"] = layerJalan;
    if (layerKelurahan) overlayMaps["Kelurahan"] = layerKelurahan;

    controlLayer = L.control.layers(baseMaps, overlayMaps, {
        collapsed: false
    }).addTo(map);
}

// ===============================
// ZOOM KE SEMUA LAYER
// ===============================
function zoomGabungan() {

    var group = [];

    if (layerJalan) group.push(layerJalan);
    if (layerKelurahan) group.push(layerKelurahan);

    if (group.length > 0) {
        var gabung = L.featureGroup(group);
        map.fitBounds(gabung.getBounds());
    }
}

// ===============================
// TUTUP PANEL DETAIL
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
