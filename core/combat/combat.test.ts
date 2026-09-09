import { describe, expect, it } from 'vitest';
import {
  BOSS_HEX,
  createEmptyBoard,
  createOpeningBoard,
  getTile,
  makeTile,
  placeTerrain,
} from '../board/index.js';
import { distance, type Axial } from '../hex/index.js';
import {
  RANGED_SWEET_RADIUS,
  applyTerrainHit,
  computeMeleeDamageToBoss,
  computeRangedDamageToBoss,
  damageBossFromAgedWallDestroy,
  isInRangedSweetZone,
} from './index.js';

const O: Axial = { q: 0, r: 0 };

describe('RANGED_SWEET_RADIUS', () => {
  it('is locked at 3', () => {
    expect(RANGED_SWEET_RADIUS).toBe(3);
  });
});

describe('melee vs boss body', () => {
  it('adjacent (dist 1) → full base damage, effective', () => {
    const attacker: Axial = { q: 1, r: 0 };
    expect(distance(attacker, BOSS_HEX)).toBe(1);
    const r = computeMeleeDamageToBoss({ attacker, baseDamage: 2 });
    expect(r.adjacent).toBe(true);
    expect(r.damage).toBe(2);
    expect(r.effective).toBe(true);
  });

  it('dist 2 → not effective, damage 0', () => {
    const attacker: Axial = { q: 2, r: 0 };
    expect(distance(attacker, O)).toBe(2);
    const r = computeMeleeDamageToBoss({ attacker, baseDamage: 3 });
    expect(r.adjacent).toBe(false);
    expect(r.damage).toBe(0);
    expect(r.effective).toBe(false);
  });
});

describe('ranged vs boss — sweet zone & penalty', () => {
  it('dist 1,2,3 → no range penalty, full damage', () => {
    for (const [q, r, d] of [
      [1, 0, 1],
      [2, 0, 2],
      [3, 0, 3],
    ] as const) {
      const attacker: Axial = { q, r };
      expect(distance(attacker, O)).toBe(d);
      expect(isInRangedSweetZone(attacker)).toBe(true);
      const result = computeRangedDamageToBoss({
        attacker,
        baseDamage: 2,
        bonusDamage: 1,
      });
      expect(result.inSweetZone).toBe(true);
      expect(result.rangePenaltyApplied).toBe(false);
      expect(result.damage).toBe(3);
      expect(result.effective).toBe(true);
    }
  });

  it('dist 4 → −1 range penalty', () => {
    const attacker: Axial = { q: 4, r: 0 };
    expect(distance(attacker, O)).toBe(4);
    expect(isInRangedSweetZone(attacker)).toBe(false);
    const result = computeRangedDamageToBoss({ attacker, baseDamage: 2 });
    expect(result.inSweetZone).toBe(false);
    expect(result.rangePenaltyApplied).toBe(true);
    expect(result.damage).toBe(1);
    expect(result.effective).toBe(true);
  });

  it('floor at 1: base 1 outside sweet → still 1 effective', () => {
    const attacker: Axial = { q: 4, r: 0 };
    const result = computeRangedDamageToBoss({ attacker, baseDamage: 1 });
    expect(result.rangePenaltyApplied).toBe(true);
    expect(result.damage).toBe(1);
    expect(result.effective).toBe(true);
  });

  it('ignoreRangePenalty skips −1 outside sweet', () => {
    const attacker: Axial = { q: 5, r: 0 };
    expect(distance(attacker, O)).toBe(5);
    const result = computeRangedDamageToBoss({
      attacker,
      baseDamage: 2,
      bonusDamage: 1,
      ignoreRangePenalty: true,
    });
    expect(result.inSweetZone).toBe(false);
    expect(result.rangePenaltyApplied).toBe(false);
    expect(result.damage).toBe(3);
    expect(result.effective).toBe(true);
  });

  it('walls present do not change ranged damage (no LoS penalty)', () => {
    // 開場牆環繞王；遠程 API 不吃 board — 有牆／無牆同一公式
    const opening = createOpeningBoard();
    expect(opening.tiles.size).toBe(6);

    let withExtras = opening;
    withExtras = placeTerrain(withExtras, { q: 2, r: 0 }, 'plain');
    withExtras = placeTerrain(withExtras, { q: 2, r: 1 }, 'punish');
    withExtras = placeTerrain(withExtras, { q: 1, r: 1 }, 'silence');

    const attacker: Axial = { q: 4, r: 0 };
    const emptyBoardResult = computeRangedDamageToBoss({
      attacker,
      baseDamage: 2,
    });
    const walledBoardResult = computeRangedDamageToBoss({
      attacker,
      baseDamage: 2,
    });
    // 明示：即使棋盤上有 opening／plain／punish／silence，結算仍相同
    void withExtras;
    expect(emptyBoardResult).toEqual(walledBoardResult);
    expect(walledBoardResult.damage).toBe(1);
    expect(walledBoardResult.rangePenaltyApplied).toBe(true);
  });
});

describe('aged wall destroy → damages boss', () => {
  it('damageBossFromAgedWallDestroy true for aged plain_broken', () => {
    const aged = makeTile('plain_broken', { aged: true });
    expect(damageBossFromAgedWallDestroy(aged)).toBe(true);
    const fresh = makeTile('plain_broken', { aged: false });
    expect(damageBossFromAgedWallDestroy(fresh)).toBe(false);
  });

  it('opening aged broken wall: applyTerrainHit destroys and BossDamaged', () => {
    const board0 = createOpeningBoard();
    const cell: Axial = { q: 1, r: 0 };
    expect(getTile(board0, cell)?.aged).toBe(true);

    const hit = applyTerrainHit(board0, cell);
    expect(hit.ok).toBe(true);
    expect(hit.destroyed).toBe(true);
    expect(hit.damagesBoss).toBe(true);
    expect(hit.bossDamaged).toBe(true);
    expect(hit.events).toEqual([
      {
        type: 'BossDamaged',
        amount: 1,
        source: 'aged_wall_destroy',
        effective: true,
      },
    ]);
  });

  it('non-aged plain_broken destroy does not damage boss', () => {
    let board = createEmptyBoard();
    board = placeTerrain(board, { q: 3, r: 0 }, 'plain_broken', { aged: false });
    const hit = applyTerrainHit(board, { q: 3, r: 0 });
    expect(hit.destroyed).toBe(true);
    expect(hit.damagesBoss).toBe(false);
    expect(hit.bossDamaged).toBe(false);
    expect(hit.events).toEqual([]);
  });
});
