"""
update_foto_jalan.py
====================
Script untuk mengisi field FOTO di "JALAN KELURAHAN.json"
berdasarkan file foto di folder foto_jalan/.

Konvensi nama file foto:
    [Nama Jalan] [Nama Kelurahan] [Nomor].jpg
    Contoh: Jl Mawar Karangtengah 1.jpg
            Gang Menur Margomulyo 2.jpg

Cara pakai:
    1. Letakkan script ini di folder proyek (sejajar dengan index.html)
    2. Pastikan folder foto_jalan/ sudah berisi foto-foto
    3. Jalankan: python update_foto_jalan.py
    4. File output: JALAN KELURAHAN_updated.json
"""

import json
import os
import re
from pathlib import Path
from collections import defaultdict

# ── KONFIGURASI ────────────────────────────────────────────────────
GEOJSON_INPUT  = "JALAN KELURAHAN.json"
GEOJSON_OUTPUT = "JALAN KELURAHAN_updated.json"
FOLDER_FOTO    = "foto_jalan"
FOTO_PREFIX    = "foto_jalan/"          # prefix path di dalam GeoJSON
EKSTENSI_FOTO  = {'.jpg', '.jpeg', '.png', '.webp'}
# ──────────────────────────────────────────────────────────────────


def normalisasi(teks):
    """Lowercase, hapus tanda baca berlebih, normalisasi spasi."""
    teks = teks.lower().strip()
    teks = re.sub(r'[_\-]+', ' ', teks)      # ganti _ dan - dengan spasi
    teks = re.sub(r'\s+', ' ', teks)          # normalisasi spasi ganda
    # Hapus kata umum yang sering muncul di nama file tapi tidak di data
    for kata in ['jl', 'jln', 'jalan', 'gg', 'gang', 'kel', 'kelurahan', 'desa']:
        teks = re.sub(r'\b' + kata + r'\b', '', teks)
    teks = re.sub(r'\s+', ' ', teks).strip()
    return teks


def parse_nama_file(nama_file):
    """
    Ekstrak (nama_jalan_norm, nama_kelurahan_norm, nomor) dari nama file.
    Format: "[Nama Jalan] [Nama Kelurahan] [Nomor].ext"
    Strategi: coba cocokkan kelurahan yang dikenal dari belakang nama file.
    """
    stem = Path(nama_file).stem  # tanpa ekstensi

    # Daftar kelurahan yang dikenal (case-insensitive)
    KELURAHAN_DIKENAL = ['pelem', 'karangtengah', 'ketanggi', 'margomulyo']

    stem_lower = stem.lower()

    # Cari kelurahan di nama file
    kel_ditemukan = None
    for kel in KELURAHAN_DIKENAL:
        if kel in stem_lower:
            kel_ditemukan = kel
            break

    if not kel_ditemukan:
        return None, None  # tidak bisa dicocokkan

    # Hapus nomor di akhir (misal: " 1", " 2", "_01")
    stem_tanpa_nomor = re.sub(r'[\s_\-]*\d+$', '', stem).strip()

    # Hapus nama kelurahan dari stem → sisanya adalah nama jalan
    idx = stem_tanpa_nomor.lower().find(kel_ditemukan)
    nama_jalan_raw = stem_tanpa_nomor[:idx].strip() if idx > -1 else stem_tanpa_nomor

    nama_jalan_norm = normalisasi(nama_jalan_raw)
    return nama_jalan_norm, kel_ditemukan


def scan_folder_foto(folder):
    """
    Scan folder foto, kembalikan dict:
    { (nama_jalan_norm, kelurahan_norm): [path_relatif, ...] }
    """
    hasil = defaultdict(list)
    tidak_dikenal = []

    if not os.path.isdir(folder):
        print(f"  ⚠  Folder '{folder}' tidak ditemukan!")
        return hasil, tidak_dikenal

    for fname in sorted(os.listdir(folder)):
        ext = Path(fname).suffix.lower()
        if ext not in EKSTENSI_FOTO:
            continue

        nama_jalan_norm, kel_norm = parse_nama_file(fname)

        if nama_jalan_norm is None or nama_jalan_norm == '':
            tidak_dikenal.append(fname)
            continue

        key = (nama_jalan_norm, kel_norm)
        hasil[key].append(FOTO_PREFIX + fname)

    return hasil, tidak_dikenal


