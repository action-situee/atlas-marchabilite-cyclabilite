// Discrete red→green palette matching provided scale (approximation).
// 10 segments (0-0.1 ... 0.9-1.0). Tweak hex codes if you have exact brand values.
export const VALUE_PALETTE: string[] = [
  '#B00020', // 0.0 - deep red
  '#D02F1E', // 0.1 - red
  '#E24F24', // 0.2 - orange-red
  '#FFD98A', // 0.3 - yellow (shifted earlier)
  '#F1F5A0', // 0.4 - yellow-green (slightly more yellow for smoother step)
  '#DDF4A3', // 0.5 - very light green
  '#C8EE9A', // 0.6 - light green
  '#A6E083', // 0.7 - medium green
  '#7FCB62', // 0.8 - strong green
  '#38A74A', // 0.9 - dark green
  '#007A35'  // 1.0 - deep green
];

// Thresholds corresponding to palette indices (excluding the first which is the < min color)
export const VALUE_THRESHOLDS: number[] = [0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1];
