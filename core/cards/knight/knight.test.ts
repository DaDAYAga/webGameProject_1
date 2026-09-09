import { describe, expect, it } from 'vitest';
import {
  BOSS_HEX,
  createEmptyBoard,
  createOpeningBoard,
  getTile,
  placeTerrain,
} from '../../board/index.js';
import { DEFAULT_MAP_RADIUS } from '../../enclosure/index.js';
import { AXIAL_DIRECTIONS, type Axial } from '../../hex/index.js';
import { BARRIER_PRIORITY } from '../mage/constants.js';
import {
  FAITH_CURSE_CLEAR,
  HEROIC_CHARGE_BOSS_DRAWS,
  HEROIC_CHARGE_BOSS_HIT_DAMAGE,
  HEROIC_CHARGE_WALL_DAMAGE_CAP,
  KNIGHT_ATTACK_BOSS_DAMAGE,
  KNIGHT_CARD_DEFS,
  KNIGHT_CURSE_DEATH_STACKS,
  TAUNT_PRIORITY,
  makeKnightCard,
  resolveDevotion,
  resolveFaith,
  resolveHeroicCharge,
  resolveKnightAttack,
  resolveTaunt,
  resolveUndying,
  tauntBlocksPlacement,
} from './index.js';

const DIR_EQ = AXIAL_DIRECTIONS[0]!; // +q
const BOUNDS = { radius: DEFAULT_MAP_RADIUS };

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

describe('英勇衝鋒 pierce aged walls', () => {
  it('pierce two aged walls → damage 2 (cap), one draw', () => {
    let board = createEmptyBoard();
    const start: Axial = { q: 1, r: 0 };
    const w1: Axial = { q: 2, r: 0 };
    const w2: Axial = { q: 3, r: 0 };
    board = placeTerrain(board, w1, 'plain_broken', { aged: true });
    board = placeTerrain(board, w2, 'plain_broken', { aged: true });

    const r = resolveHeroicCharge({
      board,
      actorPosition: start,
      direction: DIR_EQ,
      bounds: BOUNDS,
    });
    expect(r.ok).toBe(true);
    expect(r.forceEndTurn).toBe(true);
    expect(r.wallDamage).toBe(HEROIC_CHARGE_WALL_DAMAGE_CAP);
    expect(r.bossDamage).toBe(2);
    expect(r.bossDraw).toBe(true);
    expect(getTile(r.board, w1)).toBeUndefined();
    expect(getTile(r.board, w2)).toBeUndefined();
    expect(r.events).toContainEqual({
      type: 'BossDamaged',
      amount: 2,
      source: 'aged_wall_destroy',
      effective: true,
    });
    const draws = r.events.filter((e) => e.type === 'DrawRequested');
    expect(draws).toHaveLength(1);
    expect(draws[0]).toMatchObject({
      type: 'DrawRequested',
      count: HEROIC_CHARGE_BOSS_DRAWS,
    });
  });

  it('pierce wall then hit boss → damage up to 4, one draw', () => {
    let board = createEmptyBoard();
    // start at (3,0): pierce (2,0) and (1,0) aged → wall 2, then boss hit +2 = 4
    const start: Axial = { q: 3, r: 0 };
    board = placeTerrain(board, { q: 2, r: 0 }, 'plain_broken', { aged: true });
    board = placeTerrain(board, { q: 1, r: 0 }, 'plain_broken', { aged: true });
    const dir: Axial = { q: -1, r: 0 };

    const r = resolveHeroicCharge({
      board,
      actorPosition: start,
      direction: dir,
      bounds: BOUNDS,
    });
    expect(r.ok).toBe(true);
    expect(r.hitBoss).toBe(true);
    expect(r.wallDamage).toBe(2);
    expect(r.bossDamage).toBe(2 + HEROIC_CHARGE_BOSS_HIT_DAMAGE);
    expect(r.bossDamage).toBe(4);
    expect(r.actorPosition).toEqual({ q: 1, r: 0 });
    expect(r.events).toContainEqual({
      type: 'BossDamaged',
      amount: HEROIC_CHARGE_BOSS_HIT_DAMAGE,
      source: 'heroic_charge',
      effective: true,
    });
    expect(r.events.filter((e) => e.type === 'DrawRequested')).toHaveLength(1);
  });

  it('wall damage caps at 2 even with three aged walls', () => {
    let board = createEmptyBoard();
    const start: Axial = { q: 0, r: 1 };
    // charge +q along r=1: (1,1)(2,1)(3,1)
    board = placeTerrain(board, { q: 1, r: 1 }, 'plain', { aged: true });
    board = placeTerrain(board, { q: 2, r: 1 }, 'plain_broken', { aged: true });
    board = placeTerrain(board, { q: 3, r: 1 }, 'plain_broken', { aged: true });
    const r = resolveHeroicCharge({
      board,
      actorPosition: start,
      direction: DIR_EQ,
      bounds: BOUNDS,
    });
    expect(r.wallDamage).toBe(2);
    expect(r.bossDamage).toBe(2);
    expect(r.events.filter((e) => e.type === 'DrawRequested')).toHaveLength(1);
  });
});

