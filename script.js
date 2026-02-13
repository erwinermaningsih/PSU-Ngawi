// ================= MAP =================
var map = L.map('map').setView([-7.4,111.4],13);

// ================= BASEMAP =================
var osm = L.tileLayer(
'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
{ maxZoom:19, attribution:'© OpenStreetMap' }
).addTo(map);

// ================= STYLE =================
function styleJalan(){
    return { color:"red", weight:6 };
}

function styleKelurahan(){
    return {
        color:"#0047AB",
        weight:2,
        fillColor:"#00AEEF",
        fillOpacity:0.15
    };
}

var layerJalan, layerKelurahan;

// ================= LOAD JALAN =================
fetch("./Jalan.geojson")
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

        }

    }).addTo(map);

    // 🔥 ZOOM DARI JALAN (PASTI ADA)
    map.fitBounds(layerJalan.getBounds());

    setLayerControl();
});

// ================= LOAD KELURAHAN =================
fetch("./kelurahankarangtengah.geojson")
.then(res => res.json())
.then(data => {

    layerKelurahan = L.geoJSON(data,{
        style:styleKelurahan,

        onEachFeature:function(feature, layer){

            var namaKel = feature.properties.KELURAHAN;

            layer.bindPopup("<b>Kelurahan :</b> " + namaKel);

        }

    }).addTo(map);

    setLayerControl();
});

// ================= CONTROL LAYER =================
var controlLayer;

function setLayerControl(){

    if(controlLayer) map.removeControl(controlLayer);

    controlLayer = L.control.layers(
        { "OpenStreetMap": osm },
        {
            "Jalan": layerJalan,
            "Kelurahan": layerKelurahan
        },
        { collapsed:false }
    ).addTo(map);
}
