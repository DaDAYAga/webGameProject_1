/**
 * 學習筆記（移動／佔格／懸停路徑）：
 * 1) occupied：盟友格不進 Board.tiles；走路用 shortestPath(..., { occupied:[ally] })，自身不擋自己。
 * 2) hoverPath：與 tryMoveTo 同一套路徑／步數上限；有 pendingPlay 時不顯示走路預覽。
 * 3) pendingPlay：出牌指定模式點格完成牌目標（不走移動）；取消鈕可清。
 * 4) moveLocked 仍擋「開始出牌」；大亂流／英勇衝鋒須走完或未鎖時再出。
 * 5) UI 不算規則：路徑／推動／衝鋒／裝填皆由 core 回傳，這裡只同步 state。
 */
import { useMemo, useState } from 'react';
import {
  EMPTY_AMMO_SLOT,
  GUNNER_CARD_DEFS,
  makeGunnerCard,
  resolveBigShow,
  resolveGunnerShot,
  resolveMischiefBottle,
  resolvePlayfulBottle,
  resolvePowerUp,
  resolveTurbulence,
  TURBULENCE_MAX_BOTTLE_DISCARD,
  TURBULENCE_MOVE_BASE,
  type AmmoSlotState,
  type GunnerCardId,
  type GunnerCardInstance,
} from '@core/cards/gunner/index.js';
import {
  MAGE_CARD_DEFS,
  makeMageCard,
  resolveAmplify,
  resolveBarrier,
  resolveFocus,
  resolveMagicArrow,
  resolvePlanarSwap,
  resolveWindControl,
  type BarrierAura,
  type MageCardId,
  type MageCardInstance,
} from '@core/cards/mage/index.js';
import {
  KNIGHT_CARD_DEFS,
  makeKnightCard,
  resolveDevotion,
  resolveFaith,
  resolveHeroicCharge,
  resolveKnightAttack,
  resolveTaunt,
  resolveUndying,
  type BossPlaceRestriction,
  type KnightCardId,
} from '@core/cards/knight/index.js';
import {
  BOSS_HEX,
  canStandAt,
  createDemoBoard,
  getTile,
  hexKey,
  kindAllowsCrack,
  shortestPath,
  type Board,
} from '@core/board/index.js';
import {
  AXIAL_DIRECTIONS,
  add,
  distance,
  equals,
  neighbors,
  subtract,
  type Axial,
} from '@core/hex/index.js';
import { BoardCanvas } from './BoardCanvas';
import { Hand, type HandCard } from './Hand';

type DemoClass = 'gunner' | 'mage' | 'knight';

/** 開場單位：距王 2、空格。 */
const START_UNIT_HEX: Axial = { q: 2, r: 0 };
/** 薄 demo 隊友：鄰單位，供奉獻／位面。 */
const START_ALLY_HEX: Axial = { q: 3, r: -1 };

const TURN_MOVES_PER_ROUND = 2;
const TURN_ACTIONS_PER_ROUND = 1;

/** 已串結算的牌種（薄 demo）。 */
const WIRED_IDS = new Set([
  'shot',
  'playful_bottle',
  'mischief_bottle',
  'turbulence',
  'power_up',
  'big_show',
  'magic_arrow',
  'amplify',
  'wind',
  'focus',
  'barrier',
  'planar_swap',
  'attack',
  'faith',
  'heroic_charge',
  'devotion',
  'taunt',
  'undying',
]);

/** UI-only 指定模式（2026-09-13j）：點格完成牌，不走移動。 */
type PendingPlay =
  | {
      kind: 'turbulence';
      card: HandCard;
      discardBottleIds: string[];
      steps: number;
    }
  | { kind: 'wind_from'; card: HandCard }
  | { kind: 'wind_to'; card: HandCard; from: Axial }
  | { kind: 'heroic_charge'; card: HandCard }
  | { kind: 'undying'; card: HandCard }
  | { kind: 'devotion'; card: HandCard };

