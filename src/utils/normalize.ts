export interface DataStats {
  min: number;
  max: number;
  mean: number;
}

export function computeStats(values: number[]): DataStats {
  if (values.length === 0) {
    return { min: 0, max: 1, mean: 0.5 };
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return { min, max, mean };
}
