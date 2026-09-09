/**
 * 戰鬥結算型別（design-amendments 2026-09-09b/d）。
 * 純資料；不含卡牌目錄、AI、React。
 */

import type { Board, TerrainHitResult } from '../board/types.js';

/** 遠程對王傷害結算結果。 */
export type RangedBossDamageResult = {
  /** 結算後傷害（最低 1）。 */
  damage: number;
  /** 是否在甜區（距離 ≤ RANGED_SWEET_RADIUS）。 */
  inSweetZone: boolean;
  /** 是否套用了區外 −1。 */
  rangePenaltyApplied: boolean;
  /** damage ≥ 1 → 有效傷（王應抽牌；上層可 MARK_BOSS_DAMAGED）。 */
  effective: boolean;
};

/** 近戰對王本體傷害結算結果。 */
export type MeleeBossDamageResult = {
  /** 相鄰時為 baseDamage；否則 0。 */
  damage: number;
  /** distance(attacker, boss) === 1。 */
  adjacent: boolean;
  /** 相鄰且 damage ≥ 1 → 有效傷。 */
  effective: boolean;
};

/**
 * 戰鬥事件（供上層投影／回合旗標）。
 * BossDamaged.effective 為 true 時應對齊 turn 的 bossDamagedThisRound。
 */
export type CombatEvent =
  | {
      type: 'BossDamaged';
      amount: number;
      source: 'melee' | 'ranged' | 'aged_wall_destroy' | 'heroic_charge';
      effective: boolean;
    };

/** 遠程對王參數。 */
export type ComputeRangedDamageToBossInput = {
  attacker: { q: number; r: number };
  baseDamage: number;
  /** 裝填／增幅等平坦加成；預設 0。 */
  bonusDamage?: number;
  /** 之後技能可忽略區外 −1；第一版可不傳。 */
  ignoreRangePenalty?: boolean;
  /** 預設王格 (0,0)。 */
  bossHex?: { q: number; r: number };
};

/** 近戰對王本體參數。 */
export type ComputeMeleeDamageToBossInput = {
  attacker: { q: number; r: number };
  baseDamage: number;
  bossHex?: { q: number; r: number };
};

/**
 * 地形攻擊（破碎／拆牆）＋戰鬥側王傷回報。
 * 重用 board.crackTile；damagesBoss 來自 tileDestroyDamagesBoss。
 */
export type TerrainCombatResult = TerrainHitResult & {
  events: CombatEvent[];
  /** 本次是否產生有效王傷（拆老化牆路徑）。 */
  bossDamaged: boolean;
};

/** 方便再匯出 Board（applyTerrainHit 參數）。 */
export type { Board };