function buildGunnerHand(): HandCard[] {
  const ids: GunnerCardId[] = [
    'shot',
    'shot',
    'shot',
    'playful_bottle',
    'mischief_bottle',
    'turbulence',
    'power_up',
    'big_show',
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
    'planar_swap',
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
    'heroic_charge',
    'taunt',
    'devotion',
    'undying',
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

function bottleFailReason(reason: string | undefined): string {
  if (reason === 'no_shot_to_discard') return '手牌無射擊可棄';
  if (reason === 'ammo_slot_full') return '裝填槽已滿（合計最多 2）';
  return reason ?? '未知失敗';
}

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

/** 鄰格可站？含盟友佔格阻擋（解鎖「無法續走」用）。 */
function hasStandableNeighbor(
  board: Board,
  hex: Axial,
  occupied: readonly Axial[],
): boolean {
  return neighbors(hex).some((n) => canStandAt(board, n, { occupied }));
}

/** 走路／預覽共用：其他單位佔格（不含自己）。 */
function walkOccupied(allyHex: Axial): Axial[] {
  return [allyHex];
}

/** 從 from 往 toward 是否在軸向直線；是則回傳單位方向。 */
function axialDirectionToward(from: Axial, toward: Axial): Axial | null {
  if (equals(from, toward)) return null;
  for (const dir of AXIAL_DIRECTIONS) {
    let cur = from;
    for (let i = 0; i < 24; i++) {
      cur = add(cur, dir);
      if (equals(cur, toward)) return dir;
    }
  }
  return null;
}

function pendingHint(p: PendingPlay | null): string {
  if (!p) return '';
  if (p.kind === 'turbulence') {
    return `指定大亂流終點（須恰好 ${p.steps} 步；已選棄氣瓶 ${p.discardBottleIds.length}）`;
  }
  if (p.kind === 'wind_from') return '指定要推動的地形格';
  if (p.kind === 'wind_to') {
    return `指定推動方向：點 (${p.from.q},${p.from.r}) 的鄰格`;
  }
  if (p.kind === 'heroic_charge') return '指定衝鋒方向：點直線上任一格（或鄰格）';
  if (p.kind === 'undying') return '指定復活落點（可站格）';
  if (p.kind === 'devotion') return '指定鄰 1 隊友格（吸咒）';
  return '';
}

export function App() {
  const [demo, setDemo] = useState<DemoClass>('gunner');
  const [unitHex, setUnitHex] = useState<Axial>(START_UNIT_HEX);
  const [allyHex, setAllyHex] = useState<Axial>(START_ALLY_HEX);
  const [hand, setHand] = useState<HandCard[]>(() => buildGunnerHand());
  const [ammo, setAmmo] = useState<AmmoSlotState>(EMPTY_AMMO_SLOT);
  const [amplifiedPending, setAmplifiedPending] = useState(false);
  const [board, setBoard] = useState<Board>(() => createDemoBoard());
  const [log, setLog] = useState<string[]>([
    '薄 UI：剩餘職業牌已串；指定模式點格完成目標（非移動）。移動鎖仍擋開始出牌。',
  ]);
  const [toast, setToast] = useState('');
  const [round, setRound] = useState(1);
  const [movesLeft, setMovesLeft] = useState(TURN_MOVES_PER_ROUND);
  const [actionsLeft, setActionsLeft] = useState(TURN_ACTIONS_PER_ROUND);
  const [moveLocked, setMoveLocked] = useState(false);
  const mustFinishMove = moveLocked;
  /** 本回合是否已移動（走路／大亂流／衝鋒）；信仰／大招用。 */
  const [hasMovedThisTurn, setHasMovedThisTurn] = useState(false);
  /** 大招授旗：下一張手上射擊 ignoreRange 且不另扣行動。 */
  const [mayPlayShotIgnoreRange, setMayPlayShotIgnoreRange] = useState(false);
  const [pendingPlay, setPendingPlay] = useState<PendingPlay | null>(null);
  /** 滑鼠懸停格；App 算與 tryMoveTo 相同的走路路徑預覽。 */
  const [hoverHex, setHoverHex] = useState<Axial | null>(null);
  /** 法師屏障光環 stub（僅日誌／狀態列）。 */
  const [barrierAura, setBarrierAura] = useState<BarrierAura | null>(null);
  /** 騎士詛咒層（信仰／奉獻 demo）。 */
  const [curseStacks, setCurseStacks] = useState(2);
  const [allyCurseStacks, setAllyCurseStacks] = useState(1);
  /** 嘲諷：他人回合開關。 */
  const [isOthersTurn, setIsOthersTurn] = useState(false);
  const [tauntRestriction, setTauntRestriction] =
    useState<BossPlaceRestriction | null>(null);
  /** 不死存在 demo 旗。 */
  const [isDead, setIsDead] = useState(false);
  const [atRoundEndAfterActors, setAtRoundEndAfterActors] = useState(false);

  const ammoHint = useMemo(
    () => `裝填 dmg+${ammo.damageBonus} draw+${ammo.drawBonus}`,
    [ammo],
  );

  /** 與 tryMoveTo 同一套規則：有路徑且步數 ≤ movesLeft 與回合上限才高亮。 */
  const hoverPath = useMemo(() => {
    if (!hoverHex || pendingPlay) return null;
    if (equals(hoverHex, unitHex)) return null;
    if (movesLeft <= 0) return null;
    const occupied = walkOccupied(allyHex);
    const path = shortestPath(board, unitHex, hoverHex, { occupied });
    if (path === null) return null;
    const steps = path.length - 1;
    if (steps < 1) return null;
    if (steps > TURN_MOVES_PER_ROUND || steps > movesLeft) return null;
    return path;
  }, [allyHex, board, hoverHex, movesLeft, pendingPlay, unitHex]);

  function pushLog(line: string) {
    setLog((prev) => [...prev, line]);
  }

  function clearPending(note?: string) {
    setPendingPlay(null);
    if (note) {
      pushLog(note);
      setToast(note);
    }
  }

  function switchDemo(next: DemoClass) {
    setDemo(next);
    setHand(buildHand(next));
    setAmmo(EMPTY_AMMO_SLOT);
    setAmplifiedPending(false);
    setMovesLeft(TURN_MOVES_PER_ROUND);
    setActionsLeft(TURN_ACTIONS_PER_ROUND);
    setMoveLocked(false);
    setHasMovedThisTurn(false);
    setMayPlayShotIgnoreRange(false);
    setPendingPlay(null);
    setBarrierAura(null);
    setTauntRestriction(null);
    setCurseStacks(2);
    setAllyCurseStacks(1);
    setIsOthersTurn(false);
    setIsDead(false);
    setAtRoundEndAfterActors(false);
    setAllyHex(START_ALLY_HEX);
    pushLog(`【切換】→ ${demoLabel(next)}（手牌重建；額度／鎖／指定清除）`);
    setToast(`切換 ${demoLabel(next)}`);
  }

  function endTurn(reason = '玩家結束') {
    const nextRound = round + 1;
    setRound(nextRound);
    setMovesLeft(TURN_MOVES_PER_ROUND);
    setActionsLeft(TURN_ACTIONS_PER_ROUND);
    setMoveLocked(false);
    setHasMovedThisTurn(false);
    setAmplifiedPending(false);
    setMayPlayShotIgnoreRange(false);
    setPendingPlay(null);
    setBarrierAura(null);
    setTauntRestriction(null);
    setAtRoundEndAfterActors(false);
    pushLog(
      `【結束回合】${reason} → round ${nextRound}` +
        `（移動 ${TURN_MOVES_PER_ROUND}／行動 ${TURN_ACTIONS_PER_ROUND}；鎖／增幅／大招旗／屏障光環清除）`,
    );
    setToast(
      `第 ${nextRound} 回合：移動 ${TURN_MOVES_PER_ROUND} · 行動 ${TURN_ACTIONS_PER_ROUND}`,
    );
  }

  function spendActionIfCounted(cardId: string) {
    if (!lookupCountsTowardAction(demo, cardId)) return;
    setActionsLeft((n) => Math.max(0, n - 1));
  }

  function removeFromHand(...instanceIds: string[]) {
    const drop = new Set(instanceIds.filter(Boolean));
    setHand((prev) => prev.filter((c) => !drop.has(c.instanceId)));
  }

  /** 走路移動（無 pending 時）。 */
  function tryMoveTo(hex: Axial) {
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

    const occupied = walkOccupied(allyHex);
    const path = shortestPath(board, unitHex, hex, { occupied });
    if (path === null) {
      const why = equals(hex, BOSS_HEX)
        ? '不可站王格'
        : equals(hex, allyHex)
          ? '不可站隊友格'
          : `不可達或不可站：${tileDesc}`;
      pushLog(`${base} → 移動拒絕（${why}）`);
      setToast(`無法移動：${why}`);
      return;
    }

    const steps = path.length - 1;
    if (steps > TURN_MOVES_PER_ROUND) {
      const msg = `路徑 ${steps} 步，超過本回合上限 ${TURN_MOVES_PER_ROUND}`;
      pushLog(`${base} → ${msg}`);
      setToast(msg);
      return;
    }
    if (steps > movesLeft) {
      const msg = `路徑 ${steps} 步，剩餘移動僅 ${movesLeft}`;
      pushLog(`${base} → ${msg}`);
      setToast(msg);
      return;
    }
    if (steps < 1) {
      pushLog(`${base}（已在此格）`);
      setToast(`單位已在 (${hex.q},${hex.r})`);
      return;
    }

    const from = unitHex;
    const dest = path[path.length - 1]!;
    setUnitHex(dest);
    setHasMovedThisTurn(true);
    const left = movesLeft - steps;
    setMovesLeft(left);

    let nextLocked = true;
    let stuckUnlock = false;
    if (left <= 0) {
      nextLocked = false;
    } else if (!hasStandableNeighbor(board, dest, occupied)) {
      nextLocked = false;
      stuckUnlock = true;
    }
    setMoveLocked(nextLocked);

    const via =
      steps === 2
        ? `經 (${path[1]!.q},${path[1]!.r}) 兩步一次套用`
        : '一步';
    const lockNote = nextLocked
      ? ' · 移動鎖定中（須走完才可出牌）'
      : stuckUnlock
        ? ''
        : ' · 移動完成，可出牌';
    pushLog(
      `【移動】(${from.q},${from.r}) → (${dest.q},${dest.r})` +
        `（${via} · 剩餘移動 ${left}${lockNote}）`,
    );
    if (stuckUnlock) pushLog('無法續走，解鎖出牌');
    setToast(
      stuckUnlock
        ? `移動到 (${dest.q},${dest.r})；無法續走，解鎖出牌`
        : `移動到 (${dest.q},${dest.r})（剩餘移動 ${left}` +
            (nextLocked ? '；鎖定出牌' : '；可出牌') +
            '）',
    );
  }

  function completeTurbulence(hex: Axial, pending: Extract<PendingPlay, { kind: 'turbulence' }>) {
    const occupied = walkOccupied(allyHex);
    const full = shortestPath(board, unitHex, hex, { occupied });
    if (full === null) {
      pushLog(`【大亂流】目標不可達／不可站 (${hex.q},${hex.r})`);
      setToast('大亂流：目標不可達');
      return;
    }
    const pathWithoutStart = full.slice(1);
    if (pathWithoutStart.length !== pending.steps) {
      const msg = `路徑 ${pathWithoutStart.length} 步，須恰好 ${pending.steps} 步`;
      pushLog(`【大亂流】${msg}`);
      setToast(msg);
      return;
    }
    const result = resolveTurbulence({
      board,
      actorPosition: unitHex,
      hand: toGunnerInstances(hand),
      discardBottleInstanceIds: pending.discardBottleIds,
      path: pathWithoutStart,
      occupiedHexes: occupied,
    });
    if (!result.ok) {
      pushLog(`【大亂流】失敗：${result.reason}`);
      setToast(`大亂流失敗：${result.reason}`);
      return;
    }
    setUnitHex(result.actorPosition);
    setHasMovedThisTurn(true);
    removeFromHand(pending.card.instanceId, ...result.discardedBottleIds);
    spendActionIfCounted('turbulence');
    setPendingPlay(null);
    // 大亂流不算走路額度；不改 movesLeft／moveLocked（仍擋於鎖中開始）
    pushLog(
      `【大亂流】→ (${result.actorPosition.q},${result.actorPosition.r})` +
        ` steps=${result.steps} 棄氣瓶=${result.discardedBottleIds.join(',') || '無'}` +
        ` / events=${formatEvents(result.events)}`,
    );
    setToast(`大亂流：落到 (${result.actorPosition.q},${result.actorPosition.r})`);
  }

  function completeWindFrom(hex: Axial, card: HandCard) {
    const tile = getTile(board, hex);
    if (!tile) {
      pushLog(`【御風術】(${hex.q},${hex.r}) 無地形可推`);
      setToast('請點有地形的格');
      return;
    }
    setPendingPlay({ kind: 'wind_to', card, from: hex });
    pushLog(`【御風術】來源 (${hex.q},${hex.r}) ${tile.kind} → 請點鄰格決定方向`);
    setToast(`來源 (${hex.q},${hex.r})：點鄰格當方向`);
  }

  function completeWindTo(hex: Axial, card: HandCard, from: Axial) {
    if (distance(from, hex) !== 1) {
      pushLog(`【御風術】方向須為來源鄰格（點了 (${hex.q},${hex.r})）`);
      setToast('請點來源的鄰格');
      return;
    }
    const direction = subtract(hex, from);
    const usedAmp = amplifiedPending;
    const result = resolveWindControl({
      board,
      from,
      direction,
      amplified: usedAmp,
      actors: [
        { id: 'self', hex: unitHex },
        { id: 'ally', hex: allyHex },
      ],
    });
    if (!result.ok) {
      pushLog(`【御風術】失敗：${result.reason}`);
      setToast(`御風失敗：${result.reason}`);
      return;
    }
    setBoard(result.board);
    setAmplifiedPending(false);
    removeFromHand(card.instanceId);
    spendActionIfCounted('wind');
    setPendingPlay(null);
    pushLog(
      `【御風術】(${from.q},${from.r}) → (${result.finalHex?.q},${result.finalHex?.r})` +
        ` steps=${result.stepsMoved}` +
        (usedAmp ? '（增幅）' : '') +
        ` / events=${formatEvents(result.events)}`,
    );
    setToast(
      `御風：推到 (${result.finalHex?.q},${result.finalHex?.r})` +
        (usedAmp ? '（增幅 2 步）' : ''),
    );
  }

  function completeHeroicCharge(hex: Axial, card: HandCard) {
    const dir = axialDirectionToward(unitHex, hex);
    if (!dir) {
      pushLog(`【英勇衝鋒】(${hex.q},${hex.r}) 不在單位軸向直線上`);
      setToast('請點直線上的格（或鄰格）');
      return;
    }
    // 薄 demo：不傳 units，避免撞隊友落地複雜度；直線衝到邊／硬停
    const final = resolveHeroicCharge({
      board,
      actorPosition: unitHex,
      direction: dir,
    });
    if (!final.ok) {
      pushLog(`【英勇衝鋒】失敗：${final.reason}`);
      setToast(`衝鋒失敗：${final.reason}`);
      setPendingPlay(null);
      if (final.forceEndTurn) endTurn('英勇衝鋒失敗強制結束');
      return;
    }
    setBoard(final.board);
    setUnitHex(final.actorPosition);
    setHasMovedThisTurn(true);
    removeFromHand(card.instanceId);
    spendActionIfCounted('heroic_charge');
    setPendingPlay(null);
    pushLog(
      `【英勇衝鋒】→ (${final.actorPosition.q},${final.actorPosition.r})` +
        ` bossDamage=${final.bossDamage} hitBoss=${final.hitBoss}` +
        ` / events=${formatEvents(final.events)}`,
    );
    setToast(`衝鋒至 (${final.actorPosition.q},${final.actorPosition.r})`);
    if (final.forceEndTurn) endTurn('英勇衝鋒強制結束');
  }

  function completeUndying(hex: Axial, card: HandCard) {
    const result = resolveUndying({
      board,
      landingHex: hex,
      isDead,
      hasUndyingInHand: hand.some((c) => c.cardId === 'undying'),
      atRoundEndAfterActors,
    });
    if (!result.ok) {
      pushLog(`【不死存在】失敗：${result.reason}`);
      setToast(`不死失敗：${result.reason}`);
      return;
    }
    setBoard(result.board);
    setUnitHex(result.actorPosition!);
    setIsDead(false);
    removeFromHand(card.instanceId);
    setPendingPlay(null);
    pushLog(
      `【不死存在】復活於 (${result.actorPosition!.q},${result.actorPosition!.r})` +
        ` / events=${formatEvents(result.events)}`,
    );
    setToast(`復活於 (${result.actorPosition!.q},${result.actorPosition!.r})`);
    if (result.forceEndTurn) endTurn('不死存在強制結束');
  }

  function completeDevotion(hex: Axial, card: HandCard) {
    if (!equals(hex, allyHex)) {
      pushLog(`【奉獻】請點隊友格 (${allyHex.q},${allyHex.r})`);
      setToast('請點隊友標記格');
      return;
    }
    const result = resolveDevotion({
      actorHex: unitHex,
      allyHex,
      selfCurseStacks: curseStacks,
      allyCurseStacks,
    });
    if (!result.ok) {
      pushLog(`【奉獻】失敗：${result.reason}`);
      setToast(`奉獻失敗：${result.reason}`);
      setPendingPlay(null);
      return;
    }
    setCurseStacks(result.selfCurseStacks);
    setAllyCurseStacks(result.allyCurseStacks);
    removeFromHand(card.instanceId);
    setPendingPlay(null);
    pushLog(
      `【奉獻】自己咒 ${result.selfCurseStacks}／隊友 ${result.allyCurseStacks}` +
        (result.extractedUndying ? ' · 抽出不死' : '') +
        ` / events=${formatEvents(result.events)}`,
    );
    setToast(
      `奉獻：自己咒 ${result.selfCurseStacks}` +
        (result.extractedUndying ? '（抽出不死）' : ''),
    );
  }

  function onHexClick(hex: Axial) {
    // 指定模式優先：完成牌目標，不走移動
    if (pendingPlay) {
      if (pendingPlay.kind === 'turbulence') {
        completeTurbulence(hex, pendingPlay);
        return;
      }
      if (pendingPlay.kind === 'wind_from') {
        completeWindFrom(hex, pendingPlay.card);
        return;
      }
      if (pendingPlay.kind === 'wind_to') {
        completeWindTo(hex, pendingPlay.card, pendingPlay.from);
        return;
      }
      if (pendingPlay.kind === 'heroic_charge') {
        completeHeroicCharge(hex, pendingPlay.card);
        return;
      }
      if (pendingPlay.kind === 'undying') {
        completeUndying(hex, pendingPlay.card);
        return;
      }
      if (pendingPlay.kind === 'devotion') {
        completeDevotion(hex, pendingPlay.card);
        return;
      }
    }
    tryMoveTo(hex);
  }

  function onPlay(card: HandCard) {
    const attacker = unitHex;
    const counts = lookupCountsTowardAction(demo, card.cardId);
    const bonusShot =
      card.cardId === 'shot' && mayPlayShotIgnoreRange === true;

    if (pendingPlay) {
      pushLog(`【${card.name}】請先完成或取消目前指定（${pendingPlay.kind}）`);
      setToast('請先完成／取消指定');
      return;
    }

    if (mustFinishMove) {
      const msg = '移動中，請先走完再出牌';
      pushLog(`【${card.name}】→ ${msg}（剩餘移動 ${movesLeft}）`);
      setToast(msg);
      return;
    }

    // 大招後續射擊不另扣行動額度
    if (counts && actionsLeft <= 0 && !bonusShot) {
      const msg = '本回合行動已用完';
      pushLog(`【${card.name}】→ ${msg}（點「結束回合」重置）`);
      setToast(msg);
      return;
    }

    // —— 槍手：射擊 ——
    if (card.cardId === 'shot') {
      const result = resolveGunnerShot({
        attacker,
        ammo,
        ignoreRangePenalty: bonusShot,
      });
      setAmmo(result.ammo);
      removeFromHand(card.instanceId);
      if (bonusShot) {
        setMayPlayShotIgnoreRange(false);
      } else {
        spendActionIfCounted(card.cardId);
      }
      const line =
        `【射擊】attacker=(${attacker.q},${attacker.r}) → ` +
        `bossDamage=${result.bossDamage}` +
        ` / 甜區=${result.inSweetZone ? '是' : '否'}` +
        (bonusShot ? ' / 大招 ignoreRange' : '') +
        ` / drawFromAmmo=${result.drawFromAmmo}` +
        ` / events=${formatEvents(result.events)}`;
      pushLog(line);
      setToast(
        `射擊：王傷 ${result.bossDamage}` +
          (bonusShot ? '（大招免費射）' : '') +
          (result.drawFromAmmo > 0 ? `（應抽 ${result.drawFromAmmo}）` : ''),
      );
      return;
    }

    // —— 氣瓶 ——
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
      removeFromHand(card.instanceId, result.discardedShotId ?? '');
      pushLog(
        `【${card.name}】OK → 裝填 dmg+${result.ammo.damageBonus}` +
          ` draw+${result.ammo.drawBonus}` +
          ` / 棄射擊=${result.discardedShotId}` +
          ` / events=${formatEvents(result.events)}`,
      );
      setToast(
        `${card.name}：裝填 dmg+${result.ammo.damageBonus} draw+${result.ammo.drawBonus}` +
          '（不計次）',
      );
      return;
    }

    // —— 大亂流：進指定終點 ——
    if (card.cardId === 'turbulence') {
      const bottles = hand.filter(
        (c) =>
          c.instanceId !== card.instanceId &&
          (c.cardId === 'playful_bottle' || c.cardId === 'mischief_bottle'),
      );
      const discardBottleIds = bottles
        .slice(0, TURBULENCE_MAX_BOTTLE_DISCARD)
        .map((c) => c.instanceId);
      const steps = discardBottleIds.length + TURBULENCE_MOVE_BASE;
      setPendingPlay({ kind: 'turbulence', card, discardBottleIds, steps });
      pushLog(
        `【大亂流】進入指定：將棄氣瓶 ${discardBottleIds.length} 張 → 須走 ${steps} 步；點終點格`,
      );
      setToast(`大亂流：點恰好 ${steps} 步的終點`);
      return;
    }

    // —— Power UP!!：薄 demo 固定 temp_shot ——
    if (card.cardId === 'power_up') {
      const result = resolvePowerUp({
        mode: 'temp_shot',
        attacker,
        ammo,
      });
      if (!result.ok) {
        pushLog(`【Power UP!!】失敗：${result.reason}`);
        setToast(`Power UP 失敗：${result.reason}`);
        return;
      }
      if (result.ammo) setAmmo(result.ammo);
      removeFromHand(card.instanceId);
      spendActionIfCounted(card.cardId);
      pushLog(
        `【Power UP!!】temp_shot → bossDamage=${result.bossDamage}` +
          ` 甜區=${result.inSweetZone ? '是' : '否'}` +
          ` cannotBottle=${result.cannotBottleImmediately}` +
          ` / events=${formatEvents(result.events)}`,
      );
      setToast(`Power UP 臨時射擊：王傷 ${result.bossDamage ?? 0}`);
      return;
    }

    // —— 來吧! 大鬧一場! ——
    if (card.cardId === 'big_show') {
      const result = resolveBigShow({
        hasMovedThisTurn,
        ammo,
      });
      if (!result.ok) {
        pushLog(`【來吧! 大鬧一場!】失敗：${result.reason}`);
        setToast(`大招失敗：${result.reason}`);
        return;
      }
      setAmmo(result.ammo);
      setMayPlayShotIgnoreRange(result.mayPlayShot && result.ignoreRangePenaltyForShot);
      removeFromHand(card.instanceId);
      spendActionIfCounted(card.cardId);
      pushLog(
        `【來吧! 大鬧一場!】OK 裝填 dmg+${result.ammo.damageBonus}` +
          ` draw+${result.ammo.drawBonus}` +
          ` mayPlayShot=${result.mayPlayShot}` +
          ` ignoreRange=${result.ignoreRangePenaltyForShot}` +
          ` / events=${formatEvents(result.events)}`,
      );
      setToast(
        result.mayPlayShot
          ? '大招成功：請再打 1 張手上射擊（無視距離、不另扣行動）'
          : '大招成功',
      );
      return;
    }

    // —— 強能增幅 ——
    if (card.cardId === 'amplify') {
      const result = resolveAmplify({ hand: toMageInstances(hand) });
      setAmplifiedPending(result.amplifiedPending);
      removeFromHand(card.instanceId);
      pushLog(
        `【強能增幅】armed → 下一張招 amplified / events=${formatEvents(result.events)}（不計次）`,
      );
      setToast('強能增幅：下一招吃加成（不計次）');
      return;
    }

    // —— 魔法箭 ——
    if (card.cardId === 'magic_arrow') {
      const usedAmp = amplifiedPending;
      const result = resolveMagicArrow({
        attacker,
        amplified: usedAmp,
      });
      setAmplifiedPending(false);
      removeFromHand(card.instanceId);
      spendActionIfCounted(card.cardId);
      pushLog(
        `【魔法箭】attacker=(${attacker.q},${attacker.r}) → ` +
          `bossDamage=${result.bossDamage}` +
          ` / 甜區=${result.inSweetZone ? '是' : '否'}` +
          ` / amplified=${result.amplified ? '是' : '否'}` +
          ` / events=${formatEvents(result.events)}`,
      );
      setToast(
        `魔法箭：王傷 ${result.bossDamage}` + (usedAmp ? '（已增幅）' : ''),
      );
      return;
    }

    // —— 御風術 ——
    if (card.cardId === 'wind') {
      setPendingPlay({ kind: 'wind_from', card });
      pushLog('【御風術】請點要推動的地形格，再點鄰格決定方向');
      setToast('御風：先點地形，再點鄰格方向');
      return;
    }

    // —— 聚精會神 ——
    if (card.cardId === 'focus') {
      const usedAmp = amplifiedPending;
      const result = resolveFocus({ amplified: usedAmp });
      setAmplifiedPending(false);
      removeFromHand(card.instanceId);
      // 不計次；抽牌 stub
      pushLog(
        `【聚精會神】應抽 ${result.drawCount}` +
          (usedAmp ? '（增幅）' : '') +
          ` endTurn=${result.endTurn}` +
          ` / events=${formatEvents(result.events)}（抽牌 stub：僅日誌）`,
      );
      setToast(`聚精：應抽 ${result.drawCount}（強制結束回合）`);
      if (result.endTurn) endTurn('聚精會神強制結束');
      return;
    }

    // —— 磁力屏障（薄：只套自己；增幅寄出略過）——
    if (card.cardId === 'barrier') {
      if (amplifiedPending) {
        pushLog('【磁力屏障】增幅寄出需其他單位目標 → 薄 demo 略過增幅，改套自己');
        setAmplifiedPending(false);
      }
      const result = resolveBarrier({
        mageHex: unitHex,
        mageId: 'self',
        amplified: false,
      });
      if (!result.ok) {
        pushLog(`【磁力屏障】失敗：${result.reason}`);
        setToast(`屏障失敗：${result.reason}`);
        return;
      }
      setBarrierAura(result.aura ?? null);
      removeFromHand(card.instanceId);
      spendActionIfCounted(card.cardId);
      pushLog(
        `【磁力屏障】保護 ${result.aura?.targetActorId}` +
          ` 鄰格 ${result.aura?.protectedHexes.length ?? 0}` +
          ` 下回合擋屏障=${result.barrierBlockedNextTurn}` +
          ` / events=${formatEvents(result.events)}`,
      );
      setToast('屏障：本輪保護自己鄰 1（光環 stub）');
      return;
    }

    // —— 位面調換（兩單位 demo：自己 ↔ 隊友）——
    if (card.cardId === 'planar_swap') {
      const usedAmp = amplifiedPending;
      const result = resolvePlanarSwap({
        board,
        mageHex: unitHex,
        actorA: { id: 'self', hex: unitHex },
        actorB: { id: 'ally', hex: allyHex },
        amplified: usedAmp,
      });
      setAmplifiedPending(false);
      if (!result.ok) {
        pushLog(`【位面調換】失敗：${result.reason}（若場上僅一單位則無法 demo）`);
        setToast(`位面失敗：${result.reason}`);
        return;
      }
      const pos = result.positions;
      if (pos?.self) setUnitHex(pos.self);
      if (pos?.ally) setAllyHex(pos.ally);
      removeFromHand(card.instanceId);
      pushLog(
        `【位面調換】自己↔隊友` +
          (usedAmp ? '（增幅不受沉默）' : '') +
          ` / events=${formatEvents(result.events)}`,
      );
      setToast('位面：已交換自己與隊友');
      if (result.endTurn) endTurn('位面調換強制結束');
      return;
    }

    // —— 騎士攻擊 ——
    if (card.cardId === 'attack') {
      let target: Axial | undefined;
      if (distance(attacker, BOSS_HEX) === 1) {
        target = BOSS_HEX;
      } else {
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
      if (result.board !== board) setBoard(result.board);
      removeFromHand(card.instanceId);
      spendActionIfCounted(card.cardId);
      const tgtDesc = equals(target, BOSS_HEX)
        ? '王'
        : `牆(${target.q},${target.r})`;
      pushLog(
        `【攻擊】→ ${tgtDesc}` +
          ` bossDamage=${result.bossDamage}` +
          ` ok=${result.ok}` +
          (result.reason ? ` reason=${result.reason}` : '') +
          ` / events=${formatEvents(result.events)}`,
      );
      setToast(
        result.ok
          ? `攻擊 ${tgtDesc}：王傷 ${result.bossDamage}`
          : `攻擊失敗：${result.reason ?? '未知'}`,
      );
      return;
    }

    // —— 堅定信仰 ——
    if (card.cardId === 'faith') {
      const result = resolveFaith({
        hasMovedThisTurn,
        curseStacks,
      });
      if (!result.ok) {
        pushLog(`【堅定信仰】失敗：${result.reason}`);
        setToast(`信仰失敗：${result.reason}`);
        return;
      }
      setCurseStacks(result.curseStacks);
      removeFromHand(card.instanceId);
      spendActionIfCounted(card.cardId);
      pushLog(
        `【堅定信仰】清 ${result.cleared} → 咒層 ${result.curseStacks}` +
          ` / events=${formatEvents(result.events)}`,
      );
      setToast(`信仰：詛咒 ${curseStacks} → ${result.curseStacks}`);
      return;
    }

    // —— 英勇衝鋒 ——
    if (card.cardId === 'heroic_charge') {
      setPendingPlay({ kind: 'heroic_charge', card });
      pushLog('【英勇衝鋒】請點軸向直線上的格以決定方向');
      setToast('衝鋒：點直線方向格');
      return;
    }

    // —— 奉獻 ——
    if (card.cardId === 'devotion') {
      if (distance(unitHex, allyHex) === 1) {
        completeDevotion(allyHex, card);
        return;
      }
      setPendingPlay({ kind: 'devotion', card });
      pushLog(`【奉獻】隊友不鄰：請點隊友格 (${allyHex.q},${allyHex.r})（或先走近）`);
      setToast('奉獻：點隊友格');
      return;
    }

    // —— 嘲諷 ——
    if (card.cardId === 'taunt') {
      const result = resolveTaunt({
        isOthersTurn,
        knightHex: unitHex,
        existingBarrier: barrierAura
          ? { priority: barrierAura.priority, targetHex: barrierAura.targetHex }
          : null,
      });
      if (!result.ok) {
        pushLog(
          `【嘲諷】失敗：${result.reason}` +
            '（可開「他人回合」開關再試）',
        );
        setToast(`嘲諷失敗：${result.reason}`);
        return;
      }
      setTauntRestriction(result.bossPlaceRestriction ?? null);
      removeFromHand(card.instanceId);
      pushLog(
        `【嘲諷】中心 (${unitHex.q},${unitHex.r}) ring=1` +
          ` priority=${result.tauntPriority}` +
          ` overridesBarrier=${result.overridesBarrier}` +
          ` / events=${formatEvents(result.events)}`,
      );
      setToast('嘲諷：王不可在鄰 1 鋪牆（限制 stub）');
      return;
    }

    // —— 不死存在 ——
    if (card.cardId === 'undying') {
      setPendingPlay({ kind: 'undying', card });
      pushLog(
        `【不死存在】請點復活落點（isDead=${isDead} atRoundEnd=${atRoundEndAfterActors}）`,
      );
      setToast('不死：點落點（須勾死亡＋輪末）');
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
          懸停顯示走路路徑（螢光綠）；有 pending 時點格＝牌目標（不預覽移動）。
          隊友擋路；demo 有完整牆／沉默／詛咒測試格。
        </p>
      </header>

      <BoardCanvas
        board={board}
        unitHex={unitHex}
        allyHex={allyHex}
        hoverPath={hoverPath}
        onHexClick={onHexClick}
        onHexHover={setHoverHex}
      />

      <div>
        <span className="tab">
          {demoLabel(demo)}
          {' · '}round {round}
          {' · '}移動 {movesLeft}/{TURN_MOVES_PER_ROUND}
          {' · '}行動 {actionsLeft}/{TURN_ACTIONS_PER_ROUND}
          {moveLocked ? ' · 移動鎖定' : ''}
          {hasMovedThisTurn ? ' · 已移動' : ''}
          {mayPlayShotIgnoreRange ? ' · 大招可射' : ''}
          {' · '}單位 ({unitHex.q},{unitHex.r})
          {demo === 'gunner' ? ` · ${ammoHint}` : ''}
          {demo === 'mage' && amplifiedPending ? ' · 增幅待用' : ''}
          {demo === 'mage' && barrierAura ? ' · 屏障中' : ''}
          {demo === 'knight'
            ? ` · 咒${curseStacks}/友${allyCurseStacks}`
            : ''}
          {tauntRestriction ? ' · 嘲諷中' : ''}
          {pendingPlay ? ` · 指定:${pendingPlay.kind}` : ''}
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
        <button type="button" onClick={() => endTurn('玩家結束')}>
          結束回合
        </button>{' '}
        {pendingPlay ? (
          <button
            type="button"
            onClick={() => clearPending('【取消指定】已清除 pendingPlay')}
          >
            取消指定
          </button>
        ) : null}
      </div>

      {pendingPlay ? (
        <p className="muted" role="status">
          {pendingHint(pendingPlay)}
        </p>
      ) : null}

      {demo === 'knight' ? (
        <div className="demo-toggles">
          <label>
            <input
              type="checkbox"
              checked={isOthersTurn}
              onChange={(e) => setIsOthersTurn(e.target.checked)}
            />{' '}
            他人回合（嘲諷）
          </label>{' '}
          <label>
            <input
              type="checkbox"
              checked={isDead}
              onChange={(e) => setIsDead(e.target.checked)}
            />{' '}
            已死亡（不死）
          </label>{' '}
          <label>
            <input
              type="checkbox"
              checked={atRoundEndAfterActors}
              onChange={(e) => setAtRoundEndAfterActors(e.target.checked)}
            />{' '}
            輪末可行動者皆結束（不死）
          </label>{' '}
          <button
            type="button"
            onClick={() => {
              setCurseStacks((n) => n + 1);
              pushLog('【demo】自己詛咒 +1');
            }}
          >
            自己+咒
          </button>{' '}
          <button
            type="button"
            onClick={() => {
              setAllyCurseStacks((n) => n + 1);
              pushLog('【demo】隊友詛咒 +1');
            }}
          >
            隊友+咒
          </button>
        </div>
      ) : null}

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
