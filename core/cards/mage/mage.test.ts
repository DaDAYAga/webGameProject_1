import { describe, expect, it } from 'vitest';
import {
  createEmptyBoard,
  getTile,
  makeTile,
  placeTerrain,
  setTile,
} from '../../board/index.js';
import { DEFAULT_MAP_RADIUS, isSealed } from '../../enclosure/index.js';
import {
  MAGE_CARD_DEFS,
  MAGIC_ARROW_BASE_DAMAGE,
  PLANAR_SWAP_MAX_DISTANCE,
  WIND_AMPLIFIED_STEPS,
  WIND_BASE_STEPS,
  canWindPushFrom,
  makeMageCard,
  mageWindAllowsKind,
  resolveMagicArrow,
  resolvePlanarSwap,
  resolveWindControl,
  type MageActorRef,
} from './index.js';

const BOUNDS = { radius: DEFAULT_MAP_RADIUS };
const DIR_EAST = { q: 1, r: 0 };

describe('mageWindAllowsKind / canWindPushFrom', () => {
  it('plain / plain_broken / curse / plain_starter 可動', () => {
    expect(mageWindAllowsKind('plain')).toBe(true);
    expect(mageWindAllowsKind('plain_broken')).toBe(true);
    expect(mageWindAllowsKind('curse')).toBe(true);
    expect(mageWindAllowsKind('plain_starter')).toBe(true);
  });

  it('silence / punish 不可動', () => {
    expect(mageWindAllowsKind('silence')).toBe(false);
    expect(mageWindAllowsKind('punish')).toBe(false);
  });
});

