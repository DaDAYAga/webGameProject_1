/**
 * 法師「強能增幅」×2：不計次；不再棄牌；強化本回合下一張招。
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
  /** 目前手牌（本招不棄牌，原樣回傳）。 */
  hand: MageCardInstance[];
};

/**
 * 結算強能增幅：不棄牌，回傳本回合 buff 旗標。
 */
export function resolveAmplify(input: ResolveAmplifyInput): AmplifyResult {
  const events: MageCardEvent[] = [{ type: 'AmplifyArmed' }];

  return {
    ok: true,
    events,
    counted: false,
    hand: input.hand,
    /** 上層應在下一張招帶 amplified:true，回合結束清掉。 */
    amplifiedPending: true,
  };
}
