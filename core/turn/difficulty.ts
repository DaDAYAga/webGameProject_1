/**
 * 重製難度旗標：由預設袋／放置重算（可疊加）。
 * 堅固圍牆／寸步難移不改袋；代價移動（即原 C 版）不在此實作。
 */
import { BOSS_HEX, getTile, type Board } from '../board/index.js';
import { listMapHexes } from '../enclosure/index.js';
import { distance, equals, type Axial } from '../hex/index.js';

export type DifficultyBagCounts = {
  place2: number;
  place3: number;
  place4: number;
  agedWalls: number;
  intactWalls: number;
  curseTiles: number;
  silenceTiles: number;
  mudTiles: number;
};

export type BagDifficultyFlags = {
  silence: boolean;
  madCurse: boolean;
  madPressure: boolean;
};

export function hexCapacityOf(place2: number, place3: number, place4: number): number {
  return place2 * 2 + place3 * 3 + place4 * 4;
}

/** 詛咒 ≈ 一般格 1/3：intact = round(remaining*3/4)，其餘為 curse。 */
export function splitIntactAndCurse(remaining: number): {
  intactWalls: number;
  curseTiles: number;
} {
  const intactWalls = Math.round((remaining * 3) / 4);
  return { intactWalls, curseTiles: remaining - intactWalls };
}

/**
 * 由預設 counts 套用可疊加旗標。
 * 序：瘋狂壓力 → 沉默無聲 → 瘋狂詛咒。
 */
export function applyDifficultyBag(
  base: DifficultyBagCounts,
  flags: BagDifficultyFlags,
): DifficultyBagCounts {
  const out: DifficultyBagCounts = { ...base };
  if (flags.madPressure) {
    out.place2 = Math.max(0, out.place2 - 2);
    out.place4 = out.place4 + 2;
    out.intactWalls = out.intactWalls + 4;
  }
  if (flags.silence) {
    out.silenceTiles = out.silenceTiles + 1;
    out.intactWalls = Math.max(0, out.intactWalls - 1);
  }
  if (flags.madCurse) {
    const cap = hexCapacityOf(out.place2, out.place3, out.place4);
    const remaining = cap - out.silenceTiles - out.mudTiles - out.agedWalls;
    const split = splitIntactAndCurse(Math.max(0, remaining));
    out.intactWalls = split.intactWalls;
    out.curseTiles = split.curseTiles;
  }
  return out;
}

/**
 * 寸步難移：隨機內圈空格（非邊緣、非王、非佔格、非既有地形）。
 */
export function pickInteriorEmptyHexes(
  board: Board,
  occupied: readonly Axial[],
  radius: number,
  count: number,
  rng: () => number = Math.random,
): Axial[] {
  const bounds = { radius };
  const pool = listMapHexes(bounds).filter((h) => {
    if (equals(h, BOSS_HEX)) return false;
    if (distance(h, BOSS_HEX) >= radius) return false;
    if (getTile(board, h)) return false;
    if (occupied.some((o) => equals(o, h))) return false;
    return true;
  });
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = tmp;
  }
  return pool.slice(0, Math.max(0, count));
}
