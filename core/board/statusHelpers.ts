/**
 * 詛咒攜帶上限／鄰沉默／鄰泥濘（薄輔助；上身與出牌擋在上層）。
 */
import { equals, neighbors, type Axial } from '../hex/index.js';
import { BOSS_HEX, absorbCurseAt, getTile, placeTerrain } from './board.js';
import type { Board } from './types.js';

/** 基礎移動預設上限（與試玩 TURN_MOVES_PER_ROUND 對齊）。 */
export const BASIC_MOVE_BASE = 2;

/** 騎士被動「多踩一格」：攜帶上限 2；其餘職業 1。 */
export function curseCarryCap(classId: string): number {
  return classId === 'knight' ? 2 : 1;
}

/** 是否鄰 1 有 silence 地形（出牌層擋 silenced 牌）。 */
export function isAdjacentToSilence(board: Board, hex: Axial): boolean {
  for (const n of neighbors(hex)) {
    if (getTile(board, n)?.kind === 'silence') return true;
  }
  return false;
}

/** 是否鄰 1 有 mud 地形（僅扣基礎移動，不扣牌移動）。 */
export function isAdjacentToMud(board: Board, hex: Axial): boolean {
  for (const n of neighbors(hex)) {
    if (getTile(board, n)?.kind === 'mud') return true;
  }
  return false;
}

/**
 * 本回合基礎移動上限。鄰泥濘 −1（不低於 0）。
 * 卡牌移動（大亂流／衝鋒／御風）不走此 cap。
 */
export function basicMoveCap(
  board: Board,
  hex: Axial,
  base: number = BASIC_MOVE_BASE,
): number {
  return Math.max(0, base - (isAdjacentToMud(board, hex) ? 1 : 0));
}

/**
 * 沿路徑每一格 absorb curse（含起點若仍有）；層數只加到 cap。
 * 回傳清格後 board、新 stacks、實際清掉的格。
 */
export function absorbCursesAlongPath(
  board: Board,
  path: readonly Axial[],
  startStacks: number,
  cap: number,
): { board: Board; curseStacks: number; absorbedHexes: Axial[] } {
  let next = board;
  let stacks = Math.max(0, startStacks);
  const absorbedHexes: Axial[] = [];
  for (const hex of path) {
    const cleared = absorbCurseAt(next, hex);
    if (!cleared) continue;
    next = cleared;
    absorbedHexes.push({ q: hex.q, r: hex.r });
    if (stacks < cap) stacks += 1;
  }
  return { board: next, curseStacks: stacks, absorbedHexes };
}

/**
 * 出局離場：若該格仍空，鋪未老化一般格（caller 登錄老化）。
 * 已有地形（包圍壓上）不重複鋪。
 */
export function placeUnagedPlainIfEmpty(
  board: Board,
  hex: Axial,
): { board: Board; placed: boolean } {
  if (getTile(board, hex)) return { board, placed: false };
  return { board: placeTerrain(board, hex, 'plain'), placed: true };
}

/**
 * 本次吸咒後是否達 cap 而須立刻走「咒滿 → 周圍鋪一般 → 封印」（不可停在 cap 上）。
 * absorbedCount=0 不觸發。不離場、不設 eliminated。
 */
export function curseFullAfterAbsorb(
  classId: string,
  curseStacks: number,
  absorbedCount: number,
): boolean {
  return absorbedCount > 0 && curseStacks >= curseCarryCap(classId);
}

/**
 * 咒滿：每個空鄰格鋪未老化一般（不吃種類袋）。
 * 跳過：既有地形、王格、有存活單位佔格的鄰格。
 * 新 plain 進入老化管線（caller 登錄 ageKeys）。
 */
export function fillNeighborsWithPlain(
  board: Board,
  center: Axial,
  occupied: readonly Axial[],
): { board: Board; placed: Axial[] } {
  let next = board;
  const placed: Axial[] = [];
  for (const n of neighbors(center)) {
    if (equals(n, BOSS_HEX)) continue;
    if (getTile(next, n)) continue;
    if (occupied.some((o) => equals(o, n))) continue;
    const r = placeUnagedPlainIfEmpty(next, n);
    if (r.placed) {
      next = r.board;
      placed.push({ q: n.q, r: n.r });
    }
  }
  return { board: next, placed };
}
