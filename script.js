/* =================================================================
   WebGIS PSU Jalan – Dinas Perumahan Rakyat Kab. Ngawi
   ================================================================= */

'use strict';

// ── BASEMAP TILES ──────────────────────────────────────────────────
var tiles = {
  satellite: L.tileLayer(
    'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    { maxZoom: 20, subdomains: ['mt0','mt1','mt2','mt3'], attribution: '© Google Satellite' }
  ),
  osm: L.tileLayer(
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    { maxZoom: 19, attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors' }
  ),
  topo: L.tileLayer(
    'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    { maxZoom: 17, attribution: '© <a href="https://opentopomap.org">OpenTopoMap</a>' }
  )
};

// ── MAP INIT ───────────────────────────────────────────────────────
var map = L.map('map', {
  center: [-7.395, 111.452],
  zoom: 14,
  zoomControl: false,
  layers: [tiles.satellite]
});

L.control.zoom({ position: 'topright' }).addTo(map);
L.control.scale({ imperial: false, position: 'bottomright' }).addTo(map);

// ── LAYER GROUPS ───────────────────────────────────────────────────
var layerJalan     = L.layerGroup().addTo(map);
var layerKelurahan = L.layerGroup().addTo(map);
var layerFasum     = L.layerGroup().addTo(map);

var geoJalan     = null;
var geoKelurahan = null;

// ── JANGKAUAN FASUM STATE ──────────────────────────────────────────
var activeJangkauan = [];
function hideJangkauan() {
  activeJangkauan.forEach(function(c) { map.removeLayer(c); });
  activeJangkauan = [];
}

// ── LOADING COUNTER ────────────────────────────────────────────────
// 3 sumber data: JALAN KELURAHAN.json, 4_kelurahan.json, fasilitas_umum.csv
var loadPending = 3;
function checkLoaded() {
  loadPending--;
  if (loadPending <= 0) {
    var overlay = document.getElementById('loading-overlay');
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity .4s ease';
    setTimeout(function () { overlay.style.display = 'none'; }, 400);
    // Fit ke bounds kelurahan setelah semua data siap
    tryFitBounds();
  }
}

// ── HELPER: SANITIZE HTML ─────────────────────────────────────────
function escapeHtml(str) {
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(String(str || '')));
  return div.innerHTML;
}

// ── WARNA KONDISI JALAN ────────────────────────────────────────────
// Sesuai nilai field KONDISI_JA: 'BAIK', 'RUSAK RINGAN', 'RUSAK SEDANG', 'RUSAK BERAT'
function warnaKondisi(kondisi) {
  var k = (kondisi || '').trim().toUpperCase();
  if (k === 'BAIK')        return '#27ae60';
  if (k === 'RUSAK RINGAN') return '#f39c12';
  if (k === 'RUSAK SEDANG') return '#FFFF00';
  if (k === 'RUSAK BERAT')  return '#e74c3c';
}

// ── BADGE KONDISI ──────────────────────────────────────────────────
function badgeKondisi(k) {
  var safe  = (k || '').trim();
  var upper = safe.toUpperCase();
  var cls;
  if (upper === 'BAIK')        cls = 'badge-Baik';
  else if (upper === 'RUSAK RINGAN') cls = 'badge-Rusakringan';
  else if (upper === 'RUSAK SEDANG')  cls = 'badge-Rusaksedang';
  else if (upper === 'RUSAK BERAT')  cls = 'badge-Rusakberat';
  return '<span class="badge-kondisi ' + cls + '">' + escapeHtml(safe) + '</span>';
}

// ── WARNA KELURAHAN (tiap kelurahan warna beda) ───────────────────
var KELURAHAN_COLORS = {
  'Pelem':        { color: '#8e44ad', fill: '#9b59b6' },
  'Karangtengah': { color: '#16a085', fill: '#1abc9c' },
  'Ketanggi':     { color: '#d35400', fill: '#e67e22' },
  'Margomulyo':   { color: '#2980b9', fill: '#3498db' }
};

function getKelurahanStyle(nama) {
  var c = KELURAHAN_COLORS[nama] || { color: '#7f8c8d', fill: '#95a5a6' };
  return {
    color:       c.color,
    weight:      2.5,
    opacity:     0.9,
    fillOpacity: 0,          // ← tanpa fill sama sekali
    dashArray:   '6,5',
    interactive: false       // ← klik tembus ke layer jalan di bawahnya
  };
}

