/**
 * 王鋪牆威脅序選格（handoff：邊緣 → 易圍死／詛咒弱體 → 遠程 → 近距）。
 * 純函式；不改 board、不結算戰鬥。
 */

import {
  BOSS_HEX,
  getTile,
  hexKey,
  type Board,
} from '../board/index.js';
import {
  DEFAULT_MAP_RADIUS,
  countBlockedNeighbors,
  isInMap,
  listMapHexes,
  type MapBounds,
} from '../enclosure/index.js';
import { distance, equals, neighbors, type Axial } from '../hex/index.js';

/** 威脅目標角色（UI／對局層傳入）。 */
export type ThreatActor = {
  id: string;
  hex: Axial;
  /** 遠程（槍／法）優先於近距（騎）。 */
  role: 'ranged' | 'melee';
  /** 已中詛咒層數；>0 視為弱體加權。 */
  curseStacks?: number;
};

export type PickThreatPlacementOptions = {
  /** 地圖邊界；預設 radius=DEFAULT_MAP_RADIUS。 */
  bounds?: MapBounds;
  /** 單位佔格（不可鋪）。 */
  occupied?: readonly Axial[];
  /** 嘲諷／屏障等保護格（不可鋪）。 */
  protectedHexes?: readonly Axial[];
  /** 額外排除（本輪已選等）。 */
  exclude?: readonly Axial[];
};

function defaultBounds(bounds?: MapBounds): MapBounds {
  return bounds ?? { radius: DEFAULT_MAP_RADIUS };
}

function isExcluded(
  h: Axial,
  occupied: readonly Axial[],
  protectedHexes: readonly Axial[],
  exclude: readonly Axial[],
): boolean {
  if (equals(h, BOSS_HEX)) return true;
  if (occupied.some((o) => equals(o, h))) return true;
  if (protectedHexes.some((p) => equals(p, h))) return true;
  if (exclude.some((e) => equals(e, h))) return true;
  return false;
}

function isEdgeHex(hex: Axial, bounds: MapBounds): boolean {
  if ('isInMap' in bounds) {
    // 自訂邊界：鄰格有圖外者視為邊緣
    return neighbors(hex).some((n) => !isInMap(n, bounds));
  }
  const origin = bounds.origin ?? BOSS_HEX;
  return distance(origin, hex) === bounds.radius;
}

/**
 * 單格對某角色的威脅分（越高越該先鋪）。
 * 優先完成封印（鋪後 6）／瀕封（5），再邊緣／詛咒／遠程。
 */
function scoreHexForActor(
  board: Board,
  hex: Axial,
  actor: ThreatActor,
  bounds: MapBounds,
): number {
  const adj = neighbors(actor.hex).some((n) => equals(n, hex));
  if (!adj) return 0;

  const before = countBlockedNeighbors(board, actor.hex, bounds);
  // hex 目前為空，鋪上後 +1 阻擋
  const after = Math.min(6, before + 1);

  let score = 0;
  if (after >= 6) score += 10000;
  else if (after === 5) score += 8000;
  else score += after * 100;

  if (isEdgeHex(actor.hex, bounds)) score += 2000;
  if ((actor.curseStacks ?? 0) > 0) score += 1500;
  if (actor.role === 'ranged') score += 500;
  else score += 100;

  // 輕微偏好鋪在地圖邊緣格
  if (isEdgeHex(hex, bounds)) score += 50;

  return score;
}

function scoreCandidate(
  board: Board,
  hex: Axial,
  actors: readonly ThreatActor[],
  bounds: MapBounds,
): number {
  let best = 0;
  for (const a of actors) {
    best = Math.max(best, scoreHexForActor(board, hex, a, bounds));
  }
  // 無鄰角色時仍允許：邊緣格略高於內圈，避免完全隨機
  if (best === 0) {
    if (isEdgeHex(hex, bounds)) best = 10;
    else best = 1;
  }
  return best;
}

/**
 * 依威脅序選出 n 個可鋪空格（跳過佔格／王／既有地形／保護格）。
 * 回傳長度可 < n（空位不足時）。
 */
export function pickThreatPlacementHexes(
  board: Board,
  actors: readonly ThreatActor[],
  n: number,
  opts: PickThreatPlacementOptions = {},
): Axial[] {
  if (n <= 0) return [];
  const bounds = defaultBounds(opts.bounds);
  const occupied = opts.occupied ?? [];
  const protectedHexes = opts.protectedHexes ?? [];
  const exclude = [...(opts.exclude ?? [])];

  const out: Axial[] = [];
  // 逐格選：每次重算分數（前一格已佔入 exclude，模擬連續鋪）
  for (let i = 0; i < n; i++) {
    const candidates = listMapHexes(bounds).filter((h) => {
      if (isExcluded(h, occupied, protectedHexes, exclude)) return false;
      if (getTile(board, h) !== undefined) return false;
      return true;
    });
    if (candidates.length === 0) break;

    let best: Axial | null = null;
    let bestScore = -1;
    let bestKey = '';
    for (const h of candidates) {
      const s = scoreCandidate(board, h, actors, bounds);
      const key = hexKey(h);
      // 同分取鍵序穩定，方便測試
      if (s > bestScore || (s === bestScore && (best === null || key < bestKey))) {
        bestScore = s;
        best = h;
        bestKey = key;
      }
    }
    if (!best) break;
    out.push(best);
    exclude.push(best);
  }
  return out;
}
