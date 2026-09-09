/**
 * 戰鬥結算層（core/combat）。
 * 近戰鄰 1、遠程甜區 ≤3、無擋線 −1、拆老化牆傷王。不含卡牌／AI／React。
 */

export type {
  RangedBossDamageResult,
  MeleeBossDamageResult,
  CombatEvent,
  ComputeRangedDamageToBossInput,
  ComputeMeleeDamageToBossInput,
  TerrainCombatResult,
} from './types.js';

export {
  RANGED_SWEET_RADIUS,
  isInRangedSweetZone,
  computeRangedDamageToBoss,
  computeMeleeDamageToBoss,
  damageBossFromAgedWallDestroy,
  bossDamagedEventFromRanged,
  bossDamagedEventFromMelee,
  applyTerrainHit,
} from './combat.js';
