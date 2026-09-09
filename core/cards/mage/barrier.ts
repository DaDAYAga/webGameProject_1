/**
 * 法師「磁力屏障」×2：本輪結束前王不能鋪目標鄰 1。
 * 未增幅＝自己；增幅後寄給距離 ≤3 的其他未出局者，自己不再受保護。
 * 代價：法師下一回合開始抽 −1。計次；受沉默。
 * 優先級 BARRIER_PRIORITY=10；騎士嘲諷 TAUNT_PRIORITY=100 較高，衝突時嘲諷覆蓋。
 * // UNRESOLVED: 交接未明示屏障是否計次 → 預設計次（與 DEFS 對齊）。
 */

import { distance, neighbors, type Axial } from '../../hex/index.js';
import {
  BARRIER_NEXT_TURN_DRAW_DELTA,
  BARRIER_PRIORITY,
  BARRIER_RETARGET_MAX_DIST,
} from './constants.js';
import type {
  BarrierAura,
  BarrierResult,
  MageActorRef,
  MageCardEvent,
} from './types.js';

export type ResolveBarrierInput = {
  /** 法師所在格。 */
  mageHex: Axial;
  /** 法師 actor id。 */
  mageId: string;
  /** 增幅：改寄出。 */
  amplified?: boolean;
  /**
   * 增幅時的目標（其他未出局）；未增幅忽略，鎖定自己。
   */
  target?: MageActorRef;
  /** 寄出最大距離；預設 BARRIER_RETARGET_MAX_DIST。 */
  maxDistance?: number;
  /** 下一回合抽牌修正；預設 BARRIER_NEXT_TURN_DRAW_DELTA。 */
  nextTurnDrawDelta?: number;
};

/**
 * 目標鄰 1 格子（王不可在這些格鋪牆，直到本輪結束）。
 */
export function barrierProtectedHexes(targetHex: Axial): Axial[] {
  return neighbors(targetHex);
}

/**
 * 某格是否被屏障擋住王鋪牆。
 */
export function barrierBlocksPlacement(
  aura: BarrierAura | null | undefined,
  hex: Axial,
): boolean {
  if (!aura) return false;
  return aura.protectedHexes.some(
    (h) => h.q === hex.q && h.r === hex.r,
  );
}

/**
 * 結算磁力屏障。
 */
export function resolveBarrier(input: ResolveBarrierInput): BarrierResult {
  const amplified = input.amplified === true;
  const maxDist = input.maxDistance ?? BARRIER_RETARGET_MAX_DIST;
  const drawDelta =
    input.nextTurnDrawDelta ?? BARRIER_NEXT_TURN_DRAW_DELTA;

  let targetId = input.mageId;
  let targetHex = input.mageHex;

  if (amplified) {
    if (!input.target) {
      return failBarrier('amplify_needs_target');
    }
    if (input.target.id === input.mageId) {
      return failBarrier('amplify_cannot_self');
    }
    if (input.target.eliminated === true) {
      return failBarrier('target_eliminated');
    }
    if (input.target.isBoss === true) {
      return failBarrier('cannot_target_boss');
    }
    if (distance(input.mageHex, input.target.hex) > maxDist) {
      return failBarrier('target_out_of_range');
    }
    targetId = input.target.id;
    targetHex = input.target.hex;
  }

  const protectedHexes = barrierProtectedHexes(targetHex);
  const aura: BarrierAura = {
    targetActorId: targetId,
    targetHex,
    protectedHexes,
    /** 本輪結束失效（上層於 RoundEnded 清）。 */
    expires: 'end_of_round',
    nextTurnDrawDelta: drawDelta,
    mageId: input.mageId,
    /** 低於嘲諷；衝突時嘲諷覆蓋。 */
    priority: BARRIER_PRIORITY,
  };

  const events: MageCardEvent[] = [
    {
      type: 'BarrierApplied',
      targetActorId: targetId,
      protectedHexes,
      nextTurnDrawDelta: drawDelta,
    },
  ];

  return {
    ok: true,
    events,
    counted: true,
    amplified,
    aura,
  };
}

function failBarrier(reason: string): BarrierResult {
  return {
    ok: false,
    reason,
    events: [],
    counted: true,
    amplified: false,
  };
}
