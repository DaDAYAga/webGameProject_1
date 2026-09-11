/**
 * 學習筆記：
 * 1) React 元件 = 畫面上一塊（棋盤、手牌、日誌）；狀態用 useState。
 * 2) 點牌 = 呼叫 core resolve*；attacker = 目前 unitHex。
 * 3) 點棋盤 = demo 移動：只能走到「鄰格且 canStandAt」。
 * 4) UI 不算規則：傷害／站格／棄牌皆由 core 回傳，這裡只顯示並同步 state。
 * 5) 回合殼（UI-only）：movesLeft／actionsLeft 常數可調；結束回合重置。
 *    真實 core/turn 命名空間之後再接，此處僅薄 demo 額度。
 */
import { useMemo, useState } from 'react';
import {
  EMPTY_AMMO_SLOT,
  GUNNER_CARD_DEFS,
  makeGunnerCard,
  resolveGunnerShot,
  resolveMischiefBottle,
  resolvePlayfulBottle,
  type AmmoSlotState,
  type GunnerCardId,
  type GunnerCardInstance,
} from '@core/cards/gunner/index.js';
import {
  MAGE_CARD_DEFS,
  makeMageCard,
  resolveAmplify,
  resolveMagicArrow,
  type MageCardId,
  type MageCardInstance,
} from '@core/cards/mage/index.js';
import {
  KNIGHT_CARD_DEFS,
  makeKnightCard,
  resolveKnightAttack,
  type KnightCardId,
} from '@core/cards/knight/index.js';
import {
  BOSS_HEX,
  canStandAt,
  createOpeningBoard,
  getTile,
  hexKey,
  kindAllowsCrack,
  type Board,
} from '@core/board/index.js';
import { distance, equals, neighbors, type Axial } from '@core/hex/index.js';
import { BoardCanvas } from './BoardCanvas';
import { Hand, type HandCard } from './Hand';

type DemoClass = 'gunner' | 'mage' | 'knight';

/**
 * 開場單位位置：距王 2、空格、可站。
 * (2,0) 在開場六鄰牆外，適合遠程甜區示範。
 */
const START_UNIT_HEX: Axial = { q: 2, r: 0 };

/**
 * 薄 UI 回合額度（可調常數；非 core/turn）。
 * - movesLeft：鄰格移動消耗 1
 * - actionsLeft：countsTowardAction 的成功出牌消耗 1（增幅／氣瓶不計次）
 */
const TURN_MOVES_PER_ROUND = 1;
const TURN_ACTIONS_PER_ROUND = 1;

/** 已串結算的牌種（薄 demo）。 */
const WIRED_IDS = new Set([
  'shot',
  'playful_bottle',
  'mischief_bottle',
  'magic_arrow',
  'amplify',
  'attack',
]);

function buildGunnerHand(): HandCard[] {
  // 多放幾張射擊，氣瓶才能棄射擊裝填
  const ids: GunnerCardId[] = [
    'shot',
    'shot',
    'shot',
    'playful_bottle',
    'mischief_bottle',
    'turbulence',
    'power_up',
  ];
  return ids.map((cardId, i) => {
    const inst = makeGunnerCard(cardId, `g-${i}-${cardId}`);
    const def = GUNNER_CARD_DEFS[cardId];
    return {
      instanceId: inst.instanceId,
      cardId,
      name: def.name,
      wired: WIRED_IDS.has(cardId),
    };
  });
}

function buildMageHand(): HandCard[] {
  const ids: MageCardId[] = [
    'magic_arrow',
    'magic_arrow',
    'amplify',
    'wind',
    'focus',
    'barrier',
  ];
  return ids.map((cardId, i) => {
    const inst = makeMageCard(cardId, `m-${i}-${cardId}`);
    const def = MAGE_CARD_DEFS[cardId];
    return {
      instanceId: inst.instanceId,
      cardId,
      name: def.name,
      wired: WIRED_IDS.has(cardId),
    };
  });
}

function buildKnightHand(): HandCard[] {
  const ids: KnightCardId[] = [
    'attack',
    'attack',
    'faith',
    'taunt',
    'devotion',
  ];
  return ids.map((cardId, i) => {
    const inst = makeKnightCard(cardId, `k-${i}-${cardId}`);
    const def = KNIGHT_CARD_DEFS[cardId];
    return {
      instanceId: inst.instanceId,
      cardId,
      name: def.name,
      wired: WIRED_IDS.has(cardId),
    };
  });
}

function buildHand(demo: DemoClass): HandCard[] {
  if (demo === 'gunner') return buildGunnerHand();
  if (demo === 'mage') return buildMageHand();
  return buildKnightHand();
}

function demoLabel(demo: DemoClass): string {
  if (demo === 'gunner') return '槍手 demo';
  if (demo === 'mage') return '法師 demo';
  return '騎士 demo';
}

