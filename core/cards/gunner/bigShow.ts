/**
 * 槍手「來吧! 大鬧一場!」×1：出牌前不可移動。
 * 成功：免費裝填 +1 傷＋+1 抽（可超 cap）→ 授予 mayPlayShot + ignoreRangePenalty，
 * 玩家可打 1 張手上射擊（耗該卡）；大招本身不自動結算白送臨時射擊。
 * **不抽牌**。計次；受沉默。不要擅自削弱。
 */

import { addAmmoUnchecked } from './ammo.js';
import { BIG_SHOW_FREE_DAMAGE, BIG_SHOW_FREE_DRAW } from './constants.js';
import {
  EMPTY_AMMO_SLOT,
  type AmmoSlotState,
  type GunnerCardEvent,
  type BigShowResult,
} from './types.js';

export type ResolveBigShowInput = {
  /** 出牌前是否已移動；已移動則失敗。 */
  hasMovedThisTurn: boolean;
  /** 當前裝填槽；成功時免費 +傷／+抽（可超 cap）；射擊由上層出手上射擊時消耗。 */
  ammo?: AmmoSlotState;
};

/**
 * 結算大招（純函式）。
 * 1. hasMovedThisTurn → 失敗
 * 2. 不抽牌
 * 3. 免費氣瓶（可超 cap）
 * 4. 授予 mayPlayShot + ignoreRangePenaltyForShot（上層出手上 1 射擊，耗卡）
 * 不在此內 auto-resolve resolveGunnerShot / TempShotPlayed。
 */
export function resolveBigShow(input: ResolveBigShowInput): BigShowResult {
  const ammoIn = input.ammo ?? EMPTY_AMMO_SLOT;

  if (input.hasMovedThisTurn) {
    return {
      ok: false,
      reason: 'already_moved',
      events: [],
      counted: true,
      mayPlayShot: false,
      ignoreRangePenaltyForShot: false,
      ammo: ammoIn,
    };
  }

  // 免費氣瓶：頑皮 +1 傷、胡鬧 +1 抽；不棄牌、可超 cap
  const ammo = addAmmoUnchecked(
    ammoIn,
    BIG_SHOW_FREE_DAMAGE,
    BIG_SHOW_FREE_DRAW,
  );

  const events: GunnerCardEvent[] = [
    {
      type: 'AmmoSlotLoaded',
      damageBonus: ammo.damageBonus,
      drawBonus: ammo.drawBonus,
    },
    {
      type: 'BigShowAmmoGranted',
      damageBonus: BIG_SHOW_FREE_DAMAGE,
      drawBonus: BIG_SHOW_FREE_DRAW,
      ammo,
    },
    { type: 'MayPlayShot', afterBigShow: true },
  ];

  return {
    ok: true,
    events,
    counted: true,
    mayPlayShot: true,
    /** 上層打後續手上射擊時應傳 resolveGunnerShot({ ignoreRangePenalty: true }) */
    ignoreRangePenaltyForShot: true,
    ammo,
  };
}
