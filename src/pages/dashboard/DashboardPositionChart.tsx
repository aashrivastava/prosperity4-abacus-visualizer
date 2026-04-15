import { ReactNode, useMemo } from 'react';
import { Algorithm, ProsperitySymbol } from '../../models.ts';
import { Chart } from '../visualizer/Chart.tsx';

// Known position limits per product
const knownLimits: Record<string, number> = {
  TOMATOES: 80,
  EMERALDS: 80,
};

function getLimit(algorithm: Algorithm, symbol: ProsperitySymbol): number {
  if (knownLimits[symbol] !== undefined) return knownLimits[symbol];
  // Estimate from observed max position
  const positions = algorithm.data.map(row => row.state.position[symbol] || 0);
  return Math.max(Math.abs(Math.min(...positions)), Math.max(...positions), 1);
}

export interface DashboardPositionChartProps {
  algorithm: Algorithm;
  symbol: ProsperitySymbol;
  xRange: [number, number] | null;
}

export function DashboardPositionChart({ algorithm, symbol, xRange }: DashboardPositionChartProps): ReactNode {
  const limit = useMemo(() => getLimit(algorithm, symbol), [algorithm, symbol]);

  // Position as percentage of limit
  const positionData = useMemo((): [number, number][] => {
    const data: [number, number][] = [];
    for (const row of algorithm.data) {
      const pos = row.state.position[symbol] || 0;
      data.push([row.state.timestamp, (pos / limit) * 100]);
    }
    return data;
  }, [algorithm.data, symbol, limit]);

  const series: Highcharts.SeriesOptionsType[] = useMemo(
    () => [
      {
        type: 'line' as const,
        name: `${symbol} Position`,
        data: positionData,
        color: '#3498db',
        marker: { enabled: false },
      },
    ],
    [symbol, positionData],
  );

  const options: Highcharts.Options = useMemo(
    () => ({
      chart: { height: 200 },
      yAxis: {
        allowDecimals: false,
        title: { text: '% of limit' },
        opposite: false,
        min: -100,
        max: 100,
      },
      ...(xRange ? { xAxis: { min: xRange[0], max: xRange[1] } } : {}),
    }),
    [xRange],
  );

  return <Chart title={`${symbol} — Position (% of limit)`} series={series} options={options} />;
}