describe('御風術 resolveWindControl', () => {
  it('推動 plain_broken 一格 OK', () => {
    let board = createEmptyBoard();
    const from = { q: 2, r: 0 };
    const to = { q: 3, r: 0 };
    board = setTile(board, from, makeTile('plain_broken', { aged: true }));

    const r = resolveWindControl({
      board,
      from,
      direction: DIR_EAST,
      bounds: BOUNDS,
    });

    expect(r.ok).toBe(true);
    expect(r.counted).toBe(true);
    expect(r.stepsMoved).toBe(WIND_BASE_STEPS);
    expect(r.finalHex).toEqual(to);
    expect(getTile(r.board, from)).toBeUndefined();
    expect(getTile(r.board, to)?.kind).toBe('plain_broken');
    expect(r.events).toContainEqual({
      type: 'TerrainPushed',
      from,
      to,
      steps: 1,
    });
  });

  it('punish 不可動 → fail', () => {
    let board = createEmptyBoard();
    const from = { q: 2, r: 0 };
    board = placeTerrain(board, from, 'punish');

    expect(canWindPushFrom(board, from)).toBe(false);
    const r = resolveWindControl({
      board,
      from,
      direction: DIR_EAST,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('cannot_move_punish');
    expect(r.stepsMoved).toBe(0);
    expect(getTile(r.board, from)?.kind).toBe('punish');
  });

  it('silence 不可動 → fail（即使 board 預設可推）', () => {
    let board = createEmptyBoard();
    const from = { q: 2, r: 0 };
    board = placeTerrain(board, from, 'silence');

    expect(canWindPushFrom(board, from)).toBe(false);
    const r = resolveWindControl({
      board,
      from,
      direction: DIR_EAST,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('cannot_move_silence');
  });

  it('增幅後可推 2 格', () => {
    let board = createEmptyBoard();
    const from = { q: 2, r: 0 };
    const mid = { q: 3, r: 0 };
    const end = { q: 4, r: 0 };
    board = setTile(board, from, makeTile('plain', { aged: false }));

    const r = resolveWindControl({
      board,
      from,
      direction: DIR_EAST,
      amplified: true,
    });

    expect(r.ok).toBe(true);
    expect(r.stepsMoved).toBe(WIND_AMPLIFIED_STEPS);
    expect(r.finalHex).toEqual(end);
    expect(getTile(r.board, from)).toBeUndefined();
    expect(getTile(r.board, mid)).toBeUndefined();
    expect(getTile(r.board, end)?.kind).toBe('plain');
  });

  it('目標非法（已有地形）→ fail', () => {
    let board = createEmptyBoard();
    const from = { q: 2, r: 0 };
    const to = { q: 3, r: 0 };
    board = setTile(board, from, makeTile('plain_broken'));
    board = setTile(board, to, makeTile('plain'));

    const r = resolveWindControl({ board, from, direction: DIR_EAST });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('illegal_destination');
  });

  it('推到已封印單位本體 → crush_eliminate', () => {
    // 在 (3,0) 放單位，六鄰全擋 → 封印；再御風推牆上其本體
    let board = createEmptyBoard();
    const actorHex = { q: 3, r: 0 };
    const neighbors = [
      { q: 4, r: 0 },
      { q: 4, r: -1 },
      { q: 3, r: -1 },
      { q: 2, r: 0 },
      { q: 2, r: 1 },
      { q: 3, r: 1 },
    ];
    // 五鄰先鋪牆；from 用第六鄰推過去
    const from = neighbors[3]; // {q:2,r:0} — 先不鋪，等等放 plain_broken 再推
    for (const n of neighbors) {
      if (n.q === from.q && n.r === from.r) continue;
      board = setTile(board, n, makeTile('plain_broken'));
    }
    // 暫時也鋪 from 讓封印成立，再把它當推動來源
    board = setTile(board, from, makeTile('plain_broken'));
    expect(isSealed(board, actorHex, BOUNDS)).toBe(true);

    const actors: MageActorRef[] = [
      { id: 'p1', hex: actorHex, sealed: true },
    ];

    // 方向：from (2,0) → actor (3,0) = +q
    const r = resolveWindControl({
      board,
      from,
      direction: DIR_EAST,
      actors,
      bounds: BOUNDS,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('crush_eliminate');
  });
});

describe('位面調換 resolvePlanarSwap', () => {
  it('兩人皆在距離 ≤3 → 互換成功、endTurn、不計次', () => {
    const board = createEmptyBoard();
    const mageHex = { q: 2, r: 0 };
    const a: MageActorRef = { id: 'a', hex: { q: 3, r: 0 } };
    const b: MageActorRef = { id: 'b', hex: { q: 1, r: 1 } };

    const r = resolvePlanarSwap({ board, mageHex, actorA: a, actorB: b });

    expect(r.ok).toBe(true);
    expect(r.counted).toBe(false);
    expect(r.endTurn).toBe(true);
    expect(r.silenced).toBe(true);
    expect(r.swappedActorIds).toEqual(['a', 'b']);
    expect(r.positions).toEqual({
      a: b.hex,
      b: a.hex,
    });
    expect(r.events).toContainEqual({
      type: 'ActorsSwapped',
      aId: 'a',
      bId: 'b',
      aHex: b.hex,
      bHex: a.hex,
    });
    expect(r.events).toContainEqual({
      type: 'SilenceImmunityThisRound',
      actorIds: ['a', 'b'],
    });
    expect(r.events).toContainEqual({
      type: 'TurnForceEnded',
      reason: 'planar_swap',
    });
  });

  it('其中一人距離 >3 → fail', () => {
    const board = createEmptyBoard();
    const mageHex = { q: 1, r: 0 };
    const a: MageActorRef = { id: 'a', hex: { q: 2, r: 0 } }; // dist 1
    const b: MageActorRef = {
      id: 'b',
      hex: { q: 1 + PLANAR_SWAP_MAX_DISTANCE + 1, r: 0 },
    }; // dist 4

    const r = resolvePlanarSwap({ board, mageHex, actorA: a, actorB: b });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('out_of_range_b');
    expect(r.endTurn).toBe(false);
  });

  it('不可換王 → fail', () => {
    const board = createEmptyBoard();
    const mageHex = { q: 2, r: 0 };
    const a: MageActorRef = { id: 'boss', hex: { q: 0, r: 0 }, isBoss: true };
    const b: MageActorRef = { id: 'b', hex: { q: 2, r: 1 } };

    const r = resolvePlanarSwap({ board, mageHex, actorA: a, actorB: b });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('cannot_swap_boss');
  });

  it('不可換出局者 → fail', () => {
    const board = createEmptyBoard();
    const mageHex = { q: 2, r: 0 };
    const a: MageActorRef = {
      id: 'a',
      hex: { q: 3, r: 0 },
      eliminated: true,
    };
    const b: MageActorRef = { id: 'b', hex: { q: 1, r: 0 } };

    const r = resolvePlanarSwap({ board, mageHex, actorA: a, actorB: b });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('cannot_swap_eliminated');
  });

  it('可換封印者', () => {
    const board = createEmptyBoard();
    const mageHex = { q: 2, r: 0 };
    const a: MageActorRef = {
      id: 'a',
      hex: { q: 3, r: 0 },
      sealed: true,
    };
    const b: MageActorRef = { id: 'b', hex: { q: 1, r: 0 } };

    const r = resolvePlanarSwap({ board, mageHex, actorA: a, actorB: b });
    expect(r.ok).toBe(true);
    expect(r.endTurn).toBe(true);
  });

  it('增幅後 silenced=false', () => {
    const board = createEmptyBoard();
    const mageHex = { q: 2, r: 0 };
    const a: MageActorRef = { id: 'a', hex: { q: 3, r: 0 } };
    const b: MageActorRef = { id: 'b', hex: { q: 1, r: 0 } };

    const r = resolvePlanarSwap({
      board,
      mageHex,
      actorA: a,
      actorB: b,
      amplified: true,
    });
    expect(r.ok).toBe(true);
    expect(r.silenced).toBe(false);
    expect(r.counted).toBe(false);
    expect(r.endTurn).toBe(true);
  });

  it('落點不可站 → fail', () => {
    let board = createEmptyBoard();
    const wallHex = { q: 3, r: 0 };
    board = setTile(board, wallHex, makeTile('plain_broken'));
    const mageHex = { q: 2, r: 0 };
    // a 在空地，b「站」在牆上（理論異常）；交換後 a 要進牆格 → fail
    const a: MageActorRef = { id: 'a', hex: { q: 1, r: 0 } };
    const b: MageActorRef = { id: 'b', hex: wallHex };

    const r = resolvePlanarSwap({ board, mageHex, actorA: a, actorB: b });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('dest_a_not_standable');
  });
});

describe('魔法箭 resolveMagicArrow（薄包）', () => {
  it('甜區基礎傷 1', () => {
    const r = resolveMagicArrow({ attacker: { q: 2, r: 0 } });
    expect(r.ok).toBe(true);
    expect(r.counted).toBe(true);
    expect(r.inSweetZone).toBe(true);
    expect(r.bossDamage).toBe(MAGIC_ARROW_BASE_DAMAGE);
  });

  it('增幅 bonus +1 甜區 → 2', () => {
    const r = resolveMagicArrow({
      attacker: { q: 1, r: 0 },
      bonusDamage: 1,
    });
    expect(r.bossDamage).toBe(2);
  });
});

describe('MAGE_CARD_DEFS / makeMageCard', () => {
  it('御風計次受沉默；位面不計次受沉默', () => {
    expect(MAGE_CARD_DEFS.wind.countsTowardAction).toBe(true);
    expect(MAGE_CARD_DEFS.wind.silenced).toBe(true);
    expect(MAGE_CARD_DEFS.planar_swap.countsTowardAction).toBe(false);
    expect(MAGE_CARD_DEFS.planar_swap.silenced).toBe(true);
    const c = makeMageCard('wind', 'w1');
    expect(c.countsTowardAction).toBe(true);
    expect(c.cardId).toBe('wind');
  });
});
