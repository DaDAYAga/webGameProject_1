/**
 * 騎士可調數值（之後可集中抽到 balance.ts）。
 * 公開常數供測試／UI／調平衡直接改。
 */

/** 騎士精神：詛咒層數達此值死亡。 */
export const KNIGHT_CURSE_DEATH_STACKS = 3;

/** 堅定信仰：清除自己的詛咒層數。 */
export const FAITH_CURSE_CLEAR = 1;

/** 奉獻：自鄰 1 隊友吸收的詛咒層數。 */
export const DEVOTION_ABSORB = 1;

/** 不死存在：落地周圍影響半徑（鄰 1）。 */
export const UNDYING_LANDING_RADIUS = 1;
