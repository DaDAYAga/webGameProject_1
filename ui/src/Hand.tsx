import { useEffect, useRef, useState } from 'react';
import { richTooltipFor } from './cardHints';

export type HandCard = {
  instanceId: string;
  cardId: string;
  name: string;
  wired: boolean;
  /** 計次／不計次（來自 CardDefinition）。 */
  countsTowardAction?: boolean;
  /** 受沉默旗標。 */
  silenced?: boolean;
  /** 短副作用提示。 */
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
  /** 已封印：全部牌不可打。 */
  sealed?: boolean;
};

type TipPos = { left: number; top: number };

/** 手牌列表：點一張就回傳給 App 去呼叫 core；懸停僅預覽；滿 2 秒顯示完整 tooltip。 */
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
      let left = rect.left;
      if (left + tipW > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - tipW - 8);
      }
      setTipPos({ left, top: rect.bottom + 6 });
      setRichCard(card);
    }, 2000);
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
        const countsLabel =
          card.countsTowardAction === undefined
            ? null
            : card.countsTowardAction
              ? '計次'
              : '不計次';
        const silence = card.silenced ? '受沉默' : null;
        const bits = [countsLabel, silence].filter(Boolean).join(' · ');
        const blockedBySilence = adjacentSilence && card.silenced === true;
        const isCounted = card.countsTowardAction === true;
        const blockedByAction =
          isCounted &&
          actionsLeft <= 0 &&
          !(card.cardId === 'shot' && mayBonusShot);
        const blocked = blockedBySilence || blockedByAction || sealed;
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
            <span className="name">{card.name}</span>
            {bits ? <span className="meta">{bits}</span> : null}
            {card.sideHint ? (
              <span className="side">{card.sideHint}</span>
            ) : (
              <span className="meta">
                {card.cardId}
                {card.wired ? '' : ' · 未串'}
              </span>
            )}
          </button>
        );
      })}
      {rich && tipPos ? (
        <div
          className="card-rich-tooltip"
          style={{ left: tipPos.left, top: tipPos.top }}
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
