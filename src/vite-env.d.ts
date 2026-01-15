/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_TILEJSON_SEGMENT?: string;
	readonly VITE_TILEJSON_WALKNET?: string;
	readonly VITE_TILEJSON_CARREAU200?: string;
	readonly VITE_TILEJSON_ZONETRAFIC?: string;
	readonly VITE_SEG_SOURCE_LAYER?: string;
	readonly VITE_WALK_SOURCE_LAYER?: string;
	readonly VITE_CAR_SOURCE_LAYER?: string;
	readonly VITE_ZT_SOURCE_LAYER?: string;
	readonly VITE_PM_TILES_URL?: string;
	readonly VITE_PM_TILES_SEGMENT?: string;
	readonly VITE_PM_TILES_CARREAU200?: string;
	readonly VITE_PM_TILES_ZONETRAFIC?: string;
	readonly VITE_MAP_STYLE?: string;
	readonly VITE_MAPBOX_TOKEN?: string;
}
interface ImportMeta {
	readonly env: ImportMetaEnv;
}
