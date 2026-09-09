/**
 * 其餘騎士牌 stub（TODO）：僅匯出佔位，不實作結算。
 * 堅定信仰／護身／奉獻／不死存在。
 */

import type { CardDefinition } from '../types.js';
import type { KnightCardId, KnightCardInstance } from './types.js';

/** TODO: 堅定信仰 ×2 — 清自己 1 層詛咒；出牌前本回合不可已移動；計次。 */
export function resolveFaithStub(): never {
  throw new Error('TODO: resolveFaith not implemented');
}

/** TODO: 護身 ×2 — 直線友軍；視線規則；計次。 */
export function resolveGuardStub(): never {
  throw new Error('TODO: resolveGuard not implemented');
}

/** TODO: 奉獻 ×2 — 鄰 1 吸隊友詛咒；不計次；致死則抽不死。 */
export function resolveDevotionStub(): never {
  throw new Error('TODO: resolveDevotion not implemented');
}

/** TODO: 不死存在 ×1 — 輪末復活；落點 UNRESOLVED。 */
export function resolveUndyingStub(): never {
  throw new Error('TODO: resolveUndying not implemented');
}

/** 騎士牌定義表（共用 CardDefinition 薄標）。 */
export const KNIGHT_CARD_DEFS: Record<KnightCardId, CardDefinition> = {
  attack: {
    id: 'attack',
    name: '攻擊',
    countsTowardAction: true,
    silenced: true,
    kind: ['attack'],
  },
  shield_charge: {
    id: 'shield_charge',
    name: '盾牌衝鋒',
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
  guard: {
    id: 'guard',
    name: '護身',
    countsTowardAction: true,
    silenced: true,
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
