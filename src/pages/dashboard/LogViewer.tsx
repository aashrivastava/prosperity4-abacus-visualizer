import { Paper, ScrollArea, Text, Title } from '@mantine/core';
import { ReactNode, useMemo } from 'react';
import { ScrollableCodeHighlight } from '../../components/ScrollableCodeHighlight.tsx';
import { Algorithm, AlgorithmDataRow, ProsperitySymbol } from '../../models.ts';
import { formatNumber } from '../../utils/format.ts';
import { parseTraderData } from './trader-utils.ts';

export interface LogViewerProps {
  algorithm: Algorithm;
  symbol: ProsperitySymbol;
  hoveredTimestamp: number | null;
}

export function LogViewer({ algorithm, symbol, hoveredTimestamp }: LogViewerProps): ReactNode {
  // Build timestamp → AlgorithmDataRow lookup
  const dataByTimestamp = useMemo(() => {
    const map = new Map<number, AlgorithmDataRow>();
    for (const row of algorithm.data) {
      map.set(row.state.timestamp, row);
    }
    return map;
  }, [algorithm.data]);

  const currentRow = hoveredTimestamp !== null ? dataByTimestamp.get(hoveredTimestamp) ?? null : null;

  const logContent = useMemo(() => {
    if (!currentRow) return null;

    const parts: string[] = [];

    // General info
    parts.push(`General:`);
    parts.push(`TIMESTAMP:${formatNumber(currentRow.state.timestamp)}`);

    // Order book depth for selected product
    const depth = currentRow.state.orderDepths[symbol];
    if (depth) {
      parts.push('');
      parts.push(`ORDER BOOK: ${symbol}`);

      // Asks sorted high → low (top of book at bottom)
      const askLevels = Object.entries(depth.sellOrders)
        .map(([p, q]) => [Number(p), q] as [number, number])
        .sort((a, b) => b[0] - a[0]);
      if (askLevels.length > 0) {
        parts.push('  ASK');
        for (const [price, qty] of askLevels) {
          parts.push(`    ${price}  x ${Math.abs(qty)}`);
        }
      }

      // Spread
      const bidLevels = Object.entries(depth.buyOrders)
        .map(([p, q]) => [Number(p), q] as [number, number])
        .sort((a, b) => b[0] - a[0]);
      if (askLevels.length > 0 && bidLevels.length > 0) {
        const spread = askLevels[askLevels.length - 1][0] - bidLevels[0][0];
        parts.push(`  --- spread: ${spread} ---`);
      }

      // Bids sorted high → low
      if (bidLevels.length > 0) {
        parts.push('  BID');
        for (const [price, qty] of bidLevels) {
          parts.push(`    ${price}  x ${qty}`);
        }
      }
    }

    // Position
    const pos = currentRow.state.position[symbol];
    if (pos !== undefined) {
      parts.push('');
      parts.push(`POSITION: ${pos}`);
    }

    // Parsed traderData indicators
    const indicators = parseTraderData(currentRow.traderData);
    if (Object.keys(indicators).length > 0) {
      parts.push('');
      parts.push('Indicators:');
      for (const [key, value] of Object.entries(indicators)) {
        parts.push(`  ${key}: ${value}`);
      }
    }

    // Orders submitted at this timestamp
    const orders = Object.entries(currentRow.orders);
    if (orders.length > 0) {
      parts.push('');
      parts.push('ORDERS:');
      for (const [sym, orderList] of orders) {
        for (const order of orderList) {
          const side = order.quantity > 0 ? 'BUY' : 'SELL';
          parts.push(`  ${sym}: ${side} ${Math.abs(order.quantity)}@${order.price}`);
        }
      }
    }

    // Algorithm logs
    if (currentRow.algorithmLogs && currentRow.algorithmLogs.trim()) {
      parts.push('');
      parts.push('LOGS:');
      parts.push(currentRow.algorithmLogs.trim());
    }

    return parts.join('\n');
  }, [currentRow, symbol]);

  return (
    <Paper withBorder shadow="xs" p="md" style={{ height: 350 }}>
      <Title order={5} mb="xs">
        Log Viewer
      </Title>
      <ScrollArea h={290} offsetScrollbars>
        {logContent ? (
          <ScrollableCodeHighlight code={logContent} language="text" />
        ) : (
          <Text size="sm" c="dimmed" ta="center" mt="xl">
            Hover over the chart to see logs
          </Text>
        )}
      </ScrollArea>
    </Paper>
  );
}
