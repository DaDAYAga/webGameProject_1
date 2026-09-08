/**
 * 六角格幾何（Red Blob Games cube / axial）。
 * 僅純函式與型別，不含棋盤或 UI。
 */
export {
  type Axial,
  type Cube,
  type ShrinkingFanOptions,
  axialToCube,
  cubeToAxial,
  add,
  subtract,
  scale,
  equals,
  AXIAL_DIRECTIONS,
  neighbors,
  distance,
  shrinkingFanCells,
} from './hex.js';
