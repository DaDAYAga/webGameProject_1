/**
 * 共用卡牌薄型別（非 tag engine／ECS）。
 * 僅定義欄位與標籤字面量；職業結算仍各自實作。
 */

/** 卡牌種類薄標籤。 */
export type CardKindTag =
  | 'attack'
  | 'ranged'
  | 'movement'
  | 'utility'
  | 'ammo'
  | 'ultimate'
  | 'buff';

/**
 * 最小卡牌定義欄位。
 * - countsTowardAction：計次（佔用本回合出 1 張計次牌額度）
 * - silenced：受沉默旗標（鄰沉默格時由上層擋出牌；本層不結算）
 */
export type CardDefinition = {
  id: string;
  name: string;
  /** 計次。 */
  countsTowardAction: boolean;
  /** 受沉默（之後由上層處理）。 */
  silenced: boolean;
  /** 薄標籤列表。 */
  kind: readonly CardKindTag[];
};

/** 最小卡牌實例（instanceId 供手牌／棄牌追蹤）。 */
export type CardInstanceBase = {
  instanceId: string;
  cardId: string;
  /** 計次（與定義 countsTowardAction 對齊）。 */
  countsTowardAction: boolean;
};
