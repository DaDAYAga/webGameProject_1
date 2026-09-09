/**
 * 槍手牌定義表 + makeGunnerCard。
 * 結算見各 resolve* 模組（不再拋 stub）。
 */

import type { CardDefinition } from '../types.js';
import type { GunnerCardId, GunnerCardInstance } from './types.js';

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
