/** 手牌正面標記（計次不顯示）。 */

import { CARD_FLAGS, type CardFlagId } from './cardHints';

export type FaceBadgeId =
  | 'free'
  | 'silenceImmune'
  | CardFlagId;

export const FACE_BADGE_TITLE: Record<FaceBadgeId, string> = {
  free: '不計次',
  silenceImmune: '不受沉默',
  endTurn: '使用後結束回合',
  noMove: '須尚未移動',
  sealedOnly: '封印中才能用',
  cooldown: '下回合不可再用',
};

export function faceBadgesFor(card: {
  cardId: string;
  countsTowardAction?: boolean;
  silenced?: boolean;
}): FaceBadgeId[] {
  const out: FaceBadgeId[] = [];
  if (card.countsTowardAction === false) out.push('free');
  if (card.silenced === false) out.push('silenceImmune');
  for (const b of CARD_FLAGS[card.cardId] ?? []) {
    if (!out.includes(b)) out.push(b);
  }
  return out;
}