function formatEvents(events: ReadonlyArray<{ type: string }>): string {
  if (events.length === 0) return '（無事件）';
  return events.map((e) => e.type).join(', ');
}

function describeHex(board: Board, hex: Axial): string {
  const tile = getTile(board, hex);
  if (tile) return `${tile.kind}${tile.aged ? '+aged' : ''}`;
  if (equals(hex, BOSS_HEX)) return '王格';
  return '空格';
}

/** HandCard → core 槍手實例（氣瓶／棄牌要 instanceId）。 */
function toGunnerInstances(hand: HandCard[]): GunnerCardInstance[] {
  return hand.map((c) => {
    const cardId = c.cardId as GunnerCardId;
    return {
      instanceId: c.instanceId,
      cardId,
      countsTowardAction: GUNNER_CARD_DEFS[cardId].countsTowardAction,
    };
  });
}

/** HandCard → core 法師實例（增幅不棄牌，仍要交 hand）。 */
function toMageInstances(hand: HandCard[]): MageCardInstance[] {
  return hand.map((c) => {
    const cardId = c.cardId as MageCardId;
    return {
      instanceId: c.instanceId,
      cardId,
      countsTowardAction: MAGE_CARD_DEFS[cardId].countsTowardAction,
    };
  });
}

/** 氣瓶失敗原因 → 短中文。 */
function bottleFailReason(reason: string | undefined): string {
  if (reason === 'no_shot_to_discard') return '手牌無射擊可棄';
  if (reason === 'ammo_slot_full') return '裝填槽已滿（合計最多 2）';
  return reason ?? '未知失敗';
}

/** 依職業定義表查 countsTowardAction（薄殼用；真實 turn 之後再接）。 */
function lookupCountsTowardAction(demo: DemoClass, cardId: string): boolean {
  if (demo === 'gunner') {
    const def = GUNNER_CARD_DEFS[cardId as GunnerCardId];
    return def?.countsTowardAction ?? false;
  }
  if (demo === 'mage') {
    const def = MAGE_CARD_DEFS[cardId as MageCardId];
    return def?.countsTowardAction ?? false;
  }
  const def = KNIGHT_CARD_DEFS[cardId as KnightCardId];
  return def?.countsTowardAction ?? false;
}

