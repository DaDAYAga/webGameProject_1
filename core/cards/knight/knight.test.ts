import { describe, expect, it } from 'vitest';
import {
  BOSS_HEX,
  createEmptyBoard,
  createOpeningBoard,
  getTile,
  placeTerrain,
} from '../../board/index.js';
import { AXIAL_DIRECTIONS, type Axial } from '../../hex/index.js';
import {
  KNIGHT_ATTACK_BOSS_DAMAGE,
  makeKnightCard,
  resolveKnightAttack,
  resolveShieldCharge,
} from './index.js';

const DIR_EQ = AXIAL_DIRECTIONS[0]!; // +q

describe('knight attack vs boss adjacent', () => {
  it('distance 1 → 2 damage, BossDamaged melee', () => {
    const attacker: Axial = { q: 1, r: 0 };
    const r = resolveKnightAttack({
      board: createEmptyBoard(),
      attacker,
      target: BOSS_HEX,
    });
    expect(r.ok).toBe(true);
    expect(r.counted).toBe(true);
    expect(r.bossDamage).toBe(KNIGHT_ATTACK_BOSS_DAMAGE);
    expect(r.bossDamage).toBe(2);
    expect(r.events).toContainEqual({
      type: 'BossDamaged',
      amount: 2,
      source: 'melee',
      effective: true,
    });
  });

  it('distance 2 → no effective boss damage', () => {
    const r = resolveKnightAttack({
      board: createEmptyBoard(),
      attacker: { q: 2, r: 0 },
      target: BOSS_HEX,
    });
    expect(r.ok).toBe(true);
    expect(r.bossDamage).toBe(0);
    expect(r.reason).toBe('not_adjacent');
    expect(r.events).toEqual([]);
  });
});

describe('knight attack crack / destroy walls', () => {
  it('first hit cracks plain; no boss damage', () => {
    let board = createEmptyBoard();
    const wall: Axial = { q: 3, r: 0 };
    board = placeTerrain(board, wall, 'plain', { aged: false });
    const r = resolveKnightAttack({
      board,
      attacker: { q: 2, r: 0 },
      target: wall,
    });
    expect(r.ok).toBe(true);
    expect(r.bossDamage).toBe(0);
    expect(getTile(r.board, wall)?.kind).toBe('plain_broken');
    expect(r.events).toEqual([]);
  });

  it('second hit destroys aged plain_broken → boss 1 dmg', () => {
    let board = createEmptyBoard();
    const wall: Axial = { q: 3, r: 0 };
    board = placeTerrain(board, wall, 'plain_broken', { aged: true });
    const r = resolveKnightAttack({
      board,
      attacker: { q: 2, r: 0 },
      target: wall,
    });
    expect(r.ok).toBe(true);
    expect(r.bossDamage).toBe(1);
    expect(getTile(r.board, wall)).toBeUndefined();
    expect(r.events).toContainEqual({
      type: 'BossDamaged',
      amount: 1,
      source: 'aged_wall_destroy',
      effective: true,
    });
  });

  it('opening aged broken destroy → boss dmg via aged rule', () => {
    const board = createOpeningBoard();
    const wall: Axial = { q: 1, r: 0 };
    expect(getTile(board, wall)?.aged).toBe(true);
    const r = resolveKnightAttack({
      board,
      attacker: { q: 2, r: 0 },
      target: wall,
    });
    expect(r.ok).toBe(true);
    expect(r.bossDamage).toBe(1);
    expect(getTile(r.board, wall)).toBeUndefined();
  });

  it('cannot target punish or curse', () => {
    let board = createEmptyBoard();
    board = placeTerrain(board, { q: 2, r: 0 }, 'punish');
    board = placeTerrain(board, { q: 2, r: 1 }, 'curse');
    const againstPunish = resolveKnightAttack({
      board,
      attacker: { q: 1, r: 0 },
      target: { q: 2, r: 0 },
    });
    expect(againstPunish.ok).toBe(false);
    expect(againstPunish.reason).toBe('cannot_target_punish');

    const againstCurse = resolveKnightAttack({
      board,
      attacker: { q: 1, r: 0 },
      target: { q: 2, r: 1 },
    });
    expect(againstCurse.ok).toBe(false);
    expect(againstCurse.reason).toBe('cannot_target_curse');
  });
});

describe('shield charge into aged wall', () => {
  it('pass through aged wall, destroy, boss 1, end turn, land on hex', () => {
    let board = createEmptyBoard();
    const start: Axial = { q: 3, r: 0 };
    const wall: Axial = { q: 4, r: 0 };
    board = placeTerrain(board, wall, 'plain_broken', { aged: true });

    const r = resolveShieldCharge({
      board,
      actorPosition: start,
      direction: DIR_EQ,
    });
    expect(r.ok).toBe(true);
    expect(r.forceEndTurn).toBe(true);
    expect(r.bossDamage).toBe(1);
    expect(r.actorPosition).toEqual(wall);
    expect(getTile(r.board, wall)).toBeUndefined();
    expect(r.events).toContainEqual({
      type: 'BossDamaged',
      amount: 1,
      source: 'aged_wall_destroy',
      effective: true,
    });
    expect(r.events.some((e) => e.type === 'TurnForceEnded')).toBe(true);
  });

  it('opening default aged broken: pass through destroy + boss dmg + end turn', () => {
    const board = createOpeningBoard();
    // stand at (2,0), charge toward boss along -q into opening wall (1,0)
    const start: Axial = { q: 2, r: 0 };
    const wall: Axial = { q: 1, r: 0 };
    const dir: Axial = { q: -1, r: 0 };
    expect(getTile(board, wall)?.kind).toBe('plain_broken');
    expect(getTile(board, wall)?.aged).toBe(true);

    const r = resolveShieldCharge({
      board,
      actorPosition: start,
      direction: dir,
    });
    expect(r.forceEndTurn).toBe(true);
    expect(r.bossDamage).toBe(1);
    expect(r.actorPosition).toEqual(wall);
    expect(getTile(r.board, wall)).toBeUndefined();
  });
});

describe('shield charge into fresh wall', () => {
  it('stop on previous hex, crack wall, force end turn, no boss dmg', () => {
    let board = createEmptyBoard();
    const start: Axial = { q: 3, r: 0 };
    const wall: Axial = { q: 4, r: 0 };
    board = placeTerrain(board, wall, 'plain', { aged: false });

    const r = resolveShieldCharge({
      board,
      actorPosition: start,
      direction: DIR_EQ,
    });
    expect(r.ok).toBe(true);
    expect(r.forceEndTurn).toBe(true);
    expect(r.bossDamage).toBe(0);
    expect(r.actorPosition).toEqual(start);
    expect(getTile(r.board, wall)?.kind).toBe('plain_broken');
    expect(r.events.some((e) => e.type === 'TurnForceEnded')).toBe(true);
  });

  it('after 1 empty step then fresh wall: stop on empty, crack wall', () => {
    let board = createEmptyBoard();
    const start: Axial = { q: 2, r: 0 };
    const mid: Axial = { q: 3, r: 0 };
    const wall: Axial = { q: 4, r: 0 };
    board = placeTerrain(board, wall, 'plain', { aged: false });

    const r = resolveShieldCharge({
      board,
      actorPosition: start,
      direction: DIR_EQ,
    });
    expect(r.actorPosition).toEqual(mid);
    expect(getTile(r.board, wall)?.kind).toBe('plain_broken');
    expect(r.forceEndTurn).toBe(true);
    expect(r.bossDamage).toBe(0);
  });
});

describe('shield charge into boss cell', () => {
  it('cannot enter boss, stay put, force end turn, no destroy', () => {
    const board = createEmptyBoard();
    const start: Axial = { q: 1, r: 0 };
    const dir: Axial = { q: -1, r: 0 }; // toward (0,0)

    const r = resolveShieldCharge({
      board,
      actorPosition: start,
      direction: dir,
    });
    expect(r.actorPosition).toEqual(start);
    expect(r.forceEndTurn).toBe(true);
    expect(r.bossDamage).toBe(0);
    expect(r.events).toContainEqual({
      type: 'ChargeBlocked',
      hex: BOSS_HEX,
      reason: 'boss',
    });
  });
});

describe('shield charge empty path', () => {
  it('moves up to 2 hexes without ending turn', () => {
    const board = createEmptyBoard();
    const start: Axial = { q: 3, r: 0 };
    const r = resolveShieldCharge({
      board,
      actorPosition: start,
      direction: DIR_EQ,
    });
    expect(r.actorPosition).toEqual({ q: 5, r: 0 });
    expect(r.forceEndTurn).toBe(false);
    expect(r.bossDamage).toBe(0);
  });
});

describe('knight card stubs / instance', () => {
  it('makeKnightCard marks attack & charge as counted', () => {
    expect(makeKnightCard('attack', 'a1').counted).toBe(true);
    expect(makeKnightCard('shield_charge', 'c1').counted).toBe(true);
    expect(makeKnightCard('devotion', 'd1').counted).toBe(false);
  });
});
