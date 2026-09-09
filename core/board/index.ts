/**
 * 棋盤地形層（core/board）。
 * 放置／破碎／站格／推；不含包圍、回合、戰鬥。
 */

export type { TerrainKind, Tile, Board, TerrainHitResult } from './types.js';

export {
  kindCountsForEnclosure,
  kindAllowsStand,
  kindAllowsPush,
  kindAllowsCrack,
  tileDestroyDamagesBoss,
  makeTile,
} from './kinds.js';

export {
  BOSS_HEX,
  hexKey,
  parseHexKey,
  createEmptyBoard,
  createOpeningBoard,
  getTile,
  setTile,
  placeTerrain,
  crackTile,
  destroyTile,
  canStandAt,
  canPushOnto,
  canPushFrom,
  pushTerrain,
} from './board.js';
