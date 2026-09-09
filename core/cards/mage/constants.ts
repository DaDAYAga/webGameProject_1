/**
 * 法師可調數值（之後可集中抽到 balance.ts）。
 */

/** 強能增幅：魔法箭額外傷害。 */
export const AMPLIFY_ARROW_BONUS = 1;

/** 聚精會神：基礎抽牌數。 */
export const FOCUS_DRAW = 2;

/** 聚精會神：增幅後抽牌數。 */
export const FOCUS_DRAW_AMPLIFIED = 3;

/** 磁力屏障：增幅寄出時目標與法師最大距離。 */
export const BARRIER_RETARGET_MAX_DIST = 3;

/**
 * @deprecated 已廢：屏障副作用改為下一回合不可再出屏障（見 blockBarrierNextTurn）。
 * 保留符號僅防舊引用；成功路徑不再使用抽牌懲罰。
 */
export const BARRIER_NEXT_TURN_DRAW_DELTA = -1;

/**
 * 磁力屏障：成功後下一回合不可再出屏障（冷卻標記常數，語意固定為 true）。
 */
export const BARRIER_BLOCK_NEXT_TURN = true;

/**
 * 磁力屏障：王鋪牆限制優先級。
 * 低於騎士嘲諷（TAUNT_PRIORITY=100）；衝突時嘲諷覆蓋。
 */
export const BARRIER_PRIORITY = 10;
