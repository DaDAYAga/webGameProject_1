/**
 * 槍手「來吧! 大鬧一場!」×1：出牌前不可移動。
 * 成功：免費裝填 +1 傷＋+1 抽＋+1 推（可超 cap；註：頑皮+胡鬧+狂妄）
 * → 授予 mayPlayShot + ignoreRangePenalty。
 * **不抽牌**。計次；受沉默。不要擅自削弱。
 */

import { addAmmoUnchecked } from './ammo.js';
import {
  BIG_SHOW_FREE_DAMAGE,
  BIG_SHOW_FREE_DRAW,
  BIG_SHOW_FREE_PUSH,
} from './constants.js';
import {
  EMPTY_AMMO_SLOT,
  type AmmoSlotState,
  type GunnerCardEvent,
  type BigShowResult,
} from './types.js';

export type ResolveBigShowInput = {
  /** 出牌前是否已移動；已移動則失敗。 */
  hasMovedThisTurn: boolean;
  /** 當前裝填槽；成功時免費 +傷／+抽／+推（可超 cap）。 */
  ammo?: AmmoSlotState;
};

/**
 * 結算大招（純函式）。
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

  // 免費氣瓶：頑皮+1傷、胡鬧+1抽、狂妄+1推；不棄牌、可超 cap
  const ammo = addAmmoUnchecked(
    ammoIn,
    BIG_SHOW_FREE_DAMAGE,
    BIG_SHOW_FREE_DRAW,
    BIG_SHOW_FREE_PUSH,
  );

  const events: GunnerCardEvent[] = [
    {
      type: 'AmmoSlotLoaded',
      damageBonus: ammo.damageBonus,
      drawBonus: ammo.drawBonus,
      pushBonus: ammo.pushBonus,
    },
    {
      type: 'BigShowAmmoGranted',
      damageBonus: BIG_SHOW_FREE_DAMAGE,
      drawBonus: BIG_SHOW_FREE_DRAW,
      pushBonus: BIG_SHOW_FREE_PUSH,
      ammo,
    },
    { type: 'MayPlayShot', afterBigShow: true },
  ];

  return {
    ok: true,
    events,
    counted: true,
    mayPlayShot: true,
    ignoreRangePenaltyForShot: true,
    ammo,
  };
}
