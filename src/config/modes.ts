export type AtlasMode = 'walkability' | 'bikeability';
export type AtlasScale = 'segment' | 'carreau200' | 'zoneTrafic';
export type AnalysisTerritory = 'grandGeneve' | 'cantonGeneve';

export interface AtlasAttributeDefinition {
  name: string;
  technicalName: string;
}

export interface AtlasAttributeScore extends AtlasAttributeDefinition {
  value: number;
}

export interface AtlasClassDefinition {
  displayName: string;
  color: string;
  description: string;
  favorable: boolean;
  field: string;
  attributes: AtlasAttributeDefinition[];
}

export interface AtlasClassScore {
  color: string;
  favorable: boolean;
  description: string;
  average: number;
  attributes: AtlasAttributeScore[];
}

export type AtlasScores = Record<string, AtlasClassScore>;

export interface AtlasDebugParams {
  attr: string;
  layerId: string;
  thresholds: number[];
}

export interface AtlasModeTheme {
  pageBackground: string;
  panelBackground: string;
  panelMutedBackground: string;
  accent: string;
  accentDark: string;
  accentLight: string;
  accentBorder: string;
  accentContrast: string;
  radarGrid: string;
  classColors: string[];
}

interface AtlasSourceDefinition {
  pmtilesEnvKeys: string[];
  tilejsonEnvKeys: string[];
  sourceLayerEnvKeys: string[];
  territoryPmtilesEnvKeys?: Partial<Record<AnalysisTerritory, string[]>>;
  territoryTilejsonEnvKeys?: Partial<Record<AnalysisTerritory, string[]>>;
  defaultPmtiles?: string;
  defaultTilejson?: string;
  defaultPmtilesByTerritory?: Partial<Record<AnalysisTerritory, string>>;
  defaultTilejsonByTerritory?: Partial<Record<AnalysisTerritory, string>>;
  defaultSourceLayer: string;
}

export interface AtlasModeConfig {
  id: AtlasMode;
  title: string;
  indexField: string;
  theme: AtlasModeTheme;
  classOrder: string[];
  classes: AtlasClassDefinition[];
  sources: Record<AtlasScale, AtlasSourceDefinition>;
}

const WALKABILITY_THEME: AtlasModeTheme = {
  pageBackground: '#F7F0CC',
  panelBackground: '#FFFFFF',
  panelMutedBackground: '#F6F4EF',
  accent: '#D7A31B',
  accentDark: '#7A5A00',
  accentLight: '#F6E6A4',
  accentBorder: '#E6C65F',
  accentContrast: '#FFFFFF',
  radarGrid: '#E9D58D',
  classColors: ['#E0B629', '#D59D12', '#C48400', '#A96D00']
};

const BIKEABILITY_THEME: AtlasModeTheme = {
  pageBackground: '#E5EEE6',
  panelBackground: '#FFFFFF',
  panelMutedBackground: '#F3F4F6',
  accent: '#2E6A4A',
  accentDark: '#173828',
  accentLight: '#D3E4D7',
  accentBorder: '#8AA894',
  accentContrast: '#FFFFFF',
  radarGrid: '#A8C2AF',
  classColors: ['#8DBA9A', '#5F9A73', '#3F7C58', '#2E6A4A', '#1E4F37']
};

