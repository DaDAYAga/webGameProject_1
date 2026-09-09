/**
 * 回合／對局層（core/turn）。
 * 行動隊列、回合骨架、輪末懲罰意圖、牆老化計時。
 * 不含戰鬥、卡牌實作、實際鋪 punish、React。
 */

export type {
  ActorStatus,
  ActorTurnPhase,
  ActorTurnState,
  MatchCommand,
  MatchEvent,
  MatchState,
  MatchReduceResult,
  CreateMatchOptions,
} from './types.js';

export { DEFAULT_MOVE_POINTS } from './types.js';

export {
  AGE_TICKS_TO_AGED,
  advanceWallAging,
  defaultIsAgeable,
  type AdvanceWallAgingOptions,
  type AdvanceWallAgingResult,
} from './aging.js';

export {
  startActorTurn,
  stubMove,
  stubPlayCard,
  waitTurn,
  endActorTurnState,
  isActionable,
} from './turn.js';

export {
  createMatch,
  applyCommand,
  currentActorId,
  isRoundComplete,
} from './match.js';
