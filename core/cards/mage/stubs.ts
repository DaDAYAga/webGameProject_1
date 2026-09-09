/**
 * 其餘法師牌 stub（TODO）+ 定義表。
 * 強能增幅／聚精會神／磁力屏障：僅佔位。
 * 御風／位面／魔法箭定義亦列於此供 makeMageCard。
 */

import type { CardDefinition } from '../types.js';
import type { MageCardId, MageCardInstance } from './types.js';

/** TODO: 強能增幅 ×2 — 不計次；棄 1；強化本回合下一張招。 */
export function resolveAmplifyStub(): never {
  throw new Error('TODO: resolveAmplify not implemented');
}

/** TODO: 聚精會神 ×2 — 抽 2（增幅 3）；不計次；立刻結束回合。 */
export function resolveFocusStub(): never {
  throw new Error('TODO: resolveFocus not implemented');
}

/** TODO: 磁力屏障 ×2 — 本輪王不能鋪目標鄰 1；增幅可寄出；下回合抽 −1。 */
export function resolveBarrierStub(): never {
  throw new Error('TODO: resolveBarrier not implemented');
}

/**
 * 法師牌定義表（薄標）。
 * - 御風：計次、受沉默
 * - 位面：不計次、受沉默（增幅後不受 → 結算旗標覆蓋）
 * - 魔法箭：計次、受沉默
 * - 增幅／聚精：不計次；屏障：計次？（交接未明示屏障計次 → 預設計次 utility）
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
