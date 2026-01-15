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

Place your raw data in `data_raw/`. Current default expects:
- `data_raw/step3_index.parquet` (LineString/Polygon network with attributes)

You can add more datasets later; see notes below.

## Produce tiles

- Fast path (defaults):

```sh
npm run tile
```

This will generate:
- `data_tiles/step3_index.mbtiles` (intermediate)
- `public/tiles/step3_index.pmtiles` (final)

The app will automatically use `public/tiles/step3_index.pmtiles` during `npm run dev` and after build.

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
- TileJSON: http://localhost:3000/step3_index

You can then switch the app by setting a `.env` (see below) to point to the TileJSON.

## Configure the app

Two modes are supported; the app tries PMTiles first if present.

- PMTiles (static):
  - Default URL: `/tiles/step3_index.pmtiles`
  - Env: `VITE_PM_TILES_URL=/tiles/step3_index.pmtiles`

- Martin (TileJSON):
  - Env: `VITE_TILEJSON_WALKNET=http://localhost:3000/step3_index`

Common:
- `VITE_WALK_SOURCE_LAYER=walknet` (layer name used by tippecanoe)

Create `.env.local` (not committed) in project root to override.

## Update flow (day-to-day)

1) Drop new parquet in `data_raw/step3_index.parquet`
2) `npm run tile`
3) `npm run dev` to check locally
4) Commit/push app changes (tiles are large—prefer hosting `.pmtiles` outside git; see Deploy)

## Deploy (Cloudflare)

- Cloudflare Pages for the app (static build)
- Cloudflare R2 for hosting large `.pmtiles` files (public bucket) OR keep small `.pmtiles` in `public/tiles/`

Set in `.env.production` (for direct PMTiles):
- `VITE_PM_TILES_URL=https://<your-r2-public-domain>/step3_index.pmtiles`

…or for Martin on a server (less common for Pages-only):
- `VITE_TILEJSON_WALKNET=https://tiles.yourdomain/step3_index`

See root README for detailed steps and optional GitHub Actions workflow.

## Extending to multiple layers

- Duplicate the commands in `make_tiles.sh` with a new input and `-l <layername>`
- In the app, add a new source & layers referencing that TileJSON/PMTiles URL and `source-layer`
