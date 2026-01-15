import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { CLASS_ORDER as ORDER } from '../config/classes';

interface SpiderChartProps {
  attributeData: any;
}

export function SpiderChart({ attributeData }: SpiderChartProps) {
  // Ordre souhaité et positions, centralisé dans config
  const data = ORDER.map((className) => {
    const classInfo = (attributeData as any)[className] || { average: 0, color: '#ccc' };
    return {
      subject: className,
      value: classInfo.average || 0,
      fullMark: 1,
      color: classInfo.color || '#ccc'
    };
  });

  return (
    <div className="w-full h-48">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} margin={{ top: 22, right: 28, bottom: 26, left: 28 }} outerRadius="80%" startAngle={90} endAngle={-270}>
          <PolarGrid stroke="#D8D2CA" strokeWidth={1} />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: '#3A3A3A', fontSize: 10, fontFamily: 'Arial, sans-serif' }}
            tickLine={false}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 1]}
            tick={{ fill: '#7A7A7A', fontSize: 9, fontFamily: 'Arial, sans-serif' }}
            tickCount={6}
            stroke="#D8D2CA"
            axisLine={false}
          />
          <Radar
            name="Score"
            dataKey="value"
            stroke="#D35941"
            fill="#D35941"
            fillOpacity={0.15}
            strokeWidth={2}
            isAnimationActive={false}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}