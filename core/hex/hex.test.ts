import { describe, expect, it } from 'vitest';
import {
  add,
  axialToCube,
  cubeToAxial,
  distance,
  equals,
  neighbors,
  scale,
  shrinkingFanCells,
  subtract,
  type Axial,
} from './index.js';

const O: Axial = { q: 0, r: 0 };

function sortedKey(cells: Axial[]): string[] {
  return cells.map((c) => `${c.q},${c.r}`).sort();
}

describe('axial / cube helpers', () => {
  it('axialToCube and cubeToAxial round-trip', () => {
    const a: Axial = { q: 2, r: -1 };
    const c = axialToCube(a);
    expect(c.q + c.r + c.s).toBe(0);
    expect(cubeToAxial(c)).toEqual(a);
  });

  it('add, subtract, scale, equals work as vectors', () => {
    expect(add({ q: 1, r: 2 }, { q: 3, r: -1 })).toEqual({ q: 4, r: 1 });
    expect(subtract({ q: 4, r: 1 }, { q: 1, r: 2 })).toEqual({ q: 3, r: -1 });
    expect(scale({ q: 1, r: -1 }, 3)).toEqual({ q: 3, r: -3 });
    expect(equals({ q: 1, r: 0 }, { q: 1, r: 0 })).toBe(true);
    expect(equals({ q: 1, r: 0 }, { q: 0, r: 1 })).toBe(false);
  });
});

describe('neighbors', () => {
  it('returns exactly 6 neighbors', () => {
    expect(neighbors(O)).toHaveLength(6);
  });

  it('known offsets from origin match Red Blob axial DIR table', () => {
    const expected: Axial[] = [
      { q: +1, r: 0 },
      { q: +1, r: -1 },
      { q: 0, r: -1 },
      { q: -1, r: 0 },
      { q: -1, r: +1 },
      { q: 0, r: +1 },
    ];
    expect(sortedKey(neighbors(O))).toEqual(sortedKey(expected));
  });

  it('neighbors of a non-origin cell are all distance 1', () => {
    const h: Axial = { q: 2, r: -3 };
    const got = neighbors(h);
    expect(got).toHaveLength(6);
    for (const n of got) {
      expect(distance(h, n)).toBe(1);
    }
  });
});

describe('distance', () => {
  it('same cell is 0', () => {
    expect(distance(O, O)).toBe(0);
    expect(distance({ q: 3, r: -2 }, { q: 3, r: -2 })).toBe(0);
  });

  it('adjacent cells are distance 1', () => {
    for (const n of neighbors(O)) {
      expect(distance(O, n)).toBe(1);
    }
  });

  it('known farther values', () => {
    expect(distance(O, { q: 3, r: 0 })).toBe(3);
    expect(distance(O, { q: 2, r: -1 })).toBe(2);
    expect(distance(O, { q: -2, r: 3 })).toBe(3);
    expect(distance({ q: 1, r: -1 }, { q: -1, r: 2 })).toBe(3);
  });

  it('is symmetric', () => {
    const a: Axial = { q: 2, r: -3 };
    const b: Axial = { q: -1, r: 4 };
    expect(distance(a, b)).toBe(distance(b, a));
  });
});

describe('shrinkingFanCells (shortest-path corridor)', () => {
  it('adjacent: corridor between is empty by default', () => {
    const toward: Axial = { q: 1, r: 0 };
    expect(shrinkingFanCells(O, toward)).toEqual([]);
  });

  it('adjacent: can include endpoints via options', () => {
    const toward: Axial = { q: 1, r: 0 };
    expect(sortedKey(shrinkingFanCells(O, toward, { includeOrigin: true }))).toEqual([
      '0,0',
    ]);
    expect(sortedKey(shrinkingFanCells(O, toward, { includeTarget: true }))).toEqual([
      '1,0',
    ]);
    expect(
      sortedKey(
        shrinkingFanCells(O, toward, { includeOrigin: true, includeTarget: true }),
      ),
    ).toEqual(['0,0', '1,0']);
  });
});

describe('shrinkingFanCells farther cases', () => {
  it('several rings away on a straight line (aligned +q)', () => {
    const toward: Axial = { q: 3, r: 0 };
    expect(sortedKey(shrinkingFanCells(O, toward))).toEqual(['1,0', '2,0']);
    expect(
      sortedKey(
        shrinkingFanCells(O, toward, { includeOrigin: true, includeTarget: true }),
      ),
    ).toEqual(['0,0', '1,0', '2,0', '3,0']);
  });

  it('several rings away with multiple shortest paths', () => {
    const toward: Axial = { q: 2, r: -1 };
    expect(sortedKey(shrinkingFanCells(O, toward))).toEqual(['1,-1', '1,0']);
  });

  it('same-cell edge case: empty unless includeOrigin', () => {
    expect(shrinkingFanCells(O, O)).toEqual([]);
    expect(shrinkingFanCells(O, O, { includeOrigin: true })).toEqual([O]);
    expect(shrinkingFanCells(O, O, { includeTarget: true })).toEqual([]);
  });

  it('every returned cell lies on a shortest path', () => {
    const from: Axial = { q: -1, r: 2 };
    const toward: Axial = { q: 3, r: -2 };
    const n = distance(from, toward);
    const cells = shrinkingFanCells(from, toward, {
      includeOrigin: true,
      includeTarget: true,
    });
    expect(cells.length).toBeGreaterThan(0);
    for (const c of cells) {
      expect(distance(from, c) + distance(c, toward)).toBe(n);
    }
  });
});
