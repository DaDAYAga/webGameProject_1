/**
 * 對局 glue：行動隊列、一輪、輪末懲罰意圖、老化推進（handoff §3、§12 step 4）。
 * 不實際鋪 punish／不結算戰鬥——只發意圖事件與維護旗標。
 */

import { advanceWallAging } from './aging.js';
import {
  endActorTurnState,
  isActionable,
  startActorTurn,
  stubMove,
  stubPlayCard,
  waitTurn,
} from './turn.js';
import type {
  ActorStatus,
  CreateMatchOptions,
  MatchCommand,
  MatchEvent,
  MatchReduceResult,
  MatchState,
} from './types.js';

function actorsMap(
  order: readonly string[],
  list?: readonly ActorStatus[],
): Map<string, ActorStatus> {
  const m = new Map<string, ActorStatus>();
  for (const id of order) {
    m.set(id, { id });
  }
  if (list) {
    for (const a of list) {
      m.set(a.id, { ...m.get(a.id), ...a, id: a.id });
    }
  }
  return m;
}

function getStatus(state: MatchState, id: string): ActorStatus {
  return state.actors.get(id) ?? { id };
}

function actionableIds(state: MatchState): string[] {
  return state.actorOrder.filter((id) => {
    const a = getStatus(state, id);
    return isActionable(a.sealed, a.eliminated);
  });
}

type ScanResult = {
  /** 找到可行動者時的索引；找不到為 null */
  index: number | null;
  skipped: MatchEvent[];
};

/**
 * 從 afterIndex 之後找下一個可行動且本輪尚未結束者。
 * wrap=false：只往後掃到隊尾（開輪用）。
 * wrap=true：掃完隊尾後從頭掃到 afterIndex（結束後找下一位）。
 */
function findNextActionable(
  state: MatchState,
  afterIndex: number,
  wrap: boolean,
): ScanResult {
  const n = state.actorOrder.length;
  const skipped: MatchEvent[] = [];
  if (n === 0) return { index: null, skipped };

  const consider = (idx: number): number | null => {
    const id = state.actorOrder[idx]!;
    const st = getStatus(state, id);
    if (st.eliminated) {
      skipped.push({ type: 'ActorSkipped', actorId: id, reason: 'eliminated' });
      return null;
    }
    if (st.sealed) {
      skipped.push({ type: 'ActorSkipped', actorId: id, reason: 'sealed' });
      return null;
    }
    if (state.endedThisRound.has(id)) return null;
    return idx;
  };

  for (let idx = afterIndex + 1; idx < n; idx++) {
    const hit = consider(idx);
    if (hit !== null) return { index: hit, skipped };
  }
  if (!wrap) return { index: null, skipped };

  for (let idx = 0; idx <= afterIndex; idx++) {
    const hit = consider(idx);
    if (hit !== null) return { index: hit, skipped };
  }
  return { index: null, skipped };
}

function startTurnAt(
  state: MatchState,
  index: number,
  prepend: MatchEvent[],
): MatchReduceResult {
  const id = state.actorOrder[index]!;
  const { turn, events: turnEvents } = startActorTurn(id);
  return {
    state: {
      ...state,
      currentIndex: index,
      currentTurn: turn,
    },
    events: [...prepend, ...turnEvents],
  };
}

function clearedRoundShell(
  state: MatchState,
  roundIndex: number,
): MatchState {
  return {
    ...state,
    roundIndex,
    bossDamagedThisRound: false,
    wallsPlacedThisRound: [],
    endedThisRound: new Set(),
    currentTurn: null,
    currentIndex: -1,
  };
}

/**
 * 輪末：老化推進 → RoundEnded → 可選 PunishPlace → 嘗試開下一輪。
 * 若下一輪已無任何可行動者，只開 RoundStarted／Skip，不再遞迴 finishRound
 * （避免全員封印時無限輪末）。
 */
function finishRound(
  state: MatchState,
  prepend: MatchEvent[],
): MatchReduceResult {
  const events: MatchEvent[] = [...prepend];
  const agingResult = advanceWallAging(
    state.aging,
    state.wallsPlacedThisRound,
  );
  for (const key of agingResult.newlyAgedKeys) {
    events.push({ type: 'WallAged', hexKey: key });
  }
  events.push({ type: 'RoundEnded', roundIndex: state.roundIndex });

  if (state.punishEnabled && !state.bossDamagedThisRound) {
    events.push({ type: 'PunishPlace', reason: 'zero_boss_damage' });
  }

  const nextIndex = state.roundIndex + 1;
  const cleared = clearedRoundShell(
    { ...state, aging: agingResult.aging },
    nextIndex,
  );
  events.push({ type: 'RoundStarted', roundIndex: nextIndex });

  const scan = findNextActionable(cleared, -1, false);
  events.push(...scan.skipped);
  if (scan.index === null) {
    return { state: cleared, events };
  }
  return startTurnAt(cleared, scan.index, events);
}

/**
 * 開啟一輪並找第一位可行動者。
 * 僅 createMatch 使用；若開局即無人可動，發 RoundStarted＋Skip 後停住（不自動輪末迴圈）。
 */
function beginRound(state: MatchState, roundIndex: number): MatchReduceResult {
  const events: MatchEvent[] = [{ type: 'RoundStarted', roundIndex }];
  const cleared = clearedRoundShell(state, roundIndex);
  const scan = findNextActionable(cleared, -1, false);
  events.push(...scan.skipped);
  if (scan.index === null) {
    return { state: cleared, events };
  }
  return startTurnAt(cleared, scan.index, events);
}