def build_index_geojson(features):
    """
    Buat index GeoJSON:
    { (nama_jalan_norm, kelurahan_norm): [indeks feature, ...] }
    """
    index = defaultdict(list)
    for i, f in enumerate(features):
        p = f.get('properties', {})
        nama_raw = (p.get('NAMA_RUAS') or '').strip()
        kel_raw  = (p.get('KELURAHAN') or '').strip()
        nama_norm = normalisasi(nama_raw)
        kel_norm  = kel_raw.lower()
        index[(nama_norm, kel_norm)].append(i)
    return index


def main():
    print("=" * 60)
    print("  Update FOTO – JALAN KELURAHAN.json")
    print("=" * 60)

    # 1. Baca GeoJSON
    if not os.path.isfile(GEOJSON_INPUT):
        print(f"\n❌ File '{GEOJSON_INPUT}' tidak ditemukan.")
        print("   Pastikan script dijalankan di folder yang sama dengan GeoJSON.")
        return

    with open(GEOJSON_INPUT, 'r', encoding='utf-8') as f:
        data = json.load(f)

    features = data.get('features', [])
    print(f"\n✅ GeoJSON dimuat: {len(features)} fitur jalan")

    # 2. Scan folder foto
    print(f"\n📂 Scanning folder '{FOLDER_FOTO}/' ...")
    foto_index, tidak_dikenal = scan_folder_foto(FOLDER_FOTO)

    total_foto = sum(len(v) for v in foto_index.values())
    print(f"   Foto terdeteksi   : {total_foto} file")
    print(f"   Kelompok unik     : {len(foto_index)} (nama jalan + kelurahan)")
    if tidak_dikenal:
        print(f"   ⚠  Tidak dikenali : {len(tidak_dikenal)} file (kelurahan tidak ditemukan di nama file)")
        for fn in tidak_dikenal:
            print(f"      - {fn}")

    # 3. Build index GeoJSON
    geo_index = build_index_geojson(features)

    # 4. Cocokkan & update
    print("\n🔗 Mencocokkan foto ke GeoJSON ...")
    cocok     = 0
    tidak_cocok_foto = []

    for (nama_norm, kel_norm), foto_paths in foto_index.items():
        kandidat = geo_index.get((nama_norm, kel_norm), [])

        if not kandidat:
            tidak_cocok_foto.append((nama_norm, kel_norm, foto_paths))
            continue

        for idx in kandidat:
            existing = (features[idx]['properties'].get('FOTO') or '').strip()
            existing_list = [x for x in existing.split('|') if x] if existing else []
            # Gabung, hindari duplikat
            gabungan = existing_list[:]
            for p in foto_paths:
                if p not in gabungan:
                    gabungan.append(p)
            features[idx]['properties']['FOTO'] = '|'.join(gabungan)
            cocok += 1

    print(f"   ✅ Berhasil dicocokkan : {cocok} fitur GeoJSON diupdate")

    if tidak_cocok_foto:
        print(f"\n   ⚠  Foto tidak cocok ({len(tidak_cocok_foto)} kelompok) – nama jalan/kelurahan tidak ditemukan di GeoJSON:")
        for nama, kel, paths in tidak_cocok_foto:
            print(f"      Foto  : {[Path(p).name for p in paths]}")
            print(f"      Key   : jalan='{nama}', kelurahan='{kel}'")
            print()

    # 5. Simpan output
    with open(GEOJSON_OUTPUT, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\n💾 Output disimpan: {GEOJSON_OUTPUT}")

    # 6. Ringkasan akhir
    terisi = sum(1 for f in features if (f['properties'].get('FOTO') or '').strip())
    kosong = len(features) - terisi
    print(f"\n📊 Ringkasan:")
    print(f"   Total fitur jalan  : {len(features)}")
    print(f"   Sudah ada foto     : {terisi}")
    print(f"   Belum ada foto     : {kosong}")
    print("\n✅ Selesai! Ganti file lama dengan JALAN KELURAHAN_updated.json")
    print("   (rename jadi 'JALAN KELURAHAN.json' agar langsung terbaca web)")
    print("=" * 60)


if __name__ == '__main__':
    main()
