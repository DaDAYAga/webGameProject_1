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
 * 魔王視角：先封死／瀕封，再壓遠程與接近路線，一格嚇兩人加分。
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
  const after = Math.min(6, before + 1);

  let score = 0;
  if (after >= 6) score += 10000;
  else if (after === 5) score += 8000;
  else score += after * 120;

  if (isEdgeHex(actor.hex, bounds)) score += 1800;
  if ((actor.curseStacks ?? 0) > 0) score += 400;
  else score += 700;

  if (actor.role === 'ranged') score += 900;
  else score += 220;

  if (distance(hex, BOSS_HEX) < distance(actor.hex, BOSS_HEX)) score += 700;

  if (isEdgeHex(hex, bounds)) score += 40;
  return score;
}

function scoreCandidate(
  board: Board,
  hex: Axial,
  actors: readonly ThreatActor[],
  bounds: MapBounds,
): number {
  const scores = actors.map((a) => scoreHexForActor(board, hex, a, bounds));
  const best = scores.reduce((m, s) => (s > m ? s : m), 0);
  const support = scores.reduce((s, v) => s + v, 0) - best;
  if (best === 0) {
    return isEdgeHex(hex, bounds) ? 10 : 1;
  }
  return best + support * 0.35;
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

/**
 * 將袋中 token 依 kindPriority 高→低（穩定）指派到已威脅序排好的 picks。
 * 回傳與 picks 對齊的 tokens（長度 = min(picks, bag)）與剩餘袋（原序、去掉已用）。
 */
export function assignKindsByPriority<K extends string>(
  picks: readonly Axial[],
  bag: readonly K[],
  priority: Readonly<Record<K, number>>,
): { tokens: K[]; remaining: K[] } {
  const n = Math.min(picks.length, bag.length);
  if (n <= 0) return { tokens: [], remaining: [...bag] };
  const ranked = bag.map((tok, i) => ({ tok, i }));
  ranked.sort((a, b) => {
    const pa = priority[a.tok] ?? 0;
    const pb = priority[b.tok] ?? 0;
    if (pb !== pa) return pb - pa;
    return a.i - b.i;
  });
  const chosen = ranked.slice(0, n);
  const usedIdx = new Set(chosen.map((c) => c.i));
  return {
    tokens: chosen.map((c) => c.tok),
    remaining: bag.filter((_, i) => !usedIdx.has(i)),
  };
}

