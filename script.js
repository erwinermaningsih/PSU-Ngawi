/* =================================================================
   WebGIS PSU Jalan – Dinas Perumahan Rakyat Kab. Ngawi
   ================================================================= */

// ── BASEMAP TILES ──────────────────────────────────────────────────
var tiles = {
  satellite: L.tileLayer(
    'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    { maxZoom:20, subdomains:['mt0','mt1','mt2','mt3'], attribution:'© Google' }
  ),
  osm: L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    { maxZoom:19, attribution:'© OpenStreetMap' }
  ),
  topo: L.tileLayer(
    'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    { maxZoom:17, attribution:'© OpenTopoMap' }
  )
};

// ── MAP INIT ───────────────────────────────────────────────────────
var map = L.map('map', {
  center: [-7.4, 111.45],
  zoom: 14,
  zoomControl: true,
  layers: [tiles.satellite]
});

L.control.scale({ imperial:false, position:'bottomleft' }).addTo(map);

// ── LAYER GROUPS ───────────────────────────────────────────────────
var layerJalan     = L.layerGroup().addTo(map);
var layerKelurahan = L.layerGroup().addTo(map);
var layerFasum     = L.layerGroup().addTo(map);

// ── LOADING COUNTER ────────────────────────────────────────────────
var loadPending = 3;
function checkLoaded() {
  loadPending--;
  if (loadPending <= 0) {
    document.getElementById('loading-overlay').style.display = 'none';
  }
}

// ── WARNA KONDISI JALAN ────────────────────────────────────────────
function warnаKondisi(kondisi) {
  var k = (kondisi || '').trim().toLowerCase();
  if (k === 'baik')   return '#27ae60';
  if (k === 'sedang') return '#f39c12';
  if (k === 'rusak berat' || k === 'rusak') return '#e74c3c';
  return '#e74c3c'; // default merah
}

// ── WARNA TIPE PERKERASAN ──────────────────────────────────────────
function warnaTipe(tipe) {
  var t = (tipe || '').trim().toLowerCase();
  if (t.includes('aspal'))   return '#2c3e50';
  if (t.includes('beton'))   return '#7f8c8d';
  if (t.includes('paving'))  return '#e67e22';
  if (t.includes('tanah'))   return '#8B4513';
  return '#e74c3c';
}

// ── INFO PANEL ─────────────────────────────────────────────────────
function tampilkanAtribut(judul, rows) {
  document.getElementById('info-title').textContent = judul;
  var html = '';
  rows.forEach(function(r) {
    html += '<div class="row-attr">'
          + '<span class="attr-key">' + r.key + '</span>'
          + '<span class="attr-val">' + r.val + '</span>'
          + '</div>';
  });
  document.getElementById('info-content').innerHTML = html;
  document.getElementById('info-panel').classList.remove('hidden');
}

function closePanel() {
  document.getElementById('info-panel').classList.add('hidden');
}

// Tutup panel klik di luar
map.on('click', function() { closePanel(); });

// ── BADGE KONDISI ──────────────────────────────────────────────────
function badgeKondisi(k) {
  var safe = (k||'').trim();
  var cls  = 'badge-kondisi badge-' + safe;
  return '<span class="' + cls + '">' + safe + '</span>';
}

// ── GEOJSON: JALAN ─────────────────────────────────────────────────
var jalanStats = { count:0, totalPanjang:0 };

