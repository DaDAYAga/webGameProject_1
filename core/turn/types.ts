/**
 * 回合／對局狀態與指令／事件型別（handoff §3、§7、§12 step 4）。
 * 純資料；不含棋盤放置與戰鬥結算。
 */

/** 行動者狀態（封印／出局由呼叫端或包圍層提供）。 */
export type ActorStatus = {
  id: string;
  /** 六鄰皆擋 → 封印：本回合不抽、不出、不行動。 */
  sealed?: boolean;
  /** 已出局：跳過隊列。 */
  eliminated?: boolean;
};

/** 單一行動者回合階段。 */
export type ActorTurnPhase =
  | 'draw' // 回合開始抽牌（stub 後立刻進 main）
  | 'main' // 移動／出牌／待機
  | 'ended';

/**
 * 單一行動者回合骨架狀態。
 * 卡牌／棋盤驗證留給上層；此層只追蹤點數與旗標。
 */
export type ActorTurnState = {
  actorId: string;
  phase: ActorTurnPhase;
  /** 本回合已抽次數（stub：回合開始 +1）。 */
  drawsThisTurn: number;
  /** 剩餘基本移動點（預設上限 2）。 */
  movePointsRemaining: number;
  /** 是否已出過 1 張計次牌。 */
  cardPlayed: boolean;
};

/** 基本移動點預設上限。 */
export const DEFAULT_MOVE_POINTS = 2;

/**
 * 對局／回合指令（子集；MOVE／PLAY_CARD 完整結算在上層／combat）。
 * ADVANCE 等同對當前行動者送 END_ACTOR_TURN。
 */
export type MatchCommand =
  | { type: 'WAIT'; actorId: string }
  | { type: 'END_ACTOR_TURN'; actorId: string }
  | { type: 'ADVANCE' }
  /** stub：消耗 1（或 cost）點移動；棋盤合法性由上層驗證。 */
  | { type: 'STUB_MOVE'; actorId: string; cost?: number }
  /** stub：標記已出計次牌。 */
  | { type: 'STUB_PLAY_CARD'; actorId: string }
  /** 上層通知：本輪已對王造成有效傷。 */
  | { type: 'MARK_BOSS_DAMAGED' }
  /** 上層通知：本輪於某格鋪了可老化牆（hexKey = "q,r"）。 */
  | { type: 'REGISTER_WALL_PLACED'; hexKey: string }
  /** 同步行動者封印／出局（包圍結算後呼叫）。 */
  | { type: 'SYNC_ACTOR_STATUS'; actors: readonly ActorStatus[] };

/** 對局事件（供 UI／上層投影）。 */
export type MatchEvent =
  | { type: 'RoundStarted'; roundIndex: number }
  | { type: 'TurnStarted'; actorId: string }
  | { type: 'DrawStub'; actorId: string; drawsThisTurn: number }
  | { type: 'MoveStub'; actorId: string; cost: number; movePointsRemaining: number }
  | { type: 'CardPlayedStub'; actorId: string }
  | { type: 'Wait'; actorId: string }
  | { type: 'ActorTurnEnded'; actorId: string }
  | { type: 'ActorSkipped'; actorId: string; reason: 'sealed' | 'eliminated' }
  | { type: 'RoundEnded'; roundIndex: number }
  /**
   * 輪末懲罰意圖：本輪王傷 0 且 punishEnabled。
   * 不在此層實際鋪 punish 格——留給上層依威脅序放置。
   */
  | { type: 'PunishPlace'; reason: 'zero_boss_damage' }
  | { type: 'WallAged'; hexKey: string }
  | { type: 'CommandRejected'; commandType: string; reason: string };

/**
 * 對局狀態（match glue）。
 * aging：hexKey → 已累計輪末 ticks（見 aging.ts 註解）。
 */
export type MatchState = {
  /** 自訂行動順序（A→B→C→D）。 */
  readonly actorOrder: readonly string[];
  /** 行動者狀態表。 */
  readonly actors: ReadonlyMap<string, ActorStatus>;
  /** 當前行動者在 actorOrder 的索引；無行動者時為 -1。 */
  readonly currentIndex: number;
  /** 當前行動者回合；回合間隙可為 null。 */
  readonly currentTurn: ActorTurnState | null;
  /** 從 0 起算的輪數。 */
  readonly roundIndex: number;
  /** 本輪是否已有有效傷王。 */
  readonly bossDamagedThisRound: boolean;
  /** 教學／完整模式：是否啟用輪末懲罰。 */
  readonly punishEnabled: boolean;
  /**
   * 老化 registry：hexKey → ticks。
   * 不含開場牆／noAge；達門檻後移出並發 WallAged。
   */
  readonly aging: ReadonlyMap<string, number>;
  /** 本輪已鋪、待輪末登錄老化的格鍵。 */
  readonly wallsPlacedThisRound: readonly string[];
  /** 本輪已結束回合的行動者（可行動者皆在此 → 輪末）。 */
  readonly endedThisRound: ReadonlySet<string>;
};

/** applyCommand 回傳。 */
export type MatchReduceResult = {
  state: MatchState;
  events: MatchEvent[];
};

/** 建立對局的選項。 */
export type CreateMatchOptions = {
  actorOrder: readonly string[];
  /** 初始封印／出局；缺省皆可行動。 */
  actors?: readonly ActorStatus[];
  punishEnabled?: boolean;
  /** 初始輪數（預設 0）。 */
  roundIndex?: number;
  /** 預先放入的老化計數（測試用）。 */
  aging?: ReadonlyMap<string, number>;
};
