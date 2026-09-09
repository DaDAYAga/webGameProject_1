/**
 * 騎士「嘲諷」×2：他人回合使用；王不可在騎士鄰 1 鋪牆。
 * 不計次；不受沉默；無傷害。
 * 優先級 TAUNT_PRIORITY=100，高於磁力屏障 BARRIER_PRIORITY=10（衝突時嘲諷覆蓋）。
 * 見 design-amendments 2026-09-09f。
 */

import { distance, type Axial } from '../../hex/index.js';
import { TAUNT_PRIORITY } from './constants.js';
import type {
  BossPlaceRestriction,
  KnightCardEvent,
  TauntResult,
} from './types.js';

/** 嘲諷禁鋪距離（鄰 1）。 */
export const TAUNT_RING_DISTANCE = 1;

export type ResolveTauntInput = {
  /** 必須為他人回合（非騎士自己的回合）。 */
  isOthersTurn: boolean;
  /** 騎士所在格（嘲諷中心）。 */
  knightHex: Axial;
  /**
   * 可選：既有磁力屏障（或其它鋪牆限制）。
   * 若存在，結果 overridesBarrier=true（嘲諷優先級較高）。
   */
  existingBarrier?: {
    priority?: number;
    targetHex?: Axial;
  } | null;
};

/**
 * 某格是否被嘲諷禁鋪（距離 center ≤ ringDistance）。
 */
export function tauntBlocksPlacement(
  restriction: BossPlaceRestriction | null | undefined,
  hex: Axial,
): boolean {
  if (!restriction || restriction.type !== 'taunt') return false;
  return distance(restriction.center, hex) <= restriction.ringDistance;
}

/**
 * 結算嘲諷（純函式）。
 */
export function resolveTaunt(input: ResolveTauntInput): TauntResult {
  if (input.isOthersTurn !== true) {
    return {
      ok: false,
      reason: 'not_others_turn',
      events: [],
      counted: false,
      silenced: false,
      bossDamage: 0,
      tauntPriority: TAUNT_PRIORITY,
      overridesBarrier: false,
    };
  }

  const restriction: BossPlaceRestriction = {
    type: 'taunt',
    center: input.knightHex,
    ringDistance: TAUNT_RING_DISTANCE,
  };

  const hasBarrier =
    input.existingBarrier !== undefined && input.existingBarrier !== null;
  const barrierPriority = input.existingBarrier?.priority;
  const overridesBarrier =
    hasBarrier &&
    (barrierPriority === undefined || barrierPriority < TAUNT_PRIORITY);

  const events: KnightCardEvent[] = [
    {
      type: 'TauntApplied',
      center: input.knightHex,
      ringDistance: TAUNT_RING_DISTANCE,
      priority: TAUNT_PRIORITY,
    },
  ];

  return {
    ok: true,
    events,
    counted: false,
    silenced: false,
    bossDamage: 0,
    bossPlaceRestriction: restriction,
    tauntPriority: TAUNT_PRIORITY,
    overridesBarrier,
  };
}
