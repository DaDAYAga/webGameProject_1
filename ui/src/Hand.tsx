export type HandCard = {
  instanceId: string;
  cardId: string;
  name: string;
  wired: boolean;
};

type HandProps = {
  cards: HandCard[];
  onPlay: (card: HandCard) => void;
};

/** 手牌列表：點一張就回傳給 App 去呼叫 core。 */
export function Hand({ cards, onPlay }: HandProps) {
  return (
    <div className="hand" role="list" aria-label="手牌">
      {cards.map((card) => (
        <button
          key={card.instanceId}
          type="button"
          className="card-btn"
          role="listitem"
          onClick={() => onPlay(card)}
          title={card.wired ? '點擊結算' : '尚未串結算'}
        >
          <span className="name">{card.name}</span>
          <span className="meta">
            {card.cardId}
            {card.wired ? ' · 可結算' : ' · 未串'}
          </span>
        </button>
      ))}
    </div>
  );
}
