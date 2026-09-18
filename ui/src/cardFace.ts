/** 手牌正面標記：只顯示例外，用中文 chip。 */

import { CARD_FLAGS, type CardFlagId } from './cardHints';

export type FaceChipId = 'free' | 'waiting' | Exclude<CardFlagId, 'noMove'>;

export const FACE_CHIP_LABEL: Record<FaceChipId, string> = {
  free: '不計次',
  waiting: '等待',
  endTurn: '結束',
  sealedOnly: '封印用',
  cooldown: '冷卻',
};

export const FACE_CHIP_TITLE: Record<FaceChipId, string> = {
  free: '不佔用本回合出牌次數',
  waiting: '隊友傷王時會問要不要用，不必主動打出',
  endTurn: '使用後結束回合',
  sealedOnly: '封印中才能用',
  cooldown: '用過後下一自己回合不可再用',
};

export function faceChipsFor(card: {
  cardId: string;
  countsTowardAction?: boolean;
}): FaceChipId[] {
  if (card.cardId === 'taunt') return ['waiting'];
  const out: FaceChipId[] = [];
  if (card.countsTowardAction === false) out.push('free');
  for (const b of CARD_FLAGS[card.cardId] ?? []) {
    if (b === 'noMove') continue;
    if (!out.includes(b)) out.push(b);
  }
  return out;
}
