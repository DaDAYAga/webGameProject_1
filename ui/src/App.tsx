/**
 * 學習筆記（三職業平衡試玩）：
 * 1) 三棋子常駐：騎／槍／法；選職業＝選棋子＋看手牌；全結束才進下一輪。
 * 2) 有效傷王 → 立刻威脅序鋪 1 plain；輪末零傷才鋪 2 punish（無王行動者回合）。
 * 3) advanceWallAging 寫回 aged → Canvas 標籤牆體→老化；開場牆從不進老化管線。
 * 4) 重製＝開場盤＋依序點 3 出生格；手牌上限騎／槍 7、法 8。
 */
import { useMemo, useState } from 'react';
import {
  EMPTY_AMMO_SLOT,
  GUNNER_CARD_DEFS,
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
  createOpeningBoard,
  getTile,
  hexKey,
  kindAllowsCrack,
  placeTerrain,
  shortestPath,
  type Board,
} from '@core/board/index.js';
import {
  DEFAULT_MAP_RADIUS,
} from '@core/enclosure/index.js';
import {
  advanceWallAging,
  pickThreatPlacementHexes,
  type ThreatActor,
} from '@core/turn/index.js';
import {
  AXIAL_DIRECTIONS,
  add,
  distance,
  equals,
  neighbors,
  subtract,
  type Axial,
} from '@core/hex/index.js';
import { BoardCanvas, type BoardActorView } from './BoardCanvas';
import { Hand, type HandCard } from './Hand';
import { sideHintFor } from './cardHints';

export type ClassId = 'knight' | 'gunner' | 'mage';

const CLASS_ORDER: readonly ClassId[] = ['knight', 'gunner', 'mage'];

const START_HEX: Record<ClassId, Axial> = {
  gunner: { q: 2, r: 0 },
  mage: { q: 3, r: -1 },
  knight: { q: 2, r: -2 },
};

const HAND_CAP: Record<ClassId, number> = {
  knight: 7,
  gunner: 7,
  mage: 8,
};

const TURN_MOVES_PER_ROUND = 2;
const TURN_ACTIONS_PER_ROUND = 1;
const BOSS_HP_DEMO = 12;
const PUNISH_PER_ZERO_DAMAGE = 2;

const COLOR_ACT = { fill: '#3d7ea6', stroke: '#7ec8ff' };
const COLOR_SEL = { fill: '#3d8a5a', stroke: '#a0e8b0' };
const COLOR_END = { fill: '#5a5a5a', stroke: '#9a9a9a' };

type ClassActor = {
  hex: Axial;
  hand: HandCard[];
  movesLeft: number;
  actionsLeft: number;
  moveLocked: boolean;
  hasMovedThisTurn: boolean;
  endedThisRound: boolean;
  ammo: AmmoSlotState;
  amplifiedPending: boolean;
  mayPlayShotIgnoreRange: boolean;
  curseStacks: number;
  drawSeq: number;
};

type Actors = Record<ClassId, ClassActor>;

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

type Phase = 'playing' | 'spawn-pick';

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

function classLabel(id: ClassId): string {
  if (id === 'gunner') return '槍手';
  if (id === 'mage') return '法師';
  return '騎士';
}

function pieceLabel(id: ClassId): string {
  // 全名優先；兩字皆可塞進棋子
  return classLabel(id);
}

function enrichCard(
  instanceId: string,
  cardId: string,
  name: string,
  countsTowardAction: boolean,
  silenced: boolean,
): HandCard {
  return {
    instanceId,
    cardId,
    name,
    wired: WIRED_IDS.has(cardId),
    countsTowardAction,
    silenced,
    sideHint: sideHintFor(cardId),
  };
}

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
    const def = GUNNER_CARD_DEFS[cardId];
    return enrichCard(
      `g-${i}-${cardId}`,
      cardId,
      def.name,
      def.countsTowardAction,
      def.silenced,
    );
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
    const def = MAGE_CARD_DEFS[cardId];
    return enrichCard(
      `m-${i}-${cardId}`,
      cardId,
      def.name,
      def.countsTowardAction,
      def.silenced,
    );
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
    const def = KNIGHT_CARD_DEFS[cardId];
    return enrichCard(
      `k-${i}-${cardId}`,
      cardId,
      def.name,
      def.countsTowardAction,
      def.silenced,
    );
  });
}

function buildHand(id: ClassId): HandCard[] {
  if (id === 'gunner') return buildGunnerHand();
  if (id === 'mage') return buildMageHand();
  return buildKnightHand();
}

function makeDrawStubCard(id: ClassId, seq: number): HandCard {
  const cardId =
    id === 'gunner' ? 'shot' : id === 'mage' ? 'magic_arrow' : 'attack';
  const def =
    id === 'gunner'
      ? GUNNER_CARD_DEFS.shot
      : id === 'mage'
        ? MAGE_CARD_DEFS.magic_arrow
        : KNIGHT_CARD_DEFS.attack;
  return enrichCard(
    `draw-${id}-${seq}-${cardId}`,
    cardId,
    def.name,
    def.countsTowardAction,
    def.silenced,
  );
}

function applyHandCap(
  id: ClassId,
  hand: HandCard[],
): { hand: HandCard[]; discarded: HandCard[] } {
  const cap = HAND_CAP[id];
  if (hand.length <= cap) return { hand, discarded: [] };
  const keep = hand.slice(0, cap);
  const discarded = hand.slice(cap);
  return { hand: keep, discarded };
}

