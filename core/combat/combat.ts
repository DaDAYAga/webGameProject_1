/**
 * 戰鬥純函式：近戰鄰 1／遠程甜區 ≤3／拆老化牆傷王。
 * 鎖定：design-amendments 2026-09-09b／使用者 2026-09-09d 路徑（開場牆預設 aged broken）。
 * 不含擋線 −1、完整王牌庫、AI、React。
 */

import {
  BOSS_HEX,
  crackTile,
  tileDestroyDamagesBoss,
  type Board,
  type Tile,
} from '../board/index.js';
import { distance, type Axial } from '../hex/index.js';
import type {
  CombatEvent,
  ComputeMeleeDamageToBossInput,
  ComputeRangedDamageToBossInput,
  MeleeBossDamageResult,
  RangedBossDamageResult,
  TerrainCombatResult,
} from './types.js';

/**
 * 遠程對王甜區半徑（含）：distance ≤ 此值 → 完整傷。
 * 為什麼：鎖定常數，禁止實作成 ≤2／≤4。
 */
export const RANGED_SWEET_RADIUS = 3;

/**
 * 攻擊者是否在遠程甜區內（對王）。
 * @param attacker 攻擊者格子
 * @param bossHex 王格，預設 (0,0)
 */
export function isInRangedSweetZone(
  attacker: Axial,
  bossHex: Axial = BOSS_HEX,
): boolean {
  return distance(attacker, bossHex) <= RANGED_SWEET_RADIUS;
}

/**
 * 計算遠程（射擊／魔法箭）對王傷害。
 * - 可任意距離指定王
 * - 甜區內：base + bonus 完整傷
 * - 區外：−1（除非 ignoreRangePenalty）
 * - **無擋線／牆修正**（opening／plain／punish／silence 皆不進此函式）
 * - 最低 1；≥ 1 ⇒ effective（王應抽牌）
 */
export function computeRangedDamageToBoss(
  input: ComputeRangedDamageToBossInput,
): RangedBossDamageResult {
  const bossHex = input.bossHex ?? BOSS_HEX;
  const bonus = input.bonusDamage ?? 0;
  const ignore = input.ignoreRangePenalty === true;
  const inSweetZone = isInRangedSweetZone(input.attacker, bossHex);
  const raw = input.baseDamage + bonus;

  let rangePenaltyApplied = false;
  let damage = raw;
  if (!inSweetZone && !ignore) {
    damage = raw - 1;
    rangePenaltyApplied = true;
  }

  damage = Math.max(1, damage);
  const effective = damage >= 1;

  return { damage, inSweetZone, rangePenaltyApplied, effective };
}

/**
 * 計算近戰對王本體傷害。
 * 僅當 distance(attacker, boss) === 1 才有效；否則 damage 0、non-effective。
 */
export function computeMeleeDamageToBoss(
  input: ComputeMeleeDamageToBossInput,
): MeleeBossDamageResult {
  const bossHex = input.bossHex ?? BOSS_HEX;
  const adjacent = distance(input.attacker, bossHex) === 1;
  if (!adjacent) {
    return { damage: 0, adjacent: false, effective: false };
  }
  const damage = input.baseDamage;
  return { damage, adjacent: true, effective: damage >= 1 };
}

/**
 * 銷毀該格地形時是否依老化規則傷王。
 * 重用 board.tileDestroyDamagesBoss（aged plain／plain_broken／plain_starter）。
 * 開場牆預設 aged broken → 拆掉走此路徑傷王。
 */
export function damageBossFromAgedWallDestroy(tile: Tile): boolean {
  return tileDestroyDamagesBoss(tile);
}

/**
 * 由遠程結算結果產生 BossDamaged 事件（若有效）。
 * 為什麼：上層可用事件對齊 turn 的 MARK_BOSS_DAMAGED／bossDamagedThisRound。
 */
export function bossDamagedEventFromRanged(
  result: RangedBossDamageResult,
): CombatEvent | null {
  if (!result.effective) return null;
  return {
    type: 'BossDamaged',
    amount: result.damage,
    source: 'ranged',
    effective: true,
  };
}

/**
 * 由近戰結算結果產生 BossDamaged 事件（若有效）。
 */
export function bossDamagedEventFromMelee(
  result: MeleeBossDamageResult,
): CombatEvent | null {
  if (!result.effective) return null;
  return {
    type: 'BossDamaged',
    amount: result.damage,
    source: 'melee',
    effective: true,
  };
}

/**
 * 對地形打一下（包裝 board.crackTile），並在拆老化牆時回報王傷事件。
 * 傷害量固定 +1 風格（本層不結算王 HP）。
 */
export function applyTerrainHit(board: Board, hex: Axial): TerrainCombatResult {
  const hit = crackTile(board, hex);
  const events: CombatEvent[] = [];
  const bossDamaged = hit.destroyed && hit.damagesBoss;
  if (bossDamaged) {
    events.push({
      type: 'BossDamaged',
      amount: 1,
      source: 'aged_wall_destroy',
      effective: true,
    });
  }
  return { ...hit, events, bossDamaged };
}