// ── INFO PANEL ─────────────────────────────────────────────────────
function tampilkanAtribut(judul, rows, tipe) {
  document.getElementById('info-title').textContent = judul;
  var html = '';

  if (tipe === 'jalan') {
    var getRow = function(key) {
      var found = null;
      rows.forEach(function(r) { if (r.key === key) found = r; });
      return found;
    };

    var kondisiRow   = getRow('Kondisi');
    var namaRow      = getRow('Nama Ruas');
    var kelRow       = getRow('Kelurahan');
    var jenisRow     = getRow('Jenis Jalan');
    var panjangRow   = getRow('Panjang');
    var lebarRow     = getRow('Lebar');
    var permukaanRow = getRow('Permukaan');
    var kecamatanRow = getRow('Kecamatan');

    // Tentukan warna aksen dari kondisi
    var kondisiTeks = kondisiRow
      ? (kondisiRow.val || '').replace(/<[^>]+>/g, '').trim().toUpperCase()
      : '';
    var accentColor = kondisiTeks === 'BAIK'        ? '#27ae60'
                    : kondisiTeks === 'KURANG BAIK'  ? '#f39c12'
                    : kondisiTeks === 'TIDAK BAIK'   ? '#e74c3c'
                    : '#95a5a6';

    html += '<div class="jalan-card">';

    // Strip warna kondisi di atas
    html += '<div class="jc-strip" style="background:' + accentColor + '"></div>';

    // Badge kondisi
    if (kondisiRow) {
      html += '<div class="jc-badge-wrap">' + kondisiRow.val + '</div>';
    }

    // Nama ruas
    html += '<div class="jc-nama">' + escapeHtml(namaRow ? namaRow.val : '-') + '</div>';

    html += '<div class="jc-divider"></div>';

    // Baris info — tampilkan semua yang ada nilainya
    var infoItems = [
      { icon: '📍', label: 'Kelurahan',   row: kelRow },
      { icon: '🏘️', label: 'Kecamatan',  row: kecamatanRow },
      { icon: '🏗️', label: 'Jenis Jalan', row: jenisRow },
      { icon: '🛣️', label: 'Permukaan',   row: permukaanRow },
      { icon: '↔️', label: 'Lebar',       row: lebarRow }
    ];

    var adaInfo = false;
    infoItems.forEach(function(item) {
      if (!item.row || !item.row.val || item.row.val === '-') return;
      adaInfo = true;
      html += '<div class="jc-row">'
            + '<span class="jc-row-icon">' + item.icon + '</span>'
            + '<span class="jc-row-label">' + item.label + '</span>'
            + '<span class="jc-row-val">' + escapeHtml(item.row.val) + '</span>'
            + '</div>';
    });

    // Fallback: tampilkan semua rows yang belum ditangani di atas
    if (!adaInfo) {
      rows.forEach(function(r) {
        if (r.key === 'Kondisi' || r.key === 'Nama Ruas' || r.key === 'Panjang') return;
        var valHtml = r.isHtml ? r.val : escapeHtml(r.val);
        html += '<div class="jc-row">'
              + '<span class="jc-row-icon">•</span>'
              + '<span class="jc-row-label">' + escapeHtml(r.key) + '</span>'
              + '<span class="jc-row-val">' + valHtml + '</span>'
              + '</div>';
      });
    }

    // Panjang — kotak besar di bawah
    if (panjangRow && panjangRow.val && panjangRow.val !== '-') {
      html += '<div class="jc-panjang-box" style="border-color:' + accentColor + '20">'
            + '<span class="jc-panjang-label">📏 Panjang Ruas</span>'
            + '<span class="jc-panjang-val" style="color:' + accentColor + '">' + escapeHtml(panjangRow.val) + '</span>'
            + '</div>';
    }

    html += '</div>';

  } else {
    // Layout default untuk kelurahan & fasum
    rows.forEach(function (r) {
      var valHtml = r.isHtml ? r.val : escapeHtml(r.val);
      html += '<div class="row-attr">'
            + '<span class="attr-key">' + escapeHtml(r.key) + '</span>'
            + '<span class="attr-val">' + valHtml + '</span>'
            + '</div>';
    });
  }

  document.getElementById('info-content').innerHTML = html;
  document.getElementById('info-panel').classList.remove('hidden');
}

function closePanel() {
  document.getElementById('info-panel').classList.add('hidden');
  hideJangkauan();
}