describe('英勇衝鋒 intact wall / unit / empty', () => {
  it('intact unaged wall → stop prev, crack, force end', () => {
    let board = createEmptyBoard();
    const start: Axial = { q: 3, r: 0 };
    const wall: Axial = { q: 4, r: 0 };
    board = placeTerrain(board, wall, 'plain', { aged: false });

    const r = resolveHeroicCharge({
      board,
      actorPosition: start,
      direction: DIR_EQ,
      bounds: BOUNDS,
    });
    expect(r.ok).toBe(true);
    expect(r.forceEndTurn).toBe(true);
    expect(r.bossDamage).toBe(0);
    expect(r.bossDraw).toBe(false);
    expect(r.actorPosition).toEqual(start);
    expect(getTile(r.board, wall)?.kind).toBe('plain_broken');
    expect(r.events.some((e) => e.type === 'TurnForceEnded')).toBe(true);
  });

  it('after empty step then fresh wall: stop on empty, crack', () => {
    let board = createEmptyBoard();
    const start: Axial = { q: 2, r: 0 };
    const mid: Axial = { q: 3, r: 0 };
    const wall: Axial = { q: 4, r: 0 };
    board = placeTerrain(board, wall, 'plain', { aged: false });

    const r = resolveHeroicCharge({
      board,
      actorPosition: start,
      direction: DIR_EQ,
      bounds: BOUNDS,
    });
    expect(r.actorPosition).toEqual(mid);
    expect(getTile(r.board, wall)?.kind).toBe('plain_broken');
    expect(r.forceEndTurn).toBe(true);
  });

  it('hit unit → landingHex beside unit', () => {
    const board = createEmptyBoard();
    const start: Axial = { q: 2, r: 0 };
    const unitHex: Axial = { q: 4, r: 0 };
    const landing: Axial = { q: 4, r: -1 }; // neighbor of unit
    const r = resolveHeroicCharge({
      board,
      actorPosition: start,
      direction: DIR_EQ,
      bounds: BOUNDS,
      units: [{ id: 'ally', hex: unitHex }],
      landingHex: landing,
    });
    expect(r.ok).toBe(true);
    expect(r.actorPosition).toEqual(landing);
    expect(r.forceEndTurn).toBe(true);
    expect(r.events).toContainEqual({
      type: 'ChargeBlocked',
      hex: unitHex,
      reason: 'unit',
    });
  });

  it('unaged broken: pierce clear no boss dmg; always end turn', () => {
    let board = createEmptyBoard();
    const start: Axial = { q: 2, r: 0 };
    const broken: Axial = { q: 3, r: 0 };
    board = placeTerrain(board, broken, 'plain_broken', { aged: false });
    const r = resolveHeroicCharge({
      board,
      actorPosition: start,
      direction: DIR_EQ,
      bounds: BOUNDS,
    });
    expect(getTile(r.board, broken)).toBeUndefined();
    expect(r.bossDamage).toBe(0);
    expect(r.bossDraw).toBe(false);
    expect(r.forceEndTurn).toBe(true);
    // continues to map edge along +q from r=0
    expect(r.actorPosition.q).toBeGreaterThan(start.q);
  });

  it('empty path still forceEndTurn (unlike old shield charge)', () => {
    const board = createEmptyBoard();
    const start: Axial = { q: 0, r: 3 };
    const r = resolveHeroicCharge({
      board,
      actorPosition: start,
      direction: DIR_EQ,
      bounds: BOUNDS,
    });
    expect(r.forceEndTurn).toBe(true);
    expect(r.bossDamage).toBe(0);
    expect(isInMapish(r.actorPosition)).toBe(true);
  });
});

