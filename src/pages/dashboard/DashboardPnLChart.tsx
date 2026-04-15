import { ReactNode, useMemo } from 'react';
import { Algorithm, ProsperitySymbol } from '../../models.ts';
import { Chart } from '../visualizer/Chart.tsx';

export interface DashboardPnLChartProps {
  algorithm: Algorithm;
  symbol: ProsperitySymbol;
  xRange: [number, number] | null;
}

export function DashboardPnLChart({ algorithm, symbol, xRange }: DashboardPnLChartProps): ReactNode {
  // Extract per-product PnL time series
  const pnlData = useMemo((): [number, number][] => {
    const data: [number, number][] = [];
    for (const row of algorithm.activityLogs) {
      if (row.product === symbol) {
        data.push([row.timestamp, row.profitLoss]);
      }
    }
    return data;
  }, [algorithm.activityLogs, symbol]);

  const series: Highcharts.SeriesOptionsType[] = useMemo(
    () => [
      {
        type: 'line' as const,
        name: `${symbol} PnL`,
        data: pnlData,
        color: '#2ecc71',
        marker: { enabled: false },
      },
    ],
    [symbol, pnlData],
  );

  // Sync x-axis range from main chart
  const options: Highcharts.Options = useMemo(
    () => ({
      chart: { height: 200 },
      yAxis: { allowDecimals: true, title: { text: 'PnL' }, opposite: false },
      ...(xRange ? { xAxis: { min: xRange[0], max: xRange[1] } } : {}),
    }),
    [xRange],
  );

  return <Chart title={`${symbol} — PnL`} series={series} options={options} />;
}
