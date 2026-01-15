import React from 'react';
import { VALUE_PALETTE } from '../colors';

export interface DistributionBin {
  min: number;
  max: number;
  count: number;
  color: string;
}

export interface DistributionData {
  bins: DistributionBin[];
  total: number;
  min: number;
  max: number;
  mean: number;
  thresholds: number[];
}

interface DistributionChartProps {
  data: DistributionData | null;
}

export const DistributionChart: React.FC<DistributionChartProps> = ({ data }) => {
  if (!data || data.total === 0) {
    return (
      <div className="text-[9px] text-[#AFAFAF] text-center py-3" style={{ fontFamily: 'Arial, sans-serif' }}>
        Aucune donnée disponible
      </div>
    );
  }

  const maxCount = Math.max(...data.bins.map(b => b.count));

  return (
    <div className="space-y-2">
      {/* Statistics row */}
      <div className="flex justify-between text-[9px] text-[#5A5A5A] pb-1 border-b border-[#E0DDD8]" style={{ fontFamily: 'Arial, sans-serif' }}>
        <div>
          <span className="text-[#AFAFAF]">Min: </span>
          <span className="font-medium">{data.min.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-[#AFAFAF]">Moy: </span>
          <span className="font-medium">{data.mean.toFixed(2)}</span>
        </div>
        <div>
          <span className="text-[#AFAFAF]">Max: </span>
          <span className="font-medium">{data.max.toFixed(2)}</span>
        </div>
      </div>

      {/* Vertical histogram */}
      <div className="relative h-32 flex items-end justify-between gap-[2px] px-1">
        {/* Vertical separators showing thresholds at exact positions */}
        <div className="absolute left-1 right-1 top-0 pointer-events-none" style={{ height: '100px' }}>
          {data.thresholds.map((threshold, idx) => (
            <div
              key={idx}
              className="absolute top-0 bottom-0 w-px bg-[#D8D2CA] opacity-60"
              style={{ left: `${threshold * 100}%`, transform: 'translateX(-0.5px)' }}
              title={`Seuil: ${threshold.toFixed(2)}`}
            />
          ))}
        </div>

        {/* Bars */}
        {data.bins.map((bin, idx) => {
          const heightPercentage = maxCount > 0 ? (bin.count / maxCount) * 100 : 0;
          
          return (
            <div key={idx} className="flex-1 flex flex-col items-center gap-0.5 relative">
              {/* Bar */}
              <div className="w-full relative flex items-end" style={{ height: '100px' }}>
                <div
                  className="w-full rounded-t transition-all duration-300"
                  style={{
                    height: `${heightPercentage}%`,
                    backgroundColor: bin.color,
                    minHeight: bin.count > 0 ? '2px' : '0'
                  }}
                  title={`${bin.min.toFixed(3)}-${bin.max.toFixed(3)}: ${bin.count} entités`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Total count */}
      <div className="text-[9px] text-[#AFAFAF] text-center pt-1 border-t border-[#E0DDD8]" style={{ fontFamily: 'Arial, sans-serif' }}>
        {data.total} entités
      </div>
    </div>
  );
};
