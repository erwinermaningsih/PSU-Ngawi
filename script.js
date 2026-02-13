// ===============================
// INISIALISASI MAP
// ===============================
var map = L.map('map', {
    zoomControl: true
}).setView([-7.4, 111.4], 12);

// ===============================
// BASEMAP OPENSTREETMAP
// ===============================
L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    }
).addTo(map);

// ===============================
// STYLE JALAN
// ===============================
function styleJalan() {
    return {
        color: "#e10600",
        weight: 6,
        opacity: 1
    };
}

// ===============================
// INTERAKSI SETIAP FITUR
// ===============================
function onEachFeature(feature, layer) {

    var p = feature.properties;

    // Ambil nama jalan dari atribut
    var namaJalan = p["Fungsi Jalan"] || "Ruas Jalan";

    // LABEL DI TENGAH GARIS
    layer.bindTooltip(namaJalan, {
        permanent: true,
        direction: "center",
        className: "label-jalan"
    });

    // SAAT DIKLIK
    layer.on("click", function () {

        layer.unbindTooltip();

        var isi = `
        <b>Nama Jalan :</b> ${namaJalan}<br>
        <b>Kondisi :</b> ${p["Kondisi Jalan "] || "-"}<br>
        <b>Tipe Perkerasan :</b> ${p["Tipe Perkerasan"] || "-"}<br>
        <b>Panjang :</b> ${p["Panjang Jln"] || 0} meter
        `;

        document.getElementById("info-content").innerHTML = isi;
        document.getElementById("info-panel").classList.remove("hidden");

        window.layerAktif = layer;
        window.namaTooltip = namaJalan;
    });
}

// ===============================
// LOAD GEOJSON
// ===============================
fetch("./Jalan.geojson")
    .then(response => {

        if (!response.ok) {
            throw new Error("File GeoJSON tidak ditemukan");
        }

        return response.json();
    })
    .then(data => {

        var geojsonLayer = L.geoJSON(data, {
            style: styleJalan,
            onEachFeature: onEachFeature
        }).addTo(map);

        map.fitBounds(geojsonLayer.getBounds());

    })
    .catch(error => {
        console.log("ERROR:", error);
        alert("GeoJSON tidak terbaca. Cek nama file & lokasi file.");
    });

// ===============================
// TOMBOL TUTUP PANEL
// ===============================
function closePanel() {

    document.getElementById("info-panel").classList.add("hidden");

    // Kembalikan label
    if (window.layerAktif) {
        window.layerAktif.bindTooltip(window.namaTooltip, {
            permanent: true,
            direction: "center",
            className: "label-jalan"
        });
    }
}
