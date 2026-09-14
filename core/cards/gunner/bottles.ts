/**
 * 頑皮氣瓶／胡鬧氣瓶（2026-09-14f）。
 * 頑皮：棄 1 手上射擊 → 裝填 +1 傷。
 * 胡鬧：不棄牌 → 裝填 +1 抽；僅槽滿失敗。
 */

import { addAmmo } from './ammo.js';
import type {
  AmmoSlotState,
  GunnerBottleResult,
  GunnerCardInstance,
} from './types.js';

export type ResolveBottleInput = {
  /** 當前裝填槽。 */
  ammo: AmmoSlotState;
  /** 手牌（頑皮須含至少 1 張射擊可棄）。 */
  hand: GunnerCardInstance[];
  /**
   * 要棄的射擊 instanceId（僅頑皮）；未傳則自動選手牌中第一張 shot。
   */
  discardShotInstanceId?: string;
};

function findShotToDiscard(
  hand: GunnerCardInstance[],
  discardShotInstanceId?: string,
): GunnerCardInstance | undefined {
  if (discardShotInstanceId !== undefined) {
    const card = hand.find((c) => c.instanceId === discardShotInstanceId);
    if (card?.cardId === 'shot') return card;
    return undefined;
  }
  return hand.find((c) => c.cardId === 'shot');
}

/**
 * 結算頑皮氣瓶：棄 1 射擊 → 槽 +1 傷害。
 * 失敗：手牌無射擊、或合計將超過 2。
 */
export function resolvePlayfulBottle(
  input: ResolveBottleInput,
): GunnerBottleResult {
  const shot = findShotToDiscard(input.hand, input.discardShotInstanceId);
  if (!shot) {
    return {
      ok: false,
      reason: 'no_shot_to_discard',
      events: [],
      counted: false,
      ammo: input.ammo,
      hand: input.hand,
    };
  }

  const next = addAmmo(input.ammo, 1, 0, 0);
  if (!next) {
    return {
      ok: false,
      reason: 'ammo_slot_full',
      events: [],
      counted: false,
      ammo: input.ammo,
      hand: input.hand,
    };
  }

  const hand = input.hand.filter((c) => c.instanceId !== shot.instanceId);
  return {
    ok: true,
    events: [
      { type: 'ShotDiscarded', instanceId: shot.instanceId },
      {
        type: 'AmmoSlotLoaded',
        damageBonus: next.damageBonus,
        drawBonus: next.drawBonus,
        pushBonus: next.pushBonus,
      },
    ],
    counted: false,
    ammo: next,
    discardedShotId: shot.instanceId,
    hand,
  };
}

/**
 * 結算胡鬧氣瓶：不棄牌 → 槽 +1 抽。
 * 失敗：合計將超過 2。
 */
export function resolveMischiefBottle(
  input: ResolveBottleInput,
): GunnerBottleResult {
  const next = addAmmo(input.ammo, 0, 1, 0);
  if (!next) {
    return {
      ok: false,
      reason: 'ammo_slot_full',
      events: [],
      counted: false,
      ammo: input.ammo,
      hand: input.hand,
    };
  }

  return {
    ok: true,
    events: [
      {
        type: 'AmmoSlotLoaded',
        damageBonus: next.damageBonus,
        drawBonus: next.drawBonus,
        pushBonus: next.pushBonus,
      },
    ],
    counted: false,
    ammo: next,
    hand: input.hand,
  };
}
