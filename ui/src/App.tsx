/**
 * 學習筆記：
 * 1) React 元件 = 畫面上一塊（手牌、日誌）；狀態用 useState。
 * 2) 點牌 = 呼叫已寫好的 core 純函式（resolveGunnerShot / resolveMagicArrow）。
 * 3) UI 不算規則：傷害／事件皆由 core 回傳，這裡只顯示文字。
 */
import { useMemo, useState } from 'react';
import {
  EMPTY_AMMO_SLOT,
  GUNNER_CARD_DEFS,
  makeGunnerCard,
  resolveGunnerShot,
} from '@core/cards/gunner/index.js';
import {
  MAGE_CARD_DEFS,
  makeMageCard,
  resolveMagicArrow,
} from '@core/cards/mage/index.js';
import { Hand, type HandCard } from './Hand';

type DemoClass = 'gunner' | 'mage';

const ATTACKER = { q: 2, r: 0 } as const;

function buildGunnerHand(): HandCard[] {
  const ids = [
    'shot',
    'playful_bottle',
    'mischief_bottle',
    'turbulence',
    'power_up',
  ] as const;
  return ids.map((cardId, i) => {
    const inst = makeGunnerCard(cardId, `g-${i}-${cardId}`);
    const def = GUNNER_CARD_DEFS[cardId];
    return {
      instanceId: inst.instanceId,
      cardId,
      name: def.name,
      wired: cardId === 'shot',
    };
  });
}

function buildMageHand(): HandCard[] {
  const ids = [
    'magic_arrow',
    'amplify',
    'wind',
    'focus',
    'barrier',
  ] as const;
  return ids.map((cardId, i) => {
    const inst = makeMageCard(cardId, `m-${i}-${cardId}`);
    const def = MAGE_CARD_DEFS[cardId];
    return {
      instanceId: inst.instanceId,
      cardId,
      name: def.name,
      wired: cardId === 'magic_arrow',
    };
  });
}

function formatEvents(events: ReadonlyArray<{ type: string }>): string {
  if (events.length === 0) return '（無事件）';
  return events.map((e) => e.type).join(', ');
}

export function App() {
  const [demo, setDemo] = useState<DemoClass>('gunner');
  const [log, setLog] = useState<string[]>([
    '薄 UI demo：點「射擊」或「魔法箭」會呼叫 core 結算；其餘牌顯示尚未串結算。',
  ]);
  const [toast, setToast] = useState('');

  const hand = useMemo(
    () => (demo === 'gunner' ? buildGunnerHand() : buildMageHand()),
    [demo],
  );

  function pushLog(line: string) {
    setLog((prev) => [...prev, line]);
  }

  function onPlay(card: HandCard) {
    if (card.cardId === 'shot') {
      const result = resolveGunnerShot({
        attacker: ATTACKER,
        ammo: EMPTY_AMMO_SLOT,
      });
      const line =
        `【射擊】attacker=(${ATTACKER.q},${ATTACKER.r}) → ` +
        `bossDamage=${result.bossDamage}` +
        ` / 甜區=${result.inSweetZone ? '是' : '否'}` +
        ` / events=${formatEvents(result.events)}`;
      pushLog(line);
      setToast(`射擊結算：王傷 ${result.bossDamage}`);
      return;
    }

    if (card.cardId === 'magic_arrow') {
      const result = resolveMagicArrow({
        attacker: ATTACKER,
      });
      const line =
        `【魔法箭】attacker=(${ATTACKER.q},${ATTACKER.r}) → ` +
        `bossDamage=${result.bossDamage}` +
        ` / 甜區=${result.inSweetZone ? '是' : '否'}` +
        ` / events=${formatEvents(result.events)}`;
      pushLog(line);
      setToast(`魔法箭結算：王傷 ${result.bossDamage}`);
      return;
    }

    const msg = '此薄 UI 尚未串結算';
    setToast(`「${card.name}」：${msg}`);
    pushLog(`【${card.name}】${msg}`);
  }

  return (
    <div className="app">
      <header>
        <h1>薄手牌 UI（core 結算 demo）</h1>
        <p className="muted">
          攻擊者固定 (2,0) 對王；無完整對局狀態。規則在 core，畫面只負責呼叫與顯示。
        </p>
      </header>

      <div>
        <span className="tab">
          {demo === 'gunner' ? '槍手 demo' : '法師 demo'}
        </span>
        {' '}
        <button type="button" onClick={() => setDemo('gunner')}>
          槍手
        </button>
        {' '}
        <button type="button" onClick={() => setDemo('mage')}>
          法師
        </button>
      </div>

      <Hand cards={hand} onPlay={onPlay} />

      <div className="toast" role="status">
        {toast}
      </div>

      <section className="log-panel" aria-label="事件日誌">
        <h2>事件日誌</h2>
        <ul className="log">
          {log.length === 0 ? (
            <li className="empty">尚無紀錄</li>
          ) : (
            log.map((line, i) => <li key={`${i}-${line.slice(0, 24)}`}>{line}</li>)
          )}
        </ul>
      </section>
    </div>
  );
}
