/**
 * 牆老化計時（handoff §4）。
 *
 * 規則摘要：
 * - 非開場 plain 於「鋪下的那一輪結束後」才進入計數；再滿兩輪 → aged。
 * - 開場牆／noAge／已 aged：不計、不推進。
 * - Board.tiles 可帶 aged／noAge；完整 ageProgress 可選加在 Tile，
 *   本層採最小方案：MatchState.aging: Map<hexKey, ticks>。
 *
 * 計數模型（ticks）：
 * - Round N 鋪牆 → 輪末 End N：登錄 ticks=0（當輪結束才開始管線，尚不計 1）。
 * - End N+1：ticks → 1
 * - End N+2：ticks → 2 → 達 AGE_TICKS_TO_AGED → 標 aged、移出 registry。
 *
 * 亦即：鋪設輪結束後起算，再經兩個完整輪末 → 老化。
 * 當輪鋪當輪拆＝新牆：上層勿登錄、或拆時從 aging／wallsPlacedThisRound 移除。
 */

import { getTile, setTile, type Board } from '../board/index.js';

/** 達此 ticks 即老化（鋪設輪結束後再滿兩輪）。 */
export const AGE_TICKS_TO_AGED = 2;

export type AdvanceWallAgingOptions = {
  /**
   * 是否應進入／保留在老化管線。
   * 預設：若有 board，則僅當該格存在、非 noAge、尚未 aged；無 board 則全收。
   */
  isAgeable?: (hexKey: string) => boolean;
  /** 若提供，會把 newlyAged 的 tile.aged 設為 true 並回傳新 board。 */
  board?: Board;
};

export type AdvanceWallAgingResult = {
  aging: Map<string, number>;
  newlyAgedKeys: string[];
  /** 僅當 opts.board 有傳入時提供。 */
  board?: Board;
};

/**
 * 預設可老化判斷：有地形、非 noAge、尚未 aged。
 * 開場牆（createOpeningBoard）直接帶 aged:true，不會進來。
 */
export function defaultIsAgeable(board: Board, hexKey: string): boolean {
  const tile = getTile(board, parseKey(hexKey));
  if (!tile) return false;
  if (tile.noAge === true) return false;
  if (tile.aged === true) return false;
  // plain_starter 亦不老化（表定）；若呼叫端誤登錄，此處擋下
  if (tile.kind === 'plain_starter') return false;
  // 僅 plain 系進入老化；punish／curse／silence 不老化
  return tile.kind === 'plain' || tile.kind === 'plain_broken';
}

function parseKey(hexKey: string): { q: number; r: number } {
  const [qs, rs] = hexKey.split(',');
  return { q: Number(qs), r: Number(rs) };
}

/**
 * 輪末推進老化（純函式）。
 *
 * 順序：
 * 1. 複製 registry
 * 2. 既有條目 ticks += 1；達門檻 → newlyAged、刪除
 * 3. 本輪新鋪鍵以 ticks=0 登錄（略過不可老化／已在 registry 者）
 *
 * @param aging 現有計數
 * @param wallsPlacedThisRoundKeys 本輪新鋪格鍵
 */
export function advanceWallAging(
  aging: ReadonlyMap<string, number>,
  wallsPlacedThisRoundKeys: readonly string[],
  opts: AdvanceWallAgingOptions = {},
): AdvanceWallAgingResult {
  const isAgeable =
    opts.isAgeable ??
    (opts.board
      ? (key: string) => defaultIsAgeable(opts.board!, key)
      : () => true);

  const next = new Map(aging);
  const newlyAgedKeys: string[] = [];

  // 1) 推進既有
  for (const [key, ticks] of [...next.entries()]) {
    if (!isAgeable(key)) {
      next.delete(key);
      continue;
    }
    const advanced = ticks + 1;
    if (advanced >= AGE_TICKS_TO_AGED) {
      next.delete(key);
      newlyAgedKeys.push(key);
    } else {
      next.set(key, advanced);
    }
  }

  // 2) 本輪新鋪：輪末才登錄為 0（下一輪末才變成 1）
  for (const key of wallsPlacedThisRoundKeys) {
    if (next.has(key)) continue;
    if (newlyAgedKeys.includes(key)) continue;
    if (!isAgeable(key)) continue;
    next.set(key, 0);
  }

  let board = opts.board;
  if (board) {
    for (const key of newlyAgedKeys) {
      const hex = parseKey(key);
      const tile = getTile(board, hex);
      if (!tile) continue;
      board = setTile(board, hex, { ...tile, aged: true });
    }
  }

  return board !== undefined
    ? { aging: next, newlyAgedKeys, board }
    : { aging: next, newlyAgedKeys };
}
