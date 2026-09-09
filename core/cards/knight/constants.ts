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

/** 英勇衝鋒：撞王格時對王傷害。 */
export const HEROIC_CHARGE_BOSS_HIT_DAMAGE = 2;

/** 英勇衝鋒：穿透老化牆對王傷害加總上限。 */
export const HEROIC_CHARGE_WALL_DAMAGE_CAP = 2;

/** 英勇衝鋒：有牆傷或王命中時王抽牌張數（整次僅一次）。 */
export const HEROIC_CHARGE_BOSS_DRAWS = 1;

/**
 * 嘲諷：王鋪牆限制優先級（高於磁力屏障）。
 * 衝突時取較高者；嘲諷覆蓋屏障。
 */
export const TAUNT_PRIORITY = 100;
