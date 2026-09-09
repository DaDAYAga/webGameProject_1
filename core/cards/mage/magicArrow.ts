/**
 * 法師「魔法箭」×5：同槍手射擊規則（遠程甜區 ≤3、區外 −1、最低 1、無擋線）。
 * 薄包 combat.computeRangedDamageToBoss；無裝填槽（增幅 bonus 由呼叫端傳入）。
 */

import { BOSS_HEX } from '../../board/index.js';
import {
  bossDamagedEventFromRanged,
  computeRangedDamageToBoss,
} from '../../combat/index.js';
import type { Axial } from '../../hex/index.js';
import type { MagicArrowResult } from './types.js';

/** 魔法箭對王基礎傷害（白板）。 */
export const MAGIC_ARROW_BASE_DAMAGE = 1;

export type ResolveMagicArrowInput = {
  /** 攻擊者格子。 */
  attacker: Axial;
  /** 基礎傷；預設 1。 */
  baseDamage?: number;
  /** 增幅等加成（無裝填槽）。 */
  bonusDamage?: number;
  /** 之後技能可忽略區外 −1。 */
  ignoreRangePenalty?: boolean;
  bossHex?: Axial;
};

/**
 * 結算魔法箭（純函式；規則同 resolveGunnerShot 不含裝填）。
 */
export function resolveMagicArrow(
  input: ResolveMagicArrowInput,
): MagicArrowResult {
  const bossHex = input.bossHex ?? BOSS_HEX;
  const baseDamage = input.baseDamage ?? MAGIC_ARROW_BASE_DAMAGE;
  const bonusDamage = input.bonusDamage ?? 0;

  const ranged = computeRangedDamageToBoss({
    attacker: input.attacker,
    baseDamage,
    bonusDamage,
    ignoreRangePenalty: input.ignoreRangePenalty,
    bossHex,
  });

  const events = [];
  const bossEvt = bossDamagedEventFromRanged(ranged);
  if (bossEvt) events.push(bossEvt);

  return {
    ok: true,
    events,
    counted: true,
    bossDamage: ranged.effective ? ranged.damage : 0,
    inSweetZone: ranged.inSweetZone,
  };
}
