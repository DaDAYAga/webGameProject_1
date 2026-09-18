import { useEffect, useRef, useState } from 'react';
import { richTooltipFor } from './cardHints';
import {
  FACE_CHIP_LABEL,
  FACE_CHIP_TITLE,
  faceChipsFor,
} from './cardFace';

export type HandCard = {
  instanceId: string;
  cardId: string;
  name: string;
  wired: boolean;
  /** 計次／不計次（來自 CardDefinition）。 */
  countsTowardAction?: boolean;
  /** 受沉默旗標。 */
  silenced?: boolean;
  /** 短副作用，寫在牌面。 */
  sideHint?: string;
};

export type HandClassId = 'knight' | 'gunner' | 'mage';

type HandProps = {
  cards: HandCard[];
  onPlay: (card: HandCard) => void;
  /** 懸停預覽：進入傳牌、離開傳 null；不觸發出牌。 */
  onCardHover?: (card: HandCard | null) => void;
  classId?: HandClassId;
  /** 棋子鄰 1 有沉默地形：silenced 牌不可打。 */
  adjacentSilence?: boolean;
  /** 剩餘行動點；0 時計次牌灰掉（大招再射除外）。 */
  actionsLeft?: number;
  /** 大招授予的免費射擊。 */
  mayBonusShot?: boolean;
  /** 已封印：全部牌不可打（不死存在除外）。 */
  sealed?: boolean;
};

type TipPos = { left: number; top: number; place: 'up' | 'down' };

const CLASS_PIP: Record<HandClassId, string> = {
  knight: '騎',
  gunner: '槍',
  mage: '法',
};

/** 手牌：直式小牌；例外才上中文 chip；短效果寫在牌面。 */
export function Hand({
  cards,
  onPlay,
  onCardHover,
  classId = 'gunner',
  adjacentSilence = false,
  actionsLeft = 99,
  mayBonusShot = false,
  sealed = false,
}: HandProps) {
  const [richCard, setRichCard] = useState<HandCard | null>(null);
  const [tipPos, setTipPos] = useState<TipPos | null>(null);
  const timerRef = useRef<number | null>(null);
  const btnRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  function clearTimer() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function hideRich() {
    clearTimer();
    setRichCard(null);
    setTipPos(null);
  }

  function onEnter(card: HandCard) {
    onCardHover?.(card);
    clearTimer();
    setRichCard(null);
    setTipPos(null);
    timerRef.current = window.setTimeout(() => {
      const el = btnRefs.current.get(card.instanceId);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const tipW = 280;
      const tipH = 170;
      let left = rect.left;
      if (left + tipW > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - tipW - 8);
      }
      const preferUp = rect.top >= tipH + 12;
      setTipPos(
        preferUp
          ? { left, top: rect.top - 8, place: 'up' }
          : { left, top: rect.bottom + 6, place: 'down' },
      );
      setRichCard(card);
    }, 1000);
  }

  function onLeave() {
    onCardHover?.(null);
    hideRich();
  }

  useEffect(() => () => clearTimer(), []);

  const rich = richCard ? richTooltipFor(richCard.cardId) : null;

  return (
    <div className="hand" role="list" aria-label="手牌">
      {cards.map((card) => {
        const chips = faceChipsFor(card);
        const blockedBySilence = adjacentSilence && card.silenced === true;
        const isCounted = card.countsTowardAction === true;
        const blockedByAction =
          isCounted &&
          actionsLeft <= 0 &&
          !(card.cardId === 'shot' && mayBonusShot);
        const blockedBySeal = sealed && card.cardId !== 'undying';
        const blocked = blockedBySilence || blockedByAction || blockedBySeal;
        const reason = blockedBySeal
          ? '封'
          : blockedBySilence
            ? '默'
            : blockedByAction
              ? '無行動'
              : null;
        return (
          <button
            key={card.instanceId}
            type="button"
            className={
              'hand-card' +
              ` hand-card-${classId}` +
              (blocked ? ' is-blocked' : ' is-ready') +
              (blockedBySilence ? ' silenced-blocked' : '') +
              (blockedByAction ? ' action-blocked' : '') +
              (blockedBySeal ? ' sealed-blocked' : '')
            }
            role="listitem"
            ref={(el) => {
              if (el) btnRefs.current.set(card.instanceId, el);
              else btnRefs.current.delete(card.instanceId);
            }}
            onClick={() => {
              if (blocked) return;
              onPlay(card);
            }}
            disabled={blocked}
            onMouseEnter={() => onEnter(card)}
            onMouseLeave={onLeave}
            title={
              sealed && card.cardId !== 'undying'
                ? '已封印，無法打出'
                : blockedBySilence
                  ? '鄰近沉默，無法打出'
                  : blockedByAction
                    ? '本回合行動已用完'
                    : card.cardId === 'taunt'
                      ? '隊友傷王時會詢問，不必主動打出'
                      : card.wired
                        ? '點擊打出'
                        : '尚未串結算'
            }
          >
            <span className="hand-card-accent" aria-hidden="true" />
            <span className="hand-card-chips">
              {chips.map((id) => (
                <span
                  key={id}
                  className={'hand-chip hand-chip-' + id}
                  title={FACE_CHIP_TITLE[id]}
                >
                  {FACE_CHIP_LABEL[id]}
                </span>
              ))}
            </span>
            <span className="hand-card-name">{card.name}</span>
            <span className="hand-card-hint">
              {card.sideHint?.trim() || ' '}
            </span>
            <span className="hand-card-foot">
              <span className="hand-card-pip">{CLASS_PIP[classId]}</span>
              {reason ? (
                <span className="hand-card-reason">{reason}</span>
              ) : null}
            </span>
          </button>
        );
      })}
      {rich && tipPos ? (
        <div
          className="card-rich-tooltip"
          style={{
            left: tipPos.left,
            top: tipPos.top,
            transform: tipPos.place === 'up' ? 'translateY(-100%)' : undefined,
          }}
          role="tooltip"
        >
          <div className="card-rich-title">{rich.title}</div>
          <div className="card-rich-meta">
            {rich.countsLabel} · {rich.silenceLabel}
          </div>
          <div className="card-rich-side">{rich.sideEffects}</div>
          <div className="card-rich-how">{rich.how}</div>
        </div>
      ) : null}
    </div>
  );
}