map.on('click', function () { closePanel(); });

// ── KONVERSI ESRI JSON → GEOJSON ──────────────────────────────────
// 4_kelurahan.json menggunakan format ESRI FeatureSet (bukan GeoJSON)
// geometryType: esriGeometryPolygon, geometry: { rings: [...] }
function esriToGeoJSON(esriData) {
  var features = (esriData.features || []).map(function (f) {
    var rings  = (f.geometry && f.geometry.rings) || [];
    var coords = rings.map(function (ring) {
      // ESRI ring = [lng, lat] → GeoJSON coords sama
      return ring;
    });
    return {
      type: 'Feature',
      properties: f.attributes || {},
      geometry: {
        type: coords.length === 1 ? 'Polygon' : 'MultiPolygon',
        coordinates: coords.length === 1 ? coords : [coords]
      }
    };
  });
  return { type: 'FeatureCollection', features: features };
}

// ── GEOJSON: JALAN (dari JALAN KELURAHAN.json) ────────────────────
var jalanStats = { count: 0, totalPanjang: 0 };

fetch('JALAN KELURAHAN.json')
  .then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  })
  .then(function (data) {
    if (!data || !Array.isArray(data.features)) throw new Error('Format tidak valid');

    jalanStats.count = data.features.length;
    data.features.forEach(function (f) {
      var p = f.properties || {};
      jalanStats.totalPanjang += parseFloat(p.PANJANG_JA || 0) || 0;
    });

    document.getElementById('total-jalan').textContent = jalanStats.count;
    document.getElementById('total-panjang').textContent =
      jalanStats.totalPanjang >= 1000
        ? (jalanStats.totalPanjang / 1000).toFixed(2) + ' km'
        : jalanStats.totalPanjang.toFixed(0) + ' m';

    geoJalan = L.geoJSON(data, {
      style: function (feature) {
        var kondisi = (feature.properties.KONDISI_JA || '').trim();
        return {
          color:    warnaKondisi(kondisi),
          weight:   4,
          opacity:  0.9,
          lineCap:  'round',
          lineJoin: 'round'
        };
      },
      onEachFeature: function (f, layer) {
        var p       = f.properties || {};
        var nama    = (p.NAMA_RUAS   || '-').trim();
        var kondisi = (p.KONDISI_JA  || '-').trim();
        var jenis   = (p.JENIS_JALA  || '-').trim();
        var kel     = (p.KELURAHAN   || p.DESA_KELUR || '-').trim();
        var kec     = (p.KECAMATAN   || '-').trim();
        var panjang = parseFloat(p.PANJANG_JA || 0) || 0;
        var lebar   = (p.LEBAR_JALA  || p.LEBAR || '').toString().trim();
        var permukaan = (p.PERMUKAAN || p.JENIS_PERM || '').toString().trim();
        var ket     = (p.KETERANGAN  || p.KET || '').toString().trim();

        layer.bindTooltip(nama, {
          permanent: false,
          className: 'jalan-tooltip',
          direction: 'top',
          sticky: true
        });

        layer.on('click', function (e) {
          L.DomEvent.stopPropagation(e);
          var rowData = [
            { key: 'Nama Ruas',   val: nama },
            { key: 'Kelurahan',   val: kel },
            { key: 'Kecamatan',   val: kec },
            { key: 'Kondisi',     val: badgeKondisi(kondisi), isHtml: true },
            { key: 'Jenis Jalan', val: jenis },
            { key: 'Permukaan',   val: permukaan || '-' },
            { key: 'Lebar',       val: lebar ? lebar + ' m' : '-' },
            { key: 'Panjang',     val: panjang > 0 ? panjang.toFixed(0) + ' m' : '-' }
          ];
          if (ket && ket !== '-') rowData.push({ key: 'Keterangan', val: ket });
          tampilkanAtribut('🛣️ ' + nama, rowData, 'jalan');
        });

        layer.on('mouseover', function () {
          layer.setStyle({ weight: 7, opacity: 1 });
          layer.bringToFront();
        });
        layer.on('mouseout', function () {
          layer.setStyle({ weight: 4, opacity: 0.9 });
        });
      }
    }).addTo(layerJalan);

    checkLoaded();
  })
  .catch(function (err) {
    console.error('Gagal memuat JALAN KELURAHAN.json:', err);
    tampilkanNotif('Gagal memuat data jalan.', 'error');
    checkLoaded();
  });

