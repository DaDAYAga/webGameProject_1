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
import { canStandAt, hexKey } from './board.js';
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
};

/**
 * 在可站格上找 from→toward 的最短路徑（BFS）。
 *
 * - 進入鄰格僅當 `canStandAt(board, hex)`（**起點 from 不重驗**）
 * - 預設 toward 必須可站，否則 null；`allowUnstandableTarget` 可放寬
 * - 回傳含兩端的格子序列；不可達回 null；from===toward 回 `[from]`
 *
 * 為什麼：使用者要「每次取最短路徑時多判斷 canStandAt」— 幾何扇形不夠，必須繞牆。
 */
export function shortestPath(
  board: Board,
  from: Axial,
  toward: Axial,
  options: ShortestPathOptions = {},
): Axial[] | null {
  const allowUnstandableTarget = options.allowUnstandableTarget === true;
  const maxSteps =
    options.maxSteps ?? Math.max(distance(from, toward) * 4, 24);
  const isAllowed = options.isAllowedHex;

  if (equals(from, toward)) {
    return [{ q: from.q, r: from.r }];
  }

  // 預設：目標不可站 → 直接失敗（allowUnstandableTarget 時略過）
  if (!allowUnstandableTarget && !canStandAt(board, toward)) {
    return null;
  }

  const parent = new Map<string, string | null>();
  const stepsAt = new Map<string, number>();
  const startKey = hexKey(from);
  parent.set(startKey, null);
  stepsAt.set(startKey, 0);

  const queue: Axial[] = [{ q: from.q, r: from.r }];
  let head = 0;

  while (head < queue.length) {
    const cur = queue[head++]!;
    const curKey = hexKey(cur);
    const curSteps = stepsAt.get(curKey)!;

    if (equals(cur, toward)) {
      return reconstructPath(parent, from, toward);
    }

    if (curSteps >= maxSteps) continue;

    for (const n of neighbors(cur)) {
      const nk = hexKey(n);
      if (parent.has(nk)) continue;
      if (isAllowed && !isAllowed(n)) continue;

      const isTarget = equals(n, toward);
      // 進入條件：目標在 allow 時可不驗站格；其餘必須 canStandAt
      if (isTarget) {
        if (!allowUnstandableTarget && !canStandAt(board, n)) continue;
      } else if (!canStandAt(board, n)) {
        continue;
      }

      parent.set(nk, curKey);
      stepsAt.set(nk, curSteps + 1);
      queue.push({ q: n.q, r: n.r });
    }
  }

  return null;
}

function reconstructPath(
  parent: Map<string, string | null>,
  from: Axial,
  toward: Axial,
): Axial[] {
  const path: Axial[] = [];
  let key: string | null = hexKey(toward);
  while (key !== null) {
    const [qs, rs] = key.split(',');
    path.push({ q: Number(qs), r: Number(rs) });
    const prev = parent.get(key);
    key = prev === undefined ? null : prev;
  }
  path.reverse();
  if (path.length === 0 || !equals(path[0]!, from)) {
    return [{ q: from.q, r: from.r }, ...path];
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
