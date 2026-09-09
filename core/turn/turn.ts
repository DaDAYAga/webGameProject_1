/**
 * 單一行動者回合骨架（handoff §3 時序 1–4）。
 * stub：抽牌計數、移動點、出牌旗標；真實牌庫／棋盤驗證在上層。
 */

import {
  DEFAULT_MOVE_POINTS,
  type ActorTurnState,
  type MatchEvent,
} from './types.js';

/**
 * 開啟行動者回合：自動 stub 抽 1，進入 main。
 * 為什麼：模式 M 回合開始必抽 1；牌庫稍後接。
 */
export function startActorTurn(actorId: string): {
  turn: ActorTurnState;
  events: MatchEvent[];
} {
  const turn: ActorTurnState = {
    actorId,
    phase: 'main',
    drawsThisTurn: 1,
    movePointsRemaining: DEFAULT_MOVE_POINTS,
    cardPlayed: false,
  };
  const events: MatchEvent[] = [
    { type: 'TurnStarted', actorId },
    { type: 'DrawStub', actorId, drawsThisTurn: 1 },
  ];
  return { turn, events };
}

/**
 * stub 移動：扣 cost（預設 1）；不足則拒絕。
 */
export function stubMove(
  turn: ActorTurnState,
  cost = 1,
): { turn: ActorTurnState; events: MatchEvent[]; ok: boolean; reason?: string } {
  if (turn.phase !== 'main') {
    return { turn, events: [], ok: false, reason: 'not_in_main' };
  }
  if (cost < 1) {
    return { turn, events: [], ok: false, reason: 'invalid_cost' };
  }
  if (turn.movePointsRemaining < cost) {
    return { turn, events: [], ok: false, reason: 'no_move_points' };
  }
  const next: ActorTurnState = {
    ...turn,
    movePointsRemaining: turn.movePointsRemaining - cost,
  };
  return {
    turn: next,
    events: [
      {
        type: 'MoveStub',
        actorId: turn.actorId,
        cost,
        movePointsRemaining: next.movePointsRemaining,
      },
    ],
    ok: true,
  };
}

/**
 * stub 出計次牌：每回合最多 1 張。
 */
export function stubPlayCard(
  turn: ActorTurnState,
): { turn: ActorTurnState; events: MatchEvent[]; ok: boolean; reason?: string } {
  if (turn.phase !== 'main') {
    return { turn, events: [], ok: false, reason: 'not_in_main' };
  }
  if (turn.cardPlayed) {
    return { turn, events: [], ok: false, reason: 'card_already_played' };
  }
  const next: ActorTurnState = { ...turn, cardPlayed: true };
  return {
    turn: next,
    events: [{ type: 'CardPlayedStub', actorId: turn.actorId }],
    ok: true,
  };
}

/**
 * 待機：不改點數／出牌旗標，僅發事件。
 */
export function waitTurn(
  turn: ActorTurnState,
): { turn: ActorTurnState; events: MatchEvent[]; ok: boolean; reason?: string } {
  if (turn.phase !== 'main') {
    return { turn, events: [], ok: false, reason: 'not_in_main' };
  }
  return {
    turn,
    events: [{ type: 'Wait', actorId: turn.actorId }],
    ok: true,
  };
}

/** 標記回合結束（狀態機相）。 */
export function endActorTurnState(turn: ActorTurnState): ActorTurnState {
  return { ...turn, phase: 'ended' };
}

/** 是否可行動（未封印、未出局）。 */
export function isActionable(sealed?: boolean, eliminated?: boolean): boolean {
  return !sealed && !eliminated;
}
