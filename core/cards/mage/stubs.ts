/**
 * 法師牌定義表 + makeMageCard。
 * 結算見各 resolve* 模組（不再拋 stub）。
 */

import type { CardDefinition } from '../types.js';
import type { MageCardId, MageCardInstance } from './types.js';

/**
 * 法師牌定義表（薄標）。
 * - 御風：計次、受沉默
 * - 位面：不計次、受沉默（增幅後不受 → 結算旗標覆蓋）
 * - 魔法箭：計次、受沉默
 * - 增幅／聚精：不計次；屏障：計次（UNRESOLVED 預設）
 */
export const MAGE_CARD_DEFS: Record<MageCardId, CardDefinition> = {
  magic_arrow: {
    id: 'magic_arrow',
    name: '魔法箭',
    countsTowardAction: true,
    silenced: true,
    kind: ['attack', 'ranged'],
  },
  amplify: {
    id: 'amplify',
    name: '強能增幅',
    countsTowardAction: false,
    silenced: true,
    kind: ['utility', 'buff'],
  },
  wind: {
    id: 'wind',
    name: '御風術',
    countsTowardAction: true,
    silenced: true,
    kind: ['utility', 'movement'],
  },
  focus: {
    id: 'focus',
    name: '聚精會神',
    countsTowardAction: false,
    silenced: true,
    kind: ['utility'],
  },
  barrier: {
    id: 'barrier',
    name: '磁力屏障',
    // UNRESOLVED: 交接未明示屏障是否計次；預設計次
    countsTowardAction: true,
    silenced: true,
    kind: ['utility'],
  },
  planar_swap: {
    id: 'planar_swap',
    name: '位面調換',
    countsTowardAction: false,
    /** 定義預設受沉默；增幅後由 resolvePlanarSwap.silenced=false 覆蓋。 */
    silenced: true,
    kind: ['ultimate', 'utility'],
  },
};

/** 建立最小法師卡牌實例（測試／牌庫 stub）。 */
export function makeMageCard(
  cardId: MageCardId,
  instanceId: string,
): MageCardInstance {
  const def = MAGE_CARD_DEFS[cardId];
  return {
    instanceId,
    cardId,
    countsTowardAction: def.countsTowardAction,
  };
}
