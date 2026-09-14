/**
 * 騎士「奉獻」×2（2026-09-14i）：
 * - 鄰 1 吸隊友 1 層詛咒；或
 * - 鄰 1 吸收詛咒地形（清格、自己 +1 層）。
 * 達 cap 走咒滿→鋪鄰→封印（上層）；extractedUndying 表示上層應從牌庫抽出不死存在。
 * 不計次；受沉默。
 */

import { absorbCurseAt, curseCarryCap, type Board } from '../../board/index.js';
import { distance, type Axial } from '../../hex/index.js';
import { DEVOTION_ABSORB } from './constants.js';
import type { DevotionResult, KnightCardEvent } from './types.js';

/**
 * 從牌庫（非棄牌、非手牌）抽出指定 cardId 的第一張。
 * 找不到回 null。奉獻咒滿 tutor 不死存在用。
 */
export function extractCardFromLibrary<T extends { cardId: string }>(
  library: readonly T[],
  cardId: string,
): { card: T; rest: T[] } | null {
  const idx = library.findIndex((c) => c.cardId === cardId);
  if (idx < 0) return null;
  return {
    card: library[idx]!,
    rest: [...library.slice(0, idx), ...library.slice(idx + 1)],
  };
}

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
 * extractedUndying＝咒滿時上層應從牌庫抽出不死存在（實際抽牌在 UI，因 core 不持有牌庫）。
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
  const extractedUndying = selfCurseStacks >= curseCarryCap('knight');
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
    extractedUndying,
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
