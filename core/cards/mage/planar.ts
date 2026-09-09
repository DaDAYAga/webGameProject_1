/**
 * 法師「位面調換」×1：交換兩名單位位置。
 * 不計次；受沉默（增幅後該張不受）；成功後強制結束回合。
 * 不可王、不可出局；可封印。兩人皆須在法師距離 ≤3。禁止壓頭／不可站格。
 */

import { canStandAt, type Board } from '../../board/index.js';
import { distance, equals, type Axial } from '../../hex/index.js';
import type {
  MageActorRef,
  MageCardEvent,
  PlanarSwapResult,
} from './types.js';

/** 位面調換：目標與法師的最大距離。 */
export const PLANAR_SWAP_MAX_DISTANCE = 3;

export type ResolvePlanarSwapInput = {
  board: Board;
  /** 施法者（法師）所在格。 */
  mageHex: Axial;
  /** 第一名目標。 */
  actorA: MageActorRef;
  /** 第二名目標。 */
  actorB: MageActorRef;
  /**
   * 增幅：true → 該張不受沉默（silenced: false）。
   * 未增幅預設受沉默。
   */
  amplified?: boolean;
};

function fail(
  reason: string,
  silenced: boolean,
): PlanarSwapResult {
  return {
    ok: false,
    reason,
    events: [],
    counted: false,
    silenced,
    endTurn: false,
    swappedActorIds: [],
  };
}

/**
 * 結算位面調換（純函式；不改 board 地形，只回傳新位置）。
 */
export function resolvePlanarSwap(
  input: ResolvePlanarSwapInput,
): PlanarSwapResult {
  const amplified = input.amplified === true;
  /** 增幅後不受沉默；否則受沉默（上層擋出牌）。 */
  const silenced = !amplified;
  const { board, mageHex, actorA, actorB } = input;

  if (actorA.id === actorB.id || equals(actorA.hex, actorB.hex)) {
    return fail('same_actor', silenced);
  }

  if (actorA.isBoss === true || actorB.isBoss === true) {
    return fail('cannot_swap_boss', silenced);
  }

  if (actorA.eliminated === true || actorB.eliminated === true) {
    return fail('cannot_swap_eliminated', silenced);
  }

  if (distance(mageHex, actorA.hex) > PLANAR_SWAP_MAX_DISTANCE) {
    return fail('out_of_range_a', silenced);
  }
  if (distance(mageHex, actorB.hex) > PLANAR_SWAP_MAX_DISTANCE) {
    return fail('out_of_range_b', silenced);
  }

  // 交換後落點須可站（禁止壓到不可站地形／王格）
  if (!canStandAt(board, actorB.hex)) {
    return fail('dest_a_not_standable', silenced);
  }
  if (!canStandAt(board, actorA.hex)) {
    return fail('dest_b_not_standable', silenced);
  }

  // 壓頭：目標格若已有「其他人」佔用則禁止（兩人互換除外）
  // 本函式僅交換 A/B，不處理第三人；第三人佔格由呼叫端保證或不傳。

  const newA = actorB.hex;
  const newB = actorA.hex;

  const events: MageCardEvent[] = [
    {
      type: 'ActorsSwapped',
      aId: actorA.id,
      bId: actorB.id,
      aHex: newA,
      bHex: newB,
    },
    {
      type: 'SilenceImmunityThisRound',
      actorIds: [actorA.id, actorB.id],
    },
    {
      type: 'TurnForceEnded',
      reason: 'planar_swap',
    },
  ];

  return {
    ok: true,
    events,
    counted: false,
    silenced,
    endTurn: true,
    swappedActorIds: [actorA.id, actorB.id],
    positions: {
      [actorA.id]: newA,
      [actorB.id]: newB,
    },
  };
}