function freshActor(id: ClassId, hex: Axial): ClassActor {
  const { hand } = applyHandCap(id, buildHand(id));
  return {
    hex,
    hand,
    movesLeft: TURN_MOVES_PER_ROUND,
    actionsLeft: TURN_ACTIONS_PER_ROUND,
    moveLocked: false,
    hasMovedThisTurn: false,
    endedThisRound: false,
    ammo: EMPTY_AMMO_SLOT,
    amplifiedPending: false,
    mayPlayShotIgnoreRange: false,
    curseStacks: id === 'knight' ? 2 : 0,
    drawSeq: 0,
  };
}

function bootActors(hexes: Record<ClassId, Axial>): Actors {
  const actors = {} as Actors;
  for (const id of CLASS_ORDER) {
    actors[id] = freshActor(id, hexes[id]);
  }
  return actors;
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

function lookupCountsTowardAction(id: ClassId, cardId: string): boolean {
  if (id === 'gunner') {
    return GUNNER_CARD_DEFS[cardId as GunnerCardId]?.countsTowardAction ?? false;
  }
  if (id === 'mage') {
    return MAGE_CARD_DEFS[cardId as MageCardId]?.countsTowardAction ?? false;
  }
  return KNIGHT_CARD_DEFS[cardId as KnightCardId]?.countsTowardAction ?? false;
}

function hasStandableNeighbor(
  board: Board,
  hex: Axial,
  occupied: readonly Axial[],
): boolean {
  return neighbors(hex).some((n) => canStandAt(board, n, { occupied }));
}

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
  if (p.kind === 'devotion') return '指定鄰 1 友軍格（吸咒）';
  return '';
}

function occupiedExcept(actors: Actors, self: ClassId): Axial[] {
  return CLASS_ORDER.filter((id) => id !== self).map((id) => actors[id].hex);
}

function allHexes(actors: Actors): Axial[] {
  return CLASS_ORDER.map((id) => actors[id].hex);
}

function toThreatActors(actors: Actors): ThreatActor[] {
  return CLASS_ORDER.map((id) => ({
    id,
    hex: actors[id].hex,
    role: id === 'knight' ? 'melee' : 'ranged',
    curseStacks: actors[id].curseStacks,
  }));
}

function collectProtected(
  taunt: BossPlaceRestriction | null,
  barrier: BarrierAura | null,
): Axial[] {
  const out: Axial[] = [];
  if (taunt?.type === 'taunt') {
    for (const n of neighbors(taunt.center)) out.push(n);
  }
  if (barrier?.protectedHexes) {
    for (const h of barrier.protectedHexes) out.push(h);
  }
  return out;
}

function hasPlayableCard(actor: ClassActor, id: ClassId): boolean {
  if (actor.actionsLeft <= 0 && !actor.mayPlayShotIgnoreRange) {
    // 仍可能有不計次牌
    return actor.hand.some((c) => !lookupCountsTowardAction(id, c.cardId));
  }
  return actor.hand.some((c) => {
    const counted = lookupCountsTowardAction(id, c.cardId);
    if (counted && actor.actionsLeft <= 0) {
      return c.cardId === 'shot' && actor.mayPlayShotIgnoreRange;
    }
    return true;
  });
}

const INITIAL_HEXES = { ...START_HEX };
const INITIAL_ACTORS = bootActors(INITIAL_HEXES);

