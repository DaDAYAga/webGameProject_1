/**
 * 可站格最短路徑（BFS + canStandAt）。
 * 與 core/hex/shrinkingFanCells（純幾何廊道）分層：本模組才看棋盤障礙。
 */

import {
  distance,
  equals,
  neighbors,
  shrinkingFanCells,
  type Axial,
  type ShrinkingFanOptions,
} from '../hex/index.js';
import { canStandAt, getTile, hexKey } from './board.js';
import type { Board } from './types.js';

/** shortestPath 選項。 */
export type ShortestPathOptions = {
  /**
   * 允許目標不可站（未來技能用）。
   * 預設 false：toward 必須 canStandAt，否則回 null。
   */
  allowUnstandableTarget?: boolean;
  /**
   * 搜尋邊數上限；超過視為不可達（避免無限空曠擴張）。
   * 未指定時用 max(距離×4, 24)。
   */
  maxSteps?: number;
  /**
   * 額外允許進入的格過濾（例如地圖邊界）。
   * 回 false 則不擴展該格（起點仍可在過濾外開始）。
   */
  isAllowedHex?: (hex: Axial) => boolean;
  /**
   * 其他單位佔格（盟友等）；傳入 canStandAt，不可落地／穿越。
   * 勿含行走者自身。
   */
  occupied?: readonly Axial[];
  /**
   * 詛咒攜帶：路徑上每踩一格 curse 消耗 1 剩餘容量；
   * 已達 cap 則 curse 不可進（視同不可站）。英勇衝鋒不走此選項。
   */
  curseCarry?: { stacks: number; cap: number };
};

function standOptsFor(
  options: ShortestPathOptions,
  stacks: number,
): { occupied?: readonly Axial[]; blockCurse?: boolean } {
  const o: { occupied?: readonly Axial[]; blockCurse?: boolean } = {};
  if (options.occupied) o.occupied = options.occupied;
  if (options.curseCarry && stacks >= options.curseCarry.cap) {
    o.blockCurse = true;
  }
  return o;
}

function stacksAfterEnter(
  board: Board,
  hex: Axial,
  stacksBefore: number,
  curseCarry: { stacks: number; cap: number } | undefined,
): number | null {
  if (!curseCarry) return stacksBefore;
  const tile = getTile(board, hex);
  if (!tile || tile.kind !== 'curse') return stacksBefore;
  if (stacksBefore >= curseCarry.cap) return null;
  return stacksBefore + 1;
}

/**
 * 在可站格上找 from→toward 的最短路徑（BFS）。
 *
 * - 進入鄰格僅當 `canStandAt`（**起點 from 不重驗**）
 * - 預設 toward 必須可站，否則 null；`allowUnstandableTarget` 可放寬
 * - `curseCarry`：BFS 狀態含沿途 stacks，超量 curse 不可進
 * - 先找不踩中途詛咒的最短路；沒有才退回可踩咒的最短路（不預設走咒）
 * - 回傳含兩端的格子序列；不可達回 null；from===toward 回 `[from]`
 */
export function shortestPath(
  board: Board,
  from: Axial,
  toward: Axial,
  options: ShortestPathOptions = {},
): Axial[] | null {
  const any = searchShortestPath(board, from, toward, options, false);
  if (!any) return null;
  const steps = any.length - 1;
  const cap = Math.min(options.maxSteps ?? steps, steps);
  const clean = searchShortestPath(
    board,
    from,
    toward,
    { ...options, maxSteps: cap },
    true,
  );
  if (clean && clean.length === any.length) return clean;
  return any;
}

