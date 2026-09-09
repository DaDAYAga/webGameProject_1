/**
 * 法師「御風術」×2：計次；把地形推 1 格（增幅後 2 格）。
 * 可動 plain／plain_broken／plain_starter／curse；不可動 silence／punish。
 * 禁止壓頭（推到已封印單位本體 → wouldEliminate）。
 */

import {
  canPushFrom,
  canPushOnto,
  getTile,
  pushTerrain,
  type Board,
  type TerrainKind,
} from '../../board/index.js';
import {
  DEFAULT_MAP_RADIUS,
  wouldEliminate,
  type MapBounds,
} from '../../enclosure/index.js';
import { add, equals, type Axial } from '../../hex/index.js';
import type { MageActorRef, MageCardEvent, WindControlResult } from './types.js';

/** 未增幅推動步數。 */
export const WIND_BASE_STEPS = 1;
/** 增幅後推動步數。 */
export const WIND_AMPLIFIED_STEPS = 2;

/**
 * 御風術允許推動的地形 kind。
 * 為何獨立：board.kindAllowsPush 預設 silence 可推，但牌面不可動 silence。
 */
export function mageWindAllowsKind(kind: TerrainKind): boolean {
  switch (kind) {
    case 'plain':
    case 'plain_broken':
    case 'plain_starter':
    case 'curse':
      return true;
    case 'silence':
    case 'punish':
      return false;
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

/**
 * 來源格是否可被御風推動（board 可推 + 牌面 kind 允許）。
 */
export function canWindPushFrom(board: Board, hex: Axial): boolean {
  if (!canPushFrom(board, hex)) return false;
  const tile = getTile(board, hex);
  if (!tile) return false;
  return mageWindAllowsKind(tile.kind);
}

export type ResolveWindControlInput = {
  board: Board;
  /** 要推動的地形所在格。 */
  from: Axial;
  /**
   * 推動方向（應為 AXIAL_DIRECTIONS 之一）。
   * 呼叫端負責選方向。
   */
  direction: Axial;
  /** 增幅：true → 推 2 格；預設 false → 1 格。 */
  amplified?: boolean;
  /**
   * 場上單位（壓頭檢查：推到單位本體且 wouldEliminate → 禁止）。
   */
  actors?: readonly MageActorRef[];
  /**
   * 包圍邊界（壓頭用）。
   * // UNRESOLVED/param: 正式半徑未鎖定；預設測試用 DEFAULT_MAP_RADIUS。
   */
  bounds?: MapBounds;
};

/**
 * 若把地形推到 to，是否構成壓頭／壓人。
 * - 目標格有未出局單位 → 禁止（壓人）
 * - 且 wouldEliminate → 壓頭出局
 */
export function wouldWindCrush(
  board: Board,
  to: Axial,
  actors: readonly MageActorRef[],
  bounds: MapBounds,
): boolean {
  for (const a of actors) {
    if (a.eliminated === true || a.isBoss === true) continue;
    if (!equals(a.hex, to)) continue;
    // 壓頭：已封印再壓本體
    if (wouldEliminate(board, a.hex, bounds, to)) return true;
    // 推到有人站的空格也禁止
    return true;
  }
  return false;
}

/**
 * 結算御風術（純函式；失敗不改 board）。
 */
export function resolveWindControl(
  input: ResolveWindControlInput,
): WindControlResult {
  const amplified = input.amplified === true;
  const maxSteps = amplified ? WIND_AMPLIFIED_STEPS : WIND_BASE_STEPS;
  const bounds: MapBounds = input.bounds ?? { radius: DEFAULT_MAP_RADIUS };
  const actors = input.actors ?? [];
  const dir = input.direction;
  const events: MageCardEvent[] = [];

  let board = input.board;
  let cursor = input.from;

  if (!canWindPushFrom(board, cursor)) {
    const tile = getTile(board, cursor);
    const reason =
      tile?.kind === 'silence' || tile?.kind === 'punish'
        ? `cannot_move_${tile.kind}`
        : 'cannot_push_from';
    return {
      ok: false,
      reason,
      board: input.board,
      events: [],
      counted: true,
      stepsMoved: 0,
    };
  }

  for (let step = 1; step <= maxSteps; step++) {
    const to = add(cursor, dir);

    if (!canPushOnto(board, to)) {
      return {
        ok: false,
        reason: 'illegal_destination',
        board: input.board,
        events: [],
        counted: true,
        stepsMoved: 0,
      };
    }

    if (wouldWindCrush(board, to, actors, bounds)) {
      return {
        ok: false,
        reason: 'crush_eliminate',
        board: input.board,
        events: [],
        counted: true,
        stepsMoved: 0,
      };
    }

    // 每一步仍須符合御風 kind（中繼格理論上是同一塊地形）
    if (!canWindPushFrom(board, cursor)) {
      return {
        ok: false,
        reason: 'cannot_push_from',
        board: input.board,
        events: [],
        counted: true,
        stepsMoved: 0,
      };
    }

    const next = pushTerrain(board, cursor, to);
    if (!next) {
      return {
        ok: false,
        reason: 'push_failed',
        board: input.board,
        events: [],
        counted: true,
        stepsMoved: 0,
      };
    }
    board = next;
    cursor = to;
  }

  events.push({
    type: 'TerrainPushed',
    from: input.from,
    to: cursor,
    steps: maxSteps,
  });

  return {
    ok: true,
    board,
    events,
    counted: true,
    stepsMoved: maxSteps,
    finalHex: cursor,
  };
}
