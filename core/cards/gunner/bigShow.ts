/**
 * 槍手「來吧! 大鬧一場!」×1：出牌前不可移動。
 * 成功：免費裝填 +1 傷＋+1 抽（可超 cap）→ 立刻白送 1 發臨時射擊（不耗手上射擊牌），
 * 且 ignoreRangePenalty；裝填於該射擊結算時套用並清空（同 Power UP temp_shot）。
 * **不抽牌**。計次；受沉默。不要擅自削弱。
 */

import type { Axial } from '../../hex/index.js';
import { addAmmoUnchecked } from './ammo.js';
import { BIG_SHOW_FREE_DAMAGE, BIG_SHOW_FREE_DRAW } from './constants.js';
import { resolveGunnerShot } from './shot.js';
import {
  EMPTY_AMMO_SLOT,
  type AmmoSlotState,
  type GunnerCardEvent,
  type BigShowResult,
} from './types.js';

export type ResolveBigShowInput = {
  /** 出牌前是否已移動；已移動則失敗。 */
  hasMovedThisTurn: boolean;
  /** 當前裝填槽；成功時先免費 +傷／+抽，再由白送射擊消耗清空。 */
  ammo?: AmmoSlotState;
  /** 白送臨時射擊的攻擊者格（必填於成功路徑）。 */
  attacker?: Axial;
  bossHex?: Axial;
};

/**
 * 結算大招（純函式）。
 * 1. hasMovedThisTurn → 失敗
 * 2. 免費氣瓶（可超 cap）
 * 3. 立刻 resolveGunnerShot（白送、不耗卡、ignoreRangePenalty）
 */
export function resolveBigShow(input: ResolveBigShowInput): BigShowResult {
  const ammoIn = input.ammo ?? EMPTY_AMMO_SLOT;

  if (input.hasMovedThisTurn) {
    return {
      ok: false,
      reason: 'already_moved',
      events: [],
      counted: true,
      tempShotGranted: false,
      ammo: ammoIn,
    };
  }

  if (!input.attacker) {
    return {
      ok: false,
      reason: 'temp_shot_missing_attacker',
      events: [],
      counted: true,
      tempShotGranted: false,
      ammo: ammoIn,
    };
  }

  // 免費氣瓶：頑皮 +1 傷、胡鬧 +1 抽；不棄牌、可超 cap
  const ammoLoaded = addAmmoUnchecked(
    ammoIn,
    BIG_SHOW_FREE_DAMAGE,
    BIG_SHOW_FREE_DRAW,
  );

  // 白送臨時射擊：不耗手上射擊牌；固定忽略距離罰
  const shot = resolveGunnerShot({
    attacker: input.attacker,
    ammo: ammoLoaded,
    ignoreRangePenalty: true,
    bossHex: input.bossHex,
  });

  const events: GunnerCardEvent[] = [
    {
      type: 'AmmoSlotLoaded',
      damageBonus: ammoLoaded.damageBonus,
      drawBonus: ammoLoaded.drawBonus,
    },
    {
      type: 'BigShowAmmoGranted',
      damageBonus: BIG_SHOW_FREE_DAMAGE,
      drawBonus: BIG_SHOW_FREE_DRAW,
      ammo: ammoLoaded,
    },
    { type: 'TempShotPlayed' },
    ...shot.events,
  ];

  return {
    ok: true,
    events,
    counted: true,
    tempShotGranted: true,
    bossDamage: shot.bossDamage,
    inSweetZone: shot.inSweetZone,
    drawFromAmmo: shot.drawFromAmmo,
    /** 射擊結算後槽已清空 */
    ammo: shot.ammo,
    /** 射擊前（含免費層）槽快照，供測試／UI */
    ammoBeforeShot: ammoLoaded,
  };
}
