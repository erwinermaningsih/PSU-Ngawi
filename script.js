/* =================================================================
   WebGIS PSU Jalan – Dinas Perumahan Rakyat Kab. Ngawi
   Koreksi & Penyempurnaan: bug fix + fitur lengkap
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
  center: [-7.4, 111.45],
  zoom: 14,
  zoomControl: false,   // BUG FIX: matikan default lalu tambahkan manual di posisi kanan atas
  layers: [tiles.satellite]
});

// Tambahkan zoom control di pojok kanan atas agar tidak tumpang-tindih legenda
L.control.zoom({ position: 'topright' }).addTo(map);

L.control.scale({ imperial: false, position: 'bottomright' }).addTo(map);

// ── LAYER GROUPS ───────────────────────────────────────────────────
var layerJalan     = L.layerGroup().addTo(map);
var layerKelurahan = L.layerGroup().addTo(map);
var layerFasum     = L.layerGroup().addTo(map);

// Simpan referensi GeoJSON layer jalan untuk reset style
var geoJalan = null;

// ── LOADING COUNTER ────────────────────────────────────────────────
var loadPending = 3;
function checkLoaded() {
  loadPending--;
  if (loadPending <= 0) {
    var overlay = document.getElementById('loading-overlay');
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity .4s ease';
    setTimeout(function () { overlay.style.display = 'none'; }, 400);
  }
}

// ── HELPER: SANITIZE HTML (XSS prevention) ───────────────────────
function escapeHtml(str) {
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(String(str)));
  return div.innerHTML;
}

// ── WARNA KONDISI JALAN ────────────────────────────────────────────
// BUG FIX: nama fungsi sebelumnya menggunakan karakter Cyrillic 'а' (bukan Latin 'a')
// sehingga fungsi tidak terpanggil dengan benar → diperbaiki ke ASCII murni
function warnaKondisi(kondisi) {
  var k = (kondisi || '').trim().toLowerCase();
  if (k === 'baik')                        return '#27ae60';
  if (k === 'sedang')                      return '#f39c12';
  if (k === 'rusak berat' || k === 'rusak') return '#e74c3c';
  return '#95a5a6'; // default abu-abu (bukan merah) supaya lebih netral
}

// ── WARNA TIPE PERKERASAN ──────────────────────────────────────────
function warnaTipe(tipe) {
  var t = (tipe || '').trim().toLowerCase();
  if (t.includes('aspal'))  return '#2c3e50';
  if (t.includes('beton'))  return '#7f8c8d';
  if (t.includes('paving')) return '#e67e22';
  if (t.includes('tanah'))  return '#8B4513';
  return '#95a5a6';
}

// ── INFO PANEL ─────────────────────────────────────────────────────
function tampilkanAtribut(judul, rows) {
  document.getElementById('info-title').textContent = judul;
  var html = '';
  rows.forEach(function (r) {
    // BUG FIX: r.val yang sudah berupa HTML (badge) tidak perlu di-escape,
    // sedangkan teks biasa perlu di-escape untuk keamanan
    var valHtml = r.isHtml ? r.val : escapeHtml(r.val);
    html += '<div class="row-attr">'
          + '<span class="attr-key">' + escapeHtml(r.key) + '</span>'
          + '<span class="attr-val">' + valHtml + '</span>'
          + '</div>';
  });
  document.getElementById('info-content').innerHTML = html;
  document.getElementById('info-panel').classList.remove('hidden');
}

function closePanel() {
  document.getElementById('info-panel').classList.add('hidden');
}

// Tutup panel saat klik di luar (di peta)
map.on('click', function () { closePanel(); });

// ── BADGE KONDISI ──────────────────────────────────────────────────
// BUG FIX: CSS class sebelumnya tidak menangani variasi "Rusak Berat"
function badgeKondisi(k) {
  var safe = (k || '').trim();
  var cls;
  var lower = safe.toLowerCase();
  if (lower === 'baik')                        cls = 'badge-Baik';
  else if (lower === 'sedang')                 cls = 'badge-Sedang';
  else if (lower.includes('rusak'))            cls = 'badge-Rusak';
  else                                          cls = 'badge-Unknown';
  return '<span class="badge-kondisi ' + cls + '">' + escapeHtml(safe) + '</span>';
}

// ── GEOJSON: JALAN ─────────────────────────────────────────────────
var jalanStats = { count: 0, totalPanjang: 0 };

fetch('Jalan.geojson')
  .then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  })
  .then(function (data) {
    if (!data || !Array.isArray(data.features)) {
      throw new Error('Format GeoJSON tidak valid');
    }

    jalanStats.count = data.features.length;

    data.features.forEach(function (f) {
      // BUG FIX: property 'Panjang Jln' memiliki spasi trailing; tangani kedua kemungkinan
      var p       = f.properties || {};
      var panjang = parseFloat(p['Panjang Jln'] || p['Panjang Jln '] || 0) || 0;
      jalanStats.totalPanjang += panjang;
    });

    // Update topbar stats
    document.getElementById('total-jalan').textContent = jalanStats.count;
    document.getElementById('total-panjang').textContent =
      jalanStats.totalPanjang >= 1000
        ? (jalanStats.totalPanjang / 1000).toFixed(2) + ' km'
        : jalanStats.totalPanjang.toFixed(0) + ' m';

    geoJalan = L.geoJSON(data, {
      style: function (feature) {
        // BUG FIX: Panggil warnaKondisi (bukan warnаKondisi dengan karakter Cyrillic)
        var kondisi = (feature.properties['Kondisi Jalan '] || feature.properties['Kondisi Jalan'] || '').trim();
        return {
          color: warnaKondisi(kondisi),
          weight: 5,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round'
        };
      },
      onEachFeature: function (f, layer) {
        var p       = f.properties || {};
        // BUG FIX: trim property key (ada trailing space di 'Kondisi Jalan ')
        var kondisi = (p['Kondisi Jalan '] || p['Kondisi Jalan'] || '-').trim();
        var tipe    = (p['Tipe Perkerasan'] || '-').trim();
        var fungsi  = (p['Fungsi Jalan']    || '-').trim();
        var panjang = parseFloat(p['Panjang Jln'] || p['Panjang Jln '] || 0) || 0;

        layer.bindTooltip(fungsi || 'Jalan PSU', {
          permanent: false,
          className: 'jalan-tooltip',
          direction: 'top',
          sticky: true
        });

        layer.on('click', function (e) {
          L.DomEvent.stopPropagation(e);
          tampilkanAtribut('🛣️ Detail Ruas Jalan', [
            { key: 'Fungsi Jalan',    val: fungsi },
            { key: 'Kondisi',         val: badgeKondisi(kondisi), isHtml: true },
            { key: 'Tipe Perkerasan', val: tipe },
            { key: 'Panjang',         val: panjang.toFixed(2) + ' m' }
          ]);
        });

        layer.on('mouseover', function () {
          layer.setStyle({ weight: 8, opacity: 1 });
          layer.bringToFront();
        });
        layer.on('mouseout', function () {
          layer.setStyle({ weight: 5, opacity: 0.9 });
        });
      }
    }).addTo(layerJalan);

    checkLoaded();
  })
  .catch(function (err) {
    console.error('Gagal memuat Jalan.geojson:', err);
    tampilkanNotif('Gagal memuat data jalan. Pastikan file Jalan.geojson tersedia.', 'error');
    checkLoaded();
  });

// ── GEOJSON: KELURAHAN ─────────────────────────────────────────────
fetch('kelurahankarangtengah.geojson')
  .then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  })
  .then(function (data) {
    if (!data || !Array.isArray(data.features)) {
      throw new Error('Format GeoJSON tidak valid');
    }

    var styleDefault = {
      color: '#2980b9',
      weight: 1.5,
      opacity: 0.7,
      fillColor: '#3498db',
      fillOpacity: 0.06
    };

    L.geoJSON(data, {
      style: styleDefault,
      onEachFeature: function (f, layer) {
        var p    = f.properties || {};
        // BUG FIX: cek berbagai kemungkinan nama field (KELURAHAN atau NAMOBJ)
        var nama = (p.KELURAHAN || p.NAMOBJ || p.DESA || '-').trim();
        var kec  = (p.KECAMATAN || p.KECAMATAN_ || '-').trim();
        // BUG FIX: cek berbagai field luas
        var luas = parseFloat(p.LUASPETA || p.LUASTERTUL || p.LUAS || 0) || 0;

        layer.bindTooltip(nama, {
          sticky: true,
          className: 'jalan-tooltip',
          direction: 'top'
        });

        layer.on('click', function (e) {
          L.DomEvent.stopPropagation(e);
          tampilkanAtribut('📍 Kelurahan ' + nama, [
            { key: 'Kelurahan',  val: nama },
            { key: 'Kecamatan',  val: kec },
            { key: 'Luas Peta',  val: luas > 0 ? luas.toFixed(2) + ' m²' : '-' }
          ]);
        });

        layer.on('mouseover', function () {
          layer.setStyle({ fillOpacity: 0.15, weight: 2.5 });
        });
        layer.on('mouseout', function () {
          layer.setStyle(styleDefault);
        });
      }
    }).addTo(layerKelurahan);

    checkLoaded();
  })
  .catch(function (err) {
    console.error('Gagal memuat kelurahan GeoJSON:', err);
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

// ── WARNA FASILITAS ────────────────────────────────────────────────
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
  // BUG FIX: skipEmptyLines agar baris kosong tidak menghasilkan marker invalid
  skipEmptyLines: true,
  complete: function (results) {
    if (results.errors && results.errors.length) {
      console.warn('CSV parse warnings:', results.errors);
    }

    var valid = (results.data || []).filter(function (r) {
      var lat = parseFloat(r.y_latitude);
      var lng = parseFloat(r.x_longitude);
      return !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
    });

    document.getElementById('total-fasum').textContent = valid.length;

    valid.forEach(function (row) {
      var lat  = parseFloat(row.y_latitude);
      var lng  = parseFloat(row.x_longitude);
      var kat  = (row.kategori        || 'Umum').trim();
      var nama = (row.nama_fasilitas  || '-').trim();
      var warna = warnaFasum(kat);

      var marker = L.marker([lat, lng], { icon: getIcon(kat), riseOnHover: true });

      marker.bindTooltip(nama, {
        className: 'jalan-tooltip',
        direction: 'top',
        offset: [0, -30]
      });

      marker.on('click', function (e) {
        L.DomEvent.stopPropagation(e);
        tampilkanAtribut('🏢 ' + nama, [
          { key: 'Nama',     val: nama },
          { key: 'Kategori', val: kat },
          { key: 'Koordinat', val: lat.toFixed(6) + ', ' + lng.toFixed(6) }
        ]);
      });

      marker.addTo(layerFasum);

      // Lingkaran jangkauan (3 zona)
      var jangkauanList = [
        { field: 'jangkauan1_meter', opacity: 0.12 },
        { field: 'jangkauan2_meter', opacity: 0.07 },
        { field: 'jangkauan3_meter', opacity: 0.04 }
      ];

      jangkauanList.forEach(function (j) {
        var r = parseFloat(row[j.field]);
        if (!isNaN(r) && r > 0) {
          L.circle([lat, lng], {
            radius: r,
            color: warna,
            weight: 1,
            fillColor: warna,
            fillOpacity: j.opacity,
            interactive: false  // BUG FIX: lingkaran tidak blokir klik marker
          }).addTo(layerFasum);
        }
      });
    });

    checkLoaded();
  },
  error: function (err) {
    console.error('Gagal memuat fasilitas_umum.csv:', err);
    tampilkanNotif('Gagal memuat data fasilitas umum.', 'error');
    checkLoaded();
  }
});

// ── BASEMAP SWITCHER ────────────────────────────────────────────────
document.querySelectorAll('.bm-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var bm = btn.getAttribute('data-bm');
    if (!tiles[bm]) return;

    // Hapus semua tile sebelumnya
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
    if (this.checked) {
      layer.addTo(map);
    } else {
      map.removeLayer(layer);
    }
  });
}

setupToggle('tog-jalan',     layerJalan);
setupToggle('tog-kelurahan', layerKelurahan);
setupToggle('tog-fasum',     layerFasum);

// ── LEGENDA ────────────────────────────────────────────────────────
var legend = L.control({ position: 'bottomleft' });
legend.onAdd = function () {
  var div = L.DomUtil.create('div', 'map-legend');
  div.innerHTML = [
    '<h4>Legenda</h4>',
    '<div class="legend-section">Kondisi Jalan</div>',
    '<div class="legend-row"><span class="lg-line" style="background:#27ae60"></span> Baik</div>',
    '<div class="legend-row"><span class="lg-line" style="background:#f39c12"></span> Sedang</div>',
    '<div class="legend-row"><span class="lg-line" style="background:#e74c3c"></span> Rusak / Rusak Berat</div>',
    '<div class="legend-row"><span class="lg-line" style="background:#95a5a6"></span> Tidak Diketahui</div>',
    '<div class="legend-section">Batas Wilayah</div>',
    '<div class="legend-row"><span class="lg-poly" style="border-color:#2980b9;background:rgba(52,152,219,.12)"></span> Batas Kelurahan</div>',
    '<div class="legend-section">Fasilitas Umum</div>',
    '<div class="legend-row"><span style="font-size:15px;line-height:1">🎓</span> Sekolah</div>',
    '<div class="legend-row"><span style="font-size:15px;line-height:1">🛒</span> Pasar</div>',
    '<div class="legend-row"><span style="font-size:15px;line-height:1">➕</span> Fasilitas Kesehatan</div>',
    '<div class="legend-row"><span style="font-size:15px;line-height:1">🕌</span> Tempat Ibadah</div>',
    '<div class="legend-row"><span style="font-size:15px;line-height:1">🏢</span> Perkantoran</div>'
  ].join('');
  L.DomEvent.disableClickPropagation(div);
  L.DomEvent.disableScrollPropagation(div);
  return div;
};
legend.addTo(map);

// ── NOTIFIKASI TOAST ───────────────────────────────────────────────
function tampilkanNotif(pesan, tipe) {
  var toast = document.getElementById('toast-notif');
  if (!toast) return;
  toast.textContent = pesan;
  toast.className = 'toast-notif toast-' + (tipe || 'info') + ' show';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(function () {
    toast.classList.remove('show');
  }, 3500);
}

// ── FIT BOUNDS setelah semua layer dimuat ─────────────────────────
// Opsional: pindahkan viewport ke extent data jalan
var _origCheckLoaded = checkLoaded;
var _fitDone = false;
function tryFitBounds() {
  if (!_fitDone && geoJalan) {
    try {
      var bounds = geoJalan.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40] });
        _fitDone = true;
      }
    } catch (e) { /* abaikan jika bounds tidak valid */ }
  }
}

// Panggil tryFitBounds setelah semua data selesai dimuat
var _origLoadPending = loadPending;
var _loadInterval = setInterval(function () {
  if (loadPending <= 0) {
    clearInterval(_loadInterval);
    tryFitBounds();
  }
}, 200);