fetch('Jalan.geojson')
  .then(function(r){ return r.json(); })
  .then(function(data) {
    jalanStats.count = data.features.length;

    data.features.forEach(function(f) {
      var p = f.properties;
      var panjang = parseFloat(p['Panjang Jln']) || 0;
      jalanStats.totalPanjang += panjang;
    });

    // Update topbar stats
    document.getElementById('total-jalan').textContent = jalanStats.count;
    document.getElementById('total-panjang').textContent =
      (jalanStats.totalPanjang >= 1000
        ? (jalanStats.totalPanjang/1000).toFixed(2) + ' km'
        : jalanStats.totalPanjang.toFixed(0) + ' m');

    L.geoJSON(data, {
      style: function(feature) {
        var kondisi = (feature.properties['Kondisi Jalan '] || '').trim();
        return {
          color: warnаKondisi(kondisi),
          weight: 5,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round'
        };
      },
      onEachFeature: function(f, layer) {
        var p = f.properties;
        var kondisi  = (p['Kondisi Jalan ']  || '-').trim();
        var tipe     = (p['Tipe Perkerasan'] || '-').trim();
        var fungsi   = (p['Fungsi Jalan']    || '-').trim();
        var panjang  = parseFloat(p['Panjang Jln']) || 0;

        // Tooltip permanen
        layer.bindTooltip(fungsi, {
          permanent: false,
          className: 'jalan-tooltip',
          direction: 'top'
        });

        layer.on('click', function(e) {
          L.DomEvent.stopPropagation(e);
          tampilkanAtribut('🛣️ Detail Ruas Jalan', [
            { key: 'Fungsi Jalan',    val: fungsi },
            { key: 'Kondisi',         val: badgeKondisi(kondisi) },
            { key: 'Tipe Perkerasan', val: tipe },
            { key: 'Panjang',         val: panjang.toFixed(2) + ' m' }
          ]);
        });

        layer.on('mouseover', function() {
          layer.setStyle({ weight:8, opacity:1 });
        });
        layer.on('mouseout', function() {
          layer.setStyle({ weight:5, opacity:0.9 });
        });
      }
    }).addTo(layerJalan);

    checkLoaded();
  })
  .catch(function(err) {
    console.error('Gagal memuat Jalan.geojson:', err);
    checkLoaded();
  });

// ── GEOJSON: KELURAHAN ─────────────────────────────────────────────
fetch('kelurahankarangtengah.geojson')
  .then(function(r){ return r.json(); })
  .then(function(data) {
    L.geoJSON(data, {
      style: {
        color: '#2980b9',
        weight: 1.5,
        opacity: 0.7,
        fillColor: '#3498db',
        fillOpacity: 0.06
      },
      onEachFeature: function(f, layer) {
        var p = f.properties;
        var nama = p.KELURAHAN || p.NAMOBJ || '-';
        var kec  = p.KECAMATAN || '-';
        var luas = parseFloat(p.LUASPETA) || parseFloat(p.LUASTERTUL) || 0;

        layer.bindTooltip(nama, {
          sticky: true,
          className: 'jalan-tooltip',
          direction: 'top'
        });

        layer.on('click', function(e) {
          L.DomEvent.stopPropagation(e);
          tampilkanAtribut('📍 Kelurahan ' + nama, [
            { key: 'Kelurahan',   val: nama },
            { key: 'Kecamatan',   val: kec },
            { key: 'Luas Peta',   val: luas.toFixed(2) + ' m²' }
          ]);
        });

        layer.on('mouseover', function() {
          layer.setStyle({ fillOpacity:0.15, weight:2.5 });
        });
        layer.on('mouseout', function() {
          layer.setStyle({ fillOpacity:0.06, weight:1.5 });
        });
      }
    }).addTo(layerKelurahan);

    checkLoaded();
  })
  .catch(function(err) {
    console.error('Gagal memuat kelurahan GeoJSON:', err);
    checkLoaded();
  });

// ── ICON FASILITAS ─────────────────────────────────────────────────
function getIcon(kategori) {
  var icons = {
    'Sekolah':             'https://cdn-icons-png.flaticon.com/512/3135/3135755.png',
    'Pasar':               'https://cdn-icons-png.flaticon.com/512/3081/3081559.png',
    'Fasilitas Kesehatan': 'https://cdn-icons-png.flaticon.com/512/2967/2967350.png',
    'Tempat Ibadah':       'https://cdn-icons-png.flaticon.com/512/4257/4257032.png',
    'Perkantoran':         'https://cdn-icons-png.flaticon.com/512/1682/1682300.png'
  };
  var url = icons[kategori] || 'https://cdn-icons-png.flaticon.com/512/684/684908.png';
  return L.icon({ iconUrl:url, iconSize:[32,32], iconAnchor:[16,32], popupAnchor:[0,-32] });
}