export function App() {
  const [demo, setDemo] = useState<DemoClass>('gunner');
  const [unitHex, setUnitHex] = useState<Axial>(START_UNIT_HEX);
  // 手牌 lift：出牌／氣瓶棄射擊會移除；切 tab 重建
  const [hand, setHand] = useState<HandCard[]>(() => buildGunnerHand());
  // 槍手裝填槽（氣瓶寫入、射擊結算清空）
  const [ammo, setAmmo] = useState<AmmoSlotState>(EMPTY_AMMO_SLOT);
  // 法師增幅：下一張招帶 amplified；薄 demo 只餵給魔法箭
  const [amplifiedPending, setAmplifiedPending] = useState(false);
  // 騎士拆牆會改盤面 → lift board
  const [board, setBoard] = useState<Board>(() => createOpeningBoard());
  const [log, setLog] = useState<string[]>([
    '薄 UI：氣瓶／增幅→箭／騎士近戰已串；薄回合殼（移動1／行動1）。點「結束回合」重置額度。',
  ]);
  const [toast, setToast] = useState('');
  // 薄回合殼：僅 UI 額度；真實 core/turn 之後再接
  const [round, setRound] = useState(1);
  const [movesLeft, setMovesLeft] = useState(TURN_MOVES_PER_ROUND);
  const [actionsLeft, setActionsLeft] = useState(TURN_ACTIONS_PER_ROUND);

  const ammoHint = useMemo(
    () => `裝填 dmg+${ammo.damageBonus} draw+${ammo.drawBonus}`,
    [ammo],
  );

  function pushLog(line: string) {
    setLog((prev) => [...prev, line]);
  }

  /** 切職業：重建手牌並清 buff／裝填（棋盤與單位保留；回合額度重置）。 */
  function switchDemo(next: DemoClass) {
    setDemo(next);
    setHand(buildHand(next));
    setAmmo(EMPTY_AMMO_SLOT);
    setAmplifiedPending(false);
    setMovesLeft(TURN_MOVES_PER_ROUND);
    setActionsLeft(TURN_ACTIONS_PER_ROUND);
    pushLog(`【切換】→ ${demoLabel(next)}（手牌重建；移動／行動額度重置）`);
    setToast(`切換 ${demoLabel(next)}`);
  }

  /**
   * 結束回合（UI-only）：重置移動／行動額度、清增幅待用、保留裝填、round++。
   * 真實老化／抽牌／敵人回合之後再接 core/turn。
   */
  function endTurn() {
    const nextRound = round + 1;
    setRound(nextRound);
    setMovesLeft(TURN_MOVES_PER_ROUND);
    setActionsLeft(TURN_ACTIONS_PER_ROUND);
    setAmplifiedPending(false);
    // 裝填保留（薄 demo：不清 ammo）
    pushLog(
      `【結束回合】→ round ${nextRound}` +
        `（移動 ${TURN_MOVES_PER_ROUND}／行動 ${TURN_ACTIONS_PER_ROUND}；增幅已清；裝填保留）`,
    );
    setToast(
      `第 ${nextRound} 回合：移動 ${TURN_MOVES_PER_ROUND} · 行動 ${TURN_ACTIONS_PER_ROUND}`,
    );
  }

  /** 成功出計次牌後扣 1 行動。 */
  function spendActionIfCounted(cardId: string) {
    if (!lookupCountsTowardAction(demo, cardId)) return;
    setActionsLeft((n) => Math.max(0, n - 1));
  }

  /** 出牌後從手牌移除（成功結算時）。 */
  function removeFromHand(...instanceIds: string[]) {
    const drop = new Set(instanceIds);
    setHand((prev) => prev.filter((c) => !drop.has(c.instanceId)));
  }

  /**
   * Demo 移動：點擊目標格。
   * - 同格：略過
   * - 非鄰格：日誌「此 demo 一次只走鄰格」
   * - 鄰格但 !canStandAt：拒絕
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

    if (movesLeft <= 0) {
      const msg = '本回合移動已用完';
      pushLog(`${base} → ${msg}（點「結束回合」重置）`);
      setToast(msg);
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
    setMovesLeft((n) => Math.max(0, n - 1));
    const left = movesLeft - 1;
    const line =
      `【移動】(${from.q},${from.r}) → (${hex.q},${hex.r})` +
      `（鄰格一步 · canStandAt OK · 剩餘移動 ${left}）`;
    pushLog(line);
    setToast(`移動到 (${hex.q},${hex.r})（剩餘移動 ${left}）`);
  }

  function onPlay(card: HandCard) {
    const attacker = unitHex;
    const counts = lookupCountsTowardAction(demo, card.cardId);

    // 計次牌且行動額度用完 → 擋（增幅／氣瓶 countsTowardAction=false 不擋）
    if (counts && actionsLeft <= 0) {
      const msg = '本回合行動已用完';
      pushLog(`【${card.name}】→ ${msg}（點「結束回合」重置）`);
      setToast(msg);
      return;
    }

    // —— 槍手：射擊（吃裝填後清槽）——
    if (card.cardId === 'shot') {
      const result = resolveGunnerShot({
        attacker,
        ammo,
      });
      setAmmo(result.ammo);
      removeFromHand(card.instanceId);
      const line =
        `【射擊】attacker=(${attacker.q},${attacker.r}) → ` +
        `bossDamage=${result.bossDamage}` +
        ` / 甜區=${result.inSweetZone ? '是' : '否'}` +
        ` / drawFromAmmo=${result.drawFromAmmo}` +
        ` / events=${formatEvents(result.events)}`;
      pushLog(line);
      spendActionIfCounted(card.cardId);
      setToast(
        `射擊：王傷 ${result.bossDamage}` +
          (result.drawFromAmmo > 0 ? `（應抽 ${result.drawFromAmmo}）` : '') +
          `（剩餘行動 ${counts ? actionsLeft - 1 : actionsLeft}）`,
      );
      return;
    }

    // —— 槍手：頑皮／胡鬧氣瓶（需棄 1 射擊）——
    if (card.cardId === 'playful_bottle' || card.cardId === 'mischief_bottle') {
      const input = { ammo, hand: toGunnerInstances(hand) };
      const result =
        card.cardId === 'playful_bottle'
          ? resolvePlayfulBottle(input)
          : resolveMischiefBottle(input);
      if (!result.ok) {
        const why = bottleFailReason(result.reason);
        pushLog(`【${card.name}】失敗：${why}`);
        setToast(`${card.name} 失敗：${why}`);
        return;
      }
      setAmmo(result.ammo);
      // core 已從 hand 棄射擊；氣瓶本身由上層移除
      removeFromHand(card.instanceId, result.discardedShotId ?? '');
      const line =
        `【${card.name}】OK → 裝填 dmg+${result.ammo.damageBonus}` +
        ` draw+${result.ammo.drawBonus}` +
        ` / 棄射擊=${result.discardedShotId}` +
        ` / events=${formatEvents(result.events)}`;
      // 氣瓶 countsTowardAction=false → 不扣 actionsLeft
      pushLog(line);
      setToast(
        `${card.name}：裝填 dmg+${result.ammo.damageBonus} draw+${result.ammo.drawBonus}` +
          '（不計次）',
      );
      return;
    }

    // —— 法師：強能增幅（不棄牌；下一招 amplified）——
    if (card.cardId === 'amplify') {
      const result = resolveAmplify({ hand: toMageInstances(hand) });
      setAmplifiedPending(result.amplifiedPending);
      removeFromHand(card.instanceId);
      // 增幅 countsTowardAction=false → 不扣 actionsLeft
      pushLog(
        `【強能增幅】armed → 下一張招 amplified` +
          ` / events=${formatEvents(result.events)}` +
          '（不計次）',
      );
      setToast('強能增幅：下一張魔法箭會吃加成（不計次）');
      return;
    }

    // —— 法師：魔法箭（吃 amplifiedPending 後清旗）——
    if (card.cardId === 'magic_arrow') {
      const usedAmp = amplifiedPending;
      const result = resolveMagicArrow({
        attacker,
        amplified: usedAmp,
      });
      setAmplifiedPending(false);
      removeFromHand(card.instanceId);
      const line =
        `【魔法箭】attacker=(${attacker.q},${attacker.r}) → ` +
        `bossDamage=${result.bossDamage}` +
        ` / 甜區=${result.inSweetZone ? '是' : '否'}` +
        ` / amplified=${result.amplified ? '是' : '否'}` +
        ` / events=${formatEvents(result.events)}`;
      pushLog(line);
      spendActionIfCounted(card.cardId);
      setToast(
        `魔法箭：王傷 ${result.bossDamage}` +
          (usedAmp ? '（已增幅）' : '') +
          `（剩餘行動 ${counts ? actionsLeft - 1 : actionsLeft}）`,
      );
      return;
    }

    // —— 騎士：攻擊（鄰王打王；否則打鄰格可拆牆）——
    if (card.cardId === 'attack') {
      let target: Axial | undefined;
      if (distance(attacker, BOSS_HEX) === 1) {
        target = BOSS_HEX;
      } else {
        // 薄 UI：自動選單位鄰格第一塊可拆牆
        target = neighbors(attacker).find((h) => {
          const tile = getTile(board, h);
          return tile !== undefined && kindAllowsCrack(tile.kind);
        });
      }
      if (!target) {
        const msg = '需鄰王，或鄰格有可拆牆';
        pushLog(
          `【攻擊】失敗：${msg}（目前 (${attacker.q},${attacker.r}) 距王 ${distance(attacker, BOSS_HEX)}）`,
        );
        setToast(`攻擊失敗：${msg}`);
        return;
      }
      const result = resolveKnightAttack({
        board,
        attacker,
        target,
      });
      if (result.board !== board) {
        setBoard(result.board);
      }
      removeFromHand(card.instanceId);
      spendActionIfCounted(card.cardId);
      const tgtDesc = equals(target, BOSS_HEX)
        ? '王'
        : `牆(${target.q},${target.r})`;
      const adjNote =
        equals(target, BOSS_HEX) && result.reason === 'not_adjacent'
          ? ' / 非鄰王→0傷'
          : '';
      const line =
        `【攻擊】→ ${tgtDesc}` +
        ` bossDamage=${result.bossDamage}` +
        ` ok=${result.ok}` +
        (result.reason ? ` reason=${result.reason}` : '') +
        adjNote +
        ` / events=${formatEvents(result.events)}`;
      pushLog(line);
      setToast(
        result.ok
          ? `攻擊 ${tgtDesc}：王傷 ${result.bossDamage}` +
            `（剩餘行動 ${counts ? actionsLeft - 1 : actionsLeft}）`
          : `攻擊失敗：${result.reason ?? '未知'}`,
      );
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
          氣瓶棄射擊裝填、增幅餵下一箭、騎士鄰王／鄰牆近戰；薄回合殼（移動／行動額度）。
          真實 core/turn 之後再接。
        </p>
      </header>

      <BoardCanvas board={board} unitHex={unitHex} onHexClick={onHexClick} />

      <div>
        <span className="tab">
          {demoLabel(demo)}
          {' · '}round {round}
          {' · '}移動 {movesLeft}/{TURN_MOVES_PER_ROUND}
          {' · '}行動 {actionsLeft}/{TURN_ACTIONS_PER_ROUND}
          {' · '}單位 ({unitHex.q},{unitHex.r})
          {demo === 'gunner' ? ` · ${ammoHint}` : ''}
          {demo === 'mage' && amplifiedPending ? ' · 增幅待用' : ''}
        </span>{' '}
        <button type="button" onClick={() => switchDemo('gunner')}>
          槍手
        </button>{' '}
        <button type="button" onClick={() => switchDemo('mage')}>
          法師
        </button>{' '}
        <button type="button" onClick={() => switchDemo('knight')}>
          騎士
        </button>{' '}
        <button type="button" onClick={endTurn}>
          結束回合
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
            log.map((line, i) => (
              <li key={`${i}-${line.slice(0, 24)}`}>{line}</li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