const WALKABILITY_CLASSES: AtlasClassDefinition[] = [
  {
    displayName: 'Commodité',
    color: WALKABILITY_THEME.classColors[0],
    favorable: true,
    description: 'Est-ce commode de marcher ici ?',
    field: 'Classe_Commodité',
    attributes: [
      { name: 'Niveau sonore', technicalName: 'bruit' },
      { name: 'Température', technicalName: 'temperature' },
      { name: "Conflits d'usage", technicalName: 'conflit_usage' },
      { name: 'Couverture végétale', technicalName: 'canopee' }
    ]
  },
  {
    displayName: 'Attractivité',
    color: WALKABILITY_THEME.classColors[1],
    favorable: true,
    description: 'Y a-t-il des raisons de venir ici ?',
    field: 'Classe_Attractivité',
    attributes: [
      { name: "Plans d'eau", technicalName: 'lac_cours_deau' },
      { name: 'Fontaines', technicalName: 'fontaines' },
      { name: 'Espaces ouverts', technicalName: 'espaces_ouverts' },
      { name: 'Commerces actifs', technicalName: 'rez_actif' },
      { name: 'Transports publics', technicalName: 'tp' },
      { name: 'Aménités', technicalName: 'amenite' }
    ]
  },
  {
    displayName: 'Infrastructure',
    color: WALKABILITY_THEME.classColors[2],
    favorable: true,
    description: 'Est-ce possible de marcher ici ?',
    field: 'Classe_Infrastructure',
    attributes: [
      { name: 'Connectivité réseau', technicalName: 'connectivite' },
      { name: 'Largeur trottoir', technicalName: 'largeur_trottoir' },
      { name: 'Revêtement', technicalName: 'chemin' },
      { name: 'Stationnement gênant', technicalName: 'stationnement_genant' },
      { name: 'Pente', technicalName: 'topographie' }
    ]
  },
  {
    displayName: 'Sécurité',
    color: WALKABILITY_THEME.classColors[3],
    favorable: false,
    description: 'Puis-je marcher ici en sécurité ?',
    field: 'Classe_Sécurité',
    attributes: [
      { name: 'Historique accidents', technicalName: 'accident' },
      { name: 'Zone apaisée', technicalName: 'zone_apaisee' },
      { name: 'Zone piétonne', technicalName: 'zone_pietonne' },
      { name: 'Limite de vitesse', technicalName: 'vitesse' }
    ]
  }
];

const BIKEABILITY_CLASSES: AtlasClassDefinition[] = [
  {
    displayName: 'Attractivité',
    color: BIKEABILITY_THEME.classColors[0],
    favorable: true,
    description: 'Le réseau donne-t-il envie de circuler à vélo ?',
    field: 'Classe_attractivite',
    attributes: [
      { name: 'Aménités', technicalName: 'amenite' },
      { name: 'Connectivité', technicalName: 'connectivite' },
      { name: 'Pente', technicalName: 'pente' }
    ]
  },
  {
    displayName: 'Confort',
    color: BIKEABILITY_THEME.classColors[1],
    favorable: true,
    description: 'Le trajet est-il confortable à vélo ?',
    field: 'Classe_confort',
    attributes: [
      { name: 'Eau', technicalName: 'eau' },
      { name: 'Température', technicalName: 'temperature' },
      { name: "Qualité de l'air", technicalName: 'air' },
      { name: 'Alentours', technicalName: 'alentours' },
      { name: 'Canopée', technicalName: 'canopee' }
    ]
  },
  {
    displayName: 'Équipement',
    color: BIKEABILITY_THEME.classColors[2],
    favorable: true,
    description: 'Les services utiles aux cyclistes sont-ils présents ?',
    field: 'Classe_equipement',
    attributes: [
      { name: 'Stationnement vélo', technicalName: 'stationnement_velo' },
      { name: 'Borne de réparation', technicalName: 'borne_reparation' },
      { name: 'Location', technicalName: 'location' },
      { name: 'Sens inverse cyclable', technicalName: 'sens_inverse' },
      { name: 'Services vélo', technicalName: 'service_velo' },
      { name: 'Parking abri', technicalName: 'parking_abris' }
    ]
  },
  {
    displayName: 'Infrastructure',
    color: BIKEABILITY_THEME.classColors[3],
    favorable: true,
    description: "L'aménagement cyclable est-il qualitatif ?",
    field: 'Classe_infrastructure',
    attributes: [
      { name: 'Piste cyclable', technicalName: 'piste' },
      { name: 'Bande cyclable', technicalName: 'bande' },
      { name: 'Revêtement', technicalName: 'revetement' },
      { name: 'Giratoire', technicalName: 'giratoire' },
      { name: 'Tourner à droite', technicalName: 'tourner_droite' }
    ]
  },
  {
    displayName: 'Sécurité',
    color: BIKEABILITY_THEME.classColors[4],
    favorable: false,
    description: 'Puis-je circuler à vélo en sécurité ?',
    field: 'Classe_securite',
    attributes: [
      { name: 'Éclairage', technicalName: 'eclairage' },
      { name: 'Zone apaisée', technicalName: 'zone_apaisee' },
      { name: 'Vitesse motorisée', technicalName: 'vitesse_motorisee' },
      { name: 'Conflits modes doux', technicalName: 'conflit_md' },
      { name: 'Historique accidents', technicalName: 'accident' }
    ]
  }
];

