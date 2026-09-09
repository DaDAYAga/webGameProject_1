/**
 * 騎士「堅定信仰」×2：清自己 1 層詛咒。
 * 出牌前本回合不可已移動；計次；受沉默（上層擋）。
 */

import { FAITH_CURSE_CLEAR } from './constants.js';
import type { FaithResult, KnightCardEvent } from './types.js';

export type ResolveFaithInput = {
  /** 本回合是否已移動；已移動則不可出。 */
  hasMovedThisTurn: boolean;
  /** 自身目前詛咒層數。 */
  curseStacks: number;
  /** 清除層數；預設 FAITH_CURSE_CLEAR。 */
  clearAmount?: number;
};

/**
 * 結算堅定信仰（純函式；不改棋盤）。
 * 失敗：本回合已移動。
 */
export function resolveFaith(input: ResolveFaithInput): FaithResult {
  const clearAmount = input.clearAmount ?? FAITH_CURSE_CLEAR;

  if (input.hasMovedThisTurn) {
    return {
      ok: false,
      reason: 'already_moved',
      events: [],
      counted: true,
      curseStacks: input.curseStacks,
      cleared: 0,
    };
  }

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