function searchShortestPath(
  board: Board,
  from: Axial,
  toward: Axial,
  options: ShortestPathOptions,
  avoidTransitCurse: boolean,
): Axial[] | null {
  const allowUnstandableTarget = options.allowUnstandableTarget === true;
  const maxSteps =
    options.maxSteps ?? Math.max(distance(from, toward) * 4, 24);
  const isAllowed = options.isAllowedHex;
  const curseCarry = options.curseCarry;
  const startStacks = curseCarry?.stacks ?? 0;
  const baseStand = standOptsFor(options, startStacks);

  if (equals(from, toward)) {
    return [{ q: from.q, r: from.r }];
  }

  // 預設：目標不可站 → 直接失敗（allow 時略過；curse 目標另依沿途 stacks）
  if (!allowUnstandableTarget) {
    const towardTile = getTile(board, toward);
    const towardIsCurse = towardTile?.kind === 'curse';
    if (!towardIsCurse || !curseCarry) {
      if (!canStandAt(board, toward, baseStand)) return null;
    } else if (startStacks >= curseCarry.cap && !canStandAt(board, toward, baseStand)) {
      return null;
    }
  }

  // state key = hex|stacks（無 curseCarry 時 stacks 固定 0，等同舊行為）
  const stateKey = (hex: Axial, stacks: number) =>
    curseCarry ? `${hexKey(hex)}|${stacks}` : hexKey(hex);

  const parent = new Map<string, string | null>();
  const stepsAt = new Map<string, number>();
  const hexAt = new Map<string, Axial>();
  const stacksAt = new Map<string, number>();

  const startKey = stateKey(from, startStacks);
  parent.set(startKey, null);
  stepsAt.set(startKey, 0);
  hexAt.set(startKey, { q: from.q, r: from.r });
  stacksAt.set(startKey, startStacks);

  const queue: string[] = [startKey];
  let head = 0;

  while (head < queue.length) {
    const curKey = queue[head++]!;
    const cur = hexAt.get(curKey)!;
    const curStacks = stacksAt.get(curKey)!;
    const curSteps = stepsAt.get(curKey)!;

    if (equals(cur, toward)) {
      return reconstructPathFromStates(parent, hexAt, startKey, curKey);
    }

    if (curSteps >= maxSteps) continue;

    const standNow = standOptsFor(options, curStacks);

    const nbrs = [...neighbors(cur)];
    nbrs.sort((a, b) => {
      const ac = getTile(board, a)?.kind === 'curse' ? 1 : 0;
      const bc = getTile(board, b)?.kind === 'curse' ? 1 : 0;
      return ac - bc;
    });

    for (const n of nbrs) {
      if (isAllowed && !isAllowed(n)) continue;

      const isTarget = equals(n, toward);
      if (
        avoidTransitCurse &&
        !isTarget &&
        getTile(board, n)?.kind === 'curse'
      ) {
        continue;
      }
      const nextStacks = stacksAfterEnter(board, n, curStacks, curseCarry);
      if (nextStacks === null) continue;

      if (isTarget) {
        if (!allowUnstandableTarget) {
          const standEnter = standOptsFor(options, curStacks);
          if (!canStandAt(board, n, standEnter)) continue;
        }
      } else if (!canStandAt(board, n, standNow)) {
        continue;
      }

      const nk = stateKey(n, nextStacks);
      if (parent.has(nk)) continue;

      parent.set(nk, curKey);
      stepsAt.set(nk, curSteps + 1);
      hexAt.set(nk, { q: n.q, r: n.r });
      stacksAt.set(nk, nextStacks);
      queue.push(nk);
    }
  }

  return null;
}

function reconstructPathFromStates(
  parent: Map<string, string | null>,
  hexAt: Map<string, Axial>,
  startKey: string,
  endKey: string,
): Axial[] {
  const path: Axial[] = [];
  let key: string | null = endKey;
  while (key !== null) {
    path.push(hexAt.get(key)!);
    const prev = parent.get(key);
    key = prev === undefined ? null : prev;
  }
  path.reverse();
  if (path.length === 0) {
    const s = hexAt.get(startKey)!;
    return [{ q: s.q, r: s.r }];
  }
  return path;
}

/**
 * 可站格最短路徑的邊數（格子數 − 1）；不可達回 null。
 */
export function shortestPathLength(
  board: Board,
  from: Axial,
  toward: Axial,
  options: ShortestPathOptions = {},
): number | null {
  const path = shortestPath(board, from, toward, options);
  if (path === null) return null;
  return path.length - 1;
}

/**
 * 判斷 hex 是否落在 from→toward 某一條可站最短路徑上。
 * 作法：len(from,hex)+len(hex,toward) === len(from,toward)。
 */
export function isOnShortestStandablePath(
  board: Board,
  from: Axial,
  toward: Axial,
  hex: Axial,
  options: ShortestPathOptions = {},
): boolean {
  const total = shortestPathLength(board, from, toward, options);
  if (total === null) return false;
  const a = shortestPathLength(board, from, hex, options);
  const b = shortestPathLength(board, hex, toward, options);
  if (a === null || b === null) return false;
  return a + b === total;
}

/** standableShrinkingFanCells 選項＝幾何扇形選項。 */
export type StandableShrinkingFanOptions = ShrinkingFanOptions;

/**
 * 幾何縮距扇形再過濾可站格（端點保留）。
 *
 * **注意：這不是繞牆最短路徑。** 牆擋在直廊上時，扇形被濾掉後可能斷開；
 * 真正要「繞過障礙的最短路徑」請用 `shortestPath`（BFS）。
 */
export function standableShrinkingFanCells(
  board: Board,
  from: Axial,
  toward: Axial,
  opts: StandableShrinkingFanOptions = {},
): Axial[] {
  const cells = shrinkingFanCells(from, toward, opts);
  return cells.filter((c) => {
    if (equals(c, from) || equals(c, toward)) return true;
    return canStandAt(board, c);
  });
}
