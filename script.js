// ================= MAP =================
var map = L.map('map');

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

            layer.on("click",function(){

                layer.unbindTooltip();

                document.getElementById("info-content").innerHTML = `
                <b>Nama Jalan :</b> ${nama}<br>
                <b>Kondisi :</b> ${p["Kondisi Jalan "] || "-"}<br>
                <b>Tipe :</b> ${p["Tipe Perkerasan"] || "-"}<br>
                <b>Panjang :</b> ${p["Panjang Jln"] || 0} meter
                `;

                document.getElementById("info-panel").classList.remove("hidden");

                window.layerAktif = layer;
                window.namaTooltip = nama;
            });

        }

    }).addTo(map);

    zoomGabungan();
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

            layer.on("click", function(){
                map.fitBounds(layer.getBounds());
            });
        }

    }).addTo(map);

    zoomGabungan();
    setLayerControl();
});

// ================= LAYER CONTROL =================
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

// ================= ZOOM KE SEMUA =================
function zoomGabungan(){

    var group = [];

    if(layerJalan) group.push(layerJalan);
    if(layerKelurahan) group.push(layerKelurahan);

    if(group.length > 0){
        var gabung = L.featureGroup(group);
        map.fitBounds(gabung.getBounds());
    }
}

// ================= TUTUP PANEL =================
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
