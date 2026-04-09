/* =================================================================
   SIGAP PSU – Dinas Perumahan Rakyat Kab. Ngawi
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
var loadPending = 3;
function checkLoaded() {
  loadPending--;
  if (loadPending <= 0) {
    var overlay = document.getElementById('loading-overlay');
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity .4s ease';
    setTimeout(function () { overlay.style.display = 'none'; }, 400);
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
// FIX: return fallback agar tidak pernah undefined
function warnaKondisi(kondisi) {
  var k = (kondisi || '').trim().toUpperCase();
  if (k === 'BAIK')          return '#27ae60';
  if (k === 'RUSAK RINGAN')  return '#f9ca24';  // kuning
  if (k === 'RUSAK SEDANG')  return '#f0932b';  // orange
  if (k === 'RUSAK BERAT')   return '#e74c3c';
  return '#95a5a6'; // fallback kondisi tidak dikenal
}

// ── BADGE KONDISI ──────────────────────────────────────────────────
// FIX: nama class disesuaikan dengan style.css
function badgeKondisi(k) {
  var safe  = (k || '').trim();
  var upper = safe.toUpperCase();
  var cls;
  if (upper === 'BAIK')              cls = 'badge-baik';
  else if (upper === 'RUSAK RINGAN') cls = 'badge-rusak-ringan';
  else if (upper === 'RUSAK SEDANG') cls = 'badge-rusak-sedang';
  else if (upper === 'RUSAK BERAT')  cls = 'badge-rusak-berat';
  else                               cls = 'badge-unknown';
  return '<span class="badge-kondisi ' + cls + '">' + escapeHtml(safe || 'Tidak Diketahui') + '</span>';
}

// ── WARNA KELURAHAN ───────────────────────────────────────────────
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
    fillOpacity: 0,
    dashArray:   '6,5',
    interactive: false
  };
}

// ── INFO PANEL ─────────────────────────────────────────────────────
function tampilkanAtribut(judul, rows, tipe, extra) {
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

    // FIX: accentColor selalu punya nilai (tidak pernah undefined)
    var kondisiTeks = kondisiRow
      ? (kondisiRow.val || '').replace(/<[^>]+>/g, '').trim().toUpperCase()
      : '';
    var accentColor = kondisiTeks === 'BAIK'          ? '#27ae60'
                    : kondisiTeks === 'RUSAK RINGAN'  ? '#f9ca24'
                    : kondisiTeks === 'RUSAK SEDANG'  ? '#f0932b'
                    : kondisiTeks === 'RUSAK BERAT'   ? '#e74c3c'
                    : '#95a5a6';

    html += '<div class="jalan-card">';
    html += '<div class="jc-strip" style="background:' + accentColor + '"></div>';

    if (kondisiRow) {
      html += '<div class="jc-badge-wrap">' + kondisiRow.val + '</div>';
    }

    html += '<div class="jc-nama">' + escapeHtml(namaRow ? namaRow.val : '-') + '</div>';
    html += '<div class="jc-divider"></div>';

    var infoItems = [
      { icon: '📍', label: 'Kelurahan',   row: kelRow },
      { icon: '🏘️', label: 'Kecamatan',  row: kecamatanRow },
      { icon: '🏗️', label: 'Jenis Jalan', row: jenisRow },
      { icon: '🛣️', label: 'Permukaan',   row: permukaanRow },
      { icon: '↔️', label: 'Lebar',       row: lebarRow },
      { icon: '📏', label: 'Panjang',     row: panjangRow }
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

    if (!adaInfo) {
      rows.forEach(function(r) {
        if (r.key === 'Kondisi' || r.key === 'Nama Ruas') return;
        var valHtml = r.isHtml ? r.val : escapeHtml(r.val);
        html += '<div class="jc-row">'
              + '<span class="jc-row-icon">•</span>'
              + '<span class="jc-row-label">' + escapeHtml(r.key) + '</span>'
              + '<span class="jc-row-val">' + valHtml + '</span>'
              + '</div>';
      });
    }


    // ── KOORDINAT AWAL & AKHIR ─────────────────────────────────────
    if (extra) {
      var sx = extra.startX, sy = extra.startY, ex = extra.endX, ey = extra.endY;
      var hasStart = !isNaN(sx) && !isNaN(sy);
      var hasEnd   = !isNaN(ex) && !isNaN(ey);
      if (hasStart || hasEnd) {
        html += '<div class="jc-coord-box">'
              + '<span class="jc-coord-title">📌 Koordinat Ruas</span>';
        if (hasStart) {
          html += '<div class="jc-coord-row">'
                + '<span class="jc-coord-label">Awal</span>'
                + '<span class="jc-coord-val" title="Klik untuk salin" onclick="salinKoordinat(\'' + sy.toFixed(6) + ', ' + sx.toFixed(6) + '\')">'
                + sy.toFixed(6) + ', ' + sx.toFixed(6)
                + '</span></div>';
        }
        if (hasEnd) {
          if (hasStart) html += '<div class="jc-coord-divider"></div>';
          html += '<div class="jc-coord-row">'
                + '<span class="jc-coord-label">Akhir</span>'
                + '<span class="jc-coord-val" title="Klik untuk salin" onclick="salinKoordinat(\'' + ey.toFixed(6) + ', ' + ex.toFixed(6) + '\')">'
                + ey.toFixed(6) + ', ' + ex.toFixed(6)
                + '</span></div>';
        }
        html += '</div>';
      }

      // ── FOTO KONDISI JALAN ──────────────────────────────────────
      var fotoList = extra.fotoList || [];
      html += '<div class="jc-foto-box">'
            + '<div class="jc-foto-title"><span>📷</span> Foto Kondisi Jalan'
            + (fotoList.length > 1 ? ' <span class="jc-foto-count">(' + fotoList.length + ' foto)</span>' : '')
            + '</div>';
      if (fotoList.length > 0) {
        var fotoId = 'carousel-' + Date.now();
        html += '<div class="jc-carousel" id="' + fotoId + '" data-idx="0" data-total="' + fotoList.length + '">';
        // Slides
        html += '<div class="jc-carousel-track">';
        fotoList.forEach(function(src, i) {
          html += '<div class="jc-carousel-slide' + (i === 0 ? ' active' : '') + '">'
                + '<img class="jc-foto-img" src="' + escapeHtml(src) + '" alt="Foto ' + (i+1) + ' ' + escapeHtml(judul) + '" '
                + 'loading="lazy" '
                + 'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'" '
                + 'onclick="bukaLightbox(' + JSON.stringify(fotoList) + ',' + i + ')">'
                + '<div class="jc-foto-placeholder" style="display:none"><span>📷</span>Foto tidak tersedia</div>'
                + '</div>';
        });
        html += '</div>'; // track
        // Navigasi hanya jika lebih dari 1 foto
        if (fotoList.length > 1) {
          html += '<button class="jc-carousel-btn prev" onclick="geserKarousel(\'' + fotoId + '\',-1)" title="Foto sebelumnya">&#8249;</button>'
                + '<button class="jc-carousel-btn next" onclick="geserKarousel(\'' + fotoId + '\',1)" title="Foto berikutnya">&#8250;</button>'
                + '<div class="jc-carousel-dots">';
          for (var di = 0; di < fotoList.length; di++) {
            html += '<span class="jc-dot' + (di === 0 ? ' active' : '') + '" onclick="geserKarousel(\'' + fotoId + '\',' + (di) + ',true)"></span>';
          }
          html += '</div>'
                + '<div class="jc-carousel-counter"><span class="jc-cur">1</span>/<span>' + fotoList.length + '</span></div>';
        }
        html += '</div>'; // carousel
      } else {
        html += '<div class="jc-foto-placeholder"><span>📷</span>Belum ada foto untuk ruas ini</div>';
      }
      html += '</div>';
    }

    html += '</div>';

  } else {
    rows.forEach(function (r) {
      var valHtml = r.isHtml ? r.val : escapeHtml(r.val);
      html += '<div class="row-attr">'
            + '<span class="attr-key">' + escapeHtml(r.key) + '</span>'
            + '<span class="attr-val">' + valHtml + '</span>'
            + '</div>';
    });
  }

  document.getElementById('info-content').innerHTML = html;
  _showInfoPanel();
}

function closePanel() {
  document.getElementById('info-panel').classList.add('hidden');
  var lp = document.getElementById('layer-panel');
  if (lp) lp.classList.remove('behind');
  hideJangkauan();
}

function _showInfoPanel() {
  document.getElementById('info-panel').classList.remove('hidden');
  var lp = document.getElementById('layer-panel');
  if (lp) lp.classList.add('behind');
}

map.on('click', function () { closePanel(); });

// ── GEOJSON: JALAN ────────────────────────────────────────────────
var jalanStats = {
  count: 0, totalPanjang: 0,
  kondisi: { 'BAIK': 0, 'RUSAK RINGAN': 0, 'RUSAK SEDANG': 0, 'RUSAK BERAT': 0 },
  panjangKondisi: { 'BAIK': 0, 'RUSAK RINGAN': 0, 'RUSAK SEDANG': 0, 'RUSAK BERAT': 0 }
};

fetch('JALAN KELURAHAN.json')
  .then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  })
  .then(function (data) {
    if (!data || !Array.isArray(data.features)) throw new Error('Format tidak valid');

    jalanStats.count = data.features.length;
    initSearchIndex(data);
    data.features.forEach(function (f) {
      var p = f.properties || {};
      var panjang = parseFloat(p.PANJANG_JLN || p.PANJANG_JA || 0) || 0;
      var k = (p.KONDISI_JA || '').trim().toUpperCase();
      jalanStats.totalPanjang += panjang;
      if (jalanStats.kondisi[k] !== undefined) {
        jalanStats.kondisi[k]++;
        jalanStats.panjangKondisi[k] += panjang;
      }
    });

    document.getElementById('total-jalan').textContent = jalanStats.count;
    document.getElementById('total-panjang').textContent =
      jalanStats.totalPanjang >= 1000
        ? (jalanStats.totalPanjang / 1000).toFixed(2) + ' km'
        : jalanStats.totalPanjang.toFixed(0) + ' m';

    setupStatChipClick();

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
        var p         = f.properties || {};
        var nama      = (p.NAMA_RUAS   || '-').trim();
        var kondisi   = (p.KONDISI_JA  || '-').trim();
        var jenis     = (p.JENIS_JALA  || '-').trim();
        var kel       = (p.KELURAHAN   || p.DESA_KELUR || '-').trim();
        var kec       = (p.KECAMATAN   || '-').trim();
        var panjang   = parseFloat(p.PANJANG_JLN || 0) || 0;
        var lebar     = (p.LEBAR_JLN  || p.LEBAR || '').toString().trim();
        var permukaan = (p.PERMUKAAN   || p.JENIS_PERM || '').toString().trim();
        var ket       = (p.KETERANGAN  || p.KET || '').toString().trim();
        var fotoRaw   = (p.FOTO || p.PHOTO || p.GAMBAR || '').toString().trim();
        var fotoList  = fotoRaw ? fotoRaw.split('|').map(function(s){ return s.trim(); }).filter(Boolean) : [];
        var startX    = parseFloat(p.START_X);
        var startY    = parseFloat(p.START_Y);
        var endX      = parseFloat(p.END_X);
        var endY      = parseFloat(p.END_Y);

        layer.bindTooltip(nama, {
          permanent: false,
          className: 'jalan-tooltip',
          direction: 'top',
          sticky:    true
        });

        layer.on('click', function (e) {
          L.DomEvent.stopPropagation(e);
          var rowData = [
            { key: 'Nama Ruas',    val: nama },
            { key: 'Kelurahan',    val: kel },
            { key: 'Kecamatan',    val: kec },
            { key: 'Kondisi',      val: badgeKondisi(kondisi), isHtml: true },
            { key: 'Jenis Jalan',  val: jenis },
            { key: 'Permukaan',    val: permukaan || '-' },
            { key: 'Lebar',        val: lebar ? lebar + ' m' : '-' },
            { key: 'Panjang',      val: panjang > 0 ? panjang.toFixed(0) + ' m' : '-' }
          ];
          if (ket && ket !== '-') rowData.push({ key: 'Keterangan', val: ket });
          tampilkanAtribut('🛣️ ' + nama, rowData, 'jalan', {
            startX: startX, startY: startY,
            endX: endX, endY: endY,
            fotoList: fotoList
          });
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

// ── GEOJSON: batas_kelurahan ──────────────────────────────────────
// FIX: batas_kelurahan.json sudah GeoJSON standar, tidak perlu konversi ESRI
fetch('batas_kelurahan.json')
  .then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  })
  .then(function (data) {
    geoKelurahan = L.geoJSON(data, {
      style: function (feature) {
        var nama = (feature.properties.NAMOBJ || '').trim();
        return getKelurahanStyle(nama);
      }
    }).addTo(layerKelurahan);

    updateLegendaKelurahan(data.features);
    checkLoaded();
  })
  .catch(function (err) {
    console.error('Gagal memuat batas_kelurahan.json:', err);
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

// ── FASUM STATS ───────────────────────────────────────────────────
var fasumStats = {
  total: 0,
  kategori: {}
};

// ── CSV: FASILITAS UMUM ────────────────────────────────────────────
Papa.parse('fasilitas_umum.csv', {
  download:       true,
  header:         true,
  skipEmptyLines: true,
  // FIX: trim header dan nilai agar spasi di CSV tidak merusak parsing
  transformHeader: function(h) { return h.trim(); },
  transform:       function(v) { return v.trim(); },
  complete: function (results) {
    var valid = (results.data || []).filter(function (r) {
      var lat = parseFloat(r.y_latitude);
      var lng = parseFloat(r.x_longitude);
      return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
    });

    document.getElementById('total-fasum').textContent = valid.length;
    fasumStats.total = valid.length;
    fasumStats.kategori = {};
    valid.forEach(function(r) {
      var kat = (r.kategori || 'Umum').trim();
      kat = kat.charAt(0).toUpperCase() + kat.slice(1);
      fasumStats.kategori[kat] = (fasumStats.kategori[kat] || 0) + 1;
    });

    valid.forEach(function (row) {
      var lat   = parseFloat(row.y_latitude);
      var lng   = parseFloat(row.x_longitude);
      var kat   = (row.kategori       || 'Umum').trim();
      kat = kat.charAt(0).toUpperCase() + kat.slice(1);
      var nama  = (row.nama_fasilitas || '-').trim();
      var warna = warnaFasum(kat);

      var marker = L.marker([lat, lng], { icon: getIcon(kat), riseOnHover: true });
      marker.bindTooltip(nama, { className: 'jalan-tooltip', direction: 'top', offset: [0, -30] });

      var jangkauanCircles = [];
      [
        { field: 'jangkauan1_meter', opacity: 0.15, dashArray: null },
        { field: 'jangkauan2_meter', opacity: 0.08, dashArray: '6,4' },
        { field: 'jangkauan3_meter', opacity: 0.04, dashArray: '3,6' }
      ].forEach(function (j) {
        var r = parseFloat(row[j.field]);
        if (!isNaN(r) && r > 0) {
          jangkauanCircles.push(L.circle([lat, lng], {
            radius:      r,
            color:       warna,
            weight:      1.5,
            fillColor:   warna,
            fillOpacity: j.opacity,
            dashArray:   j.dashArray,
            interactive: false
          }));
        }
      });

      marker.on('click', function (e) {
        L.DomEvent.stopPropagation(e);
        hideJangkauan();
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

    setupStatChipClick();
    checkLoaded();
  },
  error: function (err) {
    console.error('Gagal memuat CSV:', err);
    tampilkanNotif('Gagal memuat data fasilitas umum.', 'error');
    checkLoaded();
  }
});

// ── STAT CHIP KONDISI BREAKDOWN ────────────────────────────────────
function setupStatChipClick() {
  // jalan chip → kondisi jalan + jumlah segmen
  var chipJalan = document.querySelector('.stat-chip[data-stat="jalan"]');
  if (chipJalan) {
    chipJalan.style.cursor = 'pointer';
    chipJalan.setAttribute('title', 'Klik untuk lihat kondisi & jumlah segmen jalan');
    chipJalan.addEventListener('click', function(e) {
      e.stopPropagation();
      tampilkanBreakdownSegmen();
    });
  }
  // panjang chip → kondisi jalan + total panjang
  var chipPanjang = document.querySelector('.stat-chip[data-stat="panjang"]');
  if (chipPanjang) {
    chipPanjang.style.cursor = 'pointer';
    chipPanjang.setAttribute('title', 'Klik untuk lihat kondisi & total panjang jalan');
    chipPanjang.addEventListener('click', function(e) {
      e.stopPropagation();
      tampilkanBreakdownPanjang();
    });
  }
  // fasum chip → rincian fasilitas umum
  var chipFasum = document.querySelector('.stat-chip[data-stat="fasum"]');
  if (chipFasum) {
    chipFasum.style.cursor = 'pointer';
    chipFasum.setAttribute('title', 'Klik untuk lihat rincian fasilitas umum');
    chipFasum.addEventListener('click', function(e) {
      e.stopPropagation();
      tampilkanBreakdownFasum();
    });
  }
}

// Chip "Segmen Jalan" → kondisi jalan + jumlah segmen saja
function tampilkanBreakdownSegmen() {
  var defs = [
    { key: 'BAIK',         label: 'Baik',         color: '#27ae60', icon: '✅' },
    { key: 'RUSAK RINGAN', label: 'Rusak Ringan',  color: '#f9ca24', icon: '🟡' },
    { key: 'RUSAK SEDANG', label: 'Rusak Sedang',  color: '#f0932b', icon: '🟠' },
    { key: 'RUSAK BERAT',  label: 'Rusak Berat',   color: '#e74c3c', icon: '🔴' }
  ];

  var totalSeg = jalanStats.count || 0;
  var html = '<div class="breakdown-wrap">';

  // Bar chart proporsi
  html += '<div class="bk-bar-stack">';
  defs.forEach(function(d) {
    var pct = totalSeg > 0 ? (jalanStats.kondisi[d.key] / totalSeg * 100) : 0;
    if (pct > 0) {
      html += '<div class="bk-bar-seg" style="width:' + pct.toFixed(1) + '%;background:' + d.color + '" '
            + 'title="' + d.label + ': ' + pct.toFixed(1) + '%"></div>';
    }
  });
  html += '</div>';

  // Tabel: kondisi + jumlah segmen saja
  html += '<div class="bk-table">';
  defs.forEach(function(d) {
    var jml = jalanStats.kondisi[d.key] || 0;
    html += '<div class="bk-row">'
          + '<span class="bk-dot" style="background:' + d.color + '"></span>'
          + '<span class="bk-label">' + d.label + '</span>'
          + '<span class="bk-count">' + jml + ' segmen</span>'
          + '</div>';
  });
  html += '</div>';

  // Total segmen
  html += '<div class="bk-total">'
        + '<span>Total Segmen Jalan</span>'
        + '<span><b>' + totalSeg + ' segmen</b></span>'
        + '</div>';

  html += '</div>';

  document.getElementById('info-title').textContent = '🛣️ Kondisi & Jumlah Segmen Jalan';
  document.getElementById('info-content').innerHTML = html;
  _showInfoPanel();
}

// Chip "Total Panjang" → kondisi jalan + total panjang saja
function tampilkanBreakdownPanjang() {
  var defs = [
    { key: 'BAIK',         label: 'Baik',         color: '#27ae60', icon: '✅' },
    { key: 'RUSAK RINGAN', label: 'Rusak Ringan',  color: '#f9ca24', icon: '🟡' },
    { key: 'RUSAK SEDANG', label: 'Rusak Sedang',  color: '#f0932b', icon: '🟠' },
    { key: 'RUSAK BERAT',  label: 'Rusak Berat',   color: '#e74c3c', icon: '🔴' }
  ];

  var totalPjg = jalanStats.totalPanjang || 0;
  var html = '<div class="breakdown-wrap">';

  // Bar chart proporsi berdasarkan panjang
  html += '<div class="bk-bar-stack">';
  defs.forEach(function(d) {
    var pjg = jalanStats.panjangKondisi[d.key] || 0;
    var pct = totalPjg > 0 ? (pjg / totalPjg * 100) : 0;
    if (pct > 0) {
      html += '<div class="bk-bar-seg" style="width:' + pct.toFixed(1) + '%;background:' + d.color + '" '
            + 'title="' + d.label + ': ' + pct.toFixed(1) + '%"></div>';
    }
  });
  html += '</div>';

  // Tabel: kondisi + total panjang saja
  html += '<div class="bk-table">';
  defs.forEach(function(d) {
    var pjg    = jalanStats.panjangKondisi[d.key] || 0;
    var pjgTxt = pjg >= 1000 ? (pjg/1000).toFixed(2) + ' km' : pjg.toFixed(0) + ' m';
    html += '<div class="bk-row">'
          + '<span class="bk-dot" style="background:' + d.color + '"></span>'
          + '<span class="bk-label">' + d.label + '</span>'
          + '<span class="bk-panjang">' + pjgTxt + '</span>'
          + '</div>';
  });
  html += '</div>';

  // Total panjang
  var totalPjgTxt = totalPjg >= 1000 ? (totalPjg/1000).toFixed(2) + ' km' : totalPjg.toFixed(0) + ' m';
  html += '<div class="bk-total">'
        + '<span>Total Panjang Jalan</span>'
        + '<span><b>' + totalPjgTxt + '</b></span>'
        + '</div>';

  html += '</div>';

  document.getElementById('info-title').textContent = '📏 Kondisi & Total Panjang Jalan';
  document.getElementById('info-content').innerHTML = html;
  _showInfoPanel();
}

// Tetap ada untuk backward compatibility (tidak dipakai lagi)
function tampilkanBreakdownKondisi() { tampilkanBreakdownSegmen(); }

// ── BREAKDOWN FASILITAS UMUM ───────────────────────────────────────
function tampilkanBreakdownFasum() {
  var defs = [
    { key: 'Sekolah',             icon: '🎓', color: '#27ae60' },
    { key: 'Pasar',               icon: '🛒', color: '#e67e22' },
    { key: 'Fasilitas Kesehatan', icon: '🏥', color: '#e74c3c' },
    { key: 'Tempat Ibadah',       icon: '🕌', color: '#8e44ad' },
    { key: 'Perkantoran',         icon: '🏢', color: '#2980b9' }
  ];

  var total = fasumStats.total || 0;
  var html = '<div class="breakdown-wrap">';

  // Tabel sederhana: ikon + nama kategori + jumlah unit saja
  html += '<div class="bk-table">';
  defs.forEach(function(d) {
    var jml = fasumStats.kategori[d.key] || 0;
    html += '<div class="bk-row">'
          + '<span class="bk-dot" style="background:' + d.color + '">' + d.icon + '</span>'
          + '<span class="bk-label">' + escapeHtml(d.key) + '</span>'
          + '<span class="bk-count" style="color:' + d.color + '">' + jml + ' unit</span>'
          + '</div>';
  });
  html += '</div>';

  // Total
  html += '<div class="bk-total">'
        + '<span>Total Fasilitas Umum</span>'
        + '<span><b>' + total + ' unit</b></span>'
        + '</div>';

  html += '</div>';

  document.getElementById('info-title').textContent = '🏫 Jumlah Fasilitas Umum';
  document.getElementById('info-content').innerHTML = html;
  _showInfoPanel();
}

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
    '<div class="legend-row"><span class="lg-line" style="background:#f9ca24"></span> Rusak Ringan</div>',
    '<div class="legend-row"><span class="lg-line" style="background:#f0932b"></span> Rusak Sedang</div>',
    '<div class="legend-row"><span class="lg-line" style="background:#e74c3c"></span> Rusak Berat</div>',
    '<div class="legend-section">Batas Kelurahan</div>'
  ];

  var namaList = kelurahanFeatures.length > 0
    ? kelurahanFeatures.map(function (f) { return (f.properties.NAMOBJ || '').trim(); })
    : Object.keys(KELURAHAN_COLORS);

  namaList.forEach(function (nama) {
    var c = KELURAHAN_COLORS[nama] || { color: '#7f8c8d', fill: '#95a5a6' };
    html.push(
      '<div class="legend-row">' +
      '<span class="lg-dashed" style="border-top-color:' + c.color + '"></span> ' +
      escapeHtml(nama) +
      '</div>'
    );
  });

  var fasumDefs = [
    { icon: '🎓', label: 'Sekolah',             color: '#27ae60' },
    { icon: '🛒', label: 'Pasar',               color: '#e67e22' },
    { icon: '🏥', label: 'Fasilitas Kesehatan', color: '#e74c3c' },
    { icon: '🕌', label: 'Tempat Ibadah',       color: '#8e44ad' },
    { icon: '🏢', label: 'Perkantoran',         color: '#2980b9' }
  ];
  html.push('<div class="legend-section">Fasilitas Umum</div>');
  html.push('<div class="lg-fasum-list">');
  fasumDefs.forEach(function(f) {
    html.push(
      '<div class="lg-fasum-item-row">' +
      '<span class="lg-fasum-icon" style="background:' + f.color + '22;border-color:' + f.color + '40">' + f.icon + '</span>' +
      '<span class="lg-fasum-label">' + f.label + '</span>' +
      '</div>'
    );
  });
  html.push('</div>');

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

// ── SALIN KOORDINAT ───────────────────────────────────────────────
function salinKoordinat(teks) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(teks).then(function() {
      tampilkanNotif('Koordinat disalin: ' + teks, 'info');
    });
  } else {
    var el = document.createElement('textarea');
    el.value = teks;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    tampilkanNotif('Koordinat disalin: ' + teks, 'info');
  }
}

// ── LIGHTBOX FOTO (multi-foto) ────────────────────────────────────
function bukaLightbox(srcs, idx) {
  // srcs bisa array atau string tunggal (backward compat)
  var list = Array.isArray(srcs) ? srcs : [srcs];
  var cur  = typeof idx === 'number' ? idx : 0;

  function renderLb() {
    var lb = document.getElementById('foto-lightbox');
    lb.innerHTML =
      '<button id="foto-lightbox-close" title="Tutup">✕</button>'
      + '<img src="' + escapeHtml(list[cur]) + '" alt="Foto ' + (cur+1) + '">'
      + (list.length > 1
          ? '<div class="lb-nav">'
            + '<button class="lb-btn" id="lb-prev">&#8249;</button>'
            + '<span class="lb-counter">' + (cur+1) + ' / ' + list.length + '</span>'
            + '<button class="lb-btn" id="lb-next">&#8250;</button>'
            + '</div>'
          : '');

    document.getElementById('foto-lightbox-close').onclick = tutupLb;
    if (list.length > 1) {
      document.getElementById('lb-prev').onclick = function(e) {
        e.stopPropagation();
        cur = (cur - 1 + list.length) % list.length;
        renderLb();
      };
      document.getElementById('lb-next').onclick = function(e) {
        e.stopPropagation();
        cur = (cur + 1) % list.length;
        renderLb();
      };
    }
  }

  function tutupLb() {
    var el = document.getElementById('foto-lightbox');
    if (el) document.body.removeChild(el);
    document.removeEventListener('keydown', lbKey);
  }

  function lbKey(e) {
    if (e.key === 'Escape') { tutupLb(); }
    else if (e.key === 'ArrowRight') { cur = (cur+1) % list.length; renderLb(); }
    else if (e.key === 'ArrowLeft')  { cur = (cur-1+list.length) % list.length; renderLb(); }
  }

  // Buat elemen lightbox
  var lb = document.createElement('div');
  lb.id = 'foto-lightbox';
  document.body.appendChild(lb);
  lb.addEventListener('click', function(e) { if (e.target === lb) tutupLb(); });
  document.addEventListener('keydown', lbKey);
  renderLb();
}

// ── CAROUSEL PANEL INFO ───────────────────────────────────────────
function geserKarousel(id, val, isDirect) {
  var el    = document.getElementById(id);
  if (!el) return;
  var total = parseInt(el.getAttribute('data-total'));
  var cur   = parseInt(el.getAttribute('data-idx'));
  var next  = isDirect ? val : (cur + val + total) % total;

  // Sembunyikan slide lama, tampilkan baru
  var slides = el.querySelectorAll('.jc-carousel-slide');
  var dots   = el.querySelectorAll('.jc-dot');
  var counter = el.querySelector('.jc-cur');

  if (slides[cur]) slides[cur].classList.remove('active');
  if (dots[cur])   dots[cur].classList.remove('active');
  if (slides[next]) slides[next].classList.add('active');
  if (dots[next])   dots[next].classList.add('active');
  if (counter)      counter.textContent = next + 1;

  el.setAttribute('data-idx', next);
}

// ── SEARCH ENGINE ─────────────────────────────────────────────────
var allJalanFeatures = [];   // populated setelah GeoJSON jalan dimuat
var searchDebounce  = null;

// Simpan semua layer jalan beserta feature-nya untuk navigasi
var jalanLayerMap = [];      // [{ feature, layer }]

// Patch: setelah geoJalan selesai dibuat, kumpulkan layer map
// (dipanggil dari dalam then() chain data jalan)
function initSearchIndex(data) {
  allJalanFeatures = data.features || [];
}

// Fungsi memanggil search index
function setupSearch() {
  var input   = document.getElementById('search-input');
  var results = document.getElementById('search-results');
  var clearBtn = document.getElementById('search-clear');

  if (!input || !results) return;

  input.addEventListener('input', function() {
    var q = this.value.trim();
    clearBtn.classList.toggle('hidden', q.length === 0);
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(function() { runSearch(q); }, 180);
  });

  input.addEventListener('keydown', function(e) {
    var items = results.querySelectorAll('li:not(.search-empty)');
    var active = results.querySelector('li.active');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!active) { if(items[0]) items[0].classList.add('active'); }
      else {
        active.classList.remove('active');
        var next = active.nextElementSibling;
        if (next && !next.classList.contains('search-empty')) next.classList.add('active');
        else if(items[0]) items[0].classList.add('active');
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!active) { if(items[items.length-1]) items[items.length-1].classList.add('active'); }
      else {
        active.classList.remove('active');
        var prev = active.previousElementSibling;
        if (prev) prev.classList.add('active');
        else if(items[items.length-1]) items[items.length-1].classList.add('active');
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      var act = results.querySelector('li.active');
      if (act) act.click();
    } else if (e.key === 'Escape') {
      tutupSearch();
    }
  });

  clearBtn.addEventListener('click', function() {
    input.value = '';
    clearBtn.classList.add('hidden');
    tutupSearch();
    input.focus();
  });

  // Klik di luar → tutup
  document.addEventListener('click', function(e) {
    var box = document.getElementById('search-box');
    if (box && !box.contains(e.target)) tutupSearch();
  });
}

function tutupSearch() {
  var results = document.getElementById('search-results');
  if (results) results.classList.add('hidden');
}

function runSearch(q) {
  var results = document.getElementById('search-results');
  if (!results) return;

  if (!q || q.length < 2) {
    results.classList.add('hidden');
    results.innerHTML = '';
    return;
  }

  var lower = q.toLowerCase();
  var hits = allJalanFeatures.filter(function(f) {
    var p = f.properties || {};
    var nama = (p.NAMA_RUAS || '').toLowerCase();
    var kel  = (p.KELURAHAN || '').toLowerCase();
    return nama.includes(lower) || kel.includes(lower);
  }).slice(0, 10);

  if (hits.length === 0) {
    results.innerHTML = '<li class="search-empty">Tidak ditemukan hasil untuk <b>' + escapeHtml(q) + '</b></li>';
    results.classList.remove('hidden');
    return;
  }

  results.innerHTML = '';
  hits.forEach(function(f) {
    var p       = f.properties || {};
    var nama    = (p.NAMA_RUAS  || '-').trim();
    var kel     = (p.KELURAHAN  || '-').trim();
    var kondisi = (p.KONDISI_JA || '-').trim();
    var panjang = parseFloat(p.PANJANG_JLN || p.PANJANG_JA || 0) || 0;
    var warna   = warnaKondisi(kondisi);

    var li = document.createElement('li');
    li.setAttribute('role', 'option');
    li.innerHTML = '<span class="sr-nama">' + escapeHtml(nama) + '</span>'
      + '<span class="sr-meta">'
      + '<span class="sr-kondisi-dot" style="background:' + warna + '"></span>'
      + escapeHtml(kondisi) + ' • ' + escapeHtml(kel)
      + (panjang > 0 ? ' • ' + panjang.toFixed(0) + ' m' : '')
      + '</span>';

    li.addEventListener('click', function() {
      zoomKeJalan(f);
      tutupSearch();
      document.getElementById('search-input').value = nama;
    });

    results.appendChild(li);
  });

  results.classList.remove('hidden');
}

function zoomKeJalan(feature) {
  try {
    // Cari layer yang sesuai di geoJalan
    var targetLayer = null;
    if (geoJalan) {
      geoJalan.eachLayer(function(layer) {
        if (layer.feature === feature) targetLayer = layer;
      });
    }

    // Hitung bounds dari geometry
    var coords = feature.geometry.coordinates;
    var latlngs = coords.map(function(c) { return [c[1], c[0]]; });
    var bounds = L.latLngBounds(latlngs);

    map.fitBounds(bounds, { padding: [80, 80], maxZoom: 18 });

    if (targetLayer) {
      // Flash highlight
      var orig = { weight: 4, opacity: 0.9 };
      targetLayer.setStyle({ weight: 9, opacity: 1, color: '#fff' });
      setTimeout(function() {
        targetLayer.setStyle({ weight: 8, opacity: 1, color: warnaKondisi(feature.properties.KONDISI_JA) });
        setTimeout(function() { targetLayer.setStyle(orig); }, 400);
      }, 300);

      // Tampilkan info panel
      var p         = feature.properties || {};
      var nama      = (p.NAMA_RUAS   || '-').trim();
      var kondisi   = (p.KONDISI_JA  || '-').trim();
      var jenis     = (p.JENIS_JALA  || '-').trim();
      var kel       = (p.KELURAHAN   || '-').trim();
      var kec       = (p.KECAMATAN   || '-').trim();
      var panjang   = parseFloat(p.PANJANG_JLN || p.PANJANG_JA || 0) || 0;
      var lebar     = (p.LEBAR_JLN  || p.LEBAR || '').toString().trim();
      var permukaan = (p.PERMUKAAN   || '').toString().trim();
      var ket       = (p.KETERANGAN  || '').toString().trim();
      var fotoRaw   = (p.FOTO || p.PHOTO || p.GAMBAR || '').toString().trim();
      var fotoList  = fotoRaw ? fotoRaw.split('|').map(function(s){ return s.trim(); }).filter(Boolean) : [];
      var startX    = parseFloat(p.START_X);
      var startY    = parseFloat(p.START_Y);
      var endX      = parseFloat(p.END_X);
      var endY      = parseFloat(p.END_Y);

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
      tampilkanAtribut('🛣️ ' + nama, rowData, 'jalan', {
        startX: startX, startY: startY,
        endX: endX, endY: endY,
        fotoList: fotoList
      });
    }
  } catch(e) { console.warn('zoomKeJalan error:', e); }
}

// Panggil setupSearch setelah DOM siap
document.addEventListener('DOMContentLoaded', function() {
  setupSearch();
});
