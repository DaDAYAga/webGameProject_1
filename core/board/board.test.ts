import { describe, expect, it } from 'vitest';
import { distance, neighbors, type Axial } from '../hex/index.js';
import {
  BOSS_HEX,
  canPushFrom,
  canPushOnto,
  canStandAt,
  crackTile,
  createEmptyBoard,
  createOpeningBoard,
  destroyTile,
  getTile,
  hexKey,
  kindAllowsCrack,
  kindAllowsPush,
  placeTerrain,
  pushTerrain,
  absorbCurseAt,
} from './index.js';

const O: Axial = { q: 0, r: 0 };

describe('opening board — 開場環王 6 牆', () => {
  it('default: 6 already-broken aged walls on distance-1', () => {
    const board = createOpeningBoard();
    expect(board.tiles.size).toBe(6);

    const ring = neighbors(O);
    expect(ring).toHaveLength(6);
    for (const h of ring) {
      expect(distance(O, h)).toBe(1);
      const tile = getTile(board, h);
      expect(tile?.kind).toBe('plain_broken');
      expect(tile?.aged).toBe(true);
    }
  });

  it('difficulty intactStarterWalls: 6 intact aged plain', () => {
    const board = createOpeningBoard({ intactStarterWalls: true });
    expect(board.tiles.size).toBe(6);
    for (const h of neighbors(O)) {
      const tile = getTile(board, h);
      expect(tile?.kind).toBe('plain');
      expect(tile?.aged).toBe(true);
    }
  });

  it('(0,0) boss slot is empty — not walled', () => {
    const board = createOpeningBoard();
    expect(getTile(board, BOSS_HEX)).toBeUndefined();
    expect(board.tiles.has(hexKey(BOSS_HEX))).toBe(false);
  });
});

describe('legal stand hexes — 站格', () => {
  it('cannot stand on starter walls or boss cell (0,0)', () => {
    const board = createOpeningBoard();
    expect(canStandAt(board, BOSS_HEX)).toBe(false);
    for (const h of neighbors(O)) {
      expect(canStandAt(board, h)).toBe(false);
    }
  });

  it('can stand on empty hex outside the starter ring', () => {
    const board = createOpeningBoard();
    const outside: Axial = { q: 2, r: 0 };
    expect(distance(O, outside)).toBe(2);
    expect(getTile(board, outside)).toBeUndefined();
    expect(canStandAt(board, outside)).toBe(true);
  });

  it('curse allows voluntary stand; silence defaults to no stand', () => {
    let board = createEmptyBoard();
    board = placeTerrain(board, { q: 3, r: 0 }, 'curse');
    board = placeTerrain(board, { q: 4, r: 0 }, 'silence');
    expect(canStandAt(board, { q: 3, r: 0 })).toBe(true);
    expect(canStandAt(board, { q: 4, r: 0 })).toBe(false);
  });

  it('cannot stand on plain / plain_broken / punish', () => {
    let board = createEmptyBoard();
    board = placeTerrain(board, { q: 1, r: 1 }, 'plain');
    board = placeTerrain(board, { q: 2, r: 1 }, 'plain_broken');
    board = placeTerrain(board, { q: 3, r: 1 }, 'punish');
    expect(canStandAt(board, { q: 1, r: 1 })).toBe(false);
    expect(canStandAt(board, { q: 2, r: 1 })).toBe(false);
    expect(canStandAt(board, { q: 3, r: 1 })).toBe(false);
  });
});

describe('crack / destroy — 破碎與拆牆', () => {
  it('default opening broken aged wall: one hit destroys and damages boss', () => {
    const board0 = createOpeningBoard();
    const cell: Axial = { q: 1, r: 0 };
    expect(getTile(board0, cell)?.kind).toBe('plain_broken');
    expect(getTile(board0, cell)?.aged).toBe(true);

    const hit = crackTile(board0, cell);
    expect(hit.ok).toBe(true);
    expect(hit.destroyed).toBe(true);
    expect(hit.damagesBoss).toBe(true);
    expect(getTile(hit.board, cell)).toBeUndefined();
  });

  it('intactStarterWalls: crack keeps aged; destroy damages boss via aged rule', () => {
    const board0 = createOpeningBoard({ intactStarterWalls: true });
    const cell: Axial = { q: 1, r: 0 };
    expect(getTile(board0, cell)?.kind).toBe('plain');
    expect(getTile(board0, cell)?.aged).toBe(true);

    const hit1 = crackTile(board0, cell);
    expect(hit1.ok).toBe(true);
    expect(hit1.cracked).toBe(true);
    expect(hit1.destroyed).toBe(false);
    expect(hit1.damagesBoss).toBe(false);
    const broken = getTile(hit1.board, cell)!;
    expect(broken.kind).toBe('plain_broken');
    expect(broken.aged).toBe(true);

    const hit2 = crackTile(hit1.board, cell);
    expect(hit2.ok).toBe(true);
    expect(hit2.destroyed).toBe(true);
    expect(hit2.damagesBoss).toBe(true);
    expect(getTile(hit2.board, cell)).toBeUndefined();
  });


  it('crack aged plain → broken keeps aged; destroy damagesBoss flag', () => {
    let board = createEmptyBoard();
    board = placeTerrain(board, { q: 2, r: -1 }, 'plain', { aged: true });
    const hit1 = crackTile(board, { q: 2, r: -1 });
    expect(hit1.cracked).toBe(true);
    expect(getTile(hit1.board, { q: 2, r: -1 })?.aged).toBe(true);

    const hit2 = crackTile(hit1.board, { q: 2, r: -1 });
    expect(hit2.destroyed).toBe(true);
    expect(hit2.damagesBoss).toBe(true);
  });

  it('crack empty hex fails', () => {
    const board = createEmptyBoard();
    const r = crackTile(board, { q: 5, r: 0 });
    expect(r.ok).toBe(false);
    expect(r.board).toBe(board);
  });
});

