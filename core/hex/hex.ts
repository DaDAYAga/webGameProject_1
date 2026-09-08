import type { Axial, Cube } from './types.js';

export type { Axial, Cube };

/**
 * 把軸向座標轉成立方座標。
 * 為什麼：許多演算法（距離、鄰居）在三軸上更簡單，s 可由 q、r 推得。
 */
export function axialToCube(h: Axial): Cube {
  const q = h.q;
  const r = h.r;
  return { q, r, s: -q - r };
}

/**
 * 把立方座標轉回軸向座標。
 * 為什麼：對外 API 與儲存多用兩軸，避免多餘欄位。
 */
export function cubeToAxial(c: Cube): Axial {
  return { q: c.q, r: c.r };
}

/**
 * 兩格相加（向量加法）。
 * 為什麼：移動、縮放方向向量時當成平面向量用。
 */
export function add(a: Axial, b: Axial): Axial {
  return { q: a.q + b.q, r: a.r + b.r };
}

/**
 * 兩格相減（a − b）。
 * 為什麼：算相對位移、對齊方向。
 */
export function subtract(a: Axial, b: Axial): Axial {
  return { q: a.q - b.q, r: a.r - b.r };
}

/**
 * 將座標向量乘上純量。
 * 為什麼：沿同一方向走多步（例如 scale(dir, 2)）。
 */
export function scale(h: Axial, k: number): Axial {
  return { q: h.q * k, r: h.r * k };
}

/**
 * 判斷兩格是否同一格。
 */
export function equals(a: Axial, b: Axial): boolean {
  return a.q === b.q && a.r === b.r;
}

/**
 * Red Blob Games 標準軸向鄰居位移表（axial DIR）。
 * 適用於 flat-top / pointy-top 的 cube/axial 系統（與 orientation 無關的鄰居表）。
 * 順序：+q, +q−r, −r, −q, −q+r, +r。
 */
export const AXIAL_DIRECTIONS: readonly Axial[] = [
  { q: +1, r: 0 },
  { q: +1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: +1 },
  { q: 0, r: +1 },
] as const;

/**
 * 回傳一格的六個相鄰格（恰好 6 個）。
 * 為什麼：移動、攻擊範圍、路徑擴展的基本一步。
 */
export function neighbors(h: Axial): Axial[] {
  return AXIAL_DIRECTIONS.map((d) => add(h, d));
}

/**
 * 兩格的立方距離（cube distance）。
 * 為什麼：六角格上「走幾步」等於此距離；相鄰為 1、同格為 0。
 */
export function distance(a: Axial, b: Axial): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  const ds = -a.q - a.r - (-b.q - b.r);
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(ds)) / 2;
}

export type ShrinkingFanOptions = {
  /** 是否把起點 `from` 算進結果。預設 false。 */
  includeOrigin?: boolean;
  /** 是否把終點 `toward` 算進結果。預設 false。 */
  includeTarget?: boolean;
};

/**
 * 縮距扇形／最短路徑廊道：所有落在 from→toward 任一最短路徑上的格子。
 *
 * 定義：格子 c 滿足 distance(from,c) + distance(c,toward) === distance(from,toward)。
 * （等價於：每一步都讓到目標的距離變短的擴展方向所涵蓋的格。）
 *
 * 預設：不含起點、不含終點（只要「兩者之間」的廊道）。
 * 同格（from === toward）：回傳 []；若 includeOrigin 則為 [from]。
 */
export function shrinkingFanCells(
  from: Axial,
  toward: Axial,
  options: ShrinkingFanOptions = {},
): Axial[] {
  const includeOrigin = options.includeOrigin ?? false;
  const includeTarget = options.includeTarget ?? false;

  if (equals(from, toward)) {
    return includeOrigin ? [{ q: from.q, r: from.r }] : [];
  }

  const n = distance(from, toward);
  const fc = axialToCube(from);
  const tc = axialToCube(toward);

  const minQ = Math.min(fc.q, tc.q);
  const maxQ = Math.max(fc.q, tc.q);
  const minR = Math.min(fc.r, tc.r);
  const maxR = Math.max(fc.r, tc.r);
  const minS = Math.min(fc.s, tc.s);
  const maxS = Math.max(fc.s, tc.s);

  const results: Axial[] = [];
  for (let q = minQ; q <= maxQ; q++) {
    for (let r = minR; r <= maxR; r++) {
      const s = -q - r;
      if (s < minS || s > maxS) continue;
      const c: Axial = { q, r };
      if (distance(from, c) + distance(c, toward) !== n) continue;
      if (!includeOrigin && equals(c, from)) continue;
      if (!includeTarget && equals(c, toward)) continue;
      results.push(c);
    }
  }
  return results;
}
