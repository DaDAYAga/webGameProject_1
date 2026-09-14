/**
 * 騎士「奉獻」×2（2026-09-14f）：
 * - 鄰 1 吸隊友 1 層詛咒；或
 * - 鄰 1 吸收詛咒地形（清格、自己 +1 層）。
 * 達 cap 走咒滿→鋪鄰→封印（上層）；不再抽出不死／離場。
 * 不計次；受沉默。
 */

import { absorbCurseAt, type Board } from '../../board/index.js';
import { distance, type Axial } from '../../hex/index.js';
import { DEVOTION_ABSORB } from './constants.js';
import type { DevotionResult, KnightCardEvent } from './types.js';

export type ResolveDevotionInput = {
  /** 騎士位置。 */
  actorHex: Axial;
  /** 隊友位置（須鄰 1）。 */
  allyHex: Axial;
  /** 騎士目前詛咒層。 */
  selfCurseStacks: number;
  /** 隊友目前詛咒層。 */
  allyCurseStacks: number;
  /** 吸收層數；預設 DEVOTION_ABSORB。 */
  absorbAmount?: number;
};

/**
 * 結算奉獻：吸隊友詛咒（純函式；不改棋盤）。
 * extractedUndying 恆 false（咒滿由上層 fillNeighbors＋seal）。
 */
export function resolveDevotion(input: ResolveDevotionInput): DevotionResult {
  const absorb = input.absorbAmount ?? DEVOTION_ABSORB;

  if (distance(input.actorHex, input.allyHex) !== 1) {
    return {
      ok: false,
      reason: 'ally_not_adjacent',
      events: [],
      counted: false,
      selfCurseStacks: input.selfCurseStacks,
      allyCurseStacks: input.allyCurseStacks,
      extractedUndying: false,
      wouldKillSelf: false,
    };
  }

  if (input.allyCurseStacks < absorb) {
    return {
      ok: false,
      reason: 'ally_no_curse',
      events: [],
      counted: false,
      selfCurseStacks: input.selfCurseStacks,
      allyCurseStacks: input.allyCurseStacks,
      extractedUndying: false,
      wouldKillSelf: false,
    };
  }

  const allyCurseStacks = input.allyCurseStacks - absorb;
  const selfCurseStacks = input.selfCurseStacks + absorb;
  const events: KnightCardEvent[] = [
    {
      type: 'CurseAbsorbedFromAlly',
      amount: absorb,
      selfStacks: selfCurseStacks,
      allyStacks: allyCurseStacks,
    },
  ];

  return {
    ok: true,
    events,
    counted: false,
    selfCurseStacks,
    allyCurseStacks,
    extractedUndying: false,
    wouldKillSelf: false,
  };
}

export type ResolveDevotionCurseTileInput = {
  board: Board;
  actorHex: Axial;
  /** 鄰 1 詛咒地形格。 */
  curseHex: Axial;
  selfCurseStacks: number;
  absorbAmount?: number;
};

export type DevotionCurseTileResult = {
  ok: boolean;
  reason?: string;
  board: Board;
  events: KnightCardEvent[];
  counted: false;
  selfCurseStacks: number;
  /** 實際清掉的詛咒格數（0 或 1）。 */
  absorbedCount: number;
};

/**
 * 奉獻吸鄰 1 詛咒地形：清格（不傷王）、自己 +absorb。
 */
export function resolveDevotionCurseTile(
  input: ResolveDevotionCurseTileInput,
): DevotionCurseTileResult {
  const absorb = input.absorbAmount ?? DEVOTION_ABSORB;
  if (distance(input.actorHex, input.curseHex) !== 1) {
    return {
      ok: false,
      reason: 'curse_not_adjacent',
      board: input.board,
      events: [],
      counted: false,
      selfCurseStacks: input.selfCurseStacks,
      absorbedCount: 0,
    };
  }
  const cleared = absorbCurseAt(input.board, input.curseHex);
  if (!cleared) {
    return {
      ok: false,
      reason: 'not_curse_tile',
      board: input.board,
      events: [],
      counted: false,
      selfCurseStacks: input.selfCurseStacks,
      absorbedCount: 0,
    };
  }
  const selfCurseStacks = input.selfCurseStacks + absorb;
  const events: KnightCardEvent[] = [
    { type: 'CurseAbsorbed', hex: input.curseHex },
  ];
  return {
    ok: true,
    board: cleared,
    events,
    counted: false,
    selfCurseStacks,
    absorbedCount: absorb,
  };
}
