var map = L.map('map').setView([-7.4,111.4],12);

// BASEMAP
L.tileLayer(
'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
{
    maxZoom:19,
    attribution:'© OpenStreetMap'
}
).addTo(map);

// STYLE JALAN
function style(){
    return {color:"red", weight:6};
}

// INTERAKSI
function onEachFeature(feature, layer){

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
        <b>Kondisi :</b> ${p["Kondisi Jalan "]}<br>
        <b>Tipe Perkerasan :</b> ${p["Tipe Perkerasan"]}<br>
        <b>Panjang :</b> ${p["Panjang Jln"]} meter
        `;

        document.getElementById("info-panel").classList.remove("hidden");

        window.activeLayer = layer;
        window.activeTooltipName = nama;
    });
}

// LOAD GEOJSON
fetch("./Jalan.geojson")
.then(res => res.json())
.then(data => {

    var geojson = L.geoJSON(data,{
        style:style,
        onEachFeature:onEachFeature
    }).addTo(map);

    map.fitBounds(geojson.getBounds());

})
.catch(err => console.log("GeoJSON error:", err));

// TUTUP PANEL
function closePanel(){

    document.getElementById("info-panel").classList.add("hidden");

    if(window.activeLayer){
        window.activeLayer.bindTooltip(window.activeTooltipName,{
            permanent:true,
            direction:"center",
            className:"label-jalan"
        });
    }
}
