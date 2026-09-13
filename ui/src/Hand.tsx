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
};

/** 手牌列表：點一張就回傳給 App 去呼叫 core；懸停僅預覽。 */
export function Hand({ cards, onPlay, onCardHover }: HandProps) {
  return (
    <div className="hand" role="list" aria-label="手牌">
      {cards.map((card) => {
        const counted =
          card.countsTowardAction === undefined
            ? null
            : card.countsTowardAction
              ? '計次'
              : '不計次';
        const silence = card.silenced ? '受沉默' : null;
        const bits = [counted, silence].filter(Boolean).join(' · ');
        return (
          <button
            key={card.instanceId}
            type="button"
            className="card-btn"
            role="listitem"
            onClick={() => onPlay(card)}
            onMouseEnter={() => onCardHover?.(card)}
            onMouseLeave={() => onCardHover?.(null)}
            title={card.wired ? '點擊結算' : '尚未串結算'}
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
    </div>
  );
}
