#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && cd .. && pwd)"
OUT_DIR="$ROOT_DIR/data_tiles"
PUBLIC_TILE_DIR="$ROOT_DIR/public/tiles"
TMP_DIR="$OUT_DIR/tmp"

LEGACY_FILES=(
  "$OUT_DIR/step3_index.mbtiles"
  "$OUT_DIR/carreau200.mbtiles"
  "$OUT_DIR/zone_trafic.mbtiles"
  "$OUT_DIR/canton_step3_index.mbtiles"
  "$OUT_DIR/canton_carreau200.mbtiles"
  "$OUT_DIR/canton_zone_trafic.mbtiles"
  "$OUT_DIR/bike_step3_index.mbtiles"
  "$OUT_DIR/bike_carreau200.mbtiles"
  "$OUT_DIR/bike_infra_communal.mbtiles"
  "$OUT_DIR/canton_bike_step3_index.mbtiles"
  "$OUT_DIR/canton_bike_carreau200.mbtiles"
  "$OUT_DIR/canton_bike_infra_communal.mbtiles"
  "$OUT_DIR/bike_zone_trafic.mbtiles"
  "$OUT_DIR/carreau200_strict.mbtiles"
  "$PUBLIC_TILE_DIR/step3_index.pmtiles"
  "$PUBLIC_TILE_DIR/carreau200.pmtiles"
  "$PUBLIC_TILE_DIR/zone_trafic.pmtiles"
  "$PUBLIC_TILE_DIR/canton_step3_index.pmtiles"
  "$PUBLIC_TILE_DIR/canton_carreau200.pmtiles"
  "$PUBLIC_TILE_DIR/canton_zone_trafic.pmtiles"
  "$PUBLIC_TILE_DIR/bike_step3_index.pmtiles"
  "$PUBLIC_TILE_DIR/bike_carreau200.pmtiles"
  "$PUBLIC_TILE_DIR/bike_infra_communal.pmtiles"
  "$PUBLIC_TILE_DIR/canton_bike_step3_index.pmtiles"
  "$PUBLIC_TILE_DIR/canton_bike_carreau200.pmtiles"
  "$PUBLIC_TILE_DIR/canton_bike_infra_communal.pmtiles"
  "$PUBLIC_TILE_DIR/bike_zone_trafic.pmtiles"
)

removed_any=false

for path in "${LEGACY_FILES[@]}"; do
  if [ -e "$path" ]; then
    rm -f "$path"
    echo "Removed legacy file: ${path#$ROOT_DIR/}"
    removed_any=true
  fi
done

if [ -d "$TMP_DIR" ]; then
  while IFS= read -r path; do
    rm -f "$path"
    echo "Removed temp file: ${path#$ROOT_DIR/}"
    removed_any=true
  done < <(find "$TMP_DIR" -mindepth 1 -maxdepth 1 -type f | sort)
fi

if [ "$removed_any" = false ]; then
  echo "Nothing to clean in tiling artifacts."
fi
