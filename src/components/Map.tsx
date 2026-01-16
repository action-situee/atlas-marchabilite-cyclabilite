import { useEffect, useRef, useState } from 'react';
import { VALUE_PALETTE, VALUE_THRESHOLDS } from '../colors';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Protocol } from 'pmtiles';
import type { DistributionData } from './DistributionChart';
import { computeStats, type DataStats } from '../utils/normalize';

interface MapProps {
  selectedAttribute: string | null;
  selectedClass: string | null;
  attributeData: any;
  mode: 'walkability' | 'bikeability';
  scale: 'segment' | 'carreau200' | 'zoneTrafic';
  colorMode: 'linear' | 'quantile';
  onHoverSegment: (segment: any) => void;
  onDistributionRequest?: (data: DistributionData | null) => void;
  onDebugParamsChange?: (params: { attr: string; layerId: string; thresholds: number[] }) => void;
  onStatsUpdate?: (stats: Record<string, DataStats>) => void;
}

export function Map({ selectedAttribute, selectedClass, attributeData, mode, scale, colorMode, onHoverSegment, onDistributionRequest, onDebugParamsChange, onStatsUpdate }: MapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [quantileThresholds, setQuantileThresholds] = useState<number[]>([]); // active attribute thresholds
  const [quantileMap, setQuantileMap] = useState<Record<string, number[]>>({}); // all attributes computed once
  const [loadingStage, setLoadingStage] = useState<'initial' | 'tiles' | 'quantiles' | 'distribution' | 'done'>('initial');
  const [attributeStats, setAttributeStats] = useState<Record<string, DataStats>>({}); // min/max/mean for each attribute

  const normalizePmtilesUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('pmtiles://')) return url;
    if (url.startsWith('http://') || url.startsWith('https://')) return `pmtiles://${url}`;
    if (url.startsWith('/')) return `pmtiles://${url}`;
    return `pmtiles:///${url}`;
  };

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const maplibreAny = maplibregl as typeof maplibregl & {
      addProtocol?: (name: string, handler: (params: any, callback: any) => void) => void;
      removeProtocol?: (name: string) => void;
    };
    const protocol = new Protocol();
    maplibreAny.addProtocol?.('pmtiles', protocol.tile);
    const mapboxToken = (import.meta.env.VITE_MAPBOX_TOKEN as string) || '';
    const appendAccessToken = (url: string) => {
      if (!mapboxToken || url.includes('access_token=')) return url;
      const joiner = url.includes('?') ? '&' : '?';
      return `${url}${joiner}access_token=${mapboxToken}`;
    };
    const rewriteMapboxUrl = (url: string) => {
      if (url.startsWith('mapbox://styles/')) {
        const path = url.replace('mapbox://styles/', '');
        return appendAccessToken(`https://api.mapbox.com/styles/v1/${path}`);
      }
      if (url.startsWith('mapbox://sprites/')) {
        const path = url.replace('mapbox://sprites/', '');
        return appendAccessToken(`https://api.mapbox.com/styles/v1/${path}/sprite`);
      }
      if (url.startsWith('mapbox://fonts/')) {
        const path = url.replace('mapbox://fonts/', '');
        return appendAccessToken(`https://api.mapbox.com/fonts/v1/${path}`);
      }
      if (url.startsWith('mapbox://')) {
        const path = url.replace('mapbox://', '');
        return appendAccessToken(`https://api.mapbox.com/v4/${path}.json`);
      }
      if (url.startsWith('https://api.mapbox.com/')) {
        return appendAccessToken(url);
      }
      return url;
    };
    const resolveStyleUrl = (styleUrl: string) => {
      if (styleUrl.startsWith('mapbox://') && !mapboxToken) {
        console.warn('Mapbox style detected but VITE_MAPBOX_TOKEN is missing.');
      }
      return rewriteMapboxUrl(styleUrl);
    };
    const baseStyle = resolveStyleUrl((import.meta.env.VITE_MAP_STYLE as string) || 'https://demotiles.maplibre.org/style.json');

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: baseStyle,
      center: [6.1432, 46.2044], // Genève
      zoom: 13,
      transformRequest: (url) => ({ url: rewriteMapboxUrl(url) }),
      attributionControl: false
    });

    mapRef.current = map;

    map.on('load', () => {
  setLoadingProgress(20);
  setMapLoaded(true);
  setLoadingStage('initial');

      // Martin TileJSON endpoints and source-layer names
      const SEG_TILEJSON = (import.meta.env.VITE_TILEJSON_SEGMENT as string) || (import.meta.env.VITE_TILEJSON_WALKNET as string) || '';
      const CAR_TILEJSON = (import.meta.env.VITE_TILEJSON_CARREAU200 as string) || '';
      const ZT_TILEJSON  = (import.meta.env.VITE_TILEJSON_ZONETRAFIC as string) || '';
      const SEG_PM = normalizePmtilesUrl((import.meta.env.VITE_PM_TILES_SEGMENT as string) || (import.meta.env.VITE_PM_TILES_URL as string) || '/tiles/step3_index.pmtiles');
      const CAR_PM = normalizePmtilesUrl((import.meta.env.VITE_PM_TILES_CARREAU200 as string) || '');
      const ZT_PM  = normalizePmtilesUrl((import.meta.env.VITE_PM_TILES_ZONETRAFIC as string) || '');
      const SEG_URL = SEG_TILEJSON ? SEG_TILEJSON : SEG_PM;
      const CAR_URL = CAR_TILEJSON ? CAR_TILEJSON : CAR_PM;
      const ZT_URL  = ZT_TILEJSON ? ZT_TILEJSON : ZT_PM;
      const hasCar = Boolean(CAR_URL);
      const hasZt = Boolean(ZT_URL);

      const SEG_LAYER = (import.meta.env.VITE_SEG_SOURCE_LAYER as string) || (import.meta.env.VITE_WALK_SOURCE_LAYER as string) || 'walknet';
      const CAR_LAYER = (import.meta.env.VITE_CAR_SOURCE_LAYER as string) || 'carreau200';
      const ZT_LAYER  = (import.meta.env.VITE_ZT_SOURCE_LAYER  as string) || 'zone_trafic';

      // Add sources
      map.addSource('segments', { type: 'vector', url: SEG_URL });
      if (hasCar) {
        map.addSource('carreau200', { type: 'vector', url: CAR_URL });
      }
      if (hasZt) {
        map.addSource('zones_trafic', { type: 'vector', url: ZT_URL });
      }

      // Find a good layer to insert polygons BEFORE so that basemap water/roads stay on top of our fills
      // Priority: put fills under water. If not found, put under first road/building/symbol.
      const layers = map.getStyle().layers || [];
      let beforePolygonsId: string | undefined;

  // Prefer the water fill layer if present
      beforePolygonsId = layers.find((l: any) => l.id === 'water' || (l.type === 'fill' && String(l.id).includes('water')))?.id;
      if (!beforePolygonsId) {
        // Fallback to first road/building/symbol layer
        const fallback = layers.find((l: any) => String(l.id).includes('road') || String(l.id).includes('building') || l.type === 'symbol');
        beforePolygonsId = fallback?.id;
      }

  // For segments, we want them above transport/roads but below labels
  const beforeSymbolsId: string | undefined = layers.find((l: any) => l.type === 'symbol')?.id;

  console.log('Polygons will be inserted before:', beforePolygonsId);
  console.log('Segments will be inserted before symbol layer:', beforeSymbolsId);

      // Add layers - order matters: first added = bottom, last added = top
      // Order: zones (bottom) -> carreaux -> segments (top)
      
      if (hasZt) {
        map.addLayer({
          id: 'zones-fill',
          type: 'fill',
          source: 'zones_trafic',
          'source-layer': ZT_LAYER,
          paint: {
            'fill-color': '#96C8A6',
            'fill-opacity': 0.5
          },
          layout: { visibility: 'none' }
        }, beforePolygonsId);
        
        map.addLayer({
          id: 'zones-outline',
          type: 'line',
          source: 'zones_trafic',
          'source-layer': ZT_LAYER,
          paint: { 'line-color': '#333', 'line-width': 0.3 },
          layout: { visibility: 'none' }
        }, beforePolygonsId);
      }

      if (hasCar) {
        map.addLayer({
          id: 'carreau200-fill',
          type: 'fill',
          source: 'carreau200',
          'source-layer': CAR_LAYER,
          paint: {
            'fill-color': '#96C8A6',
            'fill-opacity': 0.6,
            'fill-antialias': true
          },
          layout: { visibility: 'none' }
        // Segments go above transport/roads but under labels
        }, beforeSymbolsId);

        map.addLayer({
          id: 'carreau200-outline',
          type: 'line',
          source: 'carreau200',
          'source-layer': CAR_LAYER,
          paint: {
            'line-color': '#666',
            'line-width': 0.3,
            'line-opacity': 0.5
          },
          layout: { visibility: 'none' }
        }, beforePolygonsId);
      }

      map.addLayer({
        id: 'segments-layer',
        type: 'line',
        source: 'segments',
        'source-layer': SEG_LAYER,
        paint: {
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.8, 15, 2],
          'line-color': '#96C8A6',
          'line-opacity': 0.85
        },
        layout: { visibility: 'visible' }
  // IMPORTANT: segments are added without a "before" target so they render ON TOP of basemap (roads/transport)
  });

      // Add an invisible, thicker layer for easier hover detection on segments
      map.addLayer({
        id: 'segments-hit-area',
        type: 'line',
        source: 'segments',
        'source-layer': SEG_LAYER,
        paint: {
          'line-width': ['interpolate', ['linear'], ['zoom'], 10, 10, 15, 15], // Much thicker for easier hovering
          'line-color': 'transparent',
          'line-opacity': 0
        },
        layout: { visibility: 'visible' }
      });

      // After first full render, compute quantiles & distribution once
      map.once('idle', () => {
        setLoadingStage('tiles');
        setLoadingProgress(50);
        const attr = activeAttribute();
        // Compute quantiles ONCE from the segments layer (reference scale)
        const features = map.queryRenderedFeatures(undefined, { layers: ['segments-layer'] });
        const valuesByAttr: Record<string, number[]> = {};
        for (const f of features) {
          const props = f.properties || {};
          for (const [k, v] of Object.entries(props)) {
            if (ATTR_KEYS.has(k) && typeof v === 'number' && !isNaN(v) && v >= 0 && v <= 1) {
              if (!valuesByAttr[k]) valuesByAttr[k] = [];
              valuesByAttr[k].push(v as number);
            }
          }
        }
        // Compute quantiles for each attribute (deciles matching palette steps)
        const paletteSteps = VALUE_PALETTE.length - 1; // number of thresholds
        const qm: Record<string, number[]> = {};
        for (const [k, arr] of Object.entries(valuesByAttr)) {
          if (arr.length < 10) continue; // skip tiny samples
          const sorted = [...arr].sort((a,b)=>a-b);
          const thresholds: number[] = [];
          for (let i = 1; i <= paletteSteps; i++) {
            const p = i / paletteSteps;
            const pos = (sorted.length - 1) * p;
            const lower = Math.floor(pos);
            const upper = Math.ceil(pos);
            const w = pos - lower;
            const val = sorted[lower] * (1 - w) + sorted[upper] * w;
            thresholds.push(Number(val.toFixed(6)));
          }
          // Ensure strictly increasing
          for (let i = 1; i < thresholds.length; i++) {
            if (thresholds[i] <= thresholds[i-1]) thresholds[i] = Number((thresholds[i-1] + 1e-6).toFixed(6));
          }
          qm[k] = thresholds;
          console.log(`📊 Quantiles for ${k}:`, thresholds, `(${arr.length} values, min=${Math.min(...arr).toFixed(3)}, max=${Math.max(...arr).toFixed(3)})`);
        }
        setQuantileMap(qm);
        const activeTh = qm[attr] || VALUE_THRESHOLDS;
        setQuantileThresholds(activeTh);
        setLoadingStage('quantiles');
        setLoadingProgress(75);
        
        // Compute stats for all attributes (min, max, mean)
        const stats: Record<string, DataStats> = {};
        for (const [k, values] of Object.entries(valuesByAttr)) {
          stats[k] = computeStats(values as number[]);
        }
        setAttributeStats(stats);
        if (onStatsUpdate) {
          onStatsUpdate(stats);
        }
        
        applyRamp(attr, colorMode === 'quantile' ? activeTh : undefined);
        // Distribution
        const dist = computeDistribution(attr, colorMode === 'quantile' ? activeTh : VALUE_THRESHOLDS);
        if (onDistributionRequest) onDistributionRequest(dist);
        setLoadingStage('distribution');
        setLoadingProgress(90);
        setTimeout(() => {
          setLoadingStage('done');
          setLoadingProgress(100);
          setIsLoading(false);
        }, 400);
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
      maplibreAny.removeProtocol?.('pmtiles');
    };
  }, []);

  // Update visualization when selection changes
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    
    // TODO: Mettre à jour le style de la couche en fonction de la sélection
    // if (selectedAttribute || selectedClass) {
    //   mapRef.current.setPaintProperty('segments-layer', 'line-color', expression);
    // }
  }, [mapLoaded, selectedAttribute, selectedClass, mode, scale]);

  const handleZoomIn = () => {
    mapRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapRef.current?.zoomOut();
  };

  const handleReset = () => {
    mapRef.current?.flyTo({
      center: [6.1432, 46.2044],
      zoom: 13
    });
  };

  // Mapping from class names to their aggregated field names in tiles
  const classFieldMap: Record<string, string> = {
    'Commodité': 'Classe_Commodité',
    'Attractivité': 'Classe_Attractivité',
    'Infrastructure': 'Classe_Infrastructure',
    'Sécurité': 'Classe_Sécurité'
  };

  // Whitelist of numeric attributes we expose in the UI (limits upfront quantile work)
  const ATTR_KEYS: Set<string> = new Set([
    // class aggregates + overall index
    'Classe_Commodité','Classe_Attractivité','Classe_Infrastructure','Classe_Sécurité','indice_marchabilite',
    // Commodité
    'bruit','temperature','conflit_usage','canopee',
    // Attractivité
    'lac_cours_deau','fontaines','espaces_ouverts','rez_actif','tp','amenite',
    // Sécurité
    'accident','zone_apaisee','zone_pietonne','vitesse',
    // Infrastructure
    'connectivite','largeur_trottoir','chemin','stationnement_genant','topographie'
  ]);

  // Compute active attribute key from UI state
  function activeAttribute(): string {
    if (selectedAttribute) {
      // User clicked on a specific attribute (e.g., "Attractivité.fontaines")
      // The format is "ClassName.technicalName"
      const parts = selectedAttribute.split('.');
      if (parts.length === 2) {
        const technicalName = parts[1];
        // console.log(`🎯 Attribute selected: ${technicalName} from ${selectedAttribute}`);
        return technicalName;
      }
      // Fallback if format is different
      // console.log(`🎯 Attribute selected (fallback): ${parts[0]}`);
      return parts[0];
    }
    if (selectedClass) {
      // User clicked on a class header (e.g., "Attractivité")
      // Show the aggregated class score
      const attr = classFieldMap[selectedClass] || 'indice_marchabilite';
      // console.log(`🎯 Class selected: ${selectedClass} → showing ${attr}`);
      return attr;
    }
    // No selection → always show global overall index for ALL scales
    // and matches user expectation that the default is the global score
    // (previously polygons defaulted to Classe_Agrément, which caused confusion)
    // console.log(`🎯 No selection → showing indice_marchabilite`);
    return 'indice_marchabilite';
  }

  // Color ramp: linear (fixed thresholds) or quantile (data-driven thresholds)
  function colorRamp(attr: string, overrideThresholds?: number[]) {
    const input = ['coalesce', ['to-number', ['get', attr]], 0];
    
    if (colorMode === 'linear') {
      // Use fixed linear thresholds (0.1 increments)
      const expr: any[] = ['step', input, VALUE_PALETTE[0]];
      VALUE_THRESHOLDS.forEach((t, i) => {
        expr.push(t, VALUE_PALETTE[i + 1]);
      });
      return expr;
    } else {
      // Use quantile-based thresholds
      const expr: any[] = ['step', input, VALUE_PALETTE[0]];
      const th = overrideThresholds && overrideThresholds.length > 0 ? overrideThresholds : quantileThresholds;
      th.forEach((t, i) => {
        expr.push(t, VALUE_PALETTE[i + 1]);
      });
      return expr;
    }
  }

  // Apply current ramp to all visible layers for the active attribute
  function applyRamp(attr: string, thOverride?: number[]) {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const ramp = colorRamp(attr, thOverride);
    console.log(`🎨 Applying color ramp for attribute: ${attr}, mode: ${colorMode}, thresholds:`, thOverride || quantileThresholds);
    if (map.getLayer('segments-layer')) {
      map.setPaintProperty('segments-layer', 'line-color', ramp as any);
    }
    if (map.getLayer('carreau200-fill')) {
      map.setPaintProperty('carreau200-fill', 'fill-color', ramp as any);
    }
    if (map.getLayer('zones-fill')) {
      map.setPaintProperty('zones-fill', 'fill-color', ramp as any);
    }
    // Report active debug params to parent for display in panel
    if (onDebugParamsChange) {
      const layerId = scale === 'segment' ? 'segments-layer' : (scale === 'carreau200' ? 'carreau200-fill' : 'zones-fill');
      const thresholds = colorMode === 'linear' ? VALUE_THRESHOLDS : (thOverride && thOverride.length ? thOverride : quantileThresholds);
      onDebugParamsChange({ attr, layerId, thresholds });
    }
  }

  // Compute quantile thresholds from visible features for specific attribute
  function computeQuantileThresholds(attr: string): number[] {
    // Use stored map (computed once) otherwise fallback to linear thresholds
    const pre = quantileMap[attr];
    if (pre && pre.length) return pre;
    if (!mapRef.current || !mapLoaded) return VALUE_THRESHOLDS;

    const map = mapRef.current;

    // Determine which layer to query based on scale
    let layerId: string;
    if (scale === 'segment') layerId = 'segments-layer';
    else if (scale === 'carreau200') layerId = 'carreau200-fill';
    else layerId = 'zones-fill';

    // Query rendered features
    const features = map.queryRenderedFeatures(undefined, { layers: [layerId] });

    if (!features || features.length === 0) return VALUE_THRESHOLDS;

    // Extract values for this specific attribute
    const values: number[] = [];
    for (const f of features) {
      const val = f.properties?.[attr];
      if (typeof val === 'number' && !isNaN(val)) {
        values.push(val);
      }
    }

    if (values.length === 0) return VALUE_THRESHOLDS;

    // Sort values and compute quantiles
    values.sort((a, b) => a - b);
    const quantiles: number[] = [];
    
    for (let i = 1; i < VALUE_PALETTE.length; i++) {
      const quantilePosition = (i / (VALUE_PALETTE.length - 1)) * (values.length - 1);
      const lowerIndex = Math.floor(quantilePosition);
      const upperIndex = Math.ceil(quantilePosition);
      const weight = quantilePosition - lowerIndex;
      
      const quantileValue = values[lowerIndex] * (1 - weight) + values[upperIndex] * weight;
      quantiles.push(Math.max(quantileValue, i === 1 ? 0.01 : quantiles[i - 2] + 0.01)); // Ensure monotonic increase
    }

    return quantiles;
  }

  // Helper to map a value [0,1] to a palette color based on thresholds
  function colorForValue(v: number, thresholds?: number[]): string {
    // Match the logic from colorRamp (step expression)
    // Style step: ['step', input, color0, t1, color1, t2, color2, ...]
    // Meaning: if v < t1 → color0, if t1 <= v < t2 → color1, etc.
    const th = thresholds || VALUE_THRESHOLDS;
    if (v < th[0]) return VALUE_PALETTE[0];
    for (let i = 0; i < th.length - 1; i++) {
      if (v >= th[i] && v < th[i + 1]) {
        return VALUE_PALETTE[i + 1];
      }
    }
    return VALUE_PALETTE[VALUE_PALETTE.length - 1];
  }

  // Compute distribution from visible features
  function computeDistribution(attrOverride?: string, thresholdsOverride?: number[]): DistributionData | null {
    if (!mapRef.current || !mapLoaded) return null;
    const map = mapRef.current;
    const attr = attrOverride || activeAttribute();

    // Determine which layer to query based on scale
    let layerId: string;
    if (scale === 'segment') layerId = 'segments-layer';
    else if (scale === 'carreau200') layerId = 'carreau200-fill';
    else layerId = 'zones-fill';

    // Query rendered features
    const features = map.queryRenderedFeatures(undefined, {
      layers: [layerId]
    });

    if (!features || features.length === 0) return null;

    // Build histogram in a single pass
    const BIN_COUNT = 20;
    const bins = Array.from({ length: BIN_COUNT }, (_, i) => ({
      min: i / BIN_COUNT,
      max: (i + 1) / BIN_COUNT,
      count: 0,
      color: '#000'
    }));
    let total = 0, sum = 0, min = Infinity, max = -Infinity;
    for (const f of features) {
      const val = f.properties?.[attr];
      if (typeof val === 'number' && !isNaN(val)) {
        total += 1;
        sum += val;
        if (val < min) min = val;
        if (val > max) max = val;
        let idx = Math.floor(val * BIN_COUNT);
        if (idx < 0) idx = 0; if (idx >= BIN_COUNT) idx = BIN_COUNT - 1;
        bins[idx].count += 1;
      }
    }
    if (total === 0) return null;

    // Determine thresholds for separators (not for binning)
    let thresholds = colorMode === 'linear' ? VALUE_THRESHOLDS : (thresholdsOverride || quantileThresholds);

    // Assign colors per bin based on center using the same thresholds as the map
    for (let i = 0; i < BIN_COUNT; i++) {
      const center = (bins[i].min + bins[i].max) / 2;
      bins[i].color = colorForValue(center, thresholds);
    }
    const mean = sum / total;

    return {
      bins,
      total,
      min,
      max,
      mean,
      thresholds
    };
  }

  // Update layer visibility based on scale
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;
    const vis = (id: string, v: boolean) => {
      if (!map.getLayer(id)) return;
      map.setLayoutProperty(id, 'visibility', v ? 'visible' : 'none');
    };

    const isSegment = scale === 'segment';
    vis('segments-layer', isSegment);
    vis('segments-hit-area', isSegment);
    vis('carreau200-fill', scale === 'carreau200');
    vis('carreau200-outline', scale === 'carreau200');
    vis('zones-fill', scale === 'zoneTrafic');
    vis('zones-outline', scale === 'zoneTrafic');
  }, [mapLoaded, scale]);

  // Compute quantiles after the map finishes rendering to avoid empty features on first switch
  // When attribute changes, if quantile mode use stored thresholds (do not recompute), else apply linear
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const attr = activeAttribute();
    if (colorMode === 'quantile') {
      const th = quantileMap[attr];
      if (th && th.length) {
        setQuantileThresholds(th);
        applyRamp(attr, th);
      } else {
        applyRamp(attr); // fallback linear until thresholds available (rare if change before idle)
      }
    } else {
      applyRamp(attr);
    }
    if (onDistributionRequest) {
      const timer = setTimeout(() => {
        const dist = computeDistribution(attr);
        onDistributionRequest(dist);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [mapLoaded, selectedAttribute, selectedClass, mode, scale, colorMode]);

  // When scale changes, reuse the precomputed segment-based quantiles.
  // Only reapply the ramp and recompute distribution for the new visible layer.
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;
    const attr = activeAttribute();
    const activeTh = quantileMap[attr] || VALUE_THRESHOLDS;
    setQuantileThresholds(activeTh);
    applyRamp(attr, colorMode === 'quantile' ? activeTh : undefined);

    const recomputeDistribution = () => {
      if (onDistributionRequest) {
        const dist = computeDistribution(attr, colorMode === 'quantile' ? activeTh : VALUE_THRESHOLDS);
        onDistributionRequest(dist);
      }
    };
    map.once('idle', recomputeDistribution);
    return () => { map.off('idle', recomputeDistribution as any); };
  }, [mapLoaded, scale, colorMode, selectedAttribute, selectedClass, mode, quantileMap]);

  // Finish loading screen when base tiles are ready
  // Remove previous generic loading completion effect (handled in staged loader)

  // Update styling on attribute/class changes
  // Removed previous effect (merged logic into attribute change + staged loader)

  // Build scores object from tile feature properties
  function buildScoresFromProperties(props: any) {
    const normalizeValue = (value: number, attrName: string): number => {
      const stats = attributeStats[attrName];
      if (!stats || stats.max <= stats.min) return 0;
      return Math.max(0, Math.min(1, (value - stats.min) / (stats.max - stats.min)));
    };
    
    return {
      Commodité: {
        color: '#6B7C59',
        favorable: true,
        description: 'Est-ce commode de marcher ici ?',
        average: normalizeValue(props['Classe_Commodité'] || 0, 'Classe_Commodité'),
        attributes: [
          { name: 'Niveau sonore', technicalName: 'bruit', value: normalizeValue(props['bruit'] || 0, 'bruit') },
          { name: 'Température', technicalName: 'temperature', value: normalizeValue(props['temperature'] || 0, 'temperature') },
          { name: 'Conflits d\'usage', technicalName: 'conflit_usage', value: normalizeValue(props['conflit_usage'] || 0, 'conflit_usage') },
          { name: 'Couverture végétale', technicalName: 'canopee', value: normalizeValue(props['canopee'] || 0, 'canopee') }
        ]
      },
      Attractivité: {
        color: '#4A5F7F',
        favorable: true,
        description: 'Y a-t-il des raisons de venir ici ?',
        average: normalizeValue(props['Classe_Attractivité'] || 0, 'Classe_Attractivité'),
        attributes: [
          { name: 'Plans d\'eau', technicalName: 'lac_cours_deau', value: normalizeValue(props['lac_cours_deau'] || 0, 'lac_cours_deau') },
          { name: 'Fontaines', technicalName: 'fontaines', value: normalizeValue(props['fontaines'] || 0, 'fontaines') },
          { name: 'Espaces ouverts', technicalName: 'espaces_ouverts', value: normalizeValue(props['espaces_ouverts'] || 0, 'espaces_ouverts') },
          { name: 'Commerces actifs', technicalName: 'rez_actif', value: normalizeValue(props['rez_actif'] || 0, 'rez_actif') },
          { name: 'Transports publics', technicalName: 'tp', value: normalizeValue(props['tp'] || 0, 'tp') },
          { name: 'Aménités', technicalName: 'amenite', value: normalizeValue(props['amenite'] || 0, 'amenite') }
        ]
      },
      Sécurité: {
        color: '#A55A4A',
        favorable: false,
        description: 'Puis-je marcher ici en sécurité ?',
        average: normalizeValue(props['Classe_Sécurité'] || 0, 'Classe_Sécurité'),
        attributes: [
          { name: 'Historique accidents', technicalName: 'accident', value: normalizeValue(props['accident'] || 0, 'accident') },
          { name: 'Zone apaisée', technicalName: 'zone_apaisee', value: normalizeValue(props['zone_apaisee'] || 0, 'zone_apaisee') },
          { name: 'Zone piétonne', technicalName: 'zone_pietonne', value: normalizeValue(props['zone_pietonne'] || 0, 'zone_pietonne') },
          { name: 'Limite de vitesse', technicalName: 'vitesse', value: normalizeValue(props['vitesse'] || 0, 'vitesse') }
        ]
      },
      Infrastructure: {
        color: '#7A6B5D',
        favorable: true,
        description: 'Est-ce possible de marcher ici ?',
        average: normalizeValue(props['Classe_Infrastructure'] || 0, 'Classe_Infrastructure'),
        attributes: [
          { name: 'Connectivité réseau', technicalName: 'connectivite', value: normalizeValue(props['connectivite'] || 0, 'connectivite') },
          { name: 'Largeur trottoir', technicalName: 'largeur_trottoir', value: normalizeValue(props['largeur_trottoir'] || 0, 'largeur_trottoir') },
          { name: 'Revêtement', technicalName: 'chemin', value: normalizeValue(props['chemin'] || 0, 'chemin') },
          { name: 'Stationnement gênant', technicalName: 'stationnement_genant', value: normalizeValue(props['stationnement_genant'] || 0, 'stationnement_genant') },
          { name: 'Pente', technicalName: 'topographie', value: normalizeValue(props['topographie'] || 0, 'topographie') }
        ]
      }
    };
  }

  // Hover interaction (segments only for now)
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;
  // Using 'any' for the event to avoid type version mismatches with maplibre-gl typings
  const onMove = (e: any) => {
      const layerId = scale === 'segment' ? 'segments-hit-area' : (scale === 'carreau200' ? 'carreau200-fill' : 'zones-fill');
      const feats = map.queryRenderedFeatures(e.point, { layers: [layerId] });
      const f = feats[0];
      if (f && f.properties) {
        const scores = buildScoresFromProperties(f.properties);
        onHoverSegment({ id: f.id, properties: f.properties, geometry: f.geometry, scores });
        map.getCanvas().style.cursor = 'pointer';
      } else {
        onHoverSegment(null);
        map.getCanvas().style.cursor = '';
      }
    };
    map.on('mousemove', onMove);
    return () => { map.off('mousemove', onMove); };
  }, [mapLoaded, scale, onHoverSegment]);

  return (
    <div className="absolute inset-0">
      {/* Loading Screen */}
      {isLoading && (
        <div className="absolute inset-0 z-50 bg-white flex flex-col items-center justify-center">
          <div className="text-center space-y-5 w-[300px]">
            <h2 className="text-3xl font-bold text-[#1A1A1A]">
              {mode === 'walkability' ? 'Marchabilité' : 'Cyclabilité'}
            </h2>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#96C8A6] transition-all duration-300 ease-out"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
            <div className="text-xs font-medium tracking-wide text-[#5A5A5A] flex flex-col items-center">
              <span className="uppercase">
                {loadingStage === 'initial' && 'Initialisation du style'}
                {loadingStage === 'tiles' && 'Chargement des tuiles'}
                {loadingStage === 'quantiles' && 'Calcul des quantiles'}
                {loadingStage === 'distribution' && 'Construction de la distribution'}
                {loadingStage === 'done' && 'Prêt'}
              </span>
              <span className="mt-1 text-gray-500">{Math.round(loadingProgress)}%</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Map container */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" style={{ minHeight: '100vh' }} />

      {/* Map Controls */}
      <div className="absolute bottom-6 left-6 flex gap-2 z-10 pointer-events-auto">
        <button
          onClick={handleZoomIn}
          className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-[#5A5A5A] hover:text-[#1A1A1A] transition-all border border-[#D8D2CA]"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-[#5A5A5A] hover:text-[#1A1A1A] transition-all border border-[#D8D2CA]"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleReset}
          className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-[#5A5A5A] hover:text-[#1A1A1A] transition-all border border-[#D8D2CA]"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Debug footer removed; verification moved into AttributePanel */}
    </div>
  );
}
