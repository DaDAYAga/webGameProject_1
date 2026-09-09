/**
 * 騎士「奉獻」×2：鄰 1 吸隊友 1 層詛咒。
 * 不計次；受沉默。會致死則抽出不死存在（不傷王）。
 * 騎士精神：沉默中被動仍生效（本層只結算吸咒／抽不死）。
 */

import { distance, type Axial } from '../../hex/index.js';
import {
  DEVOTION_ABSORB,
  KNIGHT_CURSE_DEATH_STACKS,
} from './constants.js';
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
  /** 致死門檻；預設 KNIGHT_CURSE_DEATH_STACKS。 */
  deathStacks?: number;
};

/**
 * 結算奉獻（純函式）。
 * - 成功：隊友 −absorb、自己 +absorb
 * - 若自己吸後 ≥ 死亡層 → extractedUndying=true（事件 UndyingExtracted）；
 *   自己層數仍加上（上層決定死亡／持不死牌）
 * - 不傷王、不改棋盤
 */
export function resolveDevotion(input: ResolveDevotionInput): DevotionResult {
  const absorb = input.absorbAmount ?? DEVOTION_ABSORB;
  const deathAt = input.deathStacks ?? KNIGHT_CURSE_DEATH_STACKS;

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
  const wouldKillSelf = selfCurseStacks >= deathAt;
  const events: KnightCardEvent[] = [
    {
      type: 'CurseAbsorbedFromAlly',
      amount: absorb,
      selfStacks: selfCurseStacks,
      allyStacks: allyCurseStacks,
    },
  ];

  let extractedUndying = false;
  if (wouldKillSelf) {
    extractedUndying = true;
    events.push({ type: 'UndyingExtracted', reason: 'devotion_lethal' });
  }

  return {
    ok: true,
    events,
    counted: false,
    selfCurseStacks,
    allyCurseStacks,
    extractedUndying,
    wouldKillSelf,
  };
}
