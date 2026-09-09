/**
 * 頑皮氣瓶／胡鬧氣瓶：棄 1 手上射擊 → 裝填槽 +1 傷／+1 抽。
 * 槽合計最多 2；跨回合直到射擊結算。
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
  /** 手牌（須含至少 1 張射擊可棄；不含本氣瓶亦可，由上層已抽出）。 */
  hand: GunnerCardInstance[];
  /**
   * 要棄的射擊 instanceId；未傳則自動選手牌中第一張 shot。
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

function resolveBottleLoad(
  input: ResolveBottleInput,
  addDamage: number,
  addDraw: number,
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

  const next = addAmmo(input.ammo, addDamage, addDraw);
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
      },
    ],
    counted: false,
    ammo: next,
    discardedShotId: shot.instanceId,
    hand,
  };
}

/**
 * 結算頑皮氣瓶：棄 1 射擊 → 槽 +1 傷害。
 * 失敗：手牌無射擊、或合計將超過 2。
 */
export function resolvePlayfulBottle(
  input: ResolveBottleInput,
): GunnerBottleResult {
  return resolveBottleLoad(input, 1, 0);
}

/**
 * 結算胡鬧氣瓶：棄 1 射擊 → 槽 +1 抽（於該次射擊結算時抽）。
 * 失敗：手牌無射擊、或合計將超過 2。
 */
export function resolveMischiefBottle(
  input: ResolveBottleInput,
): GunnerBottleResult {
  return resolveBottleLoad(input, 0, 1);
}
