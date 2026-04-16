import Highcharts from 'highcharts/highstock';
import HighchartsAccessibility from 'highcharts/modules/accessibility';
import HighchartsExporting from 'highcharts/modules/exporting';
import HighchartsOfflineExporting from 'highcharts/modules/offline-exporting';
import HighchartsHighContrastDarkTheme from 'highcharts/themes/high-contrast-dark';
import HighchartsReact from 'highcharts-react-official';
import merge from 'lodash/merge';
import { ReactNode, useCallback, useMemo, useRef } from 'react';
import { useActualColorScheme } from '../../hooks/use-actual-color-scheme.ts';
import { Algorithm, ProsperitySymbol, ResultLogTradeHistoryItem } from '../../models.ts';
import { getAskColor } from '../../utils/colors.ts';
import { formatNumber } from '../../utils/format.ts';
import { getThemeOptions } from '../visualizer/Chart.tsx';
import { findWallPrice } from './mid-price-utils.ts';
import { classifyTrade, getDashboardBidColor } from './trader-utils.ts';

HighchartsAccessibility(Highcharts);
HighchartsExporting(Highcharts);
HighchartsOfflineExporting(Highcharts);

export type MidPriceMode = 'mid' | 'wallmid' | 'microprice' | 'none';

export interface OrderBookScatterChartProps {
  algorithm: Algorithm;
  symbol: ProsperitySymbol;
  showOrderBook: boolean;
  traderVisibility: Record<string, boolean>;
  minQuantity: number;
  maxQuantity: number;
  normalizationMap: Map<number, number> | null;
  selectedIndicators: string[];
  indicatorData: Map<string, [number, number][]>;
  traderColorMap: Map<string, string>;
  midPriceMode: MidPriceMode;
  onHoverTimestamp: (timestamp: number | null) => void;
  onXRangeChange: (min: number, max: number) => void;
  downsamplingConfig: { ds10: number; ds100: number; ob: number; trades: number };
}

