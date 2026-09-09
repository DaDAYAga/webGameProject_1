import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  createMatch,
  currentActorId,
  type MatchEvent,
  type MatchState,
} from './index.js';

function endCurrent(state: MatchState) {
  const id = currentActorId(state);
  expect(id).not.toBeNull();
  return applyCommand(state, { type: 'END_ACTOR_TURN', actorId: id! });
}

function advanceAllActionable(state: MatchState): {
  state: MatchState;
  events: MatchEvent[];
} {
  const all: MatchEvent[] = [];
  let s = state;
  // safety: enough steps for a few actors
  for (let i = 0; i < 16; i++) {
    if (!s.currentTurn) break;
    const roundBefore = s.roundIndex;
    const r = endCurrent(s);
    all.push(...r.events);
    s = r.state;
    if (r.events.some((e) => e.type === 'RoundEnded' && e.roundIndex === roundBefore)) {
      break;
    }
  }
  return { state: s, events: all };
}

describe('queue skips sealed / eliminated', () => {
  it('starts on first actionable actor, skipping sealed ahead', () => {
    const { state, events } = createMatch({
      actorOrder: ['A', 'B', 'C'],
      actors: [
        { id: 'A', sealed: true },
        { id: 'B' },
        { id: 'C' },
      ],
    });
    expect(currentActorId(state)).toBe('B');
    expect(events).toContainEqual({
      type: 'ActorSkipped',
      actorId: 'A',
      reason: 'sealed',
    });
    expect(state.currentTurn?.drawsThisTurn).toBe(1);
  });

  it('skips eliminated when advancing mid-round', () => {
    const { state: s0 } = createMatch({
      actorOrder: ['A', 'B', 'C'],
      actors: [
        { id: 'A' },
        { id: 'B', eliminated: true },
        { id: 'C' },
      ],
    });
    expect(currentActorId(s0)).toBe('A');
    const r1 = endCurrent(s0);
    expect(currentActorId(r1.state)).toBe('C');
    expect(r1.events).toContainEqual({
      type: 'ActorSkipped',
      actorId: 'B',
      reason: 'eliminated',
    });
    expect(r1.events.some((e) => e.type === 'RoundEnded')).toBe(false);
  });

  it('sealed actor never gets TurnStarted / draw', () => {
    const { events } = createMatch({
      actorOrder: ['A', 'B'],
      actors: [
        { id: 'A', sealed: true },
        { id: 'B' },
      ],
    });
    const turns = events.filter((e) => e.type === 'TurnStarted');
    expect(turns).toEqual([{ type: 'TurnStarted', actorId: 'B' }]);
    expect(
      events.filter((e) => e.type === 'DrawStub' && e.actorId === 'A'),
    ).toHaveLength(0);
  });
});

describe('full cycle through 3 actors → round ends', () => {
  it('A→B→C then RoundEnded and next round starts at A', () => {
    let { state, events: ev0 } = createMatch({
      actorOrder: ['A', 'B', 'C'],
    });
    expect(ev0.some((e) => e.type === 'RoundStarted' && e.roundIndex === 0)).toBe(
      true,
    );
    expect(currentActorId(state)).toBe('A');

    const rA = endCurrent(state);
    expect(currentActorId(rA.state)).toBe('B');

    const rB = endCurrent(rA.state);
    expect(currentActorId(rB.state)).toBe('C');

    const rC = endCurrent(rB.state);
    expect(rC.events).toContainEqual({ type: 'RoundEnded', roundIndex: 0 });
    expect(rC.events).toContainEqual({ type: 'RoundStarted', roundIndex: 1 });
    expect(currentActorId(rC.state)).toBe('A');
    expect(rC.state.roundIndex).toBe(1);
    expect(rC.state.bossDamagedThisRound).toBe(false);
  });

  it('ADVANCE equals END_ACTOR_TURN for current', () => {
    const { state } = createMatch({ actorOrder: ['A', 'B'] });
    const r = applyCommand(state, { type: 'ADVANCE' });
    expect(r.events).toContainEqual({ type: 'ActorTurnEnded', actorId: 'A' });
    expect(currentActorId(r.state)).toBe('B');
  });

  it('stub move / play card flags on actor turn', () => {
    let { state } = createMatch({ actorOrder: ['A'] });
    expect(state.currentTurn?.movePointsRemaining).toBe(2);
    let r = applyCommand(state, { type: 'STUB_MOVE', actorId: 'A' });
    expect(r.state.currentTurn?.movePointsRemaining).toBe(1);
    r = applyCommand(r.state, { type: 'STUB_MOVE', actorId: 'A', cost: 1 });
    expect(r.state.currentTurn?.movePointsRemaining).toBe(0);
    r = applyCommand(r.state, { type: 'STUB_MOVE', actorId: 'A' });
    expect(r.events[0]).toMatchObject({
      type: 'CommandRejected',
      reason: 'no_move_points',
    });
    r = applyCommand(r.state, { type: 'STUB_PLAY_CARD', actorId: 'A' });
    expect(r.state.currentTurn?.cardPlayed).toBe(true);
    r = applyCommand(r.state, { type: 'WAIT', actorId: 'A' });
    expect(r.events).toContainEqual({ type: 'Wait', actorId: 'A' });
  });
});

describe('punishEnabled + no boss damage → PunishPlace', () => {
  it('emits PunishPlace when round ends with 0 boss damage', () => {
    const { state } = createMatch({
      actorOrder: ['A', 'B'],
      punishEnabled: true,
    });
    const { events } = advanceAllActionable(state);
    expect(events).toContainEqual({
      type: 'PunishPlace',
      reason: 'zero_boss_damage',
    });
  });

  it('does not emit PunishPlace if boss was damaged', () => {
    let { state } = createMatch({
      actorOrder: ['A', 'B'],
      punishEnabled: true,
    });
    const marked = applyCommand(state, { type: 'MARK_BOSS_DAMAGED' });
    state = marked.state;
    expect(state.bossDamagedThisRound).toBe(true);
    const { events } = advanceAllActionable(state);
    expect(events.some((e) => e.type === 'PunishPlace')).toBe(false);
    expect(events).toContainEqual({ type: 'RoundEnded', roundIndex: 0 });
  });

  it('does not emit PunishPlace when punishEnabled is false', () => {
    const { state } = createMatch({
      actorOrder: ['A'],
      punishEnabled: false,
    });
    const { events } = advanceAllActionable(state);
    expect(events.some((e) => e.type === 'PunishPlace')).toBe(false);
  });
});
