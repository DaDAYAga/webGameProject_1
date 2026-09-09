/**
 * 騎士卡牌最小型別（計次旗標；沉默結算留給上層）。
 * 定義表見 stubs.KNIGHT_CARD_DEFS（共用 CardDefinition）。
 */

import type { Board } from '../../board/index.js';
import type { Axial } from '../../hex/index.js';
import type { CombatEvent } from '../../combat/index.js';
import type { CardDefinition, CardKindTag } from '../types.js';

export type { CardDefinition, CardKindTag };

/** 騎士牌種 id。 */
export type KnightCardId =
  | 'attack'
  | 'heroic_charge'
  | 'faith'
  | 'taunt'
  | 'devotion'
  | 'undying';

/**
 * 最小卡牌實例（之後沉默／牌庫可擴充）。
 * counted：計次牌；受沉默時上層擋出牌。
 */
export type KnightCardInstance = {
  instanceId: string;
  cardId: KnightCardId;
  /** 計次牌（攻擊／英勇衝鋒／信仰）；嘲諷／奉獻／不死為 false。 */
  counted: boolean;
};

/** 攻擊／衝鋒／其餘共用的結算事件（含戰鬥事件）。 */
export type KnightCardEvent =
  | CombatEvent
  | { type: 'TurnForceEnded'; reason: string }
  | { type: 'ActorMoved'; from: Axial; to: Axial }
  | { type: 'CurseAbsorbed'; hex: Axial }
  | { type: 'CurseStopped'; hex: Axial }
  | { type: 'ChargeBlocked'; hex: Axial; reason: 'punish' | 'boss' | 'silence' | 'unit' | 'map_edge' }
  | { type: 'WallPierce'; hex: Axial; bossDamageApplied: number }
  | { type: 'DrawRequested'; count: number; reason?: string }
  | { type: 'CurseClearedSelf'; amount: number }
  | {
      type: 'CurseAbsorbedFromAlly';
      amount: number;
      selfStacks: number;
      allyStacks: number;
    }
  | { type: 'UndyingExtracted'; reason: string }
  | { type: 'ActorRevived'; hex: Axial }
  | { type: 'UndyingClearedBroken'; hex: Axial }
  | { type: 'UndyingCrackedPlain'; hex: Axial }
  | {
      type: 'TauntApplied';
      center: Axial;
      ringDistance: number;
      priority: number;
    };

/** 攻擊結算結果。 */
export type KnightAttackResult = {
  ok: boolean;
  reason?: string;
  board: Board;
  events: KnightCardEvent[];
  /** 計次；沉默由上層處理。 */
  counted: true;
  /** 對王本體有效傷量（0＝無）。 */
  bossDamage: number;
};

/**
 * 英勇衝鋒遇詛咒行為。
 * - absorb：穿過並清格（預設；design-amendments 2026-09-09f）
 * - stop：停在詛咒前一格，不吸收（難度選項）
 */
export type CurseStopMode = 'absorb' | 'stop';

/** 英勇衝鋒結算結果。 */
export type HeroicChargeResult = {
  ok: boolean;
  reason?: string;
  board: Board;
  /** 衝鋒後角色位置。 */
  actorPosition: Axial;
  events: KnightCardEvent[];
  counted: true;
  /** 英勇衝鋒結算後一律結束回合。 */
  forceEndTurn: true;
  /** 牆傷（已 cap）＋王本體命中傷加總。 */
  bossDamage: number;
  /** 本次牆傷（已套 cap）。 */
  wallDamage: number;
  /** 是否命中王格。 */
  hitBoss: boolean;
  /** 是否觸發王抽牌（牆傷或王命中）。 */
  bossDraw: boolean;
  curseStop: CurseStopMode;
};

/** 堅定信仰結算結果。 */
export type FaithResult = {
  ok: boolean;
  reason?: string;
  events: KnightCardEvent[];
  counted: true;
  /** 結算後自身詛咒層。 */
  curseStacks: number;
  /** 實際清除層數。 */
  cleared: number;
};

/** 王鋪牆限制（嘲諷等）。 */
export type BossPlaceRestriction = {
  type: 'taunt';
  center: Axial;
  /** 禁鋪距離（嘲諷＝鄰 1）。 */
  ringDistance: number;
};

/** 嘲諷結算結果。 */
export type TauntResult = {
  ok: boolean;
  reason?: string;
  events: KnightCardEvent[];
  counted: false;
  /** 牌面不受沉默。 */
  silenced: false;
  bossDamage: 0;
  bossPlaceRestriction?: BossPlaceRestriction;
  tauntPriority: number;
  /** 若呼叫端傳入既有屏障，嘲諷優先級較高而覆蓋。 */
  overridesBarrier: boolean;
};

/** 奉獻結算結果。 */
export type DevotionResult = {
  ok: boolean;
  reason?: string;
  events: KnightCardEvent[];
  counted: false;
  selfCurseStacks: number;
  allyCurseStacks: number;
  /** 會致死而抽出不死存在。 */
  extractedUndying: boolean;
  wouldKillSelf: boolean;
};

/** 不死存在結算結果。 */
export type UndyingResult = {
  ok: boolean;
  reason?: string;
  board: Board;
  actorPosition?: Axial;
  events: KnightCardEvent[];
  counted: false;
  forceEndTurn: boolean;
  /** 恆為 0（清破碎不傷王）。 */
  bossDamage: number;
  affectedHexes: Axial[];
};