// ── CSV: FASILITAS UMUM ────────────────────────────────────────────
Papa.parse('fasilitas_umum.csv', {
  download: true,
  header: true,
  complete: function(results) {
    var valid = results.data.filter(function(r){
      return r.x_longitude && r.y_latitude;
    });

    document.getElementById('total-fasum').textContent = valid.length;

    valid.forEach(function(row) {
      var lat  = parseFloat(row.y_latitude);
      var lng  = parseFloat(row.x_longitude);
      var kat  = (row.kategori || 'Umum').trim();
      var nama = (row.nama_fasilitas || '-').trim();

      if (isNaN(lat) || isNaN(lng)) return;

      var warna = '#27ae60';
      if (kat === 'Pasar')               warna = '#e67e22';
      if (kat === 'Fasilitas Kesehatan') warna = '#e74c3c';
      if (kat === 'Tempat Ibadah')       warna = '#8e44ad';
      if (kat === 'Perkantoran')         warna = '#2980b9';

      var marker = L.marker([lat, lng], { icon: getIcon(kat) });

      marker.on('click', function(e) {
        L.DomEvent.stopPropagation(e);
        tampilkanAtribut('🏢 ' + nama, [
          { key: 'Nama',     val: nama },
          { key: 'Kategori', val: kat }
        ]);
      });

      marker.bindTooltip(nama, {
        className: 'jalan-tooltip',
        direction: 'top'
      });

      marker.addTo(layerFasum);

      // Lingkaran jangkauan
      var jangkauanList = [
        { r: parseFloat(row.jangkauan1_meter), opacity: 0.12 },
        { r: parseFloat(row.jangkauan2_meter), opacity: 0.08 },
        { r: parseFloat(row.jangkauan3_meter), opacity: 0.04 }
      ];
      jangkauanList.forEach(function(j) {
        if (!isNaN(j.r) && j.r > 0) {
          L.circle([lat, lng], {
            radius: j.r,
            color: warna,
            weight: 1,
            fillColor: warna,
            fillOpacity: j.opacity
          }).addTo(layerFasum);
        }
      });
    });

    checkLoaded();
  },
  error: function() { checkLoaded(); }
});

// ── BASEMAP SWITCHER ────────────────────────────────────────────────
document.querySelectorAll('.bm-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var bm = btn.getAttribute('data-bm');
    Object.values(tiles).forEach(function(t){ map.removeLayer(t); });
    tiles[bm].addTo(map);
    // Pastikan tile di belakang semua layer
    tiles[bm].bringToBack();
    document.querySelectorAll('.bm-btn').forEach(function(b){ b.classList.remove('active'); });
    btn.classList.add('active');
  });
});

// ── LAYER TOGGLE ───────────────────────────────────────────────────
document.getElementById('tog-jalan').addEventListener('change', function() {
  this.checked ? layerJalan.addTo(map) : map.removeLayer(layerJalan);
});
document.getElementById('tog-kelurahan').addEventListener('change', function() {
  this.checked ? layerKelurahan.addTo(map) : map.removeLayer(layerKelurahan);
});
document.getElementById('tog-fasum').addEventListener('change', function() {
  this.checked ? layerFasum.addTo(map) : map.removeLayer(layerFasum);
});

// ── LEGENDA ────────────────────────────────────────────────────────
var legend = L.control({ position: 'bottomleft' });
legend.onAdd = function() {
  var div = L.DomUtil.create('div', 'map-legend');
  div.innerHTML = [
    '<h4>Legenda</h4>',
    '<div class="legend-row"><span class="lg-line" style="background:#27ae60"></span> Jalan – Kondisi Baik</div>',
    '<div class="legend-row"><span class="lg-line" style="background:#f39c12"></span> Jalan – Kondisi Sedang</div>',
    '<div class="legend-row"><span class="lg-line" style="background:#e74c3c"></span> Jalan – Kondisi Rusak</div>',
    '<div class="legend-row"><span class="lg-poly" style="border-color:#2980b9;background:rgba(52,152,219,.12)"></span> Batas Kelurahan</div>',
    '<div class="legend-row"><span style="font-size:16px">🎓</span> Sekolah</div>',
    '<div class="legend-row"><span style="font-size:16px">🛒</span> Pasar</div>',
    '<div class="legend-row"><span style="font-size:16px">➕</span> Fasilitas Kesehatan</div>'
  ].join('');
  L.DomEvent.disableClickPropagation(div);
  return div;
};
legend.addTo(map);
