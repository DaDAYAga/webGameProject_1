/**
 * 騎士牌定義表 + makeKnightCard。
 * 結算見各 resolve* 模組（不再拋 stub）。
 */

import type { CardDefinition } from '../types.js';
import type { KnightCardId, KnightCardInstance } from './types.js';

/** 騎士牌定義表（共用 CardDefinition 薄標）。 */
export const KNIGHT_CARD_DEFS: Record<KnightCardId, CardDefinition> = {
  attack: {
    id: 'attack',
    name: '攻擊',
    countsTowardAction: true,
    silenced: true,
    kind: ['attack'],
  },
  heroic_charge: {
    id: 'heroic_charge',
    name: '英勇衝鋒',
    countsTowardAction: true,
    silenced: true,
    kind: ['attack', 'movement'],
  },
  faith: {
    id: 'faith',
    name: '堅定信仰',
    countsTowardAction: true,
    silenced: true,
    kind: ['utility'],
  },
  taunt: {
    id: 'taunt',
    name: '嘲諷',
    countsTowardAction: false,
    silenced: false,
    kind: ['utility'],
  },
  devotion: {
    id: 'devotion',
    name: '奉獻',
    countsTowardAction: false,
    silenced: true,
    kind: ['utility'],
  },
  undying: {
    id: 'undying',
    name: '不死存在',
    countsTowardAction: false,
    silenced: true,
    kind: ['ultimate'],
  },
};

/** 建立最小卡牌實例（測試／牌庫 stub）。 */
export function makeKnightCard(
  cardId: KnightCardId,
  instanceId: string,
): KnightCardInstance {
  const def = KNIGHT_CARD_DEFS[cardId];
  return { instanceId, cardId, counted: def.countsTowardAction };
}
