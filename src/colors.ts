export type AtlasColorScale = 'redGreen' | 'blueGold' | 'viridis';

export interface ColorScaleDefinition {
  id: AtlasColorScale;
  label: string;
  shortLabel: string;
  description: string;
  palette: string[];
}

const RED_GREEN_PALETTE: string[] = [
  '#B00020',
  '#D02F1E',
  '#E24F24',
  '#FFD98A',
  '#F1F5A0',
  '#DDF4A3',
  '#C8EE9A',
  '#A6E083',
  '#7FCB62',
  '#38A74A',
  '#007A35'
];

const BLUE_GOLD_PALETTE: string[] = [
  '#08306B',
  '#084D96',
  '#1A6EB8',
  '#3C92CC',
  '#6AB4DC',
  '#9ECFE8',
  '#C8E4EE',
  '#E8E098',
  '#DEDA4C',
  '#D6DC46',
  '#D1D646'
];

const VIRIDIS_PALETTE: string[] = [
  '#440154',
  '#482878',
  '#3E4989',
  '#31688E',
  '#26828E',
  '#1F9E89',
  '#35B779',
  '#6DCD59',
  '#B4DE2C',
  '#DCE319',
  '#FDE725'
];

export const COLOR_SCALES: Record<AtlasColorScale, ColorScaleDefinition> = {
  redGreen: {
    id: 'redGreen',
    label: 'Rouge-vert',
    shortLabel: 'R-V',
    description: 'Défavorable en rouge, favorable en vert',
    palette: RED_GREEN_PALETTE
  },
  blueGold: {
    id: 'blueGold',
    label: 'Bleu-jaune',
    shortLabel: 'B-J',
    description: 'Défavorable en bleu foncé, favorable en jaune doré',
    palette: BLUE_GOLD_PALETTE
  },
  viridis: {
    id: 'viridis',
    label: 'Viridis',
    shortLabel: 'Viridis',
    description: 'Rampe perceptuelle lisible avec moins de dépendance au rouge/vert',
    palette: VIRIDIS_PALETTE
  }
};

export const COLOR_SCALE_OPTIONS = Object.values(COLOR_SCALES);

export const VALUE_PALETTE: string[] = COLOR_SCALES.redGreen.palette;

// Thresholds corresponding to palette indices (excluding the first which is the < min color)
export const VALUE_THRESHOLDS: number[] = [0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1];

export function getColorScale(colorScale: AtlasColorScale): ColorScaleDefinition {
  return COLOR_SCALES[colorScale] || COLOR_SCALES.redGreen;
}

export function getPaletteColor(
  value: number,
  thresholds: number[] = VALUE_THRESHOLDS,
  palette: string[] = VALUE_PALETTE
): string {
  const safeValue = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  if (safeValue < thresholds[0]) return palette[0];

  for (let index = 0; index < thresholds.length - 1; index += 1) {
    if (safeValue >= thresholds[index] && safeValue < thresholds[index + 1]) {
      return palette[index + 1] || palette[palette.length - 1];
    }
  }

  return palette[palette.length - 1];
}
