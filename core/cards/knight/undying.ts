/**
 * 騎士「不死存在」×1（2026-09-14f）：封印中可出；落點無周圍特效。
 * 不再要求 isDead／輪末；落點僅搬移並解除封印（上層清 sealed 後再算包圍）。
 */

import { canStandAt, type Board } from '../../board/index.js';
import { equals, type Axial } from '../../hex/index.js';
import type { KnightCardEvent, UndyingResult } from './types.js';

export type ResolveUndyingInput = {
  board: Board;
  /** 落地格（可站、非王、非佔格）。 */
  landingHex: Axial;
  /** 是否已封印（未封印不可觸發）。 */
  isSealed: boolean;
  /** 手牌是否持有不死存在。 */
  hasUndyingInHand: boolean;
  /** 其他單位佔格（不含自己亦可；等於落點則拒絕）。 */
  occupiedHexes?: readonly Axial[];
};

/**
 * 結算不死存在（純函式）。
 * 成功：僅回傳落點與強制結束；**不**變更周圍地形。
 */
export function resolveUndying(input: ResolveUndyingInput): UndyingResult {
  if (!input.isSealed) {
    return failUndying(input.board, 'not_sealed');
  }
  if (!input.hasUndyingInHand) {
    return failUndying(input.board, 'not_in_hand');
  }
  const occupied = input.occupiedHexes ?? [];
  if (occupied.some((o) => equals(o, input.landingHex))) {
    return failUndying(input.board, 'landing_occupied');
  }
  if (!canStandAt(input.board, input.landingHex)) {
    return failUndying(input.board, 'landing_not_standable');
  }

  const events: KnightCardEvent[] = [
    { type: 'ActorRevived', hex: input.landingHex },
    { type: 'TurnForceEnded', reason: 'undying_unseal' },
  ];

  return {
    ok: true,
    board: input.board,
    actorPosition: input.landingHex,
    events,
    counted: false,
    forceEndTurn: true,
    bossDamage: 0,
    affectedHexes: [],
  };
}

function failUndying(board: Board, reason: string): UndyingResult {
  return {
    ok: false,
    reason,
    board,
    events: [],
    counted: false,
    forceEndTurn: false,
    bossDamage: 0,
    affectedHexes: [],
  };
}
