/**
 * 學習筆記：
 * 1) React 元件 = 畫面上一塊（棋盤、手牌、日誌）；狀態用 useState。
 * 2) 點牌 = 呼叫 core（resolveGunnerShot / resolveMagicArrow），attacker = 目前 unitHex。
 * 3) 點棋盤 = demo 移動：只能走到「鄰格且 canStandAt」；遠格／牆／王格寫日誌拒絕。
 *    ※ 這是教學用一步移動，不是真實 AP／路徑尋路。
 * 4) UI 不算規則：傷害／站格皆由 core 回傳或判定，這裡只顯示文字。
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
import {
  BOSS_HEX,
  canStandAt,
  createOpeningBoard,
  getTile,
  hexKey,
} from '@core/board/index.js';
import { distance, equals, type Axial } from '@core/hex/index.js';
import { BoardCanvas } from './BoardCanvas';
import { Hand, type HandCard } from './Hand';

type DemoClass = 'gunner' | 'mage';

/**
 * 開場單位位置：距王 2、空格、可站。
 * (2,0) 在開場六鄰牆外，適合遠程甜區示範。
 */
const START_UNIT_HEX: Axial = { q: 2, r: 0 };

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

function describeHex(board: ReturnType<typeof createOpeningBoard>, hex: Axial): string {
  const tile = getTile(board, hex);
  if (tile) return `${tile.kind}${tile.aged ? '+aged' : ''}`;
  if (equals(hex, BOSS_HEX)) return '王格';
  return '空格';
}

export function App() {
  const [demo, setDemo] = useState<DemoClass>('gunner');
  const [unitHex, setUnitHex] = useState<Axial>(START_UNIT_HEX);
  const [log, setLog] = useState<string[]>([
    '薄 UI demo：棋盤單位可一步走鄰格；射擊／魔法箭以目前「我」格為 attacker。',
  ]);
  const [toast, setToast] = useState('');

  // v1 棋盤靜態（開場牆不因移動改變）；之後若要拆牆再 lift 成 useState
  const board = useMemo(() => createOpeningBoard(), []);

  const hand = useMemo(
    () => (demo === 'gunner' ? buildGunnerHand() : buildMageHand()),
    [demo],
  );

  function pushLog(line: string) {
    setLog((prev) => [...prev, line]);
  }

  /**
   * Demo 移動：點擊目標格。
   * - 同格：略過
   * - 非鄰格：日誌「此 demo 一次只走鄰格」（非真實 AP／A*）
   * - 鄰格但 !canStandAt（牆／王等）：拒絕並說明
   * - 鄰格且可站：更新 unitHex
   */
  function onHexClick(hex: Axial) {
    const tileDesc = describeHex(board, hex);
    const base = `【點格】axial=(${hex.q},${hex.r}) key=${hexKey(hex)} → ${tileDesc}`;

    if (equals(hex, unitHex)) {
      pushLog(`${base}（已在此格）`);
      setToast(`單位已在 (${hex.q},${hex.r})`);
      return;
    }

    const step = distance(unitHex, hex);
    if (step !== 1) {
      const msg = '此 demo 一次只走鄰格';
      pushLog(`${base} → ${msg}（距離 ${step}；非真實 AP／路徑）`);
      setToast(msg);
      return;
    }

    if (!canStandAt(board, hex)) {
      const why = equals(hex, BOSS_HEX) ? '不可站王格' : `不可站：${tileDesc}`;
      pushLog(`${base} → 移動拒絕（${why}）`);
      setToast(`無法移動：${why}`);
      return;
    }

    const from = unitHex;
    setUnitHex(hex);
    const line =
      `【移動】(${from.q},${from.r}) → (${hex.q},${hex.r})` +
      `（鄰格一步 · canStandAt OK）`;
    pushLog(line);
    setToast(`移動到 (${hex.q},${hex.r})`);
  }

  function onPlay(card: HandCard) {
    // 出牌用目前單位格當 attacker（不再 hardcode {q:2,r:0}）
    const attacker = unitHex;

    if (card.cardId === 'shot') {
      const result = resolveGunnerShot({
        attacker,
        ammo: EMPTY_AMMO_SLOT,
      });
      const line =
        `【射擊】attacker=(${attacker.q},${attacker.r}) → ` +
        `bossDamage=${result.bossDamage}` +
        ` / 甜區=${result.inSweetZone ? '是' : '否'}` +
        ` / events=${formatEvents(result.events)}`;
      pushLog(line);
      setToast(`射擊結算：王傷 ${result.bossDamage}（自 (${attacker.q},${attacker.r})）`);
      return;
    }

    if (card.cardId === 'magic_arrow') {
      const result = resolveMagicArrow({
        attacker,
      });
      const line =
        `【魔法箭】attacker=(${attacker.q},${attacker.r}) → ` +
        `bossDamage=${result.bossDamage}` +
        ` / 甜區=${result.inSweetZone ? '是' : '否'}` +
        ` / events=${formatEvents(result.events)}`;
      pushLog(line);
      setToast(`魔法箭結算：王傷 ${result.bossDamage}（自 (${attacker.q},${attacker.r})）`);
      return;
    }

    const msg = '此薄 UI 尚未串結算';
    setToast(`「${card.name}」：${msg}`);
    pushLog(`【${card.name}】${msg}`);
  }

  return (
    <div className="app">
      <header>
        <h1>薄 UI（棋盤移動 + 手牌 demo）</h1>
        <p className="muted">
          點鄰格移動單位（牆／王格拒絕）；射擊／魔法箭以「我」格為 attacker。尚無完整對局 loop。
        </p>
      </header>

      <BoardCanvas board={board} unitHex={unitHex} onHexClick={onHexClick} />

      <div>
        <span className="tab">
          {demo === 'gunner' ? '槍手 demo' : '法師 demo'}
          {' · '}單位 ({unitHex.q},{unitHex.r})
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
