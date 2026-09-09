/**
 * 法師「強能增幅」×2：不計次；棄 1；強化本回合下一張招。
 * 未使用則回合結束失效。
 * 升級：箭 +1；御風 2 步；位面不受沉默；聚精 +1 抽；屏障改寄出。
 * 既有 wind／planar／arrow 以 amplified 旗銜接。
 */

import type {
  AmplifyResult,
  MageCardEvent,
  MageCardInstance,
} from './types.js';

export type ResolveAmplifyInput = {
  hand: MageCardInstance[];
  /**
   * 要棄的手牌 instanceId（不含本增幅牌；上層已從手牌抽出增幅亦可）。
   */
  discardInstanceId: string;
};

/**
 * 結算強能增幅：棄 1 並回傳本回合 buff 旗標。
 */
export function resolveAmplify(input: ResolveAmplifyInput): AmplifyResult {
  const card = input.hand.find((c) => c.instanceId === input.discardInstanceId);
  if (!card) {
    return {
      ok: false,
      reason: 'discard_not_in_hand',
      events: [],
      counted: false,
      hand: input.hand,
      amplifiedPending: false,
    };
  }

  const hand = input.hand.filter(
    (c) => c.instanceId !== input.discardInstanceId,
  );
  const events: MageCardEvent[] = [
    { type: 'CardDiscarded', instanceId: card.instanceId, cardId: card.cardId },
    { type: 'AmplifyArmed' },
  ];

  return {
    ok: true,
    events,
    counted: false,
    hand,
    discardedInstanceId: card.instanceId,
    /** 上層應在下一張招帶 amplified:true，回合結束清掉。 */
    amplifiedPending: true,
  };
}
