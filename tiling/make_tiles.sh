#!/usr/bin/env bash
set -euo pipefail

# Simple, opinionated pipeline: Parquet -> WGS84 -> NDJSON -> MBTiles -> PMTiles.
# Requires: gdal, tippecanoe, pmtiles (CLI), bash, macOS/Linux.

ROOT_DIR="$(cd "$(dirname "$0")" && cd .. && pwd)"
RAW_DIR="$ROOT_DIR/data_raw"
OUT_DIR="$ROOT_DIR/data_tiles"
PUB_TILES_DIR="$ROOT_DIR/public/tiles"
TMP_DIR="$OUT_DIR/tmp"

INPUT_PARQUET_STEP3="$RAW_DIR/step3_index.parquet"
INPUT_PARQUET_CAR="$RAW_DIR/step3_aggregated_index_carreau200.parquet"
INPUT_PARQUET_ZT="$RAW_DIR/step3_aggregated_index_girec.parquet"

LAYER_NAME_SEG="walknet"
LAYER_NAME_CAR="carreau200"
LAYER_NAME_ZT="zone_trafic"

MBTILES_NAME_SEG="step3_index.mbtiles"
MBTILES_NAME_CAR="carreau200.mbtiles"
MBTILES_NAME_ZT="zone_trafic.mbtiles"

PMTILES_NAME_SEG="step3_index.pmtiles"
PMTILES_NAME_CAR="carreau200.pmtiles"
PMTILES_NAME_ZT="zone_trafic.pmtiles"

mkdir -p "$OUT_DIR" "$TMP_DIR" "$PUB_TILES_DIR"

need() { command -v "$1" >/dev/null 2>&1 || { echo "Error: '$1' is required but not installed."; exit 127; }; }
need ogr2ogr
need tippecanoe
need pmtiles

build_one(){
  local INPUT="$1"; local BASENAME="$2"; local LAYER="$3";
  local MBTILES_NAME="$4"; local PMTILES_NAME="$5";
  if [ ! -f "$INPUT" ]; then
    echo "⚠️  Skipping: $INPUT not found"; return 0;
  fi
  echo "➡️  Reproject to WGS84 ($BASENAME)"
  local OGR_WGS84="$TMP_DIR/${BASENAME}_wgs84.parquet"
  ogr2ogr -f Parquet "$OGR_WGS84" "$INPUT" -t_srs EPSG:4326

  echo "➡️  Export to NDJSON ($BASENAME)"
  local NDJSON="$TMP_DIR/${BASENAME}.ndjson"
  ogr2ogr -f GeoJSONSeq "$NDJSON" "$OGR_WGS84" -lco RFC7946=YES

  echo "➡️  tippecanoe → MBTiles ($MBTILES_NAME)"
  local MBTILES="$OUT_DIR/$MBTILES_NAME"
  rm -f "$MBTILES"
  tippecanoe -o "$MBTILES" "$NDJSON" \
    -l "$LAYER" -zg \
    --drop-densest-as-needed --extend-zooms-if-still-dropping \
    --no-feature-limit --no-tile-size-limit \
    --coalesce --coalesce-densest

  echo "➡️  pmtiles convert → PMTiles ($PMTILES_NAME)"
  local PMTILES="$PUB_TILES_DIR/$PMTILES_NAME"
  rm -f "$PMTILES"
  pmtiles convert "$MBTILES" "$PMTILES"
  ls -lh "$MBTILES" "$PMTILES"
  echo "✅ Tiles ready: $PMTILES"
}

build_one "$INPUT_PARQUET_STEP3" step3_index "$LAYER_NAME_SEG" "$MBTILES_NAME_SEG" "$PMTILES_NAME_SEG"

# carreau200 needs special strict tiling (reprojected to EPSG:3857 for perfect grid alignment)
echo "➡️  Building carreau200 with strict tiling (EPSG:3857 reprojection)"
bash ./tiling/make_carreau200_strict.sh

build_one "$INPUT_PARQUET_ZT"   zone_trafic "$LAYER_NAME_ZT"  "$MBTILES_NAME_ZT"  "$PMTILES_NAME_ZT"

echo "   Dev server will serve PMTiles at /tiles/*.pmtiles"
