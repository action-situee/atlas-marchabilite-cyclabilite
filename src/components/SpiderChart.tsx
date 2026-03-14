import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { getModeTheme, type AtlasMode } from '../config/modes';

interface SpiderChartProps {
  attributeData: any;
  mode: AtlasMode;
  classOrder: string[];
}

export function SpiderChart({ attributeData, mode, classOrder }: SpiderChartProps) {
  const theme = getModeTheme(mode);
  const data = classOrder.map((className) => {
    const classInfo = (attributeData as any)[className] || { average: 0, color: '#ccc' };
    return {
      subject: className,
      value: classInfo.average || 0,
      fullMark: 1,
      color: classInfo.color || '#ccc'
    };
  });
  const outerRadius = classOrder.length > 4 ? '72%' : '80%';
  const chartHeight = classOrder.length > 4 ? 224 : 192;

  return (
    <div className="w-full" style={{ height: chartHeight }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} margin={{ top: 24, right: 30, bottom: 30, left: 30 }} outerRadius={outerRadius} startAngle={90} endAngle={-270}>
          <PolarGrid stroke={theme.radarGrid} strokeWidth={1} />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: theme.accentDark, fontSize: 10, fontFamily: 'Arial, sans-serif' }}
            tickLine={false}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 1]}
            tick={{ fill: theme.accentDark, fontSize: 9, fontFamily: 'Arial, sans-serif' }}
            tickCount={6}
            stroke={theme.radarGrid}
            axisLine={false}
          />
          <Radar
            name="Score"
            dataKey="value"
            stroke={theme.accent}
            fill={theme.accent}
            fillOpacity={0.18}
            strokeWidth={2}
            isAnimationActive={false}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
