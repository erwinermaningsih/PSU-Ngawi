// INIT MAP
var map = L.map('map').setView([-7.4, 111.4], 13);

// BASEMAP
var googleSat = L.tileLayer(
 'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
 {maxZoom:20, subdomains:['mt0','mt1','mt2','mt3']}
).addTo(map);

L.control.scale().addTo(map);

// LAYER
var layerJalan = L.layerGroup().addTo(map);
var layerKelurahan = L.layerGroup().addTo(map);
var layerTitik = L.layerGroup().addTo(map);

// ================= ICON =================
function getIcon(kategori){

  var url = "";

  if(kategori === "Sekolah"){
    url = "https://cdn-icons-png.flaticon.com/512/3135/3135755.png";
  }
  else if(kategori === "Pasar"){
    url = "https://cdn-icons-png.flaticon.com/512/3081/3081559.png";
  }
  else if(kategori === "Fasilitas Kesehatan"){
    url = "https://cdn-icons-png.flaticon.com/512/2967/2967350.png";
  }

  return L.icon({
    iconUrl: url,
    iconSize: [30,30]
  });
}

// ================= PANEL =================
function tampilkanAtribut(isi){
  document.getElementById("info-content").innerHTML = isi;
  document.getElementById("info-panel").classList.remove("hidden");
}

function closePanel(){
  document.getElementById("info-panel").classList.add("hidden");
}

// ================= GEOJSON =================
fetch("Jalan.geojson")
.then(res=>res.json())
.then(data=>{
  L.geoJSON(data,{
    style:{color:"red",weight:4},
    onEachFeature:(f,l)=>{
      l.on("click",()=>{
        tampilkanAtribut("Jalan : "+f.properties["Fungsi Jalan"]);
      });
    }
  }).addTo(layerJalan);
});

fetch("kelurahankarangtengah.geojson")
.then(res=>res.json())
.then(data=>{
  L.geoJSON(data,{
    style:{color:"blue",fillOpacity:0.1},
    onEachFeature:(f,l)=>{
      l.on("click",()=>{
        tampilkanAtribut("Kelurahan : "+f.properties["NAMOBJ"]);
      });
    }
  }).addTo(layerKelurahan);
});

// ================= CSV =================
Papa.parse("fasilitas_umum.csv",{
  download:true,
  header:true,
  complete:function(results){

    results.data.forEach(row=>{

      if(!row.x_longitude || !row.y_latitude) return;

      var lat = parseFloat(row.y_latitude);
      var lng = parseFloat(row.x_longitude);

      var warna = "green";
      if(row.kategori === "Pasar") warna = "orange";
      if(row.kategori === "Fasilitas Kesehatan") warna = "red";

      var marker = L.marker([lat,lng],{
        icon:getIcon(row.kategori)
      })
      .on("click",()=>{
        tampilkanAtribut(`
          <b>${row.nama_fasilitas}</b><br>
          Kategori : ${row.kategori}
        `);
      })
      .addTo(layerTitik);

      // JANGKAUAN
      if(row.jangkauan1_meter){
        L.circle([lat,lng],{
          radius:row.jangkauan1_meter,
          color:warna,
          fillOpacity:0.1
        }).addTo(layerTitik);
      }

      if(row.jangkauan2_meter){
        L.circle([lat,lng],{
          radius:row.jangkauan2_meter,
          color:warna,
          fillOpacity:0.07
        }).addTo(layerTitik);
      }

      if(row.jangkauan3_meter){
        L.circle([lat,lng],{
          radius:row.jangkauan3_meter,
          color:warna,
          fillOpacity:0.04
        }).addTo(layerTitik);
      }

    });

  }
});

// ================= LAYER CONTROL =================
var baseMaps = {
  "Google Satellite": googleSat
};

var overlayMaps = {
  "Jalan": layerJalan,
  "Kelurahan": layerKelurahan,
  "Fasilitas Umum": layerTitik
};

L.control.layers(baseMaps, overlayMaps,{collapsed:false}).addTo(map);

// ================= LEGENDA =================
var legend = L.control({position:"bottomright"});

legend.onAdd = function(){
  var div = L.DomUtil.create("div","legend");
  div.innerHTML = `
  <b>Legenda</b><br>
  🎓 Sekolah<br>
  🛒 Pasar<br>
  ➕ Fasilitas Kesehatan
  `;
  return div;
};

legend.addTo(map);
