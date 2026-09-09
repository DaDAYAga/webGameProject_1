/**
 * 裝填槽純函式：合計 ≤ AMMO_SLOT_MAX_TOTAL；跨回合直到射擊結算清空。
 * 大招可走 addAmmoUnchecked 突破上限（僅 ultimate）。
 */

import {
  AMMO_SLOT_MAX_TOTAL,
  EMPTY_AMMO_SLOT,
  type AmmoSlotState,
} from './types.js';

/** 裝填槽目前合計層數（傷害＋抽牌）。 */
export function ammoSlotTotal(slot: AmmoSlotState): number {
  return slot.damageBonus + slot.drawBonus;
}

/**
 * 是否還能再加指定層數（不超過上限 2）。
 * @param addDamage 擬加傷害層
 * @param addDraw 擬加抽牌層
 */
export function canAddAmmo(
  slot: AmmoSlotState,
  addDamage: number,
  addDraw: number,
): boolean {
  return ammoSlotTotal(slot) + addDamage + addDraw <= AMMO_SLOT_MAX_TOTAL;
}

/**
 * 加上傷害／抽牌層；超過上限則回傳 null。
 * 回傳新物件（不變更原 slot）。
 * 一般氣瓶必須走此路徑（cap=2）。
 * @param options.ignoreCap 若 true，等同 addAmmoUnchecked（僅大招應使用）。
 */
export function addAmmo(
  slot: AmmoSlotState,
  addDamage: number,
  addDraw: number,
  options?: { ignoreCap?: boolean },
): AmmoSlotState | null {
  if (options?.ignoreCap === true) {
    return addAmmoUnchecked(slot, addDamage, addDraw);
  }
  if (!canAddAmmo(slot, addDamage, addDraw)) return null;
  return {
    damageBonus: slot.damageBonus + addDamage,
    drawBonus: slot.drawBonus + addDraw,
  };
}

/**
 * 無上限裝填（僅大招「來吧! 大鬧一場!」免費氣瓶）。
 * 不檢查 AMMO_SLOT_MAX_TOTAL；一般氣瓶請用 addAmmo。
 */
export function addAmmoUnchecked(
  slot: AmmoSlotState,
  addDamage: number,
  addDraw: number,
): AmmoSlotState {
  return {
    damageBonus: slot.damageBonus + addDamage,
    drawBonus: slot.drawBonus + addDraw,
  };
}

/** 清空裝填槽。 */
export function clearAmmoSlot(): AmmoSlotState {
  return { ...EMPTY_AMMO_SLOT };
}
