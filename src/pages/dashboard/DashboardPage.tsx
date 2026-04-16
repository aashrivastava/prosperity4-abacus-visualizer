import { Container, Grid, Stack, Text, Title } from '@mantine/core';
import { ReactNode, useCallback, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useStore } from '../../store.ts';
import { formatNumber } from '../../utils/format.ts';
import { DashboardPnLChart } from './DashboardPnLChart.tsx';
import { DashboardPositionChart } from './DashboardPositionChart.tsx';
import { LogViewer } from './LogViewer.tsx';
import { MidPriceMode, OrderBookScatterChart } from './OrderBookScatterChart.tsx';
import { DownsamplingConfig, PerformanceControls } from './PerformanceControls.tsx';
import { SelectionControls } from './SelectionControls.tsx';
import { TradeFilterControls } from './TradeFilterControls.tsx';
import { buildTraderColorMap, collectTraderIds, parseTraderData } from './trader-utils.ts';
import { computeMidPriceMaps } from './mid-price-utils.ts';

export function DashboardPage(): ReactNode {
  const algorithm = useStore(state => state.algorithm);
  if (!algorithm) return <Navigate to="/" />;

  return <DashboardContent />;
}

// Separate component so hooks don't run when algorithm is null
function DashboardContent(): ReactNode {
  const algorithm = useStore(state => state.algorithm)!;

  // Extract available products from listings
  const products = useMemo(() => {
    const productSet = new Set<string>();
    for (const row of algorithm.data) {
      for (const sym of Object.keys(row.state.listings)) {
        productSet.add(sym);
      }
    }
    return Array.from(productSet).sort();
  }, [algorithm.data]);

  // ── State ──
  const [selectedProduct, setSelectedProduct] = useState<string>(products[0] || '');
  const [hoveredTimestamp, setHoveredTimestamp] = useState<number | null>(null);
  const [normalizeEnabled, setNormalizeEnabled] = useState(false);
  const [showOrderBook, setShowOrderBook] = useState(true);
  const [showAllTraders, setShowAllTraders] = useState(true);
  const [traderVisibility, setTraderVisibility] = useState<Record<string, boolean>>({});
  const [minQuantity, setMinQuantity] = useState(0);
  const [maxQuantity, setMaxQuantity] = useState(9999);
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([]);
  const [xRange, setXRange] = useState<[number, number] | null>(null);
  const [midPriceMode, setMidPriceMode] = useState<MidPriceMode>('mid');
  const [downsamplingConfig, setDownsamplingConfig] = useState<DownsamplingConfig>({
    ds10: 60000,
    ds100: 60000,
    ob: 3098,
    trades: 60000,
  });

  // ── Derived data ──

  // Collect all unique trader IDs for the selected product
  const traderIds = useMemo(
    () => collectTraderIds(algorithm.tradeHistory, selectedProduct),
    [algorithm.tradeHistory, selectedProduct],
  );

  // Stable color map for traders
  const traderColorMap = useMemo(() => buildTraderColorMap(traderIds), [traderIds]);

  // Parse traderData across all timestamps to discover indicator keys and build time series
  const { indicatorKeys, indicatorData } = useMemo(() => {
    const keysSet = new Set<string>();
    const dataMap = new Map<string, [number, number][]>();

    for (const row of algorithm.data) {
      const indicators = parseTraderData(row.traderData);
      const ts = row.state.timestamp;
      for (const [key, value] of Object.entries(indicators)) {
        keysSet.add(key);
        if (!dataMap.has(key)) dataMap.set(key, []);
        dataMap.get(key)!.push([ts, value]);
      }
    }

    return { indicatorKeys: Array.from(keysSet).sort(), indicatorData: dataMap };
  }, [algorithm.data]);

  // Precompute mid-price maps for normalization (Mid, WallMid, Microprice)
  const { midMap, wallMidMap, micropriceMap } = useMemo(
    () => computeMidPriceMaps(algorithm, selectedProduct),
    [algorithm, selectedProduct],
  );

  // Normalization map derived from current mid-price mode selection
  const normalizationMap = useMemo((): Map<number, number> | null => {
    if (!normalizeEnabled || midPriceMode === 'none') return null;
    if (midPriceMode === 'mid') return midMap;
    if (midPriceMode === 'wallmid') return wallMidMap;
    if (midPriceMode === 'microprice') return micropriceMap;
    return null;
  }, [normalizeEnabled, midPriceMode, midMap, wallMidMap, micropriceMap]);

  // ── Callbacks ──
  const handleHoverTimestamp = useCallback((ts: number | null) => setHoveredTimestamp(ts), []);
  const handleXRangeChange = useCallback((min: number, max: number) => setXRange([min, max]), []);

  const handleShowAllTradersChange = useCallback(
    (show: boolean) => {
      setShowAllTraders(show);
      const newVis: Record<string, boolean> = {};
      for (const id of traderIds) newVis[id] = show;
      newVis['SUBMISSION'] = show;
      setTraderVisibility(newVis);
    },
    [traderIds],
  );

  const handleTraderVisibilityChange = useCallback((traderId: string, visible: boolean) => {
    setTraderVisibility(prev => ({ ...prev, [traderId]: visible }));
    // Uncheck "All Traders" if any individual trader is turned off
    if (!visible) setShowAllTraders(false);
  }, []);

  const handleProductChange = useCallback((product: string) => {
    setSelectedProduct(product);
    setXRange(null);
    setHoveredTimestamp(null);
  }, []);

  if (products.length === 0) {
    return (
      <Container size="md" py="xl">
        <Text>No products found in loaded data.</Text>
      </Container>
    );
  }

  return (
    <Container size="xl" py="md">
      <Title order={2} mb="md">
        Dashboard — {selectedProduct} &nbsp;
        {hoveredTimestamp !== null && (
          <Text span size="lg" c="dimmed">
            T:{formatNumber(hoveredTimestamp)}
          </Text>
        )}
      </Title>

      <Grid gutter="md">
        {/* ── Left column: Charts ── */}
        <Grid.Col span={{ base: 12, md: 9 }}>
          <Stack gap="md">
            {/* Section 1: Main order book scatter */}
            <OrderBookScatterChart
              algorithm={algorithm}
              symbol={selectedProduct}
              showOrderBook={showOrderBook}
              traderVisibility={traderVisibility}
              minQuantity={minQuantity}
              maxQuantity={maxQuantity}
              normalizationMap={normalizationMap}
              selectedIndicators={selectedIndicators}
              indicatorData={indicatorData}
              traderColorMap={traderColorMap}
              midPriceMode={midPriceMode}
              onHoverTimestamp={handleHoverTimestamp}
              onXRangeChange={handleXRangeChange}
              downsamplingConfig={downsamplingConfig}
            />

            {/* Section 2: PnL */}
            <DashboardPnLChart algorithm={algorithm} symbol={selectedProduct} xRange={xRange} />

            {/* Section 3: Position */}
            <DashboardPositionChart algorithm={algorithm} symbol={selectedProduct} xRange={xRange} />
          </Stack>
        </Grid.Col>

        {/* ── Right column: Controls ── */}
        <Grid.Col span={{ base: 12, md: 3 }}>
          <Stack gap="md">
            {/* Section 4: Log viewer */}
            <LogViewer algorithm={algorithm} symbol={selectedProduct} hoveredTimestamp={hoveredTimestamp} />

            {/* Section 5: Selection controls */}
            <SelectionControls
              products={products}
              selectedProduct={selectedProduct}
              onProductChange={handleProductChange}
              indicatorKeys={indicatorKeys}
              selectedIndicators={selectedIndicators}
              onIndicatorsChange={setSelectedIndicators}
              normalizeEnabled={normalizeEnabled}
              onNormalizeChange={setNormalizeEnabled}
              midPriceMode={midPriceMode}
              onMidPriceModeChange={setMidPriceMode}
            />

            {/* Section 6: Trade filters */}
            <TradeFilterControls
              showOrderBook={showOrderBook}
              onShowOrderBookChange={setShowOrderBook}
              showAllTraders={showAllTraders}
              onShowAllTradersChange={handleShowAllTradersChange}
              traderIds={traderIds}
              traderVisibility={traderVisibility}
              onTraderVisibilityChange={handleTraderVisibilityChange}
              traderColorMap={traderColorMap}
              minQuantity={minQuantity}
              maxQuantity={maxQuantity}
              onMinQuantityChange={setMinQuantity}
              onMaxQuantityChange={setMaxQuantity}
            />

            {/* Section 7: Performance controls */}
            <PerformanceControls config={downsamplingConfig} onChange={setDownsamplingConfig} />
          </Stack>
        </Grid.Col>
      </Grid>
    </Container>
  );
}
