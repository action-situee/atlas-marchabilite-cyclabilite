/**
 * MinMax normalization utilities
 */

export interface DataStats {
  min: number;
  max: number;
  mean: number;
}

/**
 * Normalize a value using minmax scaling: (value - min) / (max - min)
 * Returns value clamped to [0, 1]
 */
export function normalizeMinMax(value: number, min: number, max: number): number {
  if (max <= min) return 0.5; // If no range, return middle
  const normalized = (value - min) / (max - min);
  return Math.max(0, Math.min(1, normalized)); // Clamp to [0, 1]
}

/**
 * Compute statistics (min, max, mean) from an array of values
 */
export function computeStats(values: number[]): DataStats {
  if (values.length === 0) {
    return { min: 0, max: 1, mean: 0.5 };
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return { min, max, mean };
}

/**
 * Get color for a normalized value using thresholds
 */
export function getColorForValue(
  value: number,
  palette: string[],
  thresholds: number[]
): string {
  if (value < thresholds[0]) return palette[0];
  for (let i = 0; i < thresholds.length - 1; i++) {
    if (value >= thresholds[i] && value < thresholds[i + 1]) {
      return palette[i + 1];
    }
  }
  return palette[palette.length - 1];
}
