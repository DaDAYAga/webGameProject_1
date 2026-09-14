import { useEffect, useRef, useState, type ReactNode } from 'react';
import { richTooltipFor } from './cardHints';
import {
  FACE_BADGE_TITLE,
  faceBadgesFor,
  type FaceBadgeId,
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
  /** 短副作用提示（1 秒說明仍用；牌面不再寫）。 */
  sideHint?: string;
};

type HandProps = {
  cards: HandCard[];
  onPlay: (card: HandCard) => void;
  /** 懸停預覽：進入傳牌、離開傳 null；不觸發出牌。 */
  onCardHover?: (card: HandCard | null) => void;
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

function IconSilenceImmune() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        d="M3.2 6.2h2.2L8.2 4v8L5.4 9.8H3.2V6.2z"
        fill="currentColor"
      />
      <path
        d="M10.2 5.4c.85.7 1.35 1.7 1.35 2.6s-.5 1.9-1.35 2.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M3 13.1 13 3.1"
        fill="none"
        stroke="#1a1f2a"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M3 13.1 13 3.1"
        fill="none"
        stroke="#ffd27a"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconStop() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <rect x="3.5" y="3.5" width="9" height="9" rx="1.4" fill="currentColor" />
    </svg>
  );
}

function IconNoMove() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        d="M5 3.2c.7 0 1.2.6 1.2 1.3S5.7 5.8 5 5.8 3.8 5.2 3.8 4.5 4.3 3.2 5 3.2zm6.2 0c.7 0 1.2.6 1.2 1.3s-.5 1.3-1.2 1.3-1.2-.6-1.2-1.3.5-1.3 1.2-1.3zM4.4 6.6c.9.2 1.5.8 1.8 1.5L7 10.4 5.8 11 4.6 8.6c-.2-.5-.7-.8-1.2-.9L4.4 6.6zm7.2 0 .9 1.1c-.5.1-1 .4-1.2.9L9.9 11 8.7 10.4l.8-2.3c.3-.7.9-1.3 1.8-1.5z"
        fill="currentColor"
      />
      <path
        d="M3 13.2 13 3.2"
        fill="none"
        stroke="#1a1f2a"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M3 13.2 13 3.2"
        fill="none"
        stroke="#ff8a8a"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconLock() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <rect x="3.5" y="7" width="9" height="6.2" rx="1.2" fill="currentColor" />
      <path
        d="M5.4 7V5.6a2.6 2.6 0 0 1 5.2 0V7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function IconHourglass() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        d="M4.2 2.4h7.6v1.4L8.8 7.2 11.8 10.6v2.8H4.2v-2.8L7.2 7.2 4.2 3.8V2.4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M6.2 11.6h3.6v1H6.2z" fill="currentColor" />
    </svg>
  );
}

function badgeInner(id: FaceBadgeId): ReactNode {
  if (id === 'free') return 'FREE';
  if (id === 'silenceImmune') return <IconSilenceImmune />;
  if (id === 'endTurn') return <IconStop />;
  if (id === 'noMove') return <IconNoMove />;
  if (id === 'sealedOnly') return <IconLock />;
  return <IconHourglass />;
}

/** 手牌列表：點一張就回傳給 App 去呼叫 core；懸停僅預覽；滿 1 秒顯示完整 tooltip。 */
export function Hand({
  cards,
  onPlay,
  onCardHover,
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
        const badges = faceBadgesFor(card);
        const blockedBySilence = adjacentSilence && card.silenced === true;
        const isCounted = card.countsTowardAction === true;
        const blockedByAction =
          isCounted &&
          actionsLeft <= 0 &&
          !(card.cardId === 'shot' && mayBonusShot);
        const blockedBySeal = sealed && card.cardId !== 'undying';
        const blocked = blockedBySilence || blockedByAction || blockedBySeal;
        return (
          <button
            key={card.instanceId}
            type="button"
            className={
              'card-btn' +
              (blockedBySilence ? ' silenced-blocked' : '') +
              (blockedByAction ? ' action-blocked' : '')
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
              sealed
                ? '已封印，無法打出'
                : blockedBySilence
                  ? '鄰近沉默，無法打出'
                  : blockedByAction
                    ? '本回合行動已用完'
                    : card.wired
                      ? '點擊結算'
                      : '尚未串結算'
            }
          >
            {badges.length > 0 ? (
              <span className="card-badges">
                {badges.map((id) => (
                  <span
                    key={id}
                    className={'card-badge card-badge-' + id}
                    title={FACE_BADGE_TITLE[id]}
                  >
                    {badgeInner(id)}
                  </span>
                ))}
              </span>
            ) : null}
            <span className="name">{card.name}</span>
          </button>
        );
      })}
      {rich && tipPos ? (
        <div
          className="card-rich-tooltip"
          style={{ left: tipPos.left, top: tipPos.top, transform: tipPos.place === 'up' ? 'translateY(-100%)' : undefined }}
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
