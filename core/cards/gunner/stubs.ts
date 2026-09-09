/**
 * 其餘槍手牌 stub（TODO）：僅匯出佔位，不實作結算。
 * 大亂流／Power UP!!／來吧! 大鬧一場!
 */

import type { CardDefinition } from '../types.js';
import type { GunnerCardId, GunnerCardInstance } from './types.js';

/** TODO: 大亂流 ×2 — 棄手上最多 2 張氣瓶牌 → 走棄牌數 + 1。 */
export function resolveTurbulenceStub(): never {
  throw new Error('TODO: resolveTurbulence not implemented');
}

/** TODO: Power UP!! ×2 — 移動後可出；檢 2 射擊或當臨時射擊（吃裝填清槽）。 */
export function resolvePowerUpStub(): never {
  throw new Error('TODO: resolvePowerUp not implemented');
}

/** TODO: 來吧! 大鬧一場! ×1 — 出牌前不可移動；抽 3；非射擊可立刻用；再可打 1 射擊。 */
export function resolveBigShowStub(): never {
  throw new Error('TODO: resolveBigShow not implemented');
}

/** 槍手牌定義表（薄標；氣瓶計次：UNRESOLVED 預設不計次）。 */
export const GUNNER_CARD_DEFS: Record<GunnerCardId, CardDefinition> = {
  shot: {
    id: 'shot',
    name: '射擊',
    countsTowardAction: true,
    silenced: true,
    kind: ['attack', 'ranged'],
  },
  playful_bottle: {
    id: 'playful_bottle',
    name: '頑皮氣瓶',
    countsTowardAction: false,
    silenced: true,
    kind: ['utility', 'ammo'],
  },
  mischief_bottle: {
    id: 'mischief_bottle',
    name: '胡鬧氣瓶',
    countsTowardAction: false,
    silenced: true,
    kind: ['utility', 'ammo'],
  },
  turbulence: {
    id: 'turbulence',
    name: '大亂流',
    countsTowardAction: true,
    silenced: true,
    kind: ['movement'],
  },
  power_up: {
    id: 'power_up',
    name: 'Power UP!!',
    countsTowardAction: true,
    silenced: true,
    kind: ['utility', 'buff'],
  },
  big_show: {
    id: 'big_show',
    name: '來吧! 大鬧一場!',
    countsTowardAction: true,
    silenced: true,
    kind: ['ultimate'],
  },
};

/** 建立最小槍手卡牌實例（測試／牌庫 stub）。 */
export function makeGunnerCard(
  cardId: GunnerCardId,
  instanceId: string,
): GunnerCardInstance {
  const def = GUNNER_CARD_DEFS[cardId];
  return {
    instanceId,
    cardId,
    countsTowardAction: def.countsTowardAction,
  };
}