describe('punish — 不可推、不可一般拆', () => {
  it('punish cannot push / cannot crack as specified', () => {
    let board = createEmptyBoard();
    const cell: Axial = { q: 2, r: 2 };
    board = placeTerrain(board, cell, 'punish');

    expect(kindAllowsPush('punish')).toBe(false);
    expect(kindAllowsCrack('punish')).toBe(false);
    expect(canPushFrom(board, cell)).toBe(false);

    const cracked = crackTile(board, cell);
    expect(cracked.ok).toBe(false);
    expect(getTile(cracked.board, cell)?.kind).toBe('punish');

    const dest: Axial = { q: 3, r: 2 };
    expect(canPushOnto(board, dest)).toBe(true);
    expect(pushTerrain(board, cell, dest)).toBeNull();
  });
});

describe('push — 可推地形搬移', () => {
  it('opening broken wall can be pushed onto empty non-boss hex', () => {
    const board = createOpeningBoard();
    const from: Axial = { q: 1, r: 0 };
    const to: Axial = { q: 2, r: 0 };
    expect(canPushFrom(board, from)).toBe(true);
    expect(canPushOnto(board, to)).toBe(true);
    const next = pushTerrain(board, from, to);
    expect(next).not.toBeNull();
    expect(getTile(next!, from)).toBeUndefined();
    expect(getTile(next!, to)?.kind).toBe('plain_broken');
    expect(getTile(next!, to)?.aged).toBe(true);
  });

  it('cannot push onto boss cell (0,0)', () => {
    const board = createOpeningBoard();
    const from: Axial = { q: 1, r: 0 };
    expect(canPushOnto(board, BOSS_HEX)).toBe(false);
    expect(pushTerrain(board, from, BOSS_HEX)).toBeNull();
  });

  it('cannot push onto occupied hex', () => {
    const board = createOpeningBoard();
    const from: Axial = { q: 1, r: 0 };
    const occupied: Axial = { q: 0, r: 1 };
    expect(getTile(board, occupied)?.kind).toBe('plain_broken');
    expect(canPushOnto(board, occupied)).toBe(false);
    expect(pushTerrain(board, from, occupied)).toBeNull();
  });
});

describe('destroyTile direct — 銷毀旗標', () => {
  it('destroying aged broken wall damages boss; unaged does not', () => {
    let board = createEmptyBoard();
    board = placeTerrain(board, { q: 1, r: 0 }, 'plain_broken', { aged: true });
    const r = destroyTile(board, { q: 1, r: 0 });
    expect(r.destroyed).toBe(true);
    expect(r.damagesBoss).toBe(true);

    board = placeTerrain(createEmptyBoard(), { q: 2, r: 0 }, 'plain_broken', { aged: false });
    const r2 = destroyTile(board, { q: 2, r: 0 });
    expect(r2.destroyed).toBe(true);
    expect(r2.damagesBoss).toBe(false);
  });
});

describe('absorbCurseAt — 踩詛咒後格消失', () => {
  it('clears curse tile after voluntary step', () => {
    let board = createEmptyBoard();
    const hex: Axial = { q: 2, r: -1 };
    board = placeTerrain(board, hex, 'curse');
    expect(canStandAt(board, hex)).toBe(true);
    const next = absorbCurseAt(board, hex);
    expect(next).not.toBeNull();
    expect(getTile(next!, hex)).toBeUndefined();
    expect(canStandAt(next!, hex)).toBe(true);
  });

  it('returns null when hex is not curse', () => {
    const board = createOpeningBoard();
    expect(absorbCurseAt(board, { q: 1, r: 0 })).toBeNull();
    expect(absorbCurseAt(createEmptyBoard(), { q: 1, r: 0 })).toBeNull();
  });
});
