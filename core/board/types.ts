/**
 * 地形與棋盤狀態型別（handoff §4 地形表）。
 * 此層只描述格上有什麼牆／特殊地，不含包圍結算與戰鬥。
 */

/** 地形種類（交接檔 kind 欄）。 */
export type TerrainKind =
  | 'plain'
  | 'plain_broken'
  | 'plain_starter'
  | 'punish'
  | 'curse'
  | 'silence';

/**
 * 單一格上的地形狀態。
 * - aged：是否已老化（僅非開場 plain 系有意義）
 * - noAge：明確永不老化（開場牆；plain_starter 破碎後沿用）
 */
export type Tile = {
  kind: TerrainKind;
  /** 是否已老化。plain_starter／noAge 應為 false。 */
  aged?: boolean;
  /** 永不老化標記；開場牆破碎後仍保留。 */
  noAge?: boolean;
};

/**
 * 棋盤：以 axial 字串鍵存有地形的格；無鍵＝空格。
 * 王佔格 (0,0) 通常不放地形，由規則禁止站入。
 */
export type Board = {
  readonly tiles: ReadonlyMap<string, Tile>;
};

/** crack／destroy 的結果摘要（供上層決定是否傷王；本層不結算 HP）。 */
export type TerrainHitResult = {
  board: Board;
  /** 是否成功把 plain／starter 打成破碎。 */
  cracked: boolean;
  /** 是否把格上清掉（第二下或強制銷毀）。 */
  destroyed: boolean;
  /**
   * 若本次銷毀依規則會傷王（已老化且非 noAge／非 starter 系）。
   * 本層只回報旗標，不扣王 HP。
   */
  damagesBoss: boolean;
  /** 失敗原因（無地形、種類不可拆等）。 */
  ok: boolean;
};
