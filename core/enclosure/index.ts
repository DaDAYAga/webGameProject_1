/**
 * 包圍／封印層（core/enclosure）。
 * 六鄰皆擋 → 封印；已封印再壓本體 → 出局。不含回合／戰鬥／UI。
 */

export type { MapBounds, EnclosureOptions } from './types.js';

export {
  DEFAULT_MAP_RADIUS,
  isInMap,
  isEnclosureBlocker,
  countBlockedNeighbors,
  isSealed,
  wouldEliminate,
  listMapHexes,
  countLegalEmptyCells,
  cannotAbsorbPlacements,
} from './enclosure.js';
