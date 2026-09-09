/**
 * 騎士「護身」×2：直線飛向友軍旁可站格。
 * 視線：完整牆／詛咒／懲罰／沉默擋；破碎普通牆（plain_broken）可穿越。
 * 計次；受沉默（上層擋）。
 */

import {
  BOSS_HEX,
  canStandAt,
  getTile,
  type Board,
  type Tile,
} from '../../board/index.js';
import {
  add,
  distance,
  equals,
  scale,
  subtract,
  type Axial,
  AXIAL_DIRECTIONS,
} from '../../hex/index.js';
import type { GuardResult, KnightCardEvent } from './types.js';

/**
 * 護身視線是否被此地形擋住。
 * plain_broken 可穿越；完整 plain／plain_starter／curse／punish／silence 擋。
 */
export function guardSightBlockedByTile(tile: Tile | undefined): boolean {
  if (!tile) return false;
  if (tile.kind === 'plain_broken') return false;
  if (
    tile.kind === 'plain' ||
    tile.kind === 'plain_starter' ||
    tile.kind === 'curse' ||
    tile.kind === 'punish' ||
    tile.kind === 'silence'
  ) {
    return true;
  }
  return false;
}

/**
 * 兩格是否在同一軸向直線上（且非同格）。
 * 回傳單位方向；否則 null。
 */
export function straightLineDirection(
  from: Axial,
  to: Axial,
): Axial | null {
  if (equals(from, to)) return null;
  const d = subtract(to, from);
  const dist = distance(from, to);
  if (dist <= 0) return null;
  for (const dir of AXIAL_DIRECTIONS) {
    if (equals(d, scale(dir, dist))) return dir;
  }
  return null;
}

/**
 * 直線中間格（不含兩端）。
 */
export function hexesBetweenOnLine(from: Axial, to: Axial): Axial[] {
  const dir = straightLineDirection(from, to);
  if (!dir) return [];
  const n = distance(from, to);
  const out: Axial[] = [];
  for (let i = 1; i < n; i++) {
    out.push(add(from, scale(dir, i)));
  }
  return out;
}

/**
 * 護身視線是否暢通（from→to 中間格）。
 */
export function hasGuardLineOfSight(
  board: Board,
  from: Axial,
  to: Axial,
): boolean {
  if (!straightLineDirection(from, to)) return false;
  for (const h of hexesBetweenOnLine(from, to)) {
    if (guardSightBlockedByTile(getTile(board, h))) return false;
  }
  return true;
}

export type ResolveGuardInput = {
  board: Board;
  /** 騎士目前位置。 */
  actorPosition: Axial;
  /** 目標友軍所在格。 */
  allyHex: Axial;
  /** 落點（須為友軍鄰 1 可站格）。 */
  landingHex: Axial;
  /**
   * 其他單位佔格（不可落其上；不含自己與目標友軍亦可）。
   */
  occupiedHexes?: readonly Axial[];
  bossHex?: Axial;
};

/**
 * 結算護身：直線友軍 + 視線 + 落到友軍旁可站格。
 */
export function resolveGuard(input: ResolveGuardInput): GuardResult {
  const bossHex = input.bossHex ?? BOSS_HEX;
  const { board, actorPosition, allyHex, landingHex } = input;

  if (equals(actorPosition, allyHex)) {
    return failGuard(board, actorPosition, 'target_is_self');
  }
  if (equals(allyHex, bossHex) || equals(landingHex, bossHex)) {
    return failGuard(board, actorPosition, 'boss_hex');
  }
  if (!straightLineDirection(actorPosition, allyHex)) {
    return failGuard(board, actorPosition, 'not_straight_line');
  }
  if (!hasGuardLineOfSight(board, actorPosition, allyHex)) {
    return failGuard(board, actorPosition, 'line_of_sight_blocked');
  }
  if (distance(landingHex, allyHex) !== 1) {
    return failGuard(board, actorPosition, 'landing_not_beside_ally');
  }
  if (equals(landingHex, allyHex)) {
    return failGuard(board, actorPosition, 'landing_on_ally');
  }
  if (!canStandAt(board, landingHex)) {
    return failGuard(board, actorPosition, 'landing_not_standable');
  }

  const occupied = input.occupiedHexes ?? [];
  for (const o of occupied) {
    if (equals(o, landingHex) && !equals(o, actorPosition)) {
      return failGuard(board, actorPosition, 'landing_occupied');
    }
  }

  const events: KnightCardEvent[] = [];
  if (!equals(actorPosition, landingHex)) {
    events.push({
      type: 'ActorMoved',
      from: actorPosition,
      to: landingHex,
    });
  }

  return {
    ok: true,
    board,
    actorPosition: landingHex,
    events,
    counted: true,
  };
}

function failGuard(
  board: Board,
  actorPosition: Axial,
  reason: string,
): GuardResult {
  return {
    ok: false,
    reason,
    board,
    actorPosition,
    events: [],
    counted: true,
  };
}
