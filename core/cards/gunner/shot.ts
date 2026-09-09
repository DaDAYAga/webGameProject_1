/**
 * 槍手「射擊」×5：只打王、任意距離；不可加厚。
 * 用 computeRangedDamageToBoss（甜區 ≤3、區外 −1、最低 1、無擋線）。
 * 結算時套用裝填槽加成後清空槽。計次；沉默由上層處理。
 */

import {
  bossDamagedEventFromRanged,
  computeRangedDamageToBoss,
} from '../../combat/index.js';
import { BOSS_HEX } from '../../board/index.js';
import type { Axial } from '../../hex/index.js';
import { clearAmmoSlot } from './ammo.js';
import type { AmmoSlotState, GunnerShotResult } from './types.js';

/** 射擊對王基礎傷害（白板）。 */
export const GUNNER_SHOT_BASE_DAMAGE = 1;

export type ResolveGunnerShotInput = {
  /** 攻擊者格子。 */
  attacker: Axial;
  /** 當前裝填槽（會被套用後清空）。 */
  ammo: AmmoSlotState;
  /** 基礎傷；預設 1。 */
  baseDamage?: number;
  /** 之後技能可忽略區外 −1。 */
  ignoreRangePenalty?: boolean;
  bossHex?: Axial;
};

/**
 * 結算槍手射擊（含臨時射擊路徑：同樣吃裝填並清槽）。
 * - 僅打王（呼叫端不需傳 target；本函式固定對王）
 * - bonus = ammo.damageBonus；drawFromAmmo = ammo.drawBonus
 * - 結算後 ammo 清空
 */
export function resolveGunnerShot(
  input: ResolveGunnerShotInput,
): GunnerShotResult {
  const bossHex = input.bossHex ?? BOSS_HEX;
  const baseDamage = input.baseDamage ?? GUNNER_SHOT_BASE_DAMAGE;
  const { attacker, ammo } = input;

  const ranged = computeRangedDamageToBoss({
    attacker,
    baseDamage,
    bonusDamage: ammo.damageBonus,
    ignoreRangePenalty: input.ignoreRangePenalty,
    bossHex,
  });

  const events = [];
  const bossEvt = bossDamagedEventFromRanged(ranged);
  if (bossEvt) events.push(bossEvt);
  events.push({ type: 'AmmoSlotCleared' as const });

  return {
    ok: true,
    events,
    counted: true,
    bossDamage: ranged.effective ? ranged.damage : 0,
    inSweetZone: ranged.inSweetZone,
    drawFromAmmo: ammo.drawBonus,
    ammo: clearAmmoSlot(),
  };
}
