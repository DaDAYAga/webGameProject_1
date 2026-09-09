/**
 * 法師卡牌最小型別（handoff §10）。
 * 定義表見 stubs.MAGE_CARD_DEFS（共用 CardDefinition）。
 */

import type { Board } from '../../board/index.js';
import type { Axial } from '../../hex/index.js';
import type { CombatEvent } from '../../combat/index.js';
import type { CardDefinition, CardKindTag } from '../types.js';

export type { CardDefinition, CardKindTag };

/** 法師牌種 id。 */
export type MageCardId =
  | 'magic_arrow'
  | 'amplify'
  | 'wind'
  | 'focus'
  | 'barrier'
  | 'planar_swap';

/**
 * 棋上單位薄描述（御風壓頭／位面調換用）。
 * 本層不持有完整 actor 狀態。
 */
export type MageActorRef = {
  /** 單位 id（結果事件用）。 */
  id: string;
  /** 目前所在格。 */
  hex: Axial;
  /** 是否為王（不可被位面調換）。 */
  isBoss?: boolean;
  /** 是否已出局（不可被位面調換）。 */
  eliminated?: boolean;
  /** 是否已封印（可被調換；御風壓頭檢查用）。 */
  sealed?: boolean;
};

/** 法師卡牌實例。 */
export type MageCardInstance = {
  instanceId: string;
  cardId: MageCardId;
  /** 計次（與定義 countsTowardAction 對齊）。 */
  countsTowardAction: boolean;
};

/** 法師結算事件。 */
export type MageCardEvent =
  | CombatEvent
  | { type: 'TerrainPushed'; from: Axial; to: Axial; steps: number }
  | { type: 'ActorsSwapped'; aId: string; bId: string; aHex: Axial; bHex: Axial }
  | { type: 'TurnForceEnded'; reason: string }
  | { type: 'SilenceImmunityThisRound'; actorIds: string[] };

/** 御風術結算結果。 */
export type WindControlResult = {
  ok: boolean;
  reason?: string;
  board: Board;
  events: MageCardEvent[];
  /** 計次；沉默由上層處理。 */
  counted: true;
  /** 實際推動步數。 */
  stepsMoved: number;
  /** 地形最終落點（成功時）。 */
  finalHex?: Axial;
};

/** 位面調換結算結果。 */
export type PlanarSwapResult = {
  ok: boolean;
  reason?: string;
  events: MageCardEvent[];
  /** 不計次。 */
  counted: false;
  /**
   * 受沉默旗標（牌面）。
   * 未增幅：true（上層擋出牌）；增幅後：false（該張不受沉默）。
   */
  silenced: boolean;
  /** 成功後強制結束回合。 */
  endTurn: boolean;
  /** 被換兩人 id（成功時）；本輪不受沉默。 */
  swappedActorIds: string[];
  /** 交換後位置：id → hex。 */
  positions?: Record<string, Axial>;
};

/** 魔法箭結算結果（薄包遠程）。 */
export type MagicArrowResult = {
  ok: boolean;
  reason?: string;
  events: MageCardEvent[];
  counted: true;
  bossDamage: number;
  inSweetZone: boolean;
};
