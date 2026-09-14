/**
 * 裝填槽純函式：合計 ≤ AMMO_SLOT_MAX_TOTAL；跨回合直到射擊結算清空。
 * 大招可走 addAmmoUnchecked 突破上限（僅 ultimate）。
 */

import {
  AMMO_SLOT_MAX_TOTAL,
  EMPTY_AMMO_SLOT,
  type AmmoSlotState,
} from './types.js';

/** 裝填槽目前合計層數（傷害＋抽牌＋推牆）。 */
export function ammoSlotTotal(slot: AmmoSlotState): number {
  return slot.damageBonus + slot.drawBonus + slot.pushBonus;
}

/**
 * 是否還能再加指定層數（不超過上限 2）。
 */
export function canAddAmmo(
  slot: AmmoSlotState,
  addDamage: number,
  addDraw: number,
  addPush: number = 0,
): boolean {
  return ammoSlotTotal(slot) + addDamage + addDraw + addPush <= AMMO_SLOT_MAX_TOTAL;
}

/**
 * 加上傷害／抽牌／推牆層；超過上限則回傳 null。
 * 一般氣瓶必須走此路徑（cap=2）。
 * 第四參數可為 addPush 數字，或舊式 `{ ignoreCap }` options（相容）。
 */
export function addAmmo(
  slot: AmmoSlotState,
  addDamage: number,
  addDraw: number,
  addPushOrOptions: number | { ignoreCap?: boolean } = 0,
  options?: { ignoreCap?: boolean },
): AmmoSlotState | null {
  let addPush = 0;
  let opts = options;
  if (typeof addPushOrOptions === 'object' && addPushOrOptions !== null) {
    opts = addPushOrOptions;
  } else {
    addPush = addPushOrOptions;
  }
  if (opts?.ignoreCap === true) {
    return addAmmoUnchecked(slot, addDamage, addDraw, addPush);
  }
  if (!canAddAmmo(slot, addDamage, addDraw, addPush)) return null;
  return {
    damageBonus: slot.damageBonus + addDamage,
    drawBonus: slot.drawBonus + addDraw,
    pushBonus: slot.pushBonus + addPush,
  };
}

/**
 * 無上限裝填（僅大招「來吧! 大鬧一場!」免費氣瓶）。
 * 註：頑皮+胡鬧+狂妄 各 +1。
 */
export function addAmmoUnchecked(
  slot: AmmoSlotState,
  addDamage: number,
  addDraw: number,
  addPush: number = 0,
): AmmoSlotState {
  return {
    damageBonus: slot.damageBonus + addDamage,
    drawBonus: slot.drawBonus + addDraw,
    pushBonus: slot.pushBonus + addPush,
  };
}

/** 清空裝填槽。 */
export function clearAmmoSlot(): AmmoSlotState {
  return { ...EMPTY_AMMO_SLOT };
}
