import { ResultLogTradeHistoryItem } from '../../models.ts';

// 20 distinct colors for trader assignment
export const TRADER_PALETTE = [
  '#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
  '#911eb4', '#42d4f4', '#f032e6', '#bfef45', '#fabed4',
  '#469990', '#dcbeff', '#9A6324', '#fffac8', '#800000',
  '#aaffc3', '#808000', '#ffd8b1', '#000075', '#a9a9a9',
];

// Dashboard uses blue for bids (not green like Visualizer)
export function getDashboardBidColor(alpha: number): string {
  return `rgba(0, 120, 255, ${alpha})`;
}

// Stable color assignment for trader IDs
export function buildTraderColorMap(traderIds: string[]): Map<string, string> {
  const map = new Map<string, string>();
  map.set('SUBMISSION', '#ff6600');
  let idx = 0;
  for (const id of traderIds) {
    if (!map.has(id)) {
      map.set(id, TRADER_PALETTE[idx % TRADER_PALETTE.length]);
      idx++;
    }
  }
  return map;
}

// Parse traderData JSON string into numeric indicator map
export function parseTraderData(raw: string): Record<string, number> {
  if (!raw || raw.trim() === '') return {};
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const result: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'number' && isFinite(value)) {
        result[key] = value;
      }
    }
    return result;
  } catch {
    return {};
  }
}

// Classify a trade from tradeHistory
export interface TradeClassification {
  isOwn: boolean;
  traderId: string;
  markerSymbol: string; // 'cross' for own, 'square' for market maker, 'triangle' / 'triangle-down' for taker
}

export function classifyTrade(trade: ResultLogTradeHistoryItem): TradeClassification {
  const buyerIsOwn = trade.buyer.includes('SUBMISSION');
  const sellerIsOwn = trade.seller.includes('SUBMISSION');
  const isOwn = buyerIsOwn || sellerIsOwn;

  if (isOwn) {
    // Our trade — counterparty is the other side
    const traderId = buyerIsOwn ? trade.seller : trade.buyer;
    return { isOwn: true, traderId, markerSymbol: 'cross' };
  }

  // Market trade — pick buyer as the "trader" for labeling
  return { isOwn: false, traderId: trade.buyer, markerSymbol: 'square' };
}

// Collect all unique trader IDs from trade history for a given symbol
export function collectTraderIds(tradeHistory: ResultLogTradeHistoryItem[], symbol: string): string[] {
  const ids = new Set<string>();
  for (const trade of tradeHistory) {
    if (trade.symbol !== symbol) continue;
    if (!trade.buyer.includes('SUBMISSION')) ids.add(trade.buyer);
    if (!trade.seller.includes('SUBMISSION')) ids.add(trade.seller);
  }
  return Array.from(ids).sort();
}
