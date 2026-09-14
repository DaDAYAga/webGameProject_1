/**
 * 槍手「狂妄氣瓶」（cardId 仍為 power_up，避免牌庫 id 動盪）。
 * 裝填槽 +1 pushBonus（計入 cap 2）；不再 dig_shots／temp_shot。
 * 計次；受沉默。
 */

import { addAmmo } from './ammo.js';
import type { AmmoSlotState, GunnerCardEvent, PowerUpResult } from './types.js';

export type ResolvePowerUpInput = {
  /** 當前裝填槽。 */
  ammo: AmmoSlotState;
};

/**
 * 結算狂妄氣瓶：槽 +1 推牆層。
 * 失敗：合計將超過 2。
 */
export function resolvePowerUp(input: ResolvePowerUpInput): PowerUpResult {
  const next = addAmmo(input.ammo, 0, 0, 1);
  if (!next) {
    return {
      ok: false,
      reason: 'ammo_slot_full',
      events: [],
      counted: true,
      ammo: input.ammo,
    };
  }
  const events: GunnerCardEvent[] = [
    {
      type: 'AmmoSlotLoaded',
      damageBonus: next.damageBonus,
      drawBonus: next.drawBonus,
      pushBonus: next.pushBonus,
    },
  ];
  return {
    ok: true,
    events,
    counted: true,
    ammo: next,
  };
}

/** @deprecated 舊 dig／temp 模式已移除；保留型別名以免舊 import 碎裂。 */
export type PowerUpMode = 'load_push';
