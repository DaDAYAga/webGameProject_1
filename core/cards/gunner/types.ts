/**
 * 槍手卡牌／裝填槽型別（handoff §9 + 遠程修訂 2026-09-09b）。
 */

import type { Axial } from '../../hex/index.js';
import type { CombatEvent } from '../../combat/index.js';
import type { CardDefinition, CardInstanceBase, CardKindTag } from '../types.js';

/** 槍手牌種 id。 */
export type GunnerCardId =
  | 'shot'
  | 'playful_bottle'
  | 'mischief_bottle'
  | 'turbulence'
  | 'power_up'
  | 'big_show';

/**
 * 裝填槽狀態（全角色合計最多 2 層；目前存於槍手／actor 狀態）。
 * damageBonus：頑皮氣瓶；drawBonus：胡鬧氣瓶。
 */
export type AmmoSlotState = {
  /** 下一次射擊傷害加成層數。 */
  damageBonus: number;
  /** 下一次射擊額外抽牌層數（結算時回傳給上層抽）。 */
  drawBonus: number;
};

/** 空裝填槽。 */
export const EMPTY_AMMO_SLOT: AmmoSlotState = {
  damageBonus: 0,
  drawBonus: 0,
};

/** 裝填槽合計層數上限。 */
export const AMMO_SLOT_MAX_TOTAL = 2;

/** 槍手卡牌實例。 */
export type GunnerCardInstance = CardInstanceBase & {
  cardId: GunnerCardId;
};

/** 射擊／氣瓶／其餘結算事件。 */
export type GunnerCardEvent =
  | CombatEvent
  | { type: 'AmmoSlotCleared' }
  | { type: 'AmmoSlotLoaded'; damageBonus: number; drawBonus: number }
  | { type: 'ShotDiscarded'; instanceId: string }
  | { type: 'BottlesDiscarded'; instanceIds: string[] }
  | { type: 'ActorMoved'; from: Axial; to: Axial }
  | { type: 'ShotsDug'; instanceIds: string[]; count: number }
  | { type: 'TempShotPlayed' }
  | { type: 'CardsDrawn'; instanceIds: string[]; count: number }
  | { type: 'ImmediatePlayAllowed'; instanceIds: string[] }
  | { type: 'MayPlayShot'; afterBigShow: true }
  /** 大招免費氣瓶：本次新增層數 + 裝填後槽狀態。 */
  | {
      type: 'BigShowAmmoGranted';
      damageBonus: number;
      drawBonus: number;
      ammo: AmmoSlotState;
    };

/** 射擊結算結果。 */
export type GunnerShotResult = {
  ok: boolean;
  reason?: string;
  events: GunnerCardEvent[];
  /** 計次；沉默由上層處理。 */
  counted: true;
  /** 對王有效傷量。 */
  bossDamage: number;
  /** 是否在遠程甜區。 */
  inSweetZone: boolean;
  /** 結算前裝填抽牌加成（上層應抽這麼多；槽已清空）。 */
  drawFromAmmo: number;
  /** 結算後裝填槽（射擊後必清空）。 */
  ammo: AmmoSlotState;
};

/** 氣瓶（裝填）結算結果。 */
export type GunnerBottleResult = {
  ok: boolean;
  reason?: string;
  events: GunnerCardEvent[];
  /**
   * 氣瓶本身是否計次。
   * // UNRESOLVED: 交接未明示氣瓶是否計次；預設不計次（utility／裝填）。
   */
  counted: false;
  /** 更新後裝填槽。 */
  ammo: AmmoSlotState;
  /** 被棄的射擊 instanceId（成功時）。 */
  discardedShotId?: string;
  /** 更新後手牌（已移除棄掉的射擊；氣瓶本身由上層移除）。 */
  hand: GunnerCardInstance[];
};

/** 大亂流結算結果。 */
export type TurbulenceResult = {
  ok: boolean;
  reason?: string;
  events: GunnerCardEvent[];
  counted: true;
  actorPosition: Axial;
  hand: GunnerCardInstance[];
  discardedBottleIds: string[];
  steps: number;
};

/** Power UP!! 結算結果。 */
export type PowerUpResult = {
  ok: boolean;
  reason?: string;
  events: GunnerCardEvent[];
  counted: true;
  mode: 'dig_shots' | 'temp_shot';
  dugShots: GunnerCardInstance[];
  remainingDeck: GunnerCardInstance[];
  /** temp_shot 成功後不可立刻接氣瓶。 */
  cannotBottleImmediately: boolean;
  bossDamage?: number;
  inSweetZone?: boolean;
  drawFromAmmo?: number;
  ammo?: AmmoSlotState;
};

/**
 * 來吧! 大鬧一場! 結算結果（2026-09-09g：不抽牌；白送臨時射擊不耗卡）。
 */
export type BigShowResult = {
  ok: boolean;
  reason?: string;
  events: GunnerCardEvent[];
  counted: true;
  /**
   * 成功時為 true：本大招內已結算一發白送臨時射擊（同 Power UP temp_shot；
   * 不消耗手上射擊牌；固定 ignoreRangePenalty）。
   */
  tempShotGranted: boolean;
  /** 白送射擊對王有效傷（成功且有結算時）。 */
  bossDamage?: number;
  inSweetZone?: boolean;
  /** 該白送射擊從裝填抽出的張數（上層應抽）。 */
  drawFromAmmo?: number;
  /** 結算後裝填槽（白送射擊後必清空；失敗則為輸入原樣）。 */
  ammo: AmmoSlotState;
  /** 成功時：免費裝填後、射擊前的槽快照（可超 cap）。 */
  ammoBeforeShot?: AmmoSlotState;
};

export type { CardDefinition, CardKindTag };
