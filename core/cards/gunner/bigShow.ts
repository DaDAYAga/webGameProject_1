/**
 * 槍手「來吧! 大鬧一場!」×1：出牌前不可移動。
 * 抽 3；抽到的非射擊可全部立刻使用（事件／hook stub）；再可打 1 射擊。
 * 計次；受沉默。不要擅自削弱。
 */

import { BIG_SHOW_DRAW } from './constants.js';
import type {
  GunnerCardEvent,
  GunnerCardInstance,
  BigShowResult,
} from './types.js';

export type ResolveBigShowInput = {
  /** 出牌前是否已移動；已移動則失敗。 */
  hasMovedThisTurn: boolean;
  /** 牌庫（從頭抽）。 */
  deck: GunnerCardInstance[];
  /** 抽牌數；預設 BIG_SHOW_DRAW。 */
  drawCount?: number;
};

/**
 * 結算大招（純函式；不串完整氣瓶／射擊 cascade）。
 * - drawn：抽到的牌
 * - immediatePlayEligible：其中非射擊（上層可立刻 resolve）
 * - mayPlayShot：之後可再打 1 射擊（旗標）
 */
export function resolveBigShow(input: ResolveBigShowInput): BigShowResult {
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
    };
  }

  const n = input.drawCount ?? BIG_SHOW_DRAW;
  const drawn = input.deck.slice(0, n);
  const remainingDeck = input.deck.slice(n);
  const immediatePlayEligible = drawn.filter((c) => c.cardId !== 'shot');
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
  events.push({ type: 'MayPlayShot', afterBigShow: true });

  return {
    ok: true,
    events,
    counted: true,
    drawn,
    remainingDeck,
    immediatePlayEligible,
    mayPlayShot: true,
  };
}
