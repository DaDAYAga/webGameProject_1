import { describe, expect, it } from 'vitest';
import { distance, equals, neighbors, type Axial } from '../hex/index.js';
import {
  BOSS_HEX,
  canStandAt,
  createEmptyBoard,
  createOpeningBoard,
  placeTerrain,
  shortestPath,
  shortestPathLength,
  standableShrinkingFanCells,
} from './index.js';

function pathKeys(path: Axial[]): string[] {
  return path.map((h) => `${h.q},${h.r}`);
}

describe('shortestPath — 可站格 BFS', () => {
  it('empty board: path length = distance + 1 cells', () => {
    const board = createEmptyBoard();
    const from: Axial = { q: 2, r: 0 };
    const toward: Axial = { q: 5, r: 0 };
    const d = distance(from, toward);
    expect(d).toBe(3);

    const path = shortestPath(board, from, toward);
    expect(path).not.toBeNull();
    expect(path!).toHaveLength(d + 1);
    expect(shortestPathLength(board, from, toward)).toBe(d);
    expect(equals(path![0]!, from)).toBe(true);
    expect(equals(path![path!.length - 1]!, toward)).toBe(true);
    // 每步相鄰
    for (let i = 1; i < path!.length; i++) {
      expect(distance(path![i - 1]!, path![i]!)).toBe(1);
    }
  });

  it('from === toward → [from]', () => {
    const board = createEmptyBoard();
    const hex: Axial = { q: 3, r: -1 };
    const path = shortestPath(board, hex, hex);
    expect(path).toEqual([{ q: 3, r: -1 }]);
    expect(shortestPathLength(board, hex, hex)).toBe(0);
  });

  it('wall on direct line: path goes around', () => {
    let board = createEmptyBoard();
    const from: Axial = { q: 0, r: 2 };
    const toward: Axial = { q: 0, r: -2 };
    // 擋住直廊上的中間格（不含端點）
    board = placeTerrain(board, { q: 0, r: 0 }, 'plain'); // 其實是 BOSS 本來就不可站
    board = placeTerrain(board, { q: 0, r: 1 }, 'plain');
    board = placeTerrain(board, { q: 0, r: -1 }, 'plain');

    const path = shortestPath(board, from, toward);
    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThan(distance(from, toward) + 1);
    for (const h of path!) {
      if (equals(h, from)) continue;
      expect(canStandAt(board, h)).toBe(true);
    }
    // 不踩牆
    expect(pathKeys(path!)).not.toContain('0,1');
    expect(pathKeys(path!)).not.toContain('0,-1');
    expect(pathKeys(path!)).not.toContain('0,0');
  });

  it('completely blocked pocket → null', () => {
    let board = createEmptyBoard();
    const from: Axial = { q: 3, r: 0 };
    const toward: Axial = { q: 5, r: 0 };
    // 把 toward 的六鄰全封（含 from 方向），且不讓 from 進入 toward
    for (const n of neighbors(toward)) {
      board = placeTerrain(board, n, 'plain');
    }
    // toward 本身空（可站）但仍不可達
    expect(canStandAt(board, toward)).toBe(true);
    const path = shortestPath(board, from, toward, { maxSteps: 40 });
    expect(path).toBeNull();
  });

  it('unstandable target → null unless allowUnstandableTarget', () => {
    let board = createEmptyBoard();
    const from: Axial = { q: 2, r: 0 };
    const toward: Axial = { q: 4, r: 0 };
    board = placeTerrain(board, toward, 'plain_broken');
    expect(canStandAt(board, toward)).toBe(false);

    expect(shortestPath(board, from, toward)).toBeNull();

    const allowed = shortestPath(board, from, toward, {
      allowUnstandableTarget: true,
    });
    expect(allowed).not.toBeNull();
    expect(equals(allowed![allowed!.length - 1]!, toward)).toBe(true);
  });

  it('opening board: from (2,0) toward hex behind wall — never step on plain_broken ring', () => {
    const board = createOpeningBoard();
    const from: Axial = { q: 2, r: 0 };
    // 牆後／環內側：例如 (1,0) 是 plain_broken；選一個在牆另一側、可站的格
    // 王鄰六格皆牆；(2,0) 在牆外。目標選 (-2,0)（對面牆外），必須繞過環牆，不可踩牆與王格。
    const toward: Axial = { q: -2, r: 0 };
    expect(canStandAt(board, from)).toBe(true);
    expect(canStandAt(board, toward)).toBe(true);

    const path = shortestPath(board, from, toward);
    expect(path).not.toBeNull();

    const ring = new Set(neighbors(BOSS_HEX).map((h) => `${h.q},${h.r}`));
    for (const h of path!) {
      expect(ring.has(`${h.q},${h.r}`)).toBe(false);
      expect(equals(h, BOSS_HEX)).toBe(false);
      if (!equals(h, from)) {
        expect(canStandAt(board, h)).toBe(true);
      }
    }
  });

  it('opening: toward a boss-neighbor wall → null (unstandable target)', () => {
    const board = createOpeningBoard();
    const from: Axial = { q: 2, r: 0 };
    const wall: Axial = { q: 1, r: 0 };
    expect(canStandAt(board, wall)).toBe(false);
    expect(shortestPath(board, from, wall)).toBeNull();
  });
});

describe('standableShrinkingFanCells — 幾何過濾（非繞牆）', () => {
  it('filters non-standable mid cells; documents not full pathfinding', () => {
    const board = createOpeningBoard();
    const from: Axial = { q: 2, r: 0 };
    const toward: Axial = { q: -2, r: 0 };
    const fan = standableShrinkingFanCells(board, from, toward, {
      includeOrigin: true,
      includeTarget: true,
    });
    // 幾何廊道上的王鄰牆會被濾掉；端點保留
    expect(fan.some((h) => equals(h, from))).toBe(true);
    expect(fan.some((h) => equals(h, toward))).toBe(true);
    for (const h of neighbors(BOSS_HEX)) {
      expect(fan.some((c) => equals(c, h))).toBe(false);
    }
  });
});
