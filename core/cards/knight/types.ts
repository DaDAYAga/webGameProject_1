/**
 * 騎士卡牌最小型別（計次旗標；沉默結算留給上層）。
 */

import type { Board } from '../../board/index.js';
import type { Axial } from '../../hex/index.js';
import type { CombatEvent } from '../../combat/index.js';

/** 騎士牌種 id。 */
export type KnightCardId =
  | 'attack'
  | 'shield_charge'
  | 'faith'
  | 'guard'
  | 'devotion'
  | 'undying';

/**
 * 最小卡牌實例（之後沉默／牌庫可擴充）。
 * counted：計次牌；受沉默時上層擋出牌。
 */
export type KnightCardInstance = {
  instanceId: string;
  cardId: KnightCardId;
  /** 計次牌（攻擊／衝鋒／信仰／護身）；奉獻／不死為 false。 */
  counted: boolean;
};

/** 攻擊／衝鋒共用的結算事件（含戰鬥事件）。 */
export type KnightCardEvent =
  | CombatEvent
  | { type: 'TurnForceEnded'; reason: string }
  | { type: 'ActorMoved'; from: Axial; to: Axial }
  | { type: 'CurseAbsorbed'; hex: Axial }
  | { type: 'CurseStopped'; hex: Axial }
  | { type: 'ChargeBlocked'; hex: Axial; reason: 'punish' | 'boss' | 'silence' };

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
 * 衝鋒遇詛咒行為（UNRESOLVED）。
 * - stop：停在詛咒前一格，不吸收（保守預設）
 * - absorbMax1：進入並清掉最多 1 格詛咒，可繼續前進
 */
export type CurseStopMode = 'stop' | 'absorbMax1';

/** 盾牌衝鋒結算結果。 */
export type ShieldChargeResult = {
  ok: boolean;
  reason?: string;
  board: Board;
  /** 衝鋒後角色位置。 */
  actorPosition: Axial;
  events: KnightCardEvent[];
  counted: true;
  /** 是否強制結束回合（撞牆／punish／王格等）。 */
  forceEndTurn: boolean;
  bossDamage: number;
  curseStop: CurseStopMode;
};
