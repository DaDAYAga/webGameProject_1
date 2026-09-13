import { describe, expect, it } from 'vitest';
import {
  BOSS_HEX,
  createEmptyBoard,
  createOpeningBoard,
  getTile,
  placeTerrain,
} from '../board/index.js';
import { DEFAULT_MAP_RADIUS } from '../enclosure/index.js';
import {
  applyDifficultyBag,
  hexCapacityOf,
  pickInteriorEmptyHexes,
  splitIntactAndCurse,
  type DifficultyBagCounts,
} from './difficulty.js';

const BASE: DifficultyBagCounts = {
  place2: 15,
  place3: 12,
  place4: 3,
  agedWalls: 0,
  intactWalls: 62,
  curseTiles: 15,
  silenceTiles: 1,
  mudTiles: 0,
};

const OFF = { silence: false, madCurse: false, madPressure: false };

describe('applyDifficultyBag', () => {
  it('off keeps default 78-bag 62/15/1', () => {
    const r = applyDifficultyBag(BASE, OFF);
    expect(r).toEqual(BASE);
    expect(hexCapacityOf(r.place2, r.place3, r.place4)).toBe(78);
    expect(
      r.agedWalls + r.intactWalls + r.curseTiles + r.silenceTiles + r.mudTiles,
    ).toBe(78);
  });

  it('沉默無聲: silence 1→2, intact 62→61', () => {
    const r = applyDifficultyBag(BASE, { ...OFF, silence: true });
    expect(r.silenceTiles).toBe(2);
    expect(r.intactWalls).toBe(61);
    expect(r.curseTiles).toBe(15);
    expect(
      r.agedWalls + r.intactWalls + r.curseTiles + r.silenceTiles + r.mudTiles,
    ).toBe(78);
  });

  it('瘋狂詛咒: ~58 generally / ~19 curse / 1 silence', () => {
    const r = applyDifficultyBag(BASE, { ...OFF, madCurse: true });
    expect(splitIntactAndCurse(77)).toEqual({ intactWalls: 58, curseTiles: 19 });
    expect(r.intactWalls).toBe(58);
    expect(r.curseTiles).toBe(19);
    expect(r.silenceTiles).toBe(1);
    expect(
      r.agedWalls + r.intactWalls + r.curseTiles + r.silenceTiles + r.mudTiles,
    ).toBe(78);
  });

  it('沉默+詛咒: remaining 76 → 57/19/2', () => {
    const r = applyDifficultyBag(BASE, { silence: true, madCurse: true, madPressure: false });
    expect(r.silenceTiles).toBe(2);
    expect(r.intactWalls).toBe(57);
    expect(r.curseTiles).toBe(19);
    expect(
      r.agedWalls + r.intactWalls + r.curseTiles + r.silenceTiles + r.mudTiles,
    ).toBe(78);
  });

  it('瘋狂壓力: 13/12/5 cap 82, +4 一般格', () => {
    const r = applyDifficultyBag(BASE, { ...OFF, madPressure: true });
    expect(r.place2).toBe(13);
    expect(r.place3).toBe(12);
    expect(r.place4).toBe(5);
    expect(hexCapacityOf(13, 12, 5)).toBe(82);
    expect(r.intactWalls).toBe(66);
    expect(r.curseTiles).toBe(15);
    expect(r.silenceTiles).toBe(1);
    expect(
      r.agedWalls + r.intactWalls + r.curseTiles + r.silenceTiles + r.mudTiles,
    ).toBe(82);
  });

  it('壓力+詛咒 stacks: cap 82 remaining 81 → 61/20/1', () => {
    const r = applyDifficultyBag(BASE, { silence: false, madCurse: true, madPressure: true });
    expect(hexCapacityOf(r.place2, r.place3, r.place4)).toBe(82);
    expect(r.silenceTiles).toBe(1);
    expect(r.intactWalls).toBe(61);
    expect(r.curseTiles).toBe(20);
    expect(
      r.agedWalls + r.intactWalls + r.curseTiles + r.silenceTiles + r.mudTiles,
    ).toBe(82);
  });
});

describe('pickInteriorEmptyHexes', () => {
  it('skips boss, edge, tiles, occupied; takes count', () => {
    let board = createOpeningBoard();
    const occupied = [{ q: 2, r: 0 }];
    const picks = pickInteriorEmptyHexes(board, occupied, DEFAULT_MAP_RADIUS, 3, () => 0);
    expect(picks).toHaveLength(3);
    for (const h of picks) {
      expect(h).not.toEqual(BOSS_HEX);
      expect(Math.max(Math.abs(h.q), Math.abs(h.r), Math.abs(h.q + h.r))).toBeLessThan(
        DEFAULT_MAP_RADIUS + 1,
      );
      expect(distanceSafe(h)).toBeLessThan(DEFAULT_MAP_RADIUS);
      expect(getTile(board, h)).toBeUndefined();
      expect(occupied.some((o) => o.q === h.q && o.r === h.r)).toBe(false);
    }
    board = placeTerrain(createEmptyBoard(), { q: 2, r: -1 }, 'mud');
    const noneOnTile = pickInteriorEmptyHexes(
      board,
      [],
      DEFAULT_MAP_RADIUS,
      20,
      () => 0,
    );
    expect(noneOnTile.some((h) => h.q === 2 && h.r === -1)).toBe(false);
  });
});

function distanceSafe(h: { q: number; r: number }): number {
  return (Math.abs(h.q) + Math.abs(h.r) + Math.abs(h.q + h.r)) / 2;
}
