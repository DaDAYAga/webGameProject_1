/**
 * 卡牌結算層入口。
 * 共用薄型別 + 騎士攻擊／衝鋒 + 槍手射擊／裝填 + 法師御風／位面。
 */
export type {
  CardKindTag,
  CardDefinition,
  CardInstanceBase,
} from './types.js';

export * from './knight/index.js';
export * from './gunner/index.js';
export * from './mage/index.js';
