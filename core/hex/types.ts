/** 軸向座標（axial）：六角格常用的兩軸表示，第三軸 s = -q - r。 */
export type Axial = { q: number; r: number };

/** 立方座標（cube）：滿足 q + r + s = 0，距離與方向運算較直覺。 */
export type Cube = { q: number; r: number; s: number };