// ── GEOJSON: 4 KELURAHAN (dari 4_kelurahan.json, format ESRI) ─────
fetch('4_kelurahan.json')
  .then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  })
  .then(function (esriData) {
    // Konversi ESRI JSON → GeoJSON
    var data = esriToGeoJSON(esriData);

    geoKelurahan = L.geoJSON(data, {
      style: function (feature) {
        var nama = (feature.properties.NAMOBJ || '').trim();
        return getKelurahanStyle(nama);
      }
    }).addTo(layerKelurahan);

    // Update legenda kelurahan dinamis
    updateLegendaKelurahan(data.features);

    checkLoaded();
  })
  .catch(function (err) {
    console.error('Gagal memuat 4_kelurahan.json:', err);
    tampilkanNotif('Gagal memuat batas kelurahan.', 'error');
    checkLoaded();
  });

// ── ICON FASILITAS ─────────────────────────────────────────────────
var iconCache = {};
function getIcon(kategori) {
  if (iconCache[kategori]) return iconCache[kategori];
  var icons = {
    'Sekolah':             'https://cdn-icons-png.flaticon.com/512/3135/3135755.png',
    'Pasar':               'https://cdn-icons-png.flaticon.com/512/3081/3081559.png',
    'Fasilitas Kesehatan': 'https://cdn-icons-png.flaticon.com/512/2967/2967350.png',
    'Tempat Ibadah':       'https://cdn-icons-png.flaticon.com/512/4257/4257032.png',
    'Perkantoran':         'https://cdn-icons-png.flaticon.com/512/1682/1682300.png'
  };
  var url = icons[kategori] || 'https://cdn-icons-png.flaticon.com/512/684/684908.png';
  var icon = L.icon({ iconUrl: url, iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -34] });
  iconCache[kategori] = icon;
  return icon;
}

function warnaFasum(kat) {
  var colors = {
    'Sekolah':             '#27ae60',
    'Pasar':               '#e67e22',
    'Fasilitas Kesehatan': '#e74c3c',
    'Tempat Ibadah':       '#8e44ad',
    'Perkantoran':         '#2980b9'
  };
  return colors[kat] || '#34495e';
}

// ── CSV: FASILITAS UMUM ────────────────────────────────────────────
Papa.parse('fasilitas_umum.csv', {
  download: true,
  header: true,
  skipEmptyLines: true,
  complete: function (results) {
    var valid = (results.data || []).filter(function (r) {
      var lat = parseFloat(r.y_latitude);
      var lng = parseFloat(r.x_longitude);
      return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
    });

    document.getElementById('total-fasum').textContent = valid.length;

    valid.forEach(function (row) {
      var lat   = parseFloat(row.y_latitude);
      var lng   = parseFloat(row.x_longitude);
      var kat   = (row.kategori       || 'Umum').trim();
      var nama  = (row.nama_fasilitas || '-').trim();
      var warna = warnaFasum(kat);

      var marker = L.marker([lat, lng], { icon: getIcon(kat), riseOnHover: true });

      marker.bindTooltip(nama, { className: 'jalan-tooltip', direction: 'top', offset: [0, -30] });

      // Buat lingkaran jangkauan tapi JANGAN tambahkan ke map dulu
      var jangkauanCircles = [];
      [
        { field: 'jangkauan1_meter', opacity: 0.15, dashArray: null },
        { field: 'jangkauan2_meter', opacity: 0.08, dashArray: '6,4' },
        { field: 'jangkauan3_meter', opacity: 0.04, dashArray: '3,6' }
      ].forEach(function (j) {
        var r = parseFloat(row[j.field]);
        if (!isNaN(r) && r > 0) {
          jangkauanCircles.push(L.circle([lat, lng], {
            radius: r, color: warna, weight: 1.5,
            fillColor: warna, fillOpacity: j.opacity,
            dashArray: j.dashArray,
            interactive: false
          }));
        }
      });

      marker.on('click', function (e) {
        L.DomEvent.stopPropagation(e);

        // Sembunyikan jangkauan marker sebelumnya
        hideJangkauan();

        // Tampilkan jangkauan marker ini
        jangkauanCircles.forEach(function(c) {
          c.addTo(map);
          activeJangkauan.push(c);
        });

        tampilkanAtribut('🏢 ' + nama, [
          { key: 'Nama',      val: nama },
          { key: 'Kategori',  val: kat  },
          { key: 'Koordinat', val: lat.toFixed(6) + ', ' + lng.toFixed(6) }
        ]);
      });

      marker.addTo(layerFasum);
    });

    checkLoaded();
  },
  error: function (err) {
    console.error('Gagal memuat CSV:', err);
    tampilkanNotif('Gagal memuat data fasilitas umum.', 'error');
    checkLoaded();
  }
});

