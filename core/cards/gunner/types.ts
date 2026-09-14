/**
 * 槍手卡牌／裝填槽型別（handoff §9 + 遠程修訂 2026-09-09b／氣瓶 2026-09-14f）。
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
 * 裝填槽狀態（手牌氣瓶合計最多 2 層；大招 unchecked 可超）。
 * damageBonus：頑皮；drawBonus：胡鬧；pushBonus：狂妄氣瓶。
 */
export type AmmoSlotState = {
  /** 下一次射擊傷害加成層數。 */
  damageBonus: number;
  /** 下一次射擊額外抽牌層數（結算時回傳給上層抽）。 */
  drawBonus: number;
  /** 下一次射擊徑向推牆次數（僅 pushBonus；玩家點選 N 鄰格）。 */
  pushBonus: number;
};

/** 空裝填槽。 */
export const EMPTY_AMMO_SLOT: AmmoSlotState = {
  damageBonus: 0,
  drawBonus: 0,
  pushBonus: 0,
};

/** 裝填槽合計層數上限（手牌氣瓶）。 */
export const AMMO_SLOT_MAX_TOTAL = 2;

/** 槍手卡牌實例。 */
export type GunnerCardInstance = CardInstanceBase & {
  cardId: GunnerCardId;
};

/** 射擊／氣瓶／其餘結算事件。 */
export type GunnerCardEvent =
  | CombatEvent
  | { type: 'AmmoSlotCleared' }
  | {
      type: 'AmmoSlotLoaded';
      damageBonus: number;
      drawBonus: number;
      pushBonus: number;
    }
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
      pushBonus: number;
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
  /** 結算前狂妄推牆層數（上層在清槽前保存；槽已清空）。 */
  pushFromAmmo: number;
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
   * 2026-09-13 起薄 UI／定義表改為計次；本欄仍 false 表「本函式不扣行動」。
   */
  counted: false;
  /** 更新後裝填槽。 */
  ammo: AmmoSlotState;
  /** 被棄的射擊 instanceId（頑皮成功時；胡鬧／狂妄無棄牌）。 */
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

/**
 * 狂妄氣瓶（cardId 仍為 power_up）結算結果。
 * 不再 dig_shots／temp_shot。
 */
export type PowerUpResult = {
  ok: boolean;
  reason?: string;
  events: GunnerCardEvent[];
  counted: true;
  /** 更新後裝填槽。 */
  ammo: AmmoSlotState;
};

/**
 * 來吧! 大鬧一場! 結算結果（2026-09-09g／2026-09-14f：免費三瓶層）。
 */
export type BigShowResult = {
  ok: boolean;
  reason?: string;
  events: GunnerCardEvent[];
  counted: true;
  mayPlayShot: boolean;
  ignoreRangePenaltyForShot: boolean;
  /** 成功時含免費 +傷／+抽／+推（可超 AMMO_SLOT_MAX_TOTAL）；失敗則原樣。 */
  ammo: AmmoSlotState;
};

export type { CardDefinition, CardKindTag };
