import { describe, expect, it } from 'vitest';
import {
  absorbCursesAlongPath,
  BASIC_MOVE_BASE,
  basicMoveCap,
  createEmptyBoard,
  curseCarryCap,
  curseFullAfterAbsorb,
  getTile,
  isAdjacentToMud,
  isAdjacentToSilence,
  placeTerrain,
  fillNeighborsWithPlain,
  placeUnagedPlainIfEmpty,
  shortestPath,
} from './index.js';
import type { Axial } from '../hex/index.js';

describe('curseCarryCap / isAdjacentToSilence', () => {
  it('knight cap 3, others 2', () => {
    expect(curseCarryCap('knight')).toBe(3);
    expect(curseCarryCap('gunner')).toBe(2);
    expect(curseCarryCap('mage')).toBe(2);
  });

  it('adjacent silence detection', () => {
    let board = createEmptyBoard();
    const hex: Axial = { q: 2, r: 0 };
    expect(isAdjacentToSilence(board, hex)).toBe(false);
    board = placeTerrain(board, { q: 3, r: 0 }, 'silence');
    expect(isAdjacentToSilence(board, hex)).toBe(true);
  });
});

describe('isAdjacentToMud / basicMoveCap', () => {
  it('adjacent mud detection', () => {
    let board = createEmptyBoard();
    const hex: Axial = { q: 2, r: 0 };
    expect(isAdjacentToMud(board, hex)).toBe(false);
    board = placeTerrain(board, { q: 3, r: 0 }, 'mud');
    expect(isAdjacentToMud(board, hex)).toBe(true);
  });

  it('basicMoveCap is base, or base-1 next to mud, never below 0', () => {
    let board = createEmptyBoard();
    const hex: Axial = { q: 2, r: 0 };
    expect(basicMoveCap(board, hex)).toBe(BASIC_MOVE_BASE);
    expect(basicMoveCap(board, hex, 2)).toBe(2);
    board = placeTerrain(board, { q: 3, r: 0 }, 'mud');
    expect(basicMoveCap(board, hex, 2)).toBe(1);
    expect(basicMoveCap(board, hex, 1)).toBe(0);
    expect(basicMoveCap(board, hex, 0)).toBe(0);
  });
});

describe('absorbCursesAlongPath', () => {
  it('absorbs every curse on path and clamps stacks', () => {
    let board = createEmptyBoard();
    board = placeTerrain(board, { q: 3, r: 0 }, 'curse');
    board = placeTerrain(board, { q: 4, r: 0 }, 'curse');
    const path: Axial[] = [
      { q: 2, r: 0 },
      { q: 3, r: 0 },
      { q: 4, r: 0 },
    ];
    const r = absorbCursesAlongPath(board, path, 0, 2);
    expect(r.curseStacks).toBe(2);
    expect(r.absorbedHexes).toHaveLength(2);
    expect(r.board.tiles.has('3,0')).toBe(false);
    expect(r.board.tiles.has('4,0')).toBe(false);
  });
});

describe('shortestPath curseCarry', () => {
  it('at cap cannot path onto curse', () => {
    let board = createEmptyBoard();
    board = placeTerrain(board, { q: 3, r: 0 }, 'curse');
    const from: Axial = { q: 2, r: 0 };
    const toward: Axial = { q: 3, r: 0 };
    expect(
      shortestPath(board, from, toward, {
        curseCarry: { stacks: 1, cap: 1 },
      }),
    ).toBeNull();
    expect(
      shortestPath(board, from, toward, {
        curseCarry: { stacks: 0, cap: 1 },
      }),
    ).not.toBeNull();
  });

  it('path with two curses blocked when remaining cap is 1', () => {
    let board = createEmptyBoard();
    board = placeTerrain(board, { q: 3, r: 0 }, 'curse');
    board = placeTerrain(board, { q: 4, r: 0 }, 'curse');
    const from: Axial = { q: 2, r: 0 };
    const toward: Axial = { q: 4, r: 0 };
    const lane = new Set(['2,0', '3,0', '4,0']);
    const onlyLane = (h: Axial) => lane.has(`${h.q},${h.r}`);
    expect(
      shortestPath(board, from, toward, {
        curseCarry: { stacks: 0, cap: 1 },
        isAllowedHex: onlyLane,
      }),
    ).toBeNull();
    expect(
      shortestPath(board, from, toward, {
        curseCarry: { stacks: 0, cap: 2 },
        isAllowedHex: onlyLane,
      }),
    ).not.toBeNull();
  });

  it('prefers equal-length path through curse', () => {
    let board = createEmptyBoard();
    // from (0,0) to (2,0): (1,0) or (1,-1)-(2,-1) etc. Place curse on (1,0)
    board = placeTerrain(board, { q: 1, r: 0 }, 'curse');
    const path = shortestPath(
      board,
      { q: 0, r: 0 },
      { q: 2, r: 0 },
      { curseCarry: { stacks: 0, cap: 1 } },
    );
    expect(path).not.toBeNull();
    expect(path!.some((h) => h.q === 1 && h.r === 0)).toBe(true);
  });
});

describe('placeUnagedPlainIfEmpty / curseFullAfterAbsorb', () => {
  it('empty hex becomes unaged plain; occupied hex is not replaced', () => {
    let board = createEmptyBoard();
    const empty: Axial = { q: 2, r: 0 };
    const first = placeUnagedPlainIfEmpty(board, empty);
    expect(first.placed).toBe(true);
    expect(getTile(first.board, empty)?.kind).toBe('plain');
    expect(getTile(first.board, empty)?.aged).not.toBe(true);

    board = placeTerrain(createEmptyBoard(), empty, 'curse');
    const second = placeUnagedPlainIfEmpty(board, empty);
    expect(second.placed).toBe(false);
    expect(getTile(second.board, empty)?.kind).toBe('curse');
  });

  it('curse full: gunner/mage at 2, knight at 3; no absorb does not trigger', () => {
    expect(curseFullAfterAbsorb('gunner', 1, 1)).toBe(false);
    expect(curseFullAfterAbsorb('gunner', 2, 1)).toBe(true);
    expect(curseFullAfterAbsorb('mage', 2, 1)).toBe(true);
    expect(curseFullAfterAbsorb('knight', 2, 1)).toBe(false);
    expect(curseFullAfterAbsorb('knight', 3, 1)).toBe(true);
    expect(curseFullAfterAbsorb('gunner', 2, 0)).toBe(false);
    expect(curseFullAfterAbsorb('knight', 3, 0)).toBe(false);
  });
});

describe('fillNeighborsWithPlain', () => {
  it('fills empty neighbors with unaged plain; skips terrain/boss/occupied', () => {
    let board = createEmptyBoard();
    const center: Axial = { q: 2, r: 0 };
    board = placeTerrain(board, { q: 3, r: 0 }, 'curse');
    const occupied: Axial[] = [{ q: 2, r: 1 }];
    const r = fillNeighborsWithPlain(board, center, occupied);
    expect(r.placed.length).toBe(4); // 6 - curse - occupied
    for (const h of r.placed) {
      expect(getTile(r.board, h)?.kind).toBe('plain');
      expect(getTile(r.board, h)?.aged).not.toBe(true);
    }
    expect(getTile(r.board, { q: 3, r: 0 })?.kind).toBe('curse');
    expect(getTile(r.board, { q: 2, r: 1 })).toBeUndefined();
  });
});
