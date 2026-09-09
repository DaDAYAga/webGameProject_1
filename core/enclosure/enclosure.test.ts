import { describe, expect, it } from 'vitest';
import {
  BOSS_HEX,
  createEmptyBoard,
  createOpeningBoard,
  hexKey,
  placeTerrain,
  type Board,
} from '../board/index.js';
import { neighbors, type Axial } from '../hex/index.js';
import {
  cannotAbsorbPlacements,
  countBlockedNeighbors,
  countLegalEmptyCells,
  DEFAULT_MAP_RADIUS,
  isEnclosureBlocker,
  isInMap,
  isSealed,
  wouldEliminate,
  type MapBounds,
} from './index.js';

/** 測試用地圖半徑（參數，非鎖定）。 */
const BOUNDS: MapBounds = { radius: DEFAULT_MAP_RADIUS };

/** 在 actor 的六鄰鋪牆（可跳過部分鄰格）。 */
function wallNeighbors(
  board: Board,
  actor: Axial,
  count: number,
  kind: 'plain' | 'plain_broken' | 'punish' | 'curse' | 'silence' = 'plain',
): Board {
  let b = board;
  let placed = 0;
  for (const nb of neighbors(actor)) {
    if (placed >= count) break;
    // 王格本身已是阻擋，不必再鋪
    if (nb.q === BOSS_HEX.q && nb.r === BOSS_HEX.r) {
      placed += 1;
      continue;
    }
    b = placeTerrain(b, nb, kind);
    placed += 1;
  }
  return b;
}

describe('MapBounds / isInMap', () => {
  it('radius: inside and outside', () => {
    expect(isInMap({ q: 0, r: 0 }, BOUNDS)).toBe(true);
    expect(isInMap({ q: 5, r: 0 }, BOUNDS)).toBe(true);
    expect(isInMap({ q: 6, r: 0 }, BOUNDS)).toBe(false);
  });

  it('custom isInMap predicate', () => {
    const bounds: MapBounds = {
      isInMap: (h) => h.q === 1 && h.r === 1,
    };
    expect(isInMap({ q: 1, r: 1 }, bounds)).toBe(true);
    expect(isInMap({ q: 0, r: 0 }, bounds)).toBe(false);
  });
});

describe('isEnclosureBlocker', () => {
  it('outside map counts as blocker', () => {
    const board = createEmptyBoard();
    expect(isEnclosureBlocker(board, { q: 6, r: 0 }, BOUNDS)).toBe(true);
  });

  it('boss cell counts as blocker', () => {
    const board = createEmptyBoard();
    expect(isEnclosureBlocker(board, BOSS_HEX, BOUNDS)).toBe(true);
  });

  it('empty in-map cell is not a blocker', () => {
    const board = createEmptyBoard();
    expect(isEnclosureBlocker(board, { q: 2, r: 0 }, BOUNDS)).toBe(false);
  });

  it('terrain kinds that count for enclosure are blockers', () => {
    let board = createEmptyBoard();
    const hex: Axial = { q: 2, r: 0 };
    for (const kind of [
      'plain',
      'plain_broken',
      'plain_starter',
      'punish',
      'curse',
      'silence',
    ] as const) {
      board = placeTerrain(createEmptyBoard(), hex, kind);
      expect(isEnclosureBlocker(board, hex, BOUNDS)).toBe(true);
    }
  });

  it('other-player occupation does NOT count as blocker', () => {
    const board = createEmptyBoard();
    const hex: Axial = { q: 2, r: 0 };
    const occupied = new Set([hexKey(hex)]);
    expect(
      isEnclosureBlocker(board, hex, BOUNDS, { occupiedByPlayers: occupied }),
    ).toBe(false);
  });
});

describe('isSealed / countBlockedNeighbors', () => {
  it('actor with 6 blocked neighbors → sealed', () => {
    const actor: Axial = { q: 3, r: 0 };
    const board = wallNeighbors(createEmptyBoard(), actor, 6);
    expect(countBlockedNeighbors(board, actor, BOUNDS)).toBe(6);
    expect(isSealed(board, actor, BOUNDS)).toBe(true);
  });

  it('5 blocked → not sealed', () => {
    const actor: Axial = { q: 3, r: 0 };
    const board = wallNeighbors(createEmptyBoard(), actor, 5);
    expect(countBlockedNeighbors(board, actor, BOUNDS)).toBe(5);
    expect(isSealed(board, actor, BOUNDS)).toBe(false);
  });

  it('opening board: actor outside; manually fill 6 neighbors → sealed', () => {
    // 開場僅距離 1 有牆；演員站在距離 2
    const actor: Axial = { q: 2, r: 0 };
    let board = createOpeningBoard();
    // 開場牆已擋部分鄰格（朝王方向）；其餘鄰格手動補滿
    for (const nb of neighbors(actor)) {
      if (!isEnclosureBlocker(board, nb, BOUNDS)) {
        board = placeTerrain(board, nb, 'plain');
      }
    }
    expect(isSealed(board, actor, BOUNDS)).toBe(true);
  });

  it('boss cell counts as blocker for a neighbor of an actor at distance 1', () => {
    // 演員站在 (1,0)；其一鄰為王格 (0,0)
    const actor: Axial = { q: 1, r: 0 };
    let board = createEmptyBoard();
    // 其餘 5 鄰鋪牆（跳過王格）
    board = wallNeighbors(board, actor, 6);
    expect(isEnclosureBlocker(board, BOSS_HEX, BOUNDS)).toBe(true);
    expect(countBlockedNeighbors(board, actor, BOUNDS)).toBe(6);
    expect(isSealed(board, actor, BOUNDS)).toBe(true);
  });

  it('outside-map neighbors count toward seal near the edge', () => {
    // radius 5：演員在 (5,0)，外側鄰格出界
    const actor: Axial = { q: 5, r: 0 };
    let board = createEmptyBoard();
    for (const nb of neighbors(actor)) {
      if (isInMap(nb, BOUNDS) && !(nb.q === 0 && nb.r === 0)) {
        board = placeTerrain(board, nb, 'plain');
      }
    }
    expect(countBlockedNeighbors(board, actor, BOUNDS)).toBe(6);
    expect(isSealed(board, actor, BOUNDS)).toBe(true);
  });
});

describe('wouldEliminate — pressure onto sealed actor', () => {
  it('pressure onto sealed actor cell → eliminate signal', () => {
    const actor: Axial = { q: 3, r: 0 };
    const board = wallNeighbors(createEmptyBoard(), actor, 6);
    expect(isSealed(board, actor, BOUNDS)).toBe(true);
    expect(wouldEliminate(board, actor, BOUNDS, actor)).toBe(true);
  });

  it('sealed but placing elsewhere → not eliminate', () => {
    const actor: Axial = { q: 3, r: 0 };
    const board = wallNeighbors(createEmptyBoard(), actor, 6);
    expect(wouldEliminate(board, actor, BOUNDS, { q: 4, r: 0 })).toBe(false);
  });

  it('not sealed even if placing on actor → not eliminate', () => {
    const actor: Axial = { q: 3, r: 0 };
    const board = wallNeighbors(createEmptyBoard(), actor, 5);
    expect(wouldEliminate(board, actor, BOUNDS, actor)).toBe(false);
  });

  it('no placingAt → not eliminate', () => {
    const actor: Axial = { q: 3, r: 0 };
    const board = wallNeighbors(createEmptyBoard(), actor, 6);
    expect(wouldEliminate(board, actor, BOUNDS)).toBe(false);
  });
});

describe('cannotAbsorbPlacements (optional overflow)', () => {
  it('signals when placeCount exceeds legal empty cells', () => {
    const board = createOpeningBoard();
    const empty = countLegalEmptyCells(board, BOUNDS);
    expect(empty).toBeGreaterThan(0);
    expect(cannotAbsorbPlacements(board, BOUNDS, empty)).toBe(false);
    expect(cannotAbsorbPlacements(board, BOUNDS, empty + 1)).toBe(true);
  });
});
