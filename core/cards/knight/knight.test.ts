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
  FAITH_CURSE_CLEAR,
  KNIGHT_ATTACK_BOSS_DAMAGE,
  KNIGHT_CURSE_DEATH_STACKS,
  makeKnightCard,
  resolveDevotion,
  resolveFaith,
  resolveGuard,
  resolveKnightAttack,
  resolveShieldCharge,
  resolveUndying,
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

describe('護身 resolveGuard', () => {
  it('happy：直線、破碎可穿、落到友軍旁', () => {
    let board = createEmptyBoard();
    // (0,4)→(0,1)：中間 (0,3) 破碎可穿；(0,2) 空可站落點
    const actor: Axial = { q: 0, r: 4 };
    const midBroken: Axial = { q: 0, r: 3 };
    const ally: Axial = { q: 0, r: 1 };
    const landing: Axial = { q: 0, r: 2 };
    board = placeTerrain(board, midBroken, 'plain_broken');

    const r = resolveGuard({
      board,
      actorPosition: actor,
      allyHex: ally,
      landingHex: landing,
    });
    expect(r.ok).toBe(true);
    expect(r.counted).toBe(true);
    expect(r.actorPosition).toEqual(landing);
    expect(r.events).toContainEqual({
      type: 'ActorMoved',
      from: actor,
      to: landing,
    });
  });

  it('fail：完整牆擋視線', () => {
    let board = createEmptyBoard();
    const actor: Axial = { q: 0, r: 3 };
    const mid: Axial = { q: 0, r: 2 };
    const ally: Axial = { q: 0, r: 1 };
    board = placeTerrain(board, mid, 'plain');

    const r = resolveGuard({
      board,
      actorPosition: actor,
      allyHex: ally,
      landingHex: mid,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('line_of_sight_blocked');
  });

  it('fail：非直線', () => {
    const board = createEmptyBoard();
    const r = resolveGuard({
      board,
      actorPosition: { q: 0, r: 3 },
      allyHex: { q: 1, r: 1 },
      landingHex: { q: 0, r: 1 },
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('not_straight_line');
  });

  it('fail：落點不可站', () => {
    let board = createEmptyBoard();
    // 直線 (2,0)→(4,0) 視線空；落點選友軍旁但不在中線上並鋪牆
    const actor: Axial = { q: 2, r: 0 };
    const ally: Axial = { q: 4, r: 0 };
    const landing: Axial = { q: 3, r: 1 }; // 鄰 ally，非中線
    board = placeTerrain(board, landing, 'plain');
    const r = resolveGuard({
      board,
      actorPosition: actor,
      allyHex: ally,
      landingHex: landing,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('landing_not_standable');
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