/**
 * 建立對局並立刻開啟第 0 輪、第一位可行動者回合。
 */
export function createMatch(opts: CreateMatchOptions): MatchReduceResult {
  if (opts.actorOrder.length === 0) {
    throw new Error('createMatch: actorOrder must not be empty');
  }
  const base: MatchState = {
    actorOrder: [...opts.actorOrder],
    actors: actorsMap(opts.actorOrder, opts.actors),
    currentIndex: -1,
    currentTurn: null,
    roundIndex: opts.roundIndex ?? 0,
    bossDamagedThisRound: false,
    punishEnabled: opts.punishEnabled === true,
    aging: new Map(opts.aging ?? []),
    wallsPlacedThisRound: [],
    endedThisRound: new Set(),
  };
  return beginRound(base, base.roundIndex);
}

function reject(
  state: MatchState,
  commandType: string,
  reason: string,
): MatchReduceResult {
  return {
    state,
    events: [{ type: 'CommandRejected', commandType, reason }],
  };
}

/**
 * 套用指令，回傳新狀態與事件。
 */
export function applyCommand(
  state: MatchState,
  command: MatchCommand,
): MatchReduceResult {
  switch (command.type) {
    case 'SYNC_ACTOR_STATUS': {
      const actors = new Map(state.actors);
      for (const a of command.actors) {
        actors.set(a.id, { ...actors.get(a.id), ...a, id: a.id });
      }
      return { state: { ...state, actors }, events: [] };
    }

    case 'MARK_BOSS_DAMAGED':
      return {
        state: { ...state, bossDamagedThisRound: true },
        events: [],
      };

    case 'REGISTER_WALL_PLACED': {
      if (state.wallsPlacedThisRound.includes(command.hexKey)) {
        return { state, events: [] };
      }
      return {
        state: {
          ...state,
          wallsPlacedThisRound: [
            ...state.wallsPlacedThisRound,
            command.hexKey,
          ],
        },
        events: [],
      };
    }

    case 'WAIT': {
      const turn = state.currentTurn;
      if (!turn || turn.actorId !== command.actorId) {
        return reject(state, 'WAIT', 'not_current_actor');
      }
      const r = waitTurn(turn);
      if (!r.ok) return reject(state, 'WAIT', r.reason ?? 'rejected');
      return { state: { ...state, currentTurn: r.turn }, events: r.events };
    }

    case 'STUB_MOVE': {
      const turn = state.currentTurn;
      if (!turn || turn.actorId !== command.actorId) {
        return reject(state, 'STUB_MOVE', 'not_current_actor');
      }
      const r = stubMove(turn, command.cost ?? 1);
      if (!r.ok) return reject(state, 'STUB_MOVE', r.reason ?? 'rejected');
      return { state: { ...state, currentTurn: r.turn }, events: r.events };
    }

    case 'STUB_PLAY_CARD': {
      const turn = state.currentTurn;
      if (!turn || turn.actorId !== command.actorId) {
        return reject(state, 'STUB_PLAY_CARD', 'not_current_actor');
      }
      const r = stubPlayCard(turn);
      if (!r.ok) return reject(state, 'STUB_PLAY_CARD', r.reason ?? 'rejected');
      return { state: { ...state, currentTurn: r.turn }, events: r.events };
    }

    case 'ADVANCE': {
      if (!state.currentTurn) {
        return reject(state, 'ADVANCE', 'no_current_turn');
      }
      return endCurrentActor(state, state.currentTurn.actorId);
    }

    case 'END_ACTOR_TURN':
      return endCurrentActor(state, command.actorId);

    default: {
      const _exhaustive: never = command;
      return reject(state, 'unknown', String(_exhaustive));
    }
  }
}

function endCurrentActor(state: MatchState, actorId: string): MatchReduceResult {
  const turn = state.currentTurn;
  if (!turn || turn.actorId !== actorId) {
    return reject(state, 'END_ACTOR_TURN', 'not_current_actor');
  }

  const events: MatchEvent[] = [{ type: 'ActorTurnEnded', actorId }];
  const ended = new Set(state.endedThisRound);
  ended.add(actorId);

  const afterEnd: MatchState = {
    ...state,
    currentTurn: endActorTurnState(turn),
    endedThisRound: ended,
  };

  const actionable = actionableIds(afterEnd);
  const allDone =
    actionable.length === 0 ||
    actionable.every((id) => ended.has(id));
  if (allDone) {
    return finishRound(afterEnd, events);
  }

  const scan = findNextActionable(afterEnd, state.currentIndex, true);
  events.push(...scan.skipped);
  if (scan.index === null) {
    return finishRound(afterEnd, events);
  }
  return startTurnAt(afterEnd, scan.index, events);
}

/** 目前行動者 id；無則 null。 */
export function currentActorId(state: MatchState): string | null {
  return state.currentTurn?.actorId ?? null;
}

/** 本輪可行動者是否皆已結束（測試輔助）。 */
export function isRoundComplete(state: MatchState): boolean {
  const actionable = actionableIds(state);
  return (
    actionable.length > 0 &&
    actionable.every((id) => state.endedThisRound.has(id))
  );
}