// ── BASEMAP SWITCHER ───────────────────────────────────────────────
document.querySelectorAll('.bm-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var bm = btn.getAttribute('data-bm');
    if (!tiles[bm]) return;
    Object.values(tiles).forEach(function (t) { map.removeLayer(t); });
    tiles[bm].addTo(map);
    tiles[bm].bringToBack();
    document.querySelectorAll('.bm-btn').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
  });
});

// ── LAYER TOGGLE ───────────────────────────────────────────────────
function setupToggle(id, layer) {
  var el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('change', function () {
    this.checked ? layer.addTo(map) : map.removeLayer(layer);
  });
}

setupToggle('tog-jalan',     layerJalan);
setupToggle('tog-kelurahan', layerKelurahan);
setupToggle('tog-fasum',     layerFasum);

// ── LEGENDA ────────────────────────────────────────────────────────
var legend = L.control({ position: 'bottomleft' });
legend.onAdd = function () {
  var div = L.DomUtil.create('div', 'map-legend');
  div.id  = 'map-legend-ctrl';
  div.innerHTML = buildLegendHTML([]);
  L.DomEvent.disableClickPropagation(div);
  L.DomEvent.disableScrollPropagation(div);
  return div;
};
legend.addTo(map);

function buildLegendHTML(kelurahanFeatures) {
  var html = [
    '<h4>Legenda</h4>',
    '<div class="legend-section">Kondisi Jalan</div>',
    '<div class="legend-row"><span class="lg-line" style="background:#27ae60"></span> Baik</div>',
    '<div class="legend-row"><span class="lg-line" style="background:#f39c12"></span> Kurang Baik</div>',
    '<div class="legend-row"><span class="lg-line" style="background:#e74c3c"></span> Tidak Baik</div>',
    '<div class="legend-section">Batas Kelurahan</div>'
  ];

  // Warna per kelurahan
  var namaList = kelurahanFeatures.length > 0
    ? kelurahanFeatures.map(function (f) { return (f.properties.NAMOBJ || '').trim(); })
    : Object.keys(KELURAHAN_COLORS);

  namaList.forEach(function (nama) {
    var c = KELURAHAN_COLORS[nama] || { color: '#7f8c8d', fill: '#95a5a6' };
    html.push(
      '<div class="legend-row">' +
      '<span class="lg-poly" style="border-color:' + c.color + ';background:' + c.fill + '22"></span> ' +
      escapeHtml(nama) +
      '</div>'
    );
  });

  html = html.concat([
    '<div class="legend-section">Fasilitas Umum</div>',
    '<div class="legend-row"><span style="font-size:15px;line-height:1">🎓</span> Sekolah</div>',
    '<div class="legend-row"><span style="font-size:15px;line-height:1">🛒</span> Pasar</div>',
    '<div class="legend-row"><span style="font-size:15px;line-height:1">➕</span> Fasilitas Kesehatan</div>',
    '<div class="legend-row"><span style="font-size:15px;line-height:1">🕌</span> Tempat Ibadah</div>',
    '<div class="legend-row"><span style="font-size:15px;line-height:1">🏢</span> Perkantoran</div>'
  ]);

  return html.join('');
}

function updateLegendaKelurahan(features) {
  var el = document.getElementById('map-legend-ctrl');
  if (el) el.innerHTML = buildLegendHTML(features);
}

// ── NOTIFIKASI TOAST ───────────────────────────────────────────────
function tampilkanNotif(pesan, tipe) {
  var toast = document.getElementById('toast-notif');
  if (!toast) return;
  toast.textContent = pesan;
  toast.className = 'toast-notif toast-' + (tipe || 'info') + ' show';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(function () { toast.classList.remove('show'); }, 3500);
}

// ── FIT BOUNDS ────────────────────────────────────────────────────
var _fitDone = false;
function tryFitBounds() {
  if (_fitDone) return;
  try {
    var target = geoKelurahan || geoJalan;
    if (target) {
      var bounds = target.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40] });
        _fitDone = true;
      }
    }
  } catch (e) { /* abaikan */ }
}