export function OrderBookScatterChart({
  algorithm,
  symbol,
  showOrderBook,
  traderVisibility,
  minQuantity,
  maxQuantity,
  normalizationMap,
  selectedIndicators,
  indicatorData,
  traderColorMap,
  midPriceMode,
  onHoverTimestamp,
  onXRangeChange,
  downsamplingConfig,
}: OrderBookScatterChartProps): ReactNode {
  const colorScheme = useActualColorScheme();
  const chartRef = useRef<HighchartsReact.RefObject>(null);

  // Sorted timestamps for snapping mouse position to nearest data point
  const timestamps = useMemo(() => {
    const ts = new Set<number>();
    for (const row of algorithm.activityLogs) {
      if (row.product === symbol) ts.add(row.timestamp);
    }
    return Array.from(ts).sort((a, b) => a - b);
  }, [algorithm.activityLogs, symbol]);

  // Binary search: snap an x-value to the closest known timestamp
  const snapToTimestamp = useCallback(
    (xVal: number): number | null => {
      if (timestamps.length === 0) return null;
      let lo = 0;
      let hi = timestamps.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (timestamps[mid] < xVal) lo = mid + 1;
        else hi = mid;
      }
      if (lo > 0 && Math.abs(timestamps[lo - 1] - xVal) < Math.abs(timestamps[lo] - xVal)) {
        return timestamps[lo - 1];
      }
      return timestamps[lo];
    },
    [timestamps],
  );

  // Sorted keys from normalization map for nearest-timestamp lookup
  const normTimestamps = useMemo(() => {
    if (!normalizationMap) return [];
    return Array.from(normalizationMap.keys()).sort((a, b) => a - b);
  }, [normalizationMap]);

  // Normalize a price value at a given timestamp (snaps to nearest norm timestamp)
  const normalize = useCallback(
    (price: number, timestamp: number): number => {
      if (!normalizationMap || normTimestamps.length === 0) return price;
      // Try exact match first
      const exact = normalizationMap.get(timestamp);
      if (exact !== undefined) return price - exact;
      // Binary search for nearest timestamp
      let lo = 0;
      let hi = normTimestamps.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (normTimestamps[mid] < timestamp) lo = mid + 1;
        else hi = mid;
      }
      const nearest = lo > 0 && Math.abs(normTimestamps[lo - 1] - timestamp) < Math.abs(normTimestamps[lo] - timestamp)
        ? normTimestamps[lo - 1]
        : normTimestamps[lo];
      const normVal = normalizationMap.get(nearest);
      return normVal !== undefined ? price - normVal : price;
    },
    [normalizationMap, normTimestamps],
  );

  // Mid price line series — always present with mouse tracking for crosshair anchor
  const midPriceSeries = useMemo((): Highcharts.SeriesOptionsType[] => {
    if (midPriceMode === 'none') {
      // Still need an invisible tracking series for the crosshair to work
      const data: [number, number][] = [];
      for (const row of algorithm.activityLogs) {
        if (row.product === symbol) data.push([row.timestamp, row.midPrice]);
      }
      return [{
        type: 'line',
        name: 'Tracking',
        data,
        color: 'transparent',
        lineWidth: 0,
        marker: { enabled: false },
        enableMouseTracking: true,
        showInLegend: false,
        states: { hover: { lineWidthPlus: 0 } },
      }];
    }

    if (midPriceMode === 'mid') {
      // Regular mid price: (bestBid + bestAsk) / 2
      const data: [number, number][] = [];
      for (const row of algorithm.activityLogs) {
        if (row.product === symbol) {
          data.push([row.timestamp, normalize(row.midPrice, row.timestamp)]);
        }
      }
      return [{
        type: 'line',
        name: 'Mid Price',
        data,
        color: 'gray',
        dashStyle: 'Dash',
        lineWidth: 1.5,
        marker: { enabled: false },
        enableMouseTracking: true,
      }];
    }

    if (midPriceMode === 'wallmid') {
      // Wall mid: find the bid/ask "wall" (price level with max liquidity),
      // then among levels within nStd of that max volume, take the most
      // aggressive price (max bid, min ask). Wall mid = (bidWall + askWall) / 2.
      const nStd = 1;
      const data: [number, number][] = [];
      for (const row of algorithm.activityLogs) {
        if (row.product !== symbol) continue;
        if (row.bidPrices.length < 1 || row.askPrices.length < 1) continue;

        // Bid wall: find max-volume level, filter by n-std, take max price
        const bidWallPrice = findWallPrice(row.bidPrices, row.bidVolumes, nStd, 'bid');
        // Ask wall: find max-volume level, filter by n-std, take min price
        const askWallPrice = findWallPrice(row.askPrices, row.askVolumes, nStd, 'ask');
        if (bidWallPrice === null || askWallPrice === null) continue;

        const wallMid = (bidWallPrice + askWallPrice) / 2;
        data.push([row.timestamp, normalize(wallMid, row.timestamp)]);
      }
      return [{
        type: 'line',
        name: 'Wall Mid',
        data,
        color: '#e67e22',
        dashStyle: 'ShortDot',
        lineWidth: 1.5,
        marker: { enabled: false },
        enableMouseTracking: true,
      }];
    }

    if (midPriceMode === 'microprice') {
      // Microprice: best_bid * bestAskVol + best_ask * bestBidVol / totalVol
      const data: [number, number][] = [];
      for (const row of algorithm.activityLogs) {
        if (row.product !== symbol) continue;
        if (row.bidPrices.length < 1 || row.askPrices.length < 1) continue;
        const bestBid = row.bidPrices[0];
        const bestAsk = row.askPrices[0];
        const bestBidVol = row.bidVolumes[0];
        const bestAskVol = row.askVolumes[0];
        const volume = bestBidVol + bestAskVol;
        if (volume === 0) continue;
        const microprice = (bestBid * bestAskVol + bestAsk * bestBidVol) / volume;
        data.push([row.timestamp, normalize(microprice, row.timestamp)]);
      }
      return [{
        type: 'line',
        name: 'Microprice',
        data,
        color: '#9b59b6',
        dashStyle: 'LongDash',
        lineWidth: 1.5,
        marker: { enabled: false },
        enableMouseTracking: true,
      }];
    }

    return [];
  }, [algorithm.activityLogs, symbol, midPriceMode, normalize]);

  // Build order book scatter series from activity logs
  const obSeries = useMemo((): Highcharts.SeriesOptionsType[] => {
    if (!showOrderBook) return [];

    const bidData: { [level: number]: Highcharts.PointOptionsObject[] } = { 1: [], 2: [], 3: [] };
    const askData: { [level: number]: Highcharts.PointOptionsObject[] } = { 1: [], 2: [], 3: [] };

    // Downsample OB data based on threshold
    const totalOBPoints = algorithm.activityLogs.filter(r => r.product === symbol).length;
    const obStride = totalOBPoints > downsamplingConfig.ob ? Math.ceil(totalOBPoints / downsamplingConfig.ob) : 1;
    let obIdx = 0;

    for (const row of algorithm.activityLogs) {
      if (row.product !== symbol) continue;
      obIdx++;
      if (obStride > 1 && obIdx % obStride !== 0) continue;

      for (let i = 0; i < row.bidPrices.length && i < 3; i++) {
        bidData[i + 1].push({
          x: row.timestamp,
          y: normalize(row.bidPrices[i], row.timestamp),
          custom: { quantity: row.bidVolumes[i] },
        });
      }
      for (let i = 0; i < row.askPrices.length && i < 3; i++) {
        askData[i + 1].push({
          x: row.timestamp,
          y: normalize(row.askPrices[i], row.timestamp),
          custom: { quantity: row.askVolumes[i] },
        });
      }
    }

    const series: Highcharts.SeriesOptionsType[] = [];
    const bidAlphas = [1.0, 0.65, 0.35];
    const askAlphas = [1.0, 0.65, 0.35];

    for (let level = 1; level <= 3; level++) {
      if (bidData[level].length > 0) {
        series.push({
          type: 'scatter',
          name: `Bid ${level}`,
          color: getDashboardBidColor(bidAlphas[level - 1]),
          data: bidData[level],
          marker: { symbol: 'circle', radius: 2 },
          enableMouseTracking: false,
          dataGrouping: { enabled: false },
          boostThreshold: 5000,
        });
      }
      if (askData[level].length > 0) {
        series.push({
          type: 'scatter',
          name: `Ask ${level}`,
          color: getAskColor(askAlphas[level - 1]),
          data: askData[level],
          marker: { symbol: 'circle', radius: 2 },
          enableMouseTracking: false,
          dataGrouping: { enabled: false },
          boostThreshold: 5000,
        });
      }
    }

    return series;
  }, [algorithm.activityLogs, symbol, showOrderBook, normalize, downsamplingConfig.ob]);

  // Build trade marker series grouped by trader
  const tradeSeries = useMemo((): Highcharts.SeriesOptionsType[] => {
    const traderTrades = new Map<string, Highcharts.PointOptionsObject[]>();
    const ownTrades: Highcharts.PointOptionsObject[] = [];

    // Downsample trades
    const symbolTrades = algorithm.tradeHistory.filter(t => t.symbol === symbol);
    const totalTrades = symbolTrades.length;
    const tradeStride = totalTrades > downsamplingConfig.trades ? Math.ceil(totalTrades / downsamplingConfig.trades) : 1;

    symbolTrades.forEach((trade: ResultLogTradeHistoryItem, idx: number) => {
      if (tradeStride > 1 && idx % tradeStride !== 0) return;
      if (trade.quantity < minQuantity || trade.quantity > maxQuantity) return;

      const classification = classifyTrade(trade);
      const point: Highcharts.PointOptionsObject = {
        x: trade.timestamp,
        y: normalize(trade.price, trade.timestamp),
        custom: { quantity: trade.quantity, buyer: trade.buyer, seller: trade.seller },
      };

      if (classification.isOwn) {
        ownTrades.push(point);
      } else {
        const traderId = classification.traderId;
        if (traderVisibility[traderId] === false) return;
        if (!traderTrades.has(traderId)) traderTrades.set(traderId, []);
        traderTrades.get(traderId)!.push(point);
      }
    });

    const series: Highcharts.SeriesOptionsType[] = [];

    const tradeTooltip: Highcharts.SeriesTooltipOptionsObject = {
      pointFormatter(this: Highcharts.Point) {
        const { quantity, buyer, seller } = (this as any).custom ?? {};
        return `<span style="color:${this.color}">\u25CF</span> ${this.series.name}: <b>${this.y}</b> (qty: ${quantity}, buyer: ${buyer}, seller: ${seller})<br/>`;
      },
    };

    // Own trades
    if (ownTrades.length > 0 && traderVisibility['SUBMISSION'] !== false) {
      series.push({
        type: 'scatter',
        name: 'Own Trades',
        color: traderColorMap.get('SUBMISSION') || '#ff6600',
        data: ownTrades,
        marker: { symbol: 'cross', radius: 6, lineWidth: 2, lineColor: traderColorMap.get('SUBMISSION') || '#ff6600' },
        tooltip: tradeTooltip,
        dataGrouping: { enabled: false },
      });
    }

    // Per-trader series
    for (const [traderId, points] of traderTrades) {
      const color = traderColorMap.get(traderId) || '#a9a9a9';
      series.push({
        type: 'scatter',
        name: traderId,
        color,
        data: points,
        marker: { symbol: 'square', radius: 4 },
        tooltip: tradeTooltip,
        dataGrouping: { enabled: false },
      });
    }

    return series;
  }, [algorithm.tradeHistory, symbol, traderVisibility, minQuantity, maxQuantity, normalize, traderColorMap, downsamplingConfig.trades]);

  // Indicator overlay line series
  const indicatorSeries = useMemo((): Highcharts.SeriesOptionsType[] => {
    return selectedIndicators.map((key, idx) => {
      const data = indicatorData.get(key) || [];
      const normalizedData = normalizationMap
        ? data.map(([ts, val]): [number, number] => [ts, val - (normalizationMap.get(ts) ?? 0)])
        : data;
      return {
        type: 'line' as const,
        name: key,
        data: normalizedData,
        color: ['#00ff88', '#ff00ff', '#ffff00', '#00ffff'][idx % 4],
        dashStyle: 'ShortDash' as const,
        lineWidth: 2,
        marker: { enabled: false },
        enableMouseTracking: false,
        dataGrouping: { enabled: false },
      };
    });
  }, [selectedIndicators, indicatorData, normalizationMap]);

  // Mid price first so it's the primary tracking series for the crosshair
  const allSeries = useMemo(
    () => [...midPriceSeries, ...obSeries, ...tradeSeries, ...indicatorSeries],
    [midPriceSeries, obSeries, tradeSeries, indicatorSeries],
  );

  const fullOptions = useMemo((): Highcharts.Options => {
    const themeOptions = colorScheme === 'light' ? {} : getThemeOptions(HighchartsHighContrastDarkTheme);

    const chartOptions: Highcharts.Options = {
      chart: {
        animation: false,
        height: 600,
        zooming: { type: 'x' },
        panning: { enabled: true, type: 'x' },
        panKey: 'shift',
        numberFormatter: formatNumber,
        events: {
          load() {
            // Custom tooltip header — also drives onHoverTimestamp so log viewer matches
            Highcharts.addEvent(this.tooltip, 'headerFormatter', (e: any) => {
              if (e.isFooter) return true;
              let timestamp = e.labelConfig.point.x;
              if (e.labelConfig.point.dataGroup) {
                const xData = e.labelConfig.series.xData;
                const lastTimestamp = xData[xData.length - 1];
                if (timestamp + 100 * e.labelConfig.point.dataGroup.length >= lastTimestamp) {
                  timestamp = lastTimestamp;
                }
              }
              // Snap to nearest real timestamp so log viewer gets valid data
              const snapped = snapToTimestamp(timestamp);
              if (snapped !== null) {
                timestamp = snapped;
                onHoverTimestamp(snapped);
              }
              e.text = `Timestamp ${formatNumber(timestamp)}<br/>`;
              return false;
            });
          },
        },
      },
      title: { text: `${symbol} — Order Book` },
      credits: {
        href: 'javascript:window.open("https://www.highcharts.com/?credits", "_blank")',
      },
      plotOptions: {
        series: {
          dataGrouping: {
            anchor: 'start',
            firstAnchor: 'firstPoint',
            lastAnchor: 'lastPoint',
            units: [['second', [1, 2, 5, 10]]],
          },
        },
      },
      xAxis: {
        type: 'datetime',
        title: { text: 'Timestamp' },
        crosshair: { width: 1 },
        labels: { formatter: params => formatNumber(params.value as number) },
        events: {
          afterSetExtremes(e) {
            if (e.min != null && e.max != null) {
              onXRangeChange(e.min, e.max);
            }
          },
        },
      },
      yAxis: {
        opposite: false,
        allowDecimals: true,
        title: { text: 'Price' },
      },
      tooltip: { split: false, shared: false, outside: true },
      legend: { enabled: true },
      rangeSelector: { enabled: false },
      navigator: { enabled: false },
      scrollbar: { enabled: false },
      series: allSeries,
    };

    return merge(themeOptions, chartOptions);
  }, [colorScheme, symbol, allSeries, onHoverTimestamp, onXRangeChange, snapToTimestamp]);

  return <HighchartsReact ref={chartRef} highcharts={Highcharts} constructorType={'stockChart'} options={fullOptions} immutable />;
}
