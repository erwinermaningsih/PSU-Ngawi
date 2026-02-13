var map = L.map('map').setView([-7.4,111.4],12);

// BASEMAP
L.tileLayer(
'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
{ maxZoom:19 }
).addTo(map);

// STYLE
function style(){
    return {color:"red", weight:6};
}

function onEachFeature(feature, layer){

    var p = feature.properties;

    var nama = p["Fungsi Jalan"] || "Ruas Jalan";

    // LABEL TENGAH
    layer.bindTooltip(nama,{
        permanent:true,
        direction:"center",
        className:"label-jalan"
    });

    // KLIK
    layer.on("click",function(){

        layer.unbindTooltip();

        document.getElementById("info-content").innerHTML = `
        <b>Nama Jalan :</b> ${nama}<br>
        <b>Kondisi :</b> ${p["Kondisi Jalan "]}<br>
        <b>Tipe :</b> ${p["Tipe Perkerasan"]}<br>
        <b>Panjang :</b> ${p["Panjang Jln"]} meter
        `;

        document.getElementById("info-panel").classList.remove("hidden");

        window.activeLayer = layer;
        window.activeTooltipName = nama;
    });
}

// LOAD GEOJSON
fetch("Jalan2.geojson")
.then(res=>res.json())
.then(data=>{

    var geojson = L.geoJSON(data,{
        style:style,
        onEachFeature:onEachFeature
    }).addTo(map);

    map.fitBounds(geojson.getBounds());

});

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
