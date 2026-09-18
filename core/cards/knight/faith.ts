/**
 * 騎士「堅定信仰」×2：清自己 1 層詛咒。
 * 計次；受沉默（上層擋）。成功後上層應把剩餘移動清 0。
 * 不再要求出牌前未移動。
 */

import { FAITH_CURSE_CLEAR } from './constants.js';
import type { FaithResult, KnightCardEvent } from './types.js';

export type ResolveFaithInput = {
  /**
   * @deprecated 2026-09-19 不再擋「已移動」；保留欄位以免舊呼叫碎裂。
   */
  hasMovedThisTurn?: boolean;
  /** 自身目前詛咒層數。 */
  curseStacks: number;
  /** 清除層數；預設 FAITH_CURSE_CLEAR。 */
  clearAmount?: number;
};

/**
 * 結算堅定信仰（純函式；不改棋盤）。
 */
export function resolveFaith(input: ResolveFaithInput): FaithResult {
  const clearAmount = input.clearAmount ?? FAITH_CURSE_CLEAR;

  const cleared = Math.min(clearAmount, Math.max(0, input.curseStacks));
  const curseStacks = input.curseStacks - cleared;
  const events: KnightCardEvent[] = [];
  if (cleared > 0) {
    events.push({ type: 'CurseClearedSelf', amount: cleared });
  }

  return {
    ok: true,
    events,
    counted: true,
    curseStacks,
    cleared,
  };
}
