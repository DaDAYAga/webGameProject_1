/**
 * 槍手「來吧! 大鬧一場!」×1：出牌前不可移動。
 * 抽 3；抽到的非射擊可全部立刻使用（事件／hook stub）；再可打 1 射擊。
 * 成功時免費裝填 +1 傷＋+1 抽（可超 cap）；該後續射擊忽略甜區外 −1。
 * 計次；受沉默。不要擅自削弱。
 */

import { addAmmoUnchecked } from './ammo.js';
import {
  BIG_SHOW_DRAW,
  BIG_SHOW_FREE_DAMAGE,
  BIG_SHOW_FREE_DRAW,
} from './constants.js';
import {
  EMPTY_AMMO_SLOT,
  type AmmoSlotState,
  type GunnerCardEvent,
  type GunnerCardInstance,
  type BigShowResult,
} from './types.js';

export type ResolveBigShowInput = {
  /** 出牌前是否已移動；已移動則失敗。 */
  hasMovedThisTurn: boolean;
  /** 牌庫（從頭抽）。 */
  deck: GunnerCardInstance[];
  /** 當前裝填槽；成功時免費 +傷害／+抽（可超 cap）。 */
  ammo?: AmmoSlotState;
  /** 抽牌數；預設 BIG_SHOW_DRAW。 */
  drawCount?: number;
};

/**
 * 結算大招（純函式；不串完整氣瓶／射擊 cascade）。
 * - drawn：抽到的牌
 * - immediatePlayEligible：其中非射擊（上層可立刻 resolve）
 * - mayPlayShot：之後可再打 1 射擊（旗標）
 * - ignoreRangePenaltyForShot：該後續射擊應以 ignoreRangePenalty 傳入 resolveGunnerShot
 * - ammo：成功時已含免費氣瓶層（可超 AMMO_SLOT_MAX_TOTAL）
 */
export function resolveBigShow(input: ResolveBigShowInput): BigShowResult {
  const ammoIn = input.ammo ?? EMPTY_AMMO_SLOT;

  if (input.hasMovedThisTurn) {
    return {
      ok: false,
      reason: 'already_moved',
      events: [],
      counted: true,
      drawn: [],
      remainingDeck: input.deck,
      immediatePlayEligible: [],
      mayPlayShot: false,
      ignoreRangePenaltyForShot: false,
      ammo: ammoIn,
    };
  }

  const n = input.drawCount ?? BIG_SHOW_DRAW;
  const drawn = input.deck.slice(0, n);
  const remainingDeck = input.deck.slice(n);
  const immediatePlayEligible = drawn.filter((c) => c.cardId !== 'shot');

  // 免費氣瓶：頑皮 +1 傷、胡鬧 +1 抽；不棄牌、可超 cap
  const ammo = addAmmoUnchecked(
    ammoIn,
    BIG_SHOW_FREE_DAMAGE,
    BIG_SHOW_FREE_DRAW,
  );

  const events: GunnerCardEvent[] = [
    {
      type: 'CardsDrawn',
      instanceIds: drawn.map((c) => c.instanceId),
      count: drawn.length,
    },
  ];
  if (immediatePlayEligible.length > 0) {
    events.push({
      type: 'ImmediatePlayAllowed',
      instanceIds: immediatePlayEligible.map((c) => c.instanceId),
    });
  }
  events.push({
    type: 'AmmoSlotLoaded',
    damageBonus: ammo.damageBonus,
    drawBonus: ammo.drawBonus,
  });
  events.push({
    type: 'BigShowAmmoGranted',
    damageBonus: BIG_SHOW_FREE_DAMAGE,
    drawBonus: BIG_SHOW_FREE_DRAW,
    ammo,
  });
  events.push({ type: 'MayPlayShot', afterBigShow: true });

  return {
    ok: true,
    events,
    counted: true,
    drawn,
    remainingDeck,
    immediatePlayEligible,
    mayPlayShot: true,
    /** 上層打後續射擊時應傳 resolveGunnerShot({ ignoreRangePenalty: true }) */
    ignoreRangePenaltyForShot: true,
    ammo,
  };
}
