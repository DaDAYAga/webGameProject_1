/**
 * 包圍／封印層型別。
 * 地圖邊界為參數（radius 或自訂 isInMap），非鎖定常數。
 */

import type { Axial } from '../hex/index.js';

/**
 * 地圖範圍。
 * - radius：以 origin（預設王格 (0,0)）為心，distance <= radius 為圖內。
 * - isInMap：自訂判定（進階／非圓形圖）。
 *
 * **DEFAULT_MAP_RADIUS / radius 為 UNRESOLVED/param**，呼叫端傳入；本層不鎖定正式半徑。
 */
export type MapBounds =
  | {
      /** 參數：建議測試用 4 或 5；正式值未鎖定（UNRESOLVED/param）。 */
      radius: number;
      /** 圓心；預設 { q: 0, r: 0 }（王格）。 */
      origin?: Axial;
    }
  | {
      isInMap: (hex: Axial) => boolean;
    };

/**
 * 包圍判定可選項。
 * occupiedByPlayers：可選「有玩家站著的格」集合（hexKey）；
 * **明確不計入**包圍阻擋（單位本身不是牆）。
 */
export type EnclosureOptions = {
  /**
   * 被玩家佔用的格（hexKey 字串）。
   * 僅接受以便 API 明確忽略單位；不使該格成為 enclosure blocker。
   */
  occupiedByPlayers?: ReadonlySet<string>;
};