export const MODE_CONFIGS: Record<AtlasMode, AtlasModeConfig> = {
  walkability: {
    id: 'walkability',
    title: 'Marchabilité',
    indexField: 'indice_marchabilite',
    theme: WALKABILITY_THEME,
    classOrder: WALKABILITY_CLASSES.map((classDef) => classDef.displayName),
    classes: WALKABILITY_CLASSES,
    sources: {
      segment: {
        pmtilesEnvKeys: ['VITE_PM_TILES_WALK_SEGMENT', 'VITE_PM_TILES_SEGMENT', 'VITE_PM_TILES_URL'],
        tilejsonEnvKeys: ['VITE_TILEJSON_WALK_SEGMENT', 'VITE_TILEJSON_WALKNET'],
        territoryPmtilesEnvKeys: {
          cantonGeneve: ['VITE_PM_TILES_WALK_SEGMENT_CANTONGE']
        },
        territoryTilejsonEnvKeys: {
          cantonGeneve: ['VITE_TILEJSON_WALK_SEGMENT_CANTONGE']
        },
        sourceLayerEnvKeys: ['VITE_SEG_SOURCE_LAYER', 'VITE_WALK_SOURCE_LAYER'],
        defaultPmtiles: '/tiles/walk_agglo_segment.pmtiles',
        defaultPmtilesByTerritory: {
          cantonGeneve: '/tiles/walk_canton_segment.pmtiles'
        },
        defaultSourceLayer: 'walknet'
      },
      carreau200: {
        pmtilesEnvKeys: ['VITE_PM_TILES_WALK_CARREAU200', 'VITE_PM_TILES_CARREAU200'],
        tilejsonEnvKeys: ['VITE_TILEJSON_WALK_CARREAU200', 'VITE_TILEJSON_CARREAU200'],
        territoryPmtilesEnvKeys: {
          cantonGeneve: ['VITE_PM_TILES_WALK_CARREAU200_CANTONGE']
        },
        territoryTilejsonEnvKeys: {
          cantonGeneve: ['VITE_TILEJSON_WALK_CARREAU200_CANTONGE']
        },
        sourceLayerEnvKeys: ['VITE_WALK_CAR_SOURCE_LAYER', 'VITE_CAR_SOURCE_LAYER'],
        defaultPmtiles: '/tiles/walk_agglo_carreau200.pmtiles',
        defaultPmtilesByTerritory: {
          cantonGeneve: '/tiles/walk_canton_carreau200.pmtiles'
        },
        defaultSourceLayer: 'carreau200'
      },
      zoneTrafic: {
        pmtilesEnvKeys: ['VITE_PM_TILES_WALK_ZONETRAFIC', 'VITE_PM_TILES_ZONETRAFIC'],
        tilejsonEnvKeys: ['VITE_TILEJSON_WALK_ZONETRAFIC', 'VITE_TILEJSON_ZONETRAFIC'],
        territoryPmtilesEnvKeys: {
          cantonGeneve: ['VITE_PM_TILES_WALK_ZONETRAFIC_CANTONGE']
        },
        territoryTilejsonEnvKeys: {
          cantonGeneve: ['VITE_TILEJSON_WALK_ZONETRAFIC_CANTONGE']
        },
        sourceLayerEnvKeys: ['VITE_WALK_ZT_SOURCE_LAYER', 'VITE_ZT_SOURCE_LAYER'],
        defaultPmtiles: '/tiles/walk_agglo_infracommunal.pmtiles',
        defaultPmtilesByTerritory: {
          cantonGeneve: '/tiles/walk_canton_infracommunal.pmtiles'
        },
        defaultSourceLayer: 'zone_trafic'
      }
    }
  },
  bikeability: {
    id: 'bikeability',
    title: 'Cyclabilité',
    indexField: 'bike_index',
    theme: BIKEABILITY_THEME,
    classOrder: BIKEABILITY_CLASSES.map((classDef) => classDef.displayName),
    classes: BIKEABILITY_CLASSES,
    sources: {
      segment: {
        pmtilesEnvKeys: ['VITE_PM_TILES_BIKE_SEGMENT', 'VITE_PM_TILES_BIKE_URL'],
        tilejsonEnvKeys: ['VITE_TILEJSON_BIKE_SEGMENT', 'VITE_TILEJSON_BIKE_URL'],
        territoryPmtilesEnvKeys: {
          cantonGeneve: ['VITE_PM_TILES_BIKE_SEGMENT_CANTONGE']
        },
        territoryTilejsonEnvKeys: {
          cantonGeneve: ['VITE_TILEJSON_BIKE_SEGMENT_CANTONGE']
        },
        sourceLayerEnvKeys: ['VITE_BIKE_SOURCE_LAYER'],
        defaultPmtiles: '/tiles/bike_agglo_segment.pmtiles',
        defaultPmtilesByTerritory: {
          cantonGeneve: '/tiles/bike_canton_segment.pmtiles'
        },
        defaultSourceLayer: 'bikenet'
      },
      carreau200: {
        pmtilesEnvKeys: ['VITE_PM_TILES_BIKE_CARREAU200'],
        tilejsonEnvKeys: ['VITE_TILEJSON_BIKE_CARREAU200'],
        territoryPmtilesEnvKeys: {
          cantonGeneve: ['VITE_PM_TILES_BIKE_CARREAU200_CANTONGE']
        },
        territoryTilejsonEnvKeys: {
          cantonGeneve: ['VITE_TILEJSON_BIKE_CARREAU200_CANTONGE']
        },
        sourceLayerEnvKeys: ['VITE_BIKE_CAR_SOURCE_LAYER'],
        defaultPmtiles: '/tiles/bike_agglo_carreau200.pmtiles',
        defaultPmtilesByTerritory: {
          cantonGeneve: '/tiles/bike_canton_carreau200.pmtiles'
        },
        defaultSourceLayer: 'carreau200'
      },
      zoneTrafic: {
        pmtilesEnvKeys: ['VITE_PM_TILES_BIKE_INFRACOMMUNAL', 'VITE_PM_TILES_BIKE_ZONETRAFIC'],
        tilejsonEnvKeys: ['VITE_TILEJSON_BIKE_INFRACOMMUNAL', 'VITE_TILEJSON_BIKE_ZONETRAFIC'],
        territoryPmtilesEnvKeys: {
          cantonGeneve: ['VITE_PM_TILES_BIKE_INFRACOMMUNAL_CANTONGE', 'VITE_PM_TILES_BIKE_ZONETRAFIC_CANTONGE']
        },
        territoryTilejsonEnvKeys: {
          cantonGeneve: ['VITE_TILEJSON_BIKE_INFRACOMMUNAL_CANTONGE', 'VITE_TILEJSON_BIKE_ZONETRAFIC_CANTONGE']
        },
        sourceLayerEnvKeys: ['VITE_BIKE_INFRA_SOURCE_LAYER', 'VITE_BIKE_ZT_SOURCE_LAYER'],
        defaultPmtiles: '/tiles/bike_agglo_infracommunal.pmtiles',
        defaultPmtilesByTerritory: {
          cantonGeneve: '/tiles/bike_canton_infracommunal.pmtiles'
        },
        defaultSourceLayer: 'infra_communal'
      }
    }
  }
};

export function buildEmptyScores(mode: AtlasMode): AtlasScores {
  const config = MODE_CONFIGS[mode];
  return Object.fromEntries(
    config.classes.map((classDef) => [
      classDef.displayName,
      {
        color: classDef.color,
        favorable: classDef.favorable,
        description: classDef.description,
        average: 0,
        attributes: classDef.attributes.map((attribute) => ({
          ...attribute,
          value: 0
        }))
      }
    ])
  );
}

export function getAttributeKeys(mode: AtlasMode): Set<string> {
  const config = MODE_CONFIGS[mode];
  return new Set([
    config.indexField,
    ...config.classes.flatMap((classDef) => [classDef.field, ...classDef.attributes.map((attribute) => attribute.technicalName)])
  ]);
}

export function getClassFieldMap(mode: AtlasMode): Record<string, string> {
  const config = MODE_CONFIGS[mode];
  return Object.fromEntries(config.classes.map((classDef) => [classDef.displayName, classDef.field]));
}

export function getModeTheme(mode: AtlasMode): AtlasModeTheme {
  return MODE_CONFIGS[mode].theme;
}
