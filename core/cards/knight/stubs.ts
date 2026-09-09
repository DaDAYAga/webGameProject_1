/**
 * 其餘騎士牌 stub（TODO）：僅匯出佔位，不實作結算。
 * 堅定信仰／護身／奉獻／不死存在。
 */

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

/** 建立最小卡牌實例（測試／牌庫 stub）。 */
export function makeKnightCard(
  cardId: KnightCardId,
  instanceId: string,
): KnightCardInstance {
  const counted =
    cardId === 'attack' ||
    cardId === 'shield_charge' ||
    cardId === 'faith' ||
    cardId === 'guard';
  return { instanceId, cardId, counted };
}
