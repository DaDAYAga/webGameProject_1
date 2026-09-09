/**
 * 槍手「大亂流」×2：棄手上最多 2 張氣瓶牌 → 走（棄牌數 + 1）格。
 * 計次；受沉默。
 * 不特別穿越破碎牆（破碎不可站 → 路徑不可踩 plain_broken）。
 */

import { canStandAt, type Board } from '../../board/index.js';
import { distance, equals, type Axial } from '../../hex/index.js';
import {
  TURBULENCE_MAX_BOTTLE_DISCARD,
  TURBULENCE_MOVE_BASE,
} from './constants.js';
import type {
  GunnerCardEvent,
  GunnerCardInstance,
  TurbulenceResult,
} from './types.js';

const BOTTLE_IDS = new Set(['playful_bottle', 'mischief_bottle']);

export type ResolveTurbulenceInput = {
  board: Board;
  actorPosition: Axial;
  hand: GunnerCardInstance[];
  /**
   * 要棄的氣瓶 instanceId（0～TURBULENCE_MAX_BOTTLE_DISCARD 張）。
   * 空陣列 → 仍可走 TURBULENCE_MOVE_BASE 格。
   */
  discardBottleInstanceIds: readonly string[];
  /**
   * 移動路徑（不含起點；長度須 = 棄牌數 + TURBULENCE_MOVE_BASE）。
   * 每步須與前一格鄰接；每格須可站（不穿破碎）。
   */
  path: readonly Axial[];
  /** 其他單位佔格。 */
  occupiedHexes?: readonly Axial[];
};

function isBottle(card: GunnerCardInstance): boolean {
  return BOTTLE_IDS.has(card.cardId);
}

/**
 * 結算大亂流（純函式）。
 */
export function resolveTurbulence(
  input: ResolveTurbulenceInput,
): TurbulenceResult {
  const ids = input.discardBottleInstanceIds;
  if (ids.length > TURBULENCE_MAX_BOTTLE_DISCARD) {
    return failTurbulence(
      input,
      'too_many_bottles',
    );
  }

  const seen = new Set<string>();
  const discarded: GunnerCardInstance[] = [];
  for (const id of ids) {
    if (seen.has(id)) {
      return failTurbulence(input, 'duplicate_discard');
    }
    seen.add(id);
    const card = input.hand.find((c) => c.instanceId === id);
    if (!card || !isBottle(card)) {
      return failTurbulence(input, 'not_bottle_card');
    }
    discarded.push(card);
  }

  const expectedSteps = discarded.length + TURBULENCE_MOVE_BASE;
  if (input.path.length !== expectedSteps) {
    return failTurbulence(input, 'bad_path_length');
  }

  let prev = input.actorPosition;
  const occupied = input.occupiedHexes ?? [];
  for (const step of input.path) {
    if (distance(prev, step) !== 1) {
      return failTurbulence(input, 'path_not_adjacent');
    }
    if (!canStandAt(input.board, step)) {
      // 含 plain_broken：不特別穿越
      return failTurbulence(input, 'path_not_standable');
    }
    for (const o of occupied) {
      if (equals(o, step) && !equals(o, input.actorPosition)) {
        return failTurbulence(input, 'path_occupied');
      }
    }
    prev = step;
  }

  const discardSet = new Set(ids);
  const hand = input.hand.filter((c) => !discardSet.has(c.instanceId));
  const landing = input.path[input.path.length - 1]!;
  const events: GunnerCardEvent[] = [
    {
      type: 'BottlesDiscarded',
      instanceIds: [...ids],
    },
    {
      type: 'ActorMoved',
      from: input.actorPosition,
      to: landing,
    },
  ];

  return {
    ok: true,
    events,
    counted: true,
    actorPosition: landing,
    hand,
    discardedBottleIds: [...ids],
    steps: expectedSteps,
  };
}

function failTurbulence(
  input: ResolveTurbulenceInput,
  reason: string,
): TurbulenceResult {
  return {
    ok: false,
    reason,
    events: [],
    counted: true,
    actorPosition: input.actorPosition,
    hand: input.hand,
    discardedBottleIds: [],
    steps: 0,
  };
}
