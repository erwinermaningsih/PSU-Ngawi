// ===============================
// MAP
// ===============================
var map = L.map('map').setView([-7.4,111.4],13);

// ===============================
// BASEMAP
// ===============================
var osm = L.tileLayer(
'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
{ maxZoom:19, attribution:'© OpenStreetMap' }
).addTo(map);

// ===============================
// STYLE
// ===============================
function styleJalan(){
    return { color:"red", weight:6 };
}

function styleKelurahan(){
    return {
        color:"#0047AB",
        weight:2,
        fillColor:"#00AEEF",
        fillOpacity:0.2
    };
}

// ===============================
// VARIABLE LAYER
// ===============================
var layerJalan;
var layerKelurahan;

// ===============================
// LOAD JALAN
// ===============================
fetch("Jalan.geojson")
.then(res => res.json())
.then(data => {

    layerJalan = L.geoJSON(data,{

        style:styleJalan,

        onEachFeature:function(feature, layer){

            var p = feature.properties;
            var nama = p["Fungsi Jalan"] || "Ruas Jalan";

            layer.bindTooltip(nama,{
                permanent:true,
                direction:"center",
                className:"label-jalan"
            });

            layer.on("click",function(){

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

    map.fitBounds(layerJalan.getBounds());

});

// ===============================
// LOAD KELURAHAN
// ===============================
fetch("KelurahanKarangtengah.geojson")
.then(res => res.json())
.then(data => {

    layerKelurahan = L.geoJSON(data,{

        style:styleKelurahan,

        onEachFeature:function(feature, layer){

            var namaKel = feature.properties.NAMOBJ || "Kelurahan Karangtengah";

            layer.bindPopup("<b>Kelurahan :</b> " + namaKel);
        }

    }).addTo(map);

});

// ===============================
// CONTROL LAYER
// ===============================
setTimeout(function(){

L.control.layers(
    { "OpenStreetMap": osm },
    {
        "Jalan": layerJalan,
        "Kelurahan Karangtengah": layerKelurahan
    },
    { collapsed:false }
).addTo(map);

},1000);

// ===============================
// TUTUP PANEL
// ===============================
function closePanel(){

    document.getElementById("info-panel").classList.add("hidden");

    if(window.layerAktif){
        window.layerAktif.bindTooltip(window.namaTooltip,{
            permanent:true,
            direction:"center",
            className:"label-jalan"
        });
    }
}
