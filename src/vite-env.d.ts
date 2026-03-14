/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_TILEJSON_SEGMENT?: string;
	readonly VITE_TILEJSON_WALKNET?: string;
	readonly VITE_TILEJSON_CARREAU200?: string;
	readonly VITE_TILEJSON_ZONETRAFIC?: string;
	readonly VITE_TILEJSON_BIKE_INFRACOMMUNAL?: string;
	readonly VITE_TILEJSON_WALK_SEGMENT_CANTONGE?: string;
	readonly VITE_TILEJSON_WALK_CARREAU200_CANTONGE?: string;
	readonly VITE_TILEJSON_WALK_ZONETRAFIC_CANTONGE?: string;
	readonly VITE_TILEJSON_BIKE_SEGMENT_CANTONGE?: string;
	readonly VITE_TILEJSON_BIKE_CARREAU200_CANTONGE?: string;
	readonly VITE_TILEJSON_BIKE_INFRACOMMUNAL_CANTONGE?: string;
	readonly VITE_TILEJSON_BIKE_ZONETRAFIC_CANTONGE?: string;
	readonly VITE_TILEJSON_PERIMETER?: string;
	readonly VITE_SEG_SOURCE_LAYER?: string;
	readonly VITE_WALK_SOURCE_LAYER?: string;
	readonly VITE_CAR_SOURCE_LAYER?: string;
	readonly VITE_ZT_SOURCE_LAYER?: string;
	readonly VITE_BIKE_INFRA_SOURCE_LAYER?: string;
	readonly VITE_PERIMETER_SOURCE_LAYER?: string;
	readonly VITE_PM_TILES_URL?: string;
	readonly VITE_PM_TILES_SEGMENT?: string;
	readonly VITE_PM_TILES_CARREAU200?: string;
	readonly VITE_PM_TILES_ZONETRAFIC?: string;
	readonly VITE_PM_TILES_BIKE_INFRACOMMUNAL?: string;
	readonly VITE_PM_TILES_WALK_SEGMENT_CANTONGE?: string;
	readonly VITE_PM_TILES_WALK_CARREAU200_CANTONGE?: string;
	readonly VITE_PM_TILES_WALK_ZONETRAFIC_CANTONGE?: string;
	readonly VITE_PM_TILES_BIKE_SEGMENT_CANTONGE?: string;
	readonly VITE_PM_TILES_BIKE_CARREAU200_CANTONGE?: string;
	readonly VITE_PM_TILES_BIKE_INFRACOMMUNAL_CANTONGE?: string;
	readonly VITE_PM_TILES_BIKE_ZONETRAFIC_CANTONGE?: string;
	readonly VITE_PM_TILES_PERIMETER?: string;
	readonly VITE_MAP_STYLE?: string;
	readonly VITE_MAPBOX_TOKEN?: string;
}
interface ImportMeta {
	readonly env: ImportMetaEnv;
}