function isInMapish(h: Axial): boolean {
  // cube distance from origin ≤ DEFAULT_MAP_RADIUS
  const s = -h.q - h.r;
  return (Math.abs(h.q) + Math.abs(h.r) + Math.abs(s)) / 2 <= DEFAULT_MAP_RADIUS;
}

describe('knight card defs / instance', () => {
  it('heroic_charge counted+silenced; taunt neither', () => {
    expect(KNIGHT_CARD_DEFS.heroic_charge.countsTowardAction).toBe(true);
    expect(KNIGHT_CARD_DEFS.heroic_charge.silenced).toBe(true);
    expect(KNIGHT_CARD_DEFS.taunt.countsTowardAction).toBe(false);
    expect(KNIGHT_CARD_DEFS.taunt.silenced).toBe(false);
    expect(makeKnightCard('heroic_charge', 'c1').counted).toBe(true);
    expect(makeKnightCard('taunt', 't1').counted).toBe(false);
    expect(makeKnightCard('devotion', 'd1').counted).toBe(false);
  });
});

describe('嘲諷 resolveTaunt', () => {
  it('fail on own turn', () => {
    const r = resolveTaunt({
      isOthersTurn: false,
      knightHex: { q: 2, r: 0 },
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('not_others_turn');
    expect(r.counted).toBe(false);
    expect(r.silenced).toBe(false);
    expect(r.bossDamage).toBe(0);
  });

  it('succeeds on others turn; blocks ring 1', () => {
    const center: Axial = { q: 2, r: 0 };
    const r = resolveTaunt({
      isOthersTurn: true,
      knightHex: center,
    });
    expect(r.ok).toBe(true);
    expect(r.tauntPriority).toBe(TAUNT_PRIORITY);
    expect(r.tauntPriority).toBe(100);
    expect(r.bossPlaceRestriction).toEqual({
      type: 'taunt',
      center,
      ringDistance: 1,
    });
    expect(tauntBlocksPlacement(r.bossPlaceRestriction, { q: 3, r: 0 })).toBe(
      true,
    );
    expect(tauntBlocksPlacement(r.bossPlaceRestriction, { q: 5, r: 0 })).toBe(
      false,
    );
  });

  it('priority > barrier; overrides existing barrier', () => {
    expect(TAUNT_PRIORITY).toBeGreaterThan(BARRIER_PRIORITY);
    const r = resolveTaunt({
      isOthersTurn: true,
      knightHex: { q: 2, r: 0 },
      existingBarrier: { priority: BARRIER_PRIORITY, targetHex: { q: 4, r: 0 } },
    });
    expect(r.ok).toBe(true);
    expect(r.overridesBarrier).toBe(true);
    expect(r.tauntPriority).toBeGreaterThan(BARRIER_PRIORITY);
  });
});

describe('堅定信仰 resolveFaith', () => {
  it('happy：未移動清 1 層詛咒', () => {
    const r = resolveFaith({ hasMovedThisTurn: false, curseStacks: 2 });
    expect(r.ok).toBe(true);
    expect(r.counted).toBe(true);
    expect(r.cleared).toBe(FAITH_CURSE_CLEAR);
    expect(r.curseStacks).toBe(1);
    expect(r.events).toContainEqual({ type: 'CurseClearedSelf', amount: 1 });
  });

  it('fail：本回合已移動', () => {
    const r = resolveFaith({ hasMovedThisTurn: true, curseStacks: 2 });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('already_moved');
    expect(r.curseStacks).toBe(2);
  });

  it('0 層仍可出，cleared=0', () => {
    const r = resolveFaith({ hasMovedThisTurn: false, curseStacks: 0 });
    expect(r.ok).toBe(true);
    expect(r.cleared).toBe(0);
    expect(r.curseStacks).toBe(0);
  });
});

describe('奉獻 resolveDevotion', () => {
  it('happy：鄰 1 吸 1 層', () => {
    const r = resolveDevotion({
      actorHex: { q: 2, r: 0 },
      allyHex: { q: 3, r: 0 },
      selfCurseStacks: 0,
      allyCurseStacks: 2,
    });
    expect(r.ok).toBe(true);
    expect(r.counted).toBe(false);
    expect(r.selfCurseStacks).toBe(1);
    expect(r.allyCurseStacks).toBe(1);
    expect(r.extractedUndying).toBe(false);
  });

  it('致死 → 抽出不死存在', () => {
    const r = resolveDevotion({
      actorHex: { q: 2, r: 0 },
      allyHex: { q: 3, r: 0 },
      selfCurseStacks: KNIGHT_CURSE_DEATH_STACKS - 1,
      allyCurseStacks: 1,
    });
    expect(r.ok).toBe(true);
    expect(r.wouldKillSelf).toBe(true);
    expect(r.extractedUndying).toBe(true);
    expect(r.events).toContainEqual({
      type: 'UndyingExtracted',
      reason: 'devotion_lethal',
    });
  });

  it('fail：非鄰 1', () => {
    const r = resolveDevotion({
      actorHex: { q: 2, r: 0 },
      allyHex: { q: 4, r: 0 },
      selfCurseStacks: 0,
      allyCurseStacks: 1,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('ally_not_adjacent');
  });

  it('fail：隊友無咒', () => {
    const r = resolveDevotion({
      actorHex: { q: 2, r: 0 },
      allyHex: { q: 3, r: 0 },
      selfCurseStacks: 0,
      allyCurseStacks: 0,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('ally_no_curse');
  });
});

describe('不死存在 resolveUndying', () => {
  it('happy：輪末復活；清破碎、裂完整；不傷王', () => {
    let board = createEmptyBoard();
    const land: Axial = { q: 3, r: 0 };
    const broken: Axial = { q: 4, r: 0 };
    const plain: Axial = { q: 3, r: -1 };
    const curse: Axial = { q: 2, r: 0 };
    board = placeTerrain(board, broken, 'plain_broken', { aged: true });
    board = placeTerrain(board, plain, 'plain', { aged: false });
    board = placeTerrain(board, curse, 'curse');

    const r = resolveUndying({
      board,
      landingHex: land,
      isDead: true,
      hasUndyingInHand: true,
      atRoundEndAfterActors: true,
    });
    expect(r.ok).toBe(true);
    expect(r.forceEndTurn).toBe(true);
    expect(r.bossDamage).toBe(0);
    expect(getTile(r.board, broken)).toBeUndefined();
    expect(getTile(r.board, plain)?.kind).toBe('plain_broken');
    expect(getTile(r.board, curse)?.kind).toBe('curse');
    expect(r.actorPosition).toEqual(land);
  });

  it('fail：奉獻同回合抽出須 defer', () => {
    const r = resolveUndying({
      board: createEmptyBoard(),
      landingHex: { q: 2, r: 0 },
      isDead: true,
      hasUndyingInHand: true,
      extractedThisRound: true,
      atRoundEndAfterActors: true,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('extracted_this_round_defer');
  });

  it('fail：非輪末／未死亡', () => {
    const a = resolveUndying({
      board: createEmptyBoard(),
      landingHex: { q: 2, r: 0 },
      isDead: false,
      hasUndyingInHand: true,
      atRoundEndAfterActors: true,
    });
    expect(a.reason).toBe('not_dead');
    const b = resolveUndying({
      board: createEmptyBoard(),
      landingHex: { q: 2, r: 0 },
      isDead: true,
      hasUndyingInHand: true,
      atRoundEndAfterActors: false,
    });
    expect(b.reason).toBe('not_round_end');
  });
});