export function App() {
  const [phase, setPhase] = useState<Phase>('playing');
  const [spawnStep, setSpawnStep] = useState(0); // 0騎 1槍 2法
  const [spawnHexes, setSpawnHexes] = useState<Partial<Record<ClassId, Axial>>>(
    {},
  );

  const [selected, setSelected] = useState<ClassId>('gunner');
  const [actors, setActors] = useState<Actors>(() => INITIAL_ACTORS);
  const [board, setBoard] = useState<Board>(() => createOpeningBoard());
  const [bossHp, setBossHp] = useState(BOSS_HP_DEMO);
  const [won, setWon] = useState(false);
  const [roundIndex, setRoundIndex] = useState(0);
  const [bossDamagedThisRound, setBossDamagedThisRound] = useState(false);
  const [aging, setAging] = useState<Map<string, number>>(() => new Map());
  const [wallsPlacedThisRound, setWallsPlacedThisRound] = useState<string[]>(
    [],
  );
  const [log, setLog] = useState<string[]>(() => [
    '薄 UI：三職業平衡試玩。開場老化牆。傷王即鋪牆；三人皆結束才進下一輪。',
  ]);
  const [toast, setToast] = useState('');
  const [pendingPlay, setPendingPlay] = useState<PendingPlay | null>(null);
  const [hoverHex, setHoverHex] = useState<Axial | null>(null);
  const [hoveredCard, setHoveredCard] = useState<HandCard | null>(null);
  const [barrierAura, setBarrierAura] = useState<BarrierAura | null>(null);
  const [tauntRestriction, setTauntRestriction] =
    useState<BossPlaceRestriction | null>(null);
  const [isOthersTurn, setIsOthersTurn] = useState(false);
  const [isDead, setIsDead] = useState(false);
  const [atRoundEndAfterActors, setAtRoundEndAfterActors] = useState(false);
  const [allyCurseStacks, setAllyCurseStacks] = useState(1);
  const [endConfirmFor, setEndConfirmFor] = useState<ClassId | null>(null);
  const [lastDraw, setLastDraw] = useState('');

  const me = actors[selected];
  const unitHex = me.hex;
  const hand = me.hand;
  const movesLeft = me.movesLeft;
  const actionsLeft = me.actionsLeft;
  const moveLocked = me.moveLocked;
  const mustFinishMove = moveLocked;
  const hasMovedThisTurn = me.hasMovedThisTurn;
  const ammo = me.ammo;
  const amplifiedPending = me.amplifiedPending;
  const mayPlayShotIgnoreRange = me.mayPlayShotIgnoreRange;
  const curseStacks = me.curseStacks;

  const allyId = useMemo(() => {
    const others = CLASS_ORDER.filter((id) => id !== selected);
    const adj = others.find(
      (id) => distance(actors[selected].hex, actors[id].hex) === 1,
    );
    return adj ?? others[0]!;
  }, [actors, selected]);
  const allyHex = actors[allyId].hex;

  const ammoHint = useMemo(
    () => `裝填 dmg+${ammo.damageBonus} draw+${ammo.drawBonus}`,
    [ammo],
  );

  const hoverPath = useMemo(() => {
    if (phase !== 'playing') return null;
    if (!hoverHex || pendingPlay) return null;
    if (me.endedThisRound) return null;
    if (equals(hoverHex, unitHex)) return null;
    if (movesLeft <= 0) return null;
    const occupied = occupiedExcept(actors, selected);
    const path = shortestPath(board, unitHex, hoverHex, { occupied });
    if (path === null) return null;
    const steps = path.length - 1;
    if (steps < 1) return null;
    if (steps > TURN_MOVES_PER_ROUND || steps > movesLeft) return null;
    return path;
  }, [
    actors,
    board,
    hoverHex,
    me.endedThisRound,
    movesLeft,
    pendingPlay,
    phase,
    selected,
    unitHex,
  ]);

  const showSweetZone =
    hoveredCard?.cardId === 'shot' || hoveredCard?.cardId === 'magic_arrow';

  const boardActors: BoardActorView[] = CLASS_ORDER.map((id) => {
    const a = actors[id];
    const colors = a.endedThisRound
      ? COLOR_END
      : id === selected
        ? COLOR_SEL
        : COLOR_ACT;
    return {
      id,
      label: pieceLabel(id),
      hex: a.hex,
      fill: colors.fill,
      stroke: colors.stroke,
    };
  });

  const spawnHint =
    phase === 'spawn-pick'
      ? `選出生點 ${spawnStep + 1}/3：請點可站空格放置「${classLabel(CLASS_ORDER[spawnStep]!)}」`
      : null;

  function pushLog(line: string) {
    setLog((prev) => [...prev, line]);
  }

  function patchActor(id: ClassId, patch: Partial<ClassActor>) {
    setActors((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  }

  function updateActor(
    id: ClassId,
    updater: (a: ClassActor) => ClassActor,
  ) {
    setActors((prev) => ({
      ...prev,
      [id]: updater(prev[id]),
    }));
  }

  function clearPending(note?: string) {
    setPendingPlay(null);
    if (note) {
      pushLog(note);
      setToast(note);
    }
  }

  function selectClass(id: ClassId) {
    setSelected(id);
    setPendingPlay(null);
    setEndConfirmFor(null);
    setHoveredCard(null);
    if (actors[id].endedThisRound) {
      setToast(`${classLabel(id)} 本輪已結束（唯讀）`);
      pushLog(`【選取】${classLabel(id)}（已結束・唯讀）`);
    } else {
      setToast(`選取 ${classLabel(id)}`);
    }
  }

  /** 有效傷王：扣 HP＋立刻威脅序鋪 1 plain。 */
  function noteBossDamage(amount: number) {
    if (amount <= 0 || won) return;
    setBossDamagedThisRound(true);
    setBossHp((hp) => {
      const next = Math.max(0, hp - amount);
      if (next <= 0) {
        setWon(true);
        setToast('勝利：王 HP ≤ 0');
        setLog((prev) => [...prev, '【勝利】王 HP ≤ 0，停止繼續操作']);
      }
      return next;
    });

    // 立刻鋪牆（用當前 closure 的 board／actors）
    const protectedHexes = collectProtected(tauntRestriction, barrierAura);
    const picks = pickThreatPlacementHexes(board, toThreatActors(actors), 1, {
      occupied: allHexes(actors),
      protectedHexes,
      bounds: { radius: DEFAULT_MAP_RADIUS },
      exclude: wallsPlacedThisRound.map((k) => {
        const [q, r] = k.split(',').map(Number);
        return { q: q!, r: r! };
      }),
    });
    const pick = picks[0];
    if (pick) {
      const nextBoard = placeTerrain(board, pick, 'plain');
      setBoard(nextBoard);
      const key = hexKey(pick);
      setWallsPlacedThisRound((w) => [...w, key]);
      pushLog(
        `【王】受傷即鋪 plain@(${pick.q},${pick.r})（威脅序；可續走）`,
      );
    } else {
      pushLog('【王】受傷但無空位可鋪 plain');
    }
  }


  function finishRound(liveBoard: Board, liveActors: Actors, liveAging: Map<string, number>, liveWalls: string[], damaged: boolean) {
    const logs: string[] = [];
    let boardNow = liveBoard;
    let agingNow = liveAging;

    if (!damaged) {
      const protectedHexes = collectProtected(tauntRestriction, barrierAura);
      const picks = pickThreatPlacementHexes(
        boardNow,
        toThreatActors(liveActors),
        PUNISH_PER_ZERO_DAMAGE,
        {
          occupied: allHexes(liveActors),
          protectedHexes,
          bounds: { radius: DEFAULT_MAP_RADIUS },
        },
      );
      if (picks.length === 0) {
        logs.push('【王】懲罰跳過：無空位');
      } else {
        for (const h of picks) {
          boardNow = placeTerrain(boardNow, h, 'punish');
        }
        logs.push(
          `【王】PunishPlace／零傷 → ${picks.length} 格 ` +
            picks.map((h) => `punish@(${h.q},${h.r})`).join('、'),
        );
      }
    } else {
      logs.push('【王】本輪已傷王，不鋪 punish');
    }

    const aged = advanceWallAging(agingNow, liveWalls, { board: boardNow });
    agingNow = aged.aging;
    if (aged.board) boardNow = aged.board;
    if (aged.newlyAgedKeys.length > 0) {
      logs.push(
        `【老化】advanceWallAging → aged=[${aged.newlyAgedKeys.join(',')}]（標籤改「老化」）`,
      );
    }

    const nextRound = roundIndex + 1;
    logs.push(`【輪末】RoundEnded ${roundIndex} → 開 Round ${nextRound}`);

    // 重置三人可行動；保留裝填；各抽 stub
    const nextActors = { ...liveActors } as Actors;
    const drawNames: string[] = [];
    for (const id of CLASS_ORDER) {
      const prev = liveActors[id];
      let a: ClassActor = {
        ...prev,
        movesLeft: TURN_MOVES_PER_ROUND,
        actionsLeft: TURN_ACTIONS_PER_ROUND,
        moveLocked: false,
        hasMovedThisTurn: false,
        endedThisRound: false,
        amplifiedPending: false,
        mayPlayShotIgnoreRange: false,
        // ammo 保留
      };
      const stub = makeDrawStubCard(id, a.drawSeq);
      const merged = [...a.hand, stub];
      const { hand: capped, discarded } = applyHandCap(id, merged);
      a = {
        ...a,
        hand: capped,
        drawSeq: a.drawSeq + 1,
      };
      if (discarded.length > 0) {
        logs.push(
          `【手牌上限】${classLabel(id)} 棄最新 ${discarded.map((c) => c.name).join('、')}`,
        );
      } else {
        drawNames.push(`${classLabel(id)}:${stub.name}`);
      }
      // 若棄的是 stub 以外、stub 仍留下，也記抽到
      if (discarded.length > 0 && capped.some((c) => c.instanceId === stub.instanceId)) {
        drawNames.push(`${classLabel(id)}:${stub.name}`);
      }
      nextActors[id] = a;
    }
    if (drawNames.length) {
      logs.push(`【DrawStub】${drawNames.join('；')}`);
      setLastDraw(drawNames.join(' / '));
    }

    setBoard(boardNow);
    setAging(agingNow);
    setWallsPlacedThisRound([]);
    setBossDamagedThisRound(false);
    setRoundIndex(nextRound);
    setActors(nextActors);
    setBarrierAura(null);
    setTauntRestriction(null);
    setEndConfirmFor(null);
    setPendingPlay(null);
    for (const line of logs) pushLog(line);
    setToast(`第 ${nextRound} 輪開始（三人可行動）`);
  }

  function endTurn(reason = '結束回合', opts?: { force?: boolean }) {
    if (won) {
      pushLog('【結束回合】已勝利，停止操作');
      setToast('已勝利');
      return;
    }
    if (phase !== 'playing') return;
    const id = selected;
    const actor = actors[id];
    if (actor.endedThisRound) {
      pushLog(`【結束回合】${classLabel(id)} 本輪已結束`);
      setToast('本輪已結束');
      return;
    }

    const stillMoves = actor.movesLeft > 0;
    const stillPlay =
      actor.actionsLeft > 0 && hasPlayableCard(actor, id);
    // 不計次且 actions 用完仍可能有可出牌
    const stillUncounted =
      hasPlayableCard(actor, id) &&
      actor.hand.some((c) => !lookupCountsTowardAction(id, c.cardId));
    const canStillAct =
      stillMoves ||
      (actor.actionsLeft > 0 && hasPlayableCard(actor, id)) ||
      stillUncounted;

    if (!opts?.force && canStillAct && endConfirmFor !== id) {
      setEndConfirmFor(id);
      const msg = '還可移動／出牌';
      pushLog(`【結束回合】${classLabel(id)} 提醒：${msg}（再點一次確認）`);
      setToast(msg);
      return;
    }

    setEndConfirmFor(null);
    const nextActors: Actors = {
      ...actors,
      [id]: { ...actor, endedThisRound: true, moveLocked: false },
    };
    setActors(nextActors);
    pushLog(`【結束回合】${classLabel(id)}／${reason}`);
    setToast(`${classLabel(id)} 結束（灰）`);
    setPendingPlay(null);

    const allEnded = CLASS_ORDER.every((c) => nextActors[c].endedThisRound);
    if (allEnded) {
      finishRound(
        board,
        nextActors,
        aging,
        wallsPlacedThisRound,
        bossDamagedThisRound,
      );
    }
  }

  function beginSpawnPick() {
    setPhase('spawn-pick');
    setSpawnStep(0);
    setSpawnHexes({});
    setBoard(createOpeningBoard());
    setWon(false);
    setBossHp(BOSS_HP_DEMO);
    setRoundIndex(0);
    setBossDamagedThisRound(false);
    setAging(new Map());
    setWallsPlacedThisRound([]);
    setPendingPlay(null);
    setEndConfirmFor(null);
    setHoverHex(null);
    setBarrierAura(null);
    setTauntRestriction(null);
    setLog(['重製對局：開場盤。依序點 騎士 → 槍手 → 法師 出生格。']);
    setToast('請點騎士出生格');
  }

  function completeSpawnAndStart(hexes: Record<ClassId, Axial>) {
    const next = bootActors(hexes);
    setActors(next);
    setSelected('gunner');
    setPhase('playing');
    setSpawnHexes({});
    setSpawnStep(0);
    setBoard(createOpeningBoard());
    setBossHp(BOSS_HP_DEMO);
    setWon(false);
    setRoundIndex(0);
    setBossDamagedThisRound(false);
    setAging(new Map());
    setWallsPlacedThisRound([]);
    setLog([
      '薄 UI：三職業平衡試玩。出生完成。傷王即鋪牆；三人皆結束才進下一輪。',
      `【出生】騎(${hexes.knight.q},${hexes.knight.r}) 槍(${hexes.gunner.q},${hexes.gunner.r}) 法(${hexes.mage.q},${hexes.mage.r})`,
    ]);
    setToast('對局開始');
  }

  function onSpawnClick(hex: Axial) {
    const id = CLASS_ORDER[spawnStep]!;
    const taken = Object.values(spawnHexes) as Axial[];
    if (equals(hex, BOSS_HEX)) {
      setToast('不可選王格');
      return;
    }
    if (getTile(board, hex)) {
      setToast('不可選有地形的格');
      return;
    }
    if (!canStandAt(board, hex, { occupied: taken })) {
      setToast('不可站此格');
      return;
    }
    if (taken.some((t) => equals(t, hex))) {
      setToast('不可重複');
      return;
    }
    const next = { ...spawnHexes, [id]: hex };
    setSpawnHexes(next);
    pushLog(`【出生】${classLabel(id)} → (${hex.q},${hex.r})`);
    if (spawnStep >= 2) {
      completeSpawnAndStart(next as Record<ClassId, Axial>);
    } else {
      setSpawnStep(spawnStep + 1);
      setToast(`請點${classLabel(CLASS_ORDER[spawnStep + 1]!)}出生格`);
    }
  }

  function spendActionIfCounted(cardId: string) {
    if (!lookupCountsTowardAction(selected, cardId)) return;
    patchActor(selected, {
      actionsLeft: Math.max(0, actors[selected].actionsLeft - 1),
    });
  }

  function removeFromHand(...instanceIds: string[]) {
    const drop = new Set(instanceIds.filter(Boolean));
    updateActor(selected, (a) => ({
      ...a,
      hand: a.hand.filter((c) => !drop.has(c.instanceId)),
    }));
  }

  function tryMoveTo(hex: Axial) {
    if (won) {
      setToast('已勝利，停止操作');
      return;
    }
    if (me.endedThisRound) {
      setToast('本輪已結束（唯讀）');
      pushLog('【移動】拒絕：本輪已結束');
      return;
    }
    const tileDesc = describeHex(board, hex);
    const base = `【點格】axial=(${hex.q},${hex.r}) key=${hexKey(hex)} → ${tileDesc}`;

    if (equals(hex, unitHex)) {
      pushLog(`${base}（已在此格）`);
      setToast(`單位已在 (${hex.q},${hex.r})`);
      return;
    }

    if (movesLeft <= 0) {
      const msg = '本回合移動已用完';
      pushLog(`${base} → ${msg}`);
      setToast(msg);
      return;
    }

    const occupied = occupiedExcept(actors, selected);
    const path = shortestPath(board, unitHex, hex, { occupied });
    if (path === null) {
      const hitOther = occupied.some((o) => equals(o, hex));
      const why = equals(hex, BOSS_HEX)
        ? '不可站王格'
        : hitOther
          ? '不可站其他職業格'
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
    const left = movesLeft - steps;
    let nextLocked = true;
    let stuckUnlock = false;
    if (left <= 0) {
      nextLocked = false;
    } else if (!hasStandableNeighbor(board, dest, occupied)) {
      nextLocked = false;
      stuckUnlock = true;
    }
    patchActor(selected, {
      hex: dest,
      hasMovedThisTurn: true,
      movesLeft: left,
      moveLocked: nextLocked,
    });
    setEndConfirmFor(null);

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
      `【移動】${classLabel(selected)} (${from.q},${from.r}) → (${dest.q},${dest.r})` +
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

  function completeTurbulence(
    hex: Axial,
    pending: Extract<PendingPlay, { kind: 'turbulence' }>,
  ) {
    const occupied = occupiedExcept(actors, selected);
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
    updateActor(selected, (a) => {
      const drop = new Set([
        pending.card.instanceId,
        ...result.discardedBottleIds,
      ]);
      return {
        ...a,
        hex: result.actorPosition,
        hasMovedThisTurn: true,
        hand: a.hand.filter((c) => !drop.has(c.instanceId)),
        actionsLeft: lookupCountsTowardAction(selected, 'turbulence')
          ? Math.max(0, a.actionsLeft - 1)
          : a.actionsLeft,
      };
    });
    setPendingPlay(null);
    pushLog(
      `【大亂流】→ (${result.actorPosition.q},${result.actorPosition.r})` +
        ` steps=${result.steps}` +
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
      actors: CLASS_ORDER.map((id) => ({
        id,
        hex: actors[id].hex,
      })),
    });
    if (!result.ok) {
      pushLog(`【御風術】失敗：${result.reason}`);
      setToast(`御風失敗：${result.reason}`);
      return;
    }
    setBoard(result.board);
    updateActor(selected, (a) => ({
      ...a,
      amplifiedPending: false,
      hand: a.hand.filter((c) => c.instanceId !== card.instanceId),
      actionsLeft: lookupCountsTowardAction(selected, 'wind')
        ? Math.max(0, a.actionsLeft - 1)
        : a.actionsLeft,
    }));
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
    const final = resolveHeroicCharge({
      board,
      actorPosition: unitHex,
      direction: dir,
    });
    if (!final.ok) {
      pushLog(`【英勇衝鋒】失敗：${final.reason}`);
      setToast(`衝鋒失敗：${final.reason}`);
      setPendingPlay(null);
      if (final.forceEndTurn) endTurn('英勇衝鋒失敗強制結束', { force: true });
      return;
    }
    setBoard(final.board);
    updateActor(selected, (a) => ({
      ...a,
      hex: final.actorPosition,
      hasMovedThisTurn: true,
      hand: a.hand.filter((c) => c.instanceId !== card.instanceId),
      actionsLeft: lookupCountsTowardAction(selected, 'heroic_charge')
        ? Math.max(0, a.actionsLeft - 1)
        : a.actionsLeft,
    }));
    setPendingPlay(null);
    noteBossDamage(final.bossDamage);
    pushLog(
      `【英勇衝鋒】→ (${final.actorPosition.q},${final.actorPosition.r})` +
        ` bossDamage=${final.bossDamage}` +
        ` / events=${formatEvents(final.events)}`,
    );
    setToast(`衝鋒至 (${final.actorPosition.q},${final.actorPosition.r})`);
    if (final.forceEndTurn) endTurn('英勇衝鋒強制結束', { force: true });
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
    updateActor(selected, (a) => ({
      ...a,
      hex: result.actorPosition!,
      hand: a.hand.filter((c) => c.instanceId !== card.instanceId),
    }));
    setIsDead(false);
    setPendingPlay(null);
    pushLog(
      `【不死存在】復活於 (${result.actorPosition!.q},${result.actorPosition!.r})` +
        ` / events=${formatEvents(result.events)}`,
    );
    setToast(`復活於 (${result.actorPosition!.q},${result.actorPosition!.r})`);
    if (result.forceEndTurn) endTurn('不死存在強制結束', { force: true });
  }

  function completeDevotion(hex: Axial, card: HandCard) {
    const targetId = CLASS_ORDER.find((id) => equals(actors[id].hex, hex));
    if (!targetId || targetId === selected) {
      pushLog('【奉獻】請點其他職業棋子格');
      setToast('請點友軍格');
      return;
    }
    const result = resolveDevotion({
      actorHex: unitHex,
      allyHex: hex,
      selfCurseStacks: curseStacks,
      allyCurseStacks,
    });
    if (!result.ok) {
      pushLog(`【奉獻】失敗：${result.reason}`);
      setToast(`奉獻失敗：${result.reason}`);
      setPendingPlay(null);
      return;
    }
    updateActor(selected, (a) => ({
      ...a,
      curseStacks: result.selfCurseStacks,
      hand: a.hand.filter((c) => c.instanceId !== card.instanceId),
    }));
    updateActor(targetId, (a) => ({
      ...a,
      curseStacks: result.allyCurseStacks,
    }));
    setAllyCurseStacks(result.allyCurseStacks);
    setPendingPlay(null);
    pushLog(
      `【奉獻】自己咒 ${result.selfCurseStacks}／友 ${result.allyCurseStacks}` +
        (result.extractedUndying ? ' · 抽出不死' : '') +
        ` / events=${formatEvents(result.events)}`,
    );
    setToast(
      `奉獻：自己咒 ${result.selfCurseStacks}` +
        (result.extractedUndying ? '（抽出不死）' : ''),
    );
  }

  function onHexClick(hex: Axial) {
    if (phase === 'spawn-pick') {
      onSpawnClick(hex);
      return;
    }
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
    const counts = lookupCountsTowardAction(selected, card.cardId);
    const bonusShot =
      card.cardId === 'shot' && mayPlayShotIgnoreRange === true;

    if (won) {
      pushLog(`【${card.name}】已勝利，停止出牌`);
      setToast('已勝利');
      return;
    }
    if (me.endedThisRound) {
      pushLog(`【${card.name}】本輪已結束（唯讀）`);
      setToast('本輪已結束（唯讀）');
      return;
    }
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
    if (counts && actionsLeft <= 0 && !bonusShot) {
      const msg = '本回合行動已用完';
      pushLog(`【${card.name}】→ ${msg}`);
      setToast(msg);
      return;
    }

    if (card.cardId === 'shot') {
      const result = resolveGunnerShot({
        attacker,
        ammo,
        ignoreRangePenalty: bonusShot,
      });
      updateActor(selected, (a) => ({
        ...a,
        ammo: result.ammo,
        mayPlayShotIgnoreRange: bonusShot ? false : a.mayPlayShotIgnoreRange,
        hand: a.hand.filter((c) => c.instanceId !== card.instanceId),
        actionsLeft:
          bonusShot || !counts
            ? a.actionsLeft
            : Math.max(0, a.actionsLeft - 1),
      }));
      noteBossDamage(result.bossDamage);
      pushLog(
        `【射擊】attacker=(${attacker.q},${attacker.r}) → bossDamage=${result.bossDamage}` +
          ` / events=${formatEvents(result.events)}`,
      );
      setToast(`射擊：王傷 ${result.bossDamage}`);
      return;
    }

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
      updateActor(selected, (a) => {
        const drop = new Set(
          [card.instanceId, result.discardedShotId ?? ''].filter(Boolean),
        );
        return {
          ...a,
          ammo: result.ammo,
          hand: a.hand.filter((c) => !drop.has(c.instanceId)),
        };
      });
      pushLog(
        `【${card.name}】OK → 裝填 dmg+${result.ammo.damageBonus} draw+${result.ammo.drawBonus}`,
      );
      setToast(`${card.name}：裝填（不計次）`);
      return;
    }

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
      pushLog(`【大亂流】進入指定：須走 ${steps} 步`);
      setToast(`大亂流：點恰好 ${steps} 步的終點`);
      return;
    }

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
      updateActor(selected, (a) => ({
        ...a,
        ammo: result.ammo ?? a.ammo,
        hand: a.hand.filter((c) => c.instanceId !== card.instanceId),
        actionsLeft: counts ? Math.max(0, a.actionsLeft - 1) : a.actionsLeft,
      }));
      noteBossDamage(result.bossDamage ?? 0);
      pushLog(`【Power UP!!】temp_shot → bossDamage=${result.bossDamage}`);
      setToast(`Power UP 臨時射擊：王傷 ${result.bossDamage ?? 0}`);
      return;
    }

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
      updateActor(selected, (a) => ({
        ...a,
        ammo: result.ammo,
        mayPlayShotIgnoreRange:
          result.mayPlayShot && result.ignoreRangePenaltyForShot,
        hand: a.hand.filter((c) => c.instanceId !== card.instanceId),
        actionsLeft: counts ? Math.max(0, a.actionsLeft - 1) : a.actionsLeft,
      }));
      pushLog(`【來吧! 大鬧一場!】OK mayPlayShot=${result.mayPlayShot}`);
      setToast(
        result.mayPlayShot
          ? '大招成功：請再打 1 張手上射擊'
          : '大招成功',
      );
      return;
    }

    if (card.cardId === 'amplify') {
      const result = resolveAmplify({ hand: toMageInstances(hand) });
      updateActor(selected, (a) => ({
        ...a,
        amplifiedPending: result.amplifiedPending,
        hand: a.hand.filter((c) => c.instanceId !== card.instanceId),
      }));
      pushLog('【強能增幅】armed（不計次）');
      setToast('強能增幅：下一招吃加成');
      return;
    }

    if (card.cardId === 'magic_arrow') {
      const usedAmp = amplifiedPending;
      const result = resolveMagicArrow({
        attacker,
        amplified: usedAmp,
      });
      updateActor(selected, (a) => ({
        ...a,
        amplifiedPending: false,
        hand: a.hand.filter((c) => c.instanceId !== card.instanceId),
        actionsLeft: counts ? Math.max(0, a.actionsLeft - 1) : a.actionsLeft,
      }));
      noteBossDamage(result.bossDamage);
      pushLog(
        `【魔法箭】→ bossDamage=${result.bossDamage}` +
          (usedAmp ? '（增幅）' : ''),
      );
      setToast(`魔法箭：王傷 ${result.bossDamage}`);
      return;
    }

    if (card.cardId === 'wind') {
      setPendingPlay({ kind: 'wind_from', card });
      pushLog('【御風術】請點要推動的地形格，再點鄰格決定方向');
      setToast('御風：先點地形，再點鄰格方向');
      return;
    }

    if (card.cardId === 'focus') {
      const usedAmp = amplifiedPending;
      const result = resolveFocus({ amplified: usedAmp });
      updateActor(selected, (a) => ({
        ...a,
        amplifiedPending: false,
        hand: a.hand.filter((c) => c.instanceId !== card.instanceId),
      }));
      pushLog(
        `【聚精會神】應抽 ${result.drawCount}` +
          (usedAmp ? '（增幅）' : '') +
          ` endTurn=${result.endTurn}`,
      );
      setToast(`聚精：應抽 ${result.drawCount}（強制結束）`);
      if (result.endTurn) endTurn('聚精會神強制結束', { force: true });
      return;
    }

    if (card.cardId === 'barrier') {
      if (amplifiedPending) {
        pushLog('【磁力屏障】增幅寄出略過，改套自己');
        patchActor(selected, { amplifiedPending: false });
      }
      const result = resolveBarrier({
        mageHex: unitHex,
        mageId: 'mage',
        amplified: false,
      });
      if (!result.ok) {
        pushLog(`【磁力屏障】失敗：${result.reason}`);
        setToast(`屏障失敗：${result.reason}`);
        return;
      }
      setBarrierAura(result.aura ?? null);
      updateActor(selected, (a) => ({
        ...a,
        hand: a.hand.filter((c) => c.instanceId !== card.instanceId),
        actionsLeft: counts ? Math.max(0, a.actionsLeft - 1) : a.actionsLeft,
      }));
      pushLog(
        `【磁力屏障】鄰格 ${result.aura?.protectedHexes.length ?? 0}` +
          ` 下回合擋=${result.barrierBlockedNextTurn}`,
      );
      setToast('屏障：本輪保護自己鄰 1');
      return;
    }

    if (card.cardId === 'planar_swap') {
      const usedAmp = amplifiedPending;
      const result = resolvePlanarSwap({
        board,
        mageHex: unitHex,
        actorA: { id: selected, hex: unitHex },
        actorB: { id: allyId, hex: allyHex },
        amplified: usedAmp,
      });
      if (!result.ok) {
        pushLog(`【位面調換】失敗：${result.reason}`);
        setToast(`位面失敗：${result.reason}`);
        patchActor(selected, { amplifiedPending: false });
        return;
      }
      const pos = result.positions;
      setActors((prev) => {
        const next = { ...prev };
        const a = { ...next[selected], amplifiedPending: false };
        a.hand = a.hand.filter((c) => c.instanceId !== card.instanceId);
        if (pos && pos[selected]) a.hex = pos[selected]!;
        next[selected] = a;
        const b = { ...next[allyId] };
        if (pos && pos[allyId]) b.hex = pos[allyId]!;
        next[allyId] = b;
        return next;
      });
      pushLog(`【位面調換】${classLabel(selected)}↔${classLabel(allyId)}`);
      setToast('位面：已交換');
      if (result.endTurn) endTurn('位面調換強制結束', { force: true });
      return;
    }

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
        pushLog(`【攻擊】失敗：${msg}`);
        setToast(`攻擊失敗：${msg}`);
        return;
      }
      const result = resolveKnightAttack({
        board,
        attacker,
        target,
      });
      if (result.board !== board) setBoard(result.board);
      updateActor(selected, (a) => ({
        ...a,
        hand: a.hand.filter((c) => c.instanceId !== card.instanceId),
        actionsLeft: counts ? Math.max(0, a.actionsLeft - 1) : a.actionsLeft,
      }));
      if (result.ok) noteBossDamage(result.bossDamage);
      const tgtDesc = equals(target, BOSS_HEX)
        ? '王'
        : `牆(${target.q},${target.r})`;
      pushLog(`【攻擊】→ ${tgtDesc} bossDamage=${result.bossDamage}`);
      setToast(
        result.ok
          ? `攻擊 ${tgtDesc}：王傷 ${result.bossDamage}`
          : `攻擊失敗：${result.reason ?? '未知'}`,
      );
      return;
    }

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
      updateActor(selected, (a) => ({
        ...a,
        curseStacks: result.curseStacks,
        hand: a.hand.filter((c) => c.instanceId !== card.instanceId),
        actionsLeft: counts ? Math.max(0, a.actionsLeft - 1) : a.actionsLeft,
      }));
      pushLog(`【堅定信仰】清 ${result.cleared} → 咒層 ${result.curseStacks}`);
      setToast(`信仰：詛咒 → ${result.curseStacks}`);
      return;
    }

    if (card.cardId === 'heroic_charge') {
      setPendingPlay({ kind: 'heroic_charge', card });
      pushLog('【英勇衝鋒】請點軸向直線上的格以決定方向');
      setToast('衝鋒：點直線方向格');
      return;
    }

    if (card.cardId === 'devotion') {
      if (distance(unitHex, allyHex) === 1) {
        completeDevotion(allyHex, card);
        return;
      }
      setPendingPlay({ kind: 'devotion', card });
      pushLog('【奉獻】請點友軍格');
      setToast('奉獻：點友軍格');
      return;
    }

    if (card.cardId === 'taunt') {
      const result = resolveTaunt({
        isOthersTurn,
        knightHex: unitHex,
        existingBarrier: barrierAura
          ? { priority: barrierAura.priority, targetHex: barrierAura.targetHex }
          : null,
      });
      if (!result.ok) {
        pushLog(`【嘲諷】失敗：${result.reason}（可開「他人回合」）`);
        setToast(`嘲諷失敗：${result.reason}`);
        return;
      }
      setTauntRestriction(result.bossPlaceRestriction ?? null);
      removeFromHand(card.instanceId);
      pushLog(`【嘲諷】中心 (${unitHex.q},${unitHex.r})`);
      setToast('嘲諷：王不可在鄰 1 鋪牆');
      return;
    }

    if (card.cardId === 'undying') {
      setPendingPlay({ kind: 'undying', card });
      pushLog(
        `【不死存在】請點復活落點（isDead=${isDead} atRoundEnd=${atRoundEndAfterActors}）`,
      );
      setToast('不死：點落點（須勾死亡＋輪末）');
      return;
    }

    setToast(`「${card.name}」：此薄 UI 尚未串結算`);
    pushLog(`【${card.name}】尚未串結算`);
  }

  return (
    <div className="app">
      <header>
        <h1>薄 UI（三職業平衡試玩）</h1>
        <p className="muted">
          三人同場；傷王即鋪牆；全員結束回合才進下一輪。重製可選出生點。
        </p>
      </header>

      <div className="play-row">
        <BoardCanvas
          board={board}
          actors={
            phase === 'spawn-pick'
              ? CLASS_ORDER.filter((id) => spawnHexes[id]).map((id) => ({
                  id,
                  label: pieceLabel(id),
                  hex: spawnHexes[id]!,
                  fill: COLOR_SEL.fill,
                  stroke: COLOR_SEL.stroke,
                }))
              : boardActors
          }
          selectedHex={phase === 'playing' ? unitHex : undefined}
          hoverPath={hoverPath}
          onHexClick={onHexClick}
          onHexHover={setHoverHex}
          showSweetZone={showSweetZone && phase === 'playing'}
          onReset={beginSpawnPick}
          spawnHint={spawnHint}
        />

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

      <div className="turn-row">
        <span className="tab">
          {classLabel(selected)}
          {' · '}王HP {bossHp}/{BOSS_HP_DEMO}
          {' · '}輪 {roundIndex}
          {won ? ' · 勝利' : ''}
          {' · '}移動 {movesLeft}/{TURN_MOVES_PER_ROUND}
          {' · '}行動 {actionsLeft}/{TURN_ACTIONS_PER_ROUND}
          {moveLocked ? ' · 移動鎖定' : ''}
          {hasMovedThisTurn ? ' · 已移動' : ''}
          {me.endedThisRound ? ' · 本輪已結束' : ''}
          {mayPlayShotIgnoreRange ? ' · 大招可射' : ''}
          {' · '}({unitHex.q},{unitHex.r})
          {selected === 'gunner' ? ` · ${ammoHint}` : ''}
          {selected === 'mage' && amplifiedPending ? ' · 增幅待用' : ''}
          {selected === 'mage' && barrierAura ? ' · 屏障中' : ''}
          {selected === 'knight' ? ` · 咒${curseStacks}` : ''}
          {tauntRestriction ? ' · 嘲諷中' : ''}
          {pendingPlay ? ` · 指定:${pendingPlay.kind}` : ''}
          {lastDraw ? ` · 上次抽 ${lastDraw}` : ''}
        </span>
        <button
          type="button"
          className="end-turn"
          onClick={() => endTurn('玩家結束')}
          disabled={won || phase !== 'playing' || me.endedThisRound}
        >
          結束回合
        </button>
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

      {selected === 'knight' ? (
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
          </label>
        </div>
      ) : null}

      <div className="hand-row">
        <div className="class-picks" role="group" aria-label="職業">
          {CLASS_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              className={
                'card-btn' +
                (id === selected ? ' selected' : '') +
                (actors[id].endedThisRound ? ' ended' : '')
              }
              onClick={() => selectClass(id)}
              disabled={phase !== 'playing'}
            >
              <span className="name">{classLabel(id)}</span>
              <span className="meta">
                ({actors[id].hex.q},{actors[id].hex.r})
                {actors[id].endedThisRound ? ' · 已結束' : ' · 可行動'}
              </span>
            </button>
          ))}
        </div>
        <Hand
          cards={hand}
          onPlay={onPlay}
          onCardHover={setHoveredCard}
        />
      </div>

      <div className="toast" role="status">
        {toast}
      </div>
    </div>
  );
}
