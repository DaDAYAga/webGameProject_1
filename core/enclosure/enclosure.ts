/**
 * 包圍／封印／出局（core/enclosure）。
 * 純函式；不含回合、戰鬥、React。
 *
 * 規則摘要：
 * - 阻擋：圖外、王格、計入包圍的地形 kind
 * - 不阻擋：其他玩家佔格（可選 set 亦忽略）
 * - 六鄰皆擋 → 封印；已封印再壓本體格 → 出局
 */

import {
  BOSS_HEX,
  getTile,
  hexKey,
  kindCountsForEnclosure,
  type Board,
} from '../board/index.js';
import { distance, equals, neighbors, type Axial } from '../hex/index.js';
import type { EnclosureOptions, MapBounds } from './types.js';

/**
 * 建議的預設地圖半徑（測試／原型用）。
 * **UNRESOLVED/param**：正式對局半徑未鎖定；請由呼叫端明確傳入，勿當成定案常數。
 */
export const DEFAULT_MAP_RADIUS = 5;

/**
 * 判斷格是否在地圖內。
 * 為什麼：圖外視為包圍牆；半徑為參數。
 */
export function isInMap(hex: Axial, bounds: MapBounds): boolean {
  if ('isInMap' in bounds) {
    return bounds.isInMap(hex);
  }
  const origin = bounds.origin ?? BOSS_HEX;
  return distance(origin, hex) <= bounds.radius;
}

/**
 * 此格是否為包圍阻擋。
 * true：圖外、王格、或有計入包圍的地形。
 * false：圖內空格（即使有玩家站著也不擋）。
 */
export function isEnclosureBlocker(
  board: Board,
  hex: Axial,
  bounds: MapBounds,
  _opts: EnclosureOptions = {},
): boolean {
  // 單位佔格刻意忽略（_opts.occupiedByPlayers 不影響結果）
  void _opts.occupiedByPlayers;

  if (!isInMap(hex, bounds)) return true;
  if (equals(hex, BOSS_HEX)) return true;

  const tile = getTile(board, hex);
  if (!tile) return false;
  return kindCountsForEnclosure(tile.kind);
}

/**
 * 統計 actor 六鄰中有多少格為包圍阻擋（0–6）。
 */
export function countBlockedNeighbors(
  board: Board,
  hex: Axial,
  bounds: MapBounds,
  opts: EnclosureOptions = {},
): number {
  let n = 0;
  for (const nb of neighbors(hex)) {
    if (isEnclosureBlocker(board, nb, bounds, opts)) n += 1;
  }
  return n;
}

/**
 * 是否已封印：六鄰全部為包圍阻擋。
 */
export function isSealed(
  board: Board,
  actorHex: Axial,
  bounds: MapBounds,
  opts: EnclosureOptions = {},
): boolean {
  return countBlockedNeighbors(board, actorHex, bounds, opts) === 6;
}

/**
 * 是否會出局：已封印，且本次額外放置壓上該角色所在格。
 * placingAt 省略或不是 actor 格 → false（僅封印尚未出局）。
 */
export function wouldEliminate(
  board: Board,
  actorHex: Axial,
  bounds: MapBounds,
  placingAt?: Axial,
  opts: EnclosureOptions = {},
): boolean {
  if (placingAt === undefined) return false;
  if (!equals(placingAt, actorHex)) return false;
  return isSealed(board, actorHex, bounds, opts);
}

/**
 * 列舉圖內所有格（僅 radius 型 MapBounds；自訂 isInMap 無法窮舉時回 []）。
 * 為什麼：溢出檢查需掃合法空格。
 */
export function listMapHexes(bounds: MapBounds): Axial[] {
  if ('isInMap' in bounds) {
    // 自訂邊界無法窮舉；呼叫端應自行提供候選或改用 radius。
    return [];
  }
  const origin = bounds.origin ?? BOSS_HEX;
  const R = bounds.radius;
  const out: Axial[] = [];
  for (let q = -R; q <= R; q++) {
    for (let r = -R; r <= R; r++) {
      const h = { q: origin.q + q, r: origin.r + r };
      if (distance(origin, h) <= R) out.push(h);
    }
  }
  return out;
}

/**
 * 圖內可合法放置地形的空格數（非王格、無地形、在圖內）。
 */
export function countLegalEmptyCells(board: Board, bounds: MapBounds): number {
  if ('isInMap' in bounds) {
    // 無法窮舉時回 0，避免誤報「夠空」；請用 radius 邊界。
    return 0;
  }
  let n = 0;
  for (const h of listMapHexes(bounds)) {
    if (equals(h, BOSS_HEX)) continue;
    if (getTile(board, h) !== undefined) continue;
    n += 1;
  }
  return n;
}

/**
 * 多格放置是否無法被合法空格吸收（溢出／可觸發對局結束）。
 * placeCount：本次要鋪的格數。
 * true = 空格不足。
 */
export function cannotAbsorbPlacements(
  board: Board,
  bounds: MapBounds,
  placeCount: number,
): boolean {
  if (placeCount <= 0) return false;
  return countLegalEmptyCells(board, bounds) < placeCount;
}
