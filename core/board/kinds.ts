/**
 * 地形種類屬性查表（handoff §4）。
 * 包圍（enclosure）演算法見 core/enclosure；此處僅資料層標記。
 * UNRESOLVED 行為以註解標明，不自行發明。
 */

import type { TerrainKind, Tile } from './types.js';

/**
 * 此 kind 是否計入包圍（資料層標記；實際包圍演算法在 core/enclosure）。
 * 為什麼：所有表列 kind 皆「是」；空格不算。
 */
export function kindCountsForEnclosure(kind: TerrainKind): boolean {
  // enclosure: plain / plain_broken / plain_starter / punish / curse / silence → 皆是
  void kind;
  return true;
}

/**
 * 玩家預設能否站在此地形上。
 * - plain 系、punish：否
 * - curse：可（自願踩則上身；上身結算不在本層）
 * - silence：預設否（// UNRESOLVED: 是否另有例外可踩）
 */
export function kindAllowsStand(kind: TerrainKind): boolean {
  switch (kind) {
    case 'plain':
    case 'plain_broken':
    case 'plain_starter':
    case 'punish':
      return false;
    case 'curse':
      // 自願踩則上身：站格允許，詛咒層數由上層處理
      return true;
    case 'silence':
      // UNRESOLVED: 沉默格踩／一般拆 — 預設不可站
      return false;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

/**
 * 此地形能否被「推」（例如御風術搬移牆）。
 * punish：否；silence：表定預設可（牌面另有限制時由上層收斂）。
 */
export function kindAllowsPush(kind: TerrainKind): boolean {
  switch (kind) {
    case 'plain':
    case 'plain_broken':
    case 'plain_starter':
    case 'curse':
      return true;
    case 'punish':
      return false;
    case 'silence':
      // 交接表：預設可推；御風術牌面寫不可動 silence — 以牌面／上層為準
      return true;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

/**
 * 一般攻擊／拆牆能否對此 kind 做「破碎／拆掉」。
 * curse：否（要吃掉）；punish：否；silence：UNRESOLVED → 本層回 false。
 */
export function kindAllowsCrack(kind: TerrainKind): boolean {
  switch (kind) {
    case 'plain':
    case 'plain_broken':
    case 'plain_starter':
      return true;
    case 'punish':
      return false;
    case 'curse':
      // 否（要吃掉）— 一般拆不適用
      return false;
    case 'silence':
      // UNRESOLVED: 沉默格一般拆
      return false;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

/**
 * 此格銷毀時是否依規則傷王。
 * plain／plain_broken：僅已老化才傷王（開場牆預設已 aged，故拆掉傷王與此對齊）。
 * plain_starter：依 aged（開場預設不再用此 kind；保留查表相容）。
 * // UNRESOLVED: 吃掉詛咒格是否傷王
 */
export function tileDestroyDamagesBoss(tile: Tile): boolean {
  if (tile.kind === 'curse') {
    // UNRESOLVED: 吃掉詛咒格是否傷王
    return false;
  }
  if (tile.kind === 'plain' || tile.kind === 'plain_broken' || tile.kind === 'plain_starter') {
    return tile.aged === true;
  }
  return false;
}

/**
 * 建立預設 Tile（放置時用）。
 * plain_starter 隱含 noAge；其餘 aged 預設 false。
 */
export function makeTile(
  kind: TerrainKind,
  opts: { aged?: boolean; noAge?: boolean } = {},
): Tile {
  if (kind === 'plain_starter') {
    return { kind, aged: false, noAge: true };
  }
  const tile: Tile = { kind };
  if (opts.aged !== undefined) tile.aged = opts.aged;
  if (opts.noAge !== undefined) tile.noAge = opts.noAge;
  return tile;
}
