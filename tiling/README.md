# Tiling pipeline (Parquet → PMTiles → Map)

This repo ships a simple, reproducible pipeline to turn raw Parquet into performant PMTiles, then serve locally via Martin or statically from the app.

## Requirements (choose A or B)

### A) Native (macOS via Homebrew)

- GDAL (ogr2ogr with Parquet + GeoJSONSeq): `brew install gdal`
- Tippecanoe: `brew install tippecanoe`
- PMTiles CLI: `brew install pmtiles`
- Docker (optional but recommended for Martin): https://www.docker.com/

### B) Docker-only (no host installs)

- Docker Desktop
- Use `tiling/make_tiles_docker.sh` which runs GDAL, Tippecanoe and PMTiles inside containers

## Input

Place your raw data in `data_raw/`. Current defaults expect:
- Walkability:
  - `data_raw/walkability/AggloGG/step3_index.parquet`
  - `data_raw/walkability/AggloGG/step3_aggregated_index_carreau200.parquet`
  - `data_raw/walkability/AggloGG/step3_aggregated_index_gg_infra_communal.parquet`
  - `data_raw/walkability/CantonGE/step3_index.parquet`
  - `data_raw/walkability/CantonGE/step3_aggregated_index_carreau200.parquet`
  - `data_raw/walkability/CantonGE/step3_aggregated_index_girec.parquet`
- Bikeability:
  - `data_raw/cyclability/AggloGG/step3_index.parquet`
  - `data_raw/cyclability/AggloGG/step3_aggregated_index_carreau200.parquet`
  - `data_raw/cyclability/AggloGG/step3_aggregated_index_gg_infra_communal.parquet`
  - `data_raw/cyclability/CantonGE/step3_index.parquet`
  - `data_raw/cyclability/CantonGE/step3_aggregated_index_carreau200.parquet`
  - `data_raw/cyclability/CantonGE/step3_aggregated_index_gg_infra_communal.parquet`

For walkability AggloGG infracommunal, `step3_aggregated_index_gg_infra_communal.parquet` is preferred and `step3_aggregated_index_girec.parquet` is only kept as a fallback.

You can add more datasets later; see notes below.

## Produce tiles

- Fast path (defaults):

```sh
npm run tile
```

This will generate:
- Walkability:
  - `data_tiles/walk_agglo_segment.mbtiles`
  - `data_tiles/walk_agglo_carreau200.mbtiles`
  - `data_tiles/walk_agglo_infracommunal.mbtiles`
  - `data_tiles/walk_canton_segment.mbtiles`
  - `data_tiles/walk_canton_carreau200.mbtiles`
  - `data_tiles/walk_canton_infracommunal.mbtiles`
  - `public/tiles/walk_agglo_segment.pmtiles`
  - `public/tiles/walk_agglo_carreau200.pmtiles`
  - `public/tiles/walk_agglo_infracommunal.pmtiles`
  - `public/tiles/walk_canton_segment.pmtiles`
  - `public/tiles/walk_canton_carreau200.pmtiles`
  - `public/tiles/walk_canton_infracommunal.pmtiles`
- Bikeability:
  - `data_tiles/bike_agglo_segment.mbtiles`
  - `data_tiles/bike_agglo_carreau200.mbtiles`
  - `data_tiles/bike_agglo_infracommunal.mbtiles`
  - `data_tiles/bike_canton_segment.mbtiles`
  - `data_tiles/bike_canton_carreau200.mbtiles`
  - `data_tiles/bike_canton_infracommunal.mbtiles`
  - `public/tiles/bike_agglo_segment.pmtiles`
  - `public/tiles/bike_agglo_carreau200.pmtiles`
  - `public/tiles/bike_agglo_infracommunal.pmtiles`
  - `public/tiles/bike_canton_segment.pmtiles`
  - `public/tiles/bike_canton_carreau200.pmtiles`
  - `public/tiles/bike_canton_infracommunal.pmtiles`

The app will automatically use `public/tiles/walk_agglo_segment.pmtiles` during `npm run dev` and after build.

- Docker alternative (no host installs):

```sh
bash ./tiling/make_tiles_docker.sh
```

### What the script does

1) Reproject to WGS84 (EPSG:4326) if necessary
2) Convert to NDJSON (GeoJSON Sequence) for tippecanoe
3) tippecanoe → vector tiles `.mbtiles` with layer name `walknet`
4) pmtiles convert → `.pmtiles`

Artifacts and temp files are in `data_tiles/` and `public/tiles/`.

## Serve locally with Martin (optional)

If you prefer a TileJSON endpoint instead of direct PMTiles in the browser:

```sh
npm run martin
```

This runs Martin on http://localhost:3000 and serves
- TileJSON: http://localhost:3000/walk_agglo_segment

You can then switch the app by setting a `.env` (see below) to point to the TileJSON.

## Configure the app

Two modes are supported; the app tries PMTiles first if present.

- PMTiles (static):
  - Walkability default URL: `/tiles/walk_agglo_segment.pmtiles`
  - Bikeability default URL: `/tiles/bike_agglo_segment.pmtiles`
  - Env: `VITE_PM_TILES_URL=/tiles/walk_agglo_segment.pmtiles`
  - Env: `VITE_PM_TILES_BIKE_SEGMENT=/tiles/bike_agglo_segment.pmtiles`

- Martin (TileJSON):
  - Walkability env: `VITE_TILEJSON_WALKNET=http://localhost:3000/walk_agglo_segment`
  - Bikeability env: `VITE_TILEJSON_BIKE_SEGMENT=http://localhost:3000/bike_agglo_segment`

Common:
- `VITE_WALK_SOURCE_LAYER=walknet`
- `VITE_BIKE_SOURCE_LAYER=bikenet`

Create `.env.local` (not committed) in project root to override.

## Update flow (day-to-day)

1) Drop new parquet in `data_raw/walkability/` and/or `data_raw/cyclability/`
2) `npm run tile`
3) `npm run dev` to check locally
4) Commit/push app changes (tiles are large—prefer hosting `.pmtiles` outside git; see Deploy)

## Deploy (Cloudflare)

- Cloudflare Pages for the app (static build)
- Cloudflare R2 for hosting large `.pmtiles` files (public bucket) OR keep small `.pmtiles` in `public/tiles/`

Set in `.env.production` (for direct PMTiles):
- `VITE_PM_TILES_URL=https://<your-r2-public-domain>/walk_agglo_segment.pmtiles`

…or for Martin on a server (less common for Pages-only):
- `VITE_TILEJSON_WALKNET=https://tiles.yourdomain/walk_agglo_segment`

See root README for detailed steps and optional GitHub Actions workflow.

## Extending to multiple layers

- Duplicate the commands in `make_tiles.sh` with a new input and `-l <layername>`
- In the app, add a new source & layers referencing that TileJSON/PMTiles URL and `source-layer`
