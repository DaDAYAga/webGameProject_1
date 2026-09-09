import { describe, expect, it } from 'vitest';
import {
  createEmptyBoard,
  getTile,
  hexKey,
  placeTerrain,
  type Board,
} from '../board/index.js';
import {
  AGE_TICKS_TO_AGED,
  advanceWallAging,
  applyCommand,
  createMatch,
  currentActorId,
  defaultIsAgeable,
  type MatchState,
} from './index.js';

describe('advanceWallAging counter model', () => {
  /**
   * 表驅：放置輪結束登錄 0 → 再兩個輪末達門檻 → aged。
   */
  it.each([
    {
      name: 'empty → still empty',
      initial: [] as [string, number][],
      placed: [] as string[],
      expectTicks: [] as [string, number][],
      expectAged: [] as string[],
    },
    {
      name: 'register at end of placement round as 0',
      initial: [],
      placed: ['2,0'],
      expectTicks: [['2,0', 0]],
      expectAged: [],
    },
    {
      name: 'first full round after register → 1',
      initial: [['2,0', 0]],
      placed: [],
      expectTicks: [['2,0', 1]],
      expectAged: [],
    },
    {
      name: 'second full round → aged (threshold 2)',
      initial: [['2,0', 1]],
      placed: [],
      expectTicks: [],
      expectAged: ['2,0'],
    },
    {
      name: 'existing entry ages even if re-listed in placed',
      initial: [['2,0', 1]],
      placed: ['2,0'],
      expectTicks: [],
      expectAged: ['2,0'],
    },
    {
      name: 'two walls stagger',
      initial: [['1,0', 0]],
      placed: ['3,0'],
      expectTicks: [
        ['1,0', 1],
        ['3,0', 0],
      ],
      expectAged: [],
    },
  ])('$name', ({ initial, placed, expectTicks, expectAged }) => {
    const aging = new Map<string, number>(initial);
    const result = advanceWallAging(aging, placed);
    expect([...result.aging.entries()].sort()).toEqual(
      [...expectTicks].sort(),
    );
    expect([...result.newlyAgedKeys].sort()).toEqual([...expectAged].sort());
  });

  it('AGE_TICKS_TO_AGED is 2 (再滿兩輪)', () => {
    expect(AGE_TICKS_TO_AGED).toBe(2);
  });

  it('full timeline: place → end×3 → aged', () => {
    let aging = new Map<string, number>();
    // End placement round N
    let r = advanceWallAging(aging, ['4,0']);
    aging = r.aging;
    expect(aging.get('4,0')).toBe(0);
    expect(r.newlyAgedKeys).toEqual([]);

    // End N+1
    r = advanceWallAging(aging, []);
    aging = r.aging;
    expect(aging.get('4,0')).toBe(1);

    // End N+2 → aged
    r = advanceWallAging(aging, []);
    expect(r.newlyAgedKeys).toEqual(['4,0']);
    expect(r.aging.has('4,0')).toBe(false);
  });

  it('marks board.aged when board option provided', () => {
    let board: Board = createEmptyBoard();
    board = placeTerrain(board, { q: 2, r: 0 }, 'plain');
    expect(getTile(board, { q: 2, r: 0 })?.aged).toBeFalsy();

    const aging = new Map<string, number>([[hexKey({ q: 2, r: 0 }), 1]]);
    const r = advanceWallAging(aging, [], { board });
    expect(r.newlyAgedKeys).toEqual([hexKey({ q: 2, r: 0 })]);
    expect(r.board && getTile(r.board, { q: 2, r: 0 })?.aged).toBe(true);
  });

  it('defaultIsAgeable rejects noAge / already aged / starter / non-plain', () => {
    let board = createEmptyBoard();
    board = placeTerrain(board, { q: 1, r: 0 }, 'plain');
    board = placeTerrain(board, { q: 2, r: 0 }, 'plain', { aged: true });
    board = placeTerrain(board, { q: 3, r: 0 }, 'plain', { noAge: true });
    board = placeTerrain(board, { q: 4, r: 0 }, 'plain_starter');
    board = placeTerrain(board, { q: 5, r: 0 }, 'punish');

    expect(defaultIsAgeable(board, '1,0')).toBe(true);
    expect(defaultIsAgeable(board, '2,0')).toBe(false);
    expect(defaultIsAgeable(board, '3,0')).toBe(false);
    expect(defaultIsAgeable(board, '4,0')).toBe(false);
    expect(defaultIsAgeable(board, '5,0')).toBe(false);
    expect(defaultIsAgeable(board, '9,9')).toBe(false);
  });

  it('isAgeable filter skips opening-style walls from registry', () => {
    const aging = new Map<string, number>([['1,0', 1]]);
    const r = advanceWallAging(aging, ['2,0'], {
      isAgeable: (key) => key !== '1,0' && key !== '2,0',
    });
    // 1,0 not ageable → dropped; 2,0 not registered
    expect(r.aging.size).toBe(0);
    expect(r.newlyAgedKeys).toEqual([]);
  });
});

describe('match integrates aging on round end', () => {
  function endCurrent(state: MatchState) {
    const id = currentActorId(state);
    return applyCommand(state, { type: 'END_ACTOR_TURN', actorId: id! });
  }

  it('registers placed wall at round end and ages after two more rounds', () => {
    let { state } = createMatch({ actorOrder: ['A'] });
    // Round 0: register wall mid-turn
    let r = applyCommand(state, {
      type: 'REGISTER_WALL_PLACED',
      hexKey: '2,0',
    });
    state = r.state;
    r = endCurrent(state); // ends round 0 → register ticks=0, start round 1
    state = r.state;
    expect(r.events.some((e) => e.type === 'WallAged')).toBe(false);
    expect(state.aging.get('2,0')).toBe(0);
    expect(state.roundIndex).toBe(1);

    r = endCurrent(state); // end round 1 → ticks=1
    state = r.state;
    expect(state.aging.get('2,0')).toBe(1);
    expect(r.events.some((e) => e.type === 'WallAged')).toBe(false);

    r = endCurrent(state); // end round 2 → aged
    state = r.state;
    expect(r.events).toContainEqual({ type: 'WallAged', hexKey: '2,0' });
    expect(state.aging.has('2,0')).toBe(false);
  });
});
