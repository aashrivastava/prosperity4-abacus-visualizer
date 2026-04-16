import { Algorithm, ProsperitySymbol } from '../../models.ts';

// Find the "wall" price on one side of the book.
// Identifies max-volume level, filters by nStd of that max, returns most aggressive price.
export function findWallPrice(
  prices: number[],
  volumes: number[],
  nStd: number,
  side: 'bid' | 'ask',
): number | null {
  if (prices.length === 0) return null;

  let maxVol = 0;
  for (const v of volumes) {
    if (v > maxVol) maxVol = v;
  }
  if (maxVol === 0) return prices[0];

  const n = volumes.length;
  const mean = volumes.reduce((a, b) => a + b, 0) / n;
  const variance = volumes.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  const threshold = maxVol - nStd * std;

  let result: number | null = null;
  for (let i = 0; i < prices.length; i++) {
    if (volumes[i] >= threshold) {
      if (result === null) {
        result = prices[i];
      } else {
        result = side === 'bid' ? Math.max(result, prices[i]) : Math.min(result, prices[i]);
      }
    }
  }
  return result;
}

// Computed mid-price mode identifiers used as normalization keys
export const COMPUTED_MID_KEY = '__mid__';
export const COMPUTED_WALLMID_KEY = '__wallmid__';
export const COMPUTED_MICROPRICE_KEY = '__microprice__';

// Build timestamp→value maps for each computed mid-price mode
export function computeMidPriceMaps(
  algorithm: Algorithm,
  symbol: ProsperitySymbol,
): { midMap: Map<number, number>; wallMidMap: Map<number, number>; micropriceMap: Map<number, number> } {
  const midMap = new Map<number, number>();
  const wallMidMap = new Map<number, number>();
  const micropriceMap = new Map<number, number>();

  for (const row of algorithm.activityLogs) {
    if (row.product !== symbol) continue;
    const ts = row.timestamp;

    // Mid price
    midMap.set(ts, row.midPrice);

    // Wall mid
    if (row.bidPrices.length >= 1 && row.askPrices.length >= 1) {
      const bidWall = findWallPrice(row.bidPrices, row.bidVolumes, 1, 'bid');
      const askWall = findWallPrice(row.askPrices, row.askVolumes, 1, 'ask');
      if (bidWall !== null && askWall !== null) {
        wallMidMap.set(ts, (bidWall + askWall) / 2);
      }
    }

    // Microprice
    if (row.bidPrices.length >= 1 && row.askPrices.length >= 1) {
      const vol = row.bidVolumes[0] + row.askVolumes[0];
      if (vol > 0) {
        micropriceMap.set(ts, (row.bidPrices[0] * row.askVolumes[0] + row.askPrices[0] * row.bidVolumes[0]) / vol);
      }
    }
  }

  return { midMap, wallMidMap, micropriceMap };
}
