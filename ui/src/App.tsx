/**
 * 學習筆記（三職業平衡試玩／2026-09-13t）：
 * 1) 必須經重製開局（initial phase=reset-setup）；牌庫預設 15（6 基礎＋4 小技×2＋1 大招）。
 * 2) 出局離場：空格改未老化一般並登錄老化；已有地形不重複鋪；不畫棋子、不佔格。
 * 3) 吸咒達 cap 立刻出局（槍／法 1、騎 2）；不可停在 cap。
 * 4) 越打越擠是主軸；r=5／78 袋為刻意。難度可疊加；灰項只留代價移動（即原 C 版），置底不實作。
 */
import { useMemo, useRef, useState } from 'react';
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
  absorbCursesAlongPath,
  basicMoveCap,
  canStandAt,
  createOpeningBoard,
  curseCarryCap,
  curseFullAfterAbsorb,
  getTile,
  hexKey,
  isAdjacentToMud,
  isAdjacentToSilence,
  kindAllowsCrack,
  placeTerrain,
  placeUnagedPlainIfEmpty,
  shortestPath,
  type Board,
} from '@core/board/index.js';
import {
  DEFAULT_MAP_RADIUS,
  isSealed,
  wouldEliminate,
} from '@core/enclosure/index.js';
import {
  advanceWallAging,
  applyDifficultyBag,
  pickInteriorEmptyHexes,
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
import { BoardCanvas, type BoardActorView, type BossDeckHoverInfo } from './BoardCanvas';
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

/** 官方起手張數（牌庫預設 15，其餘進抽牌堆）。 */
const OPENING_HAND = 4;


const BOSS_HP_DEFAULT = 20;

type BossCountCard = { n: 2 | 3 | 4 };
type KindToken = 'plain' | 'plain_aged' | 'curse' | 'silence' | 'mud';

const DEFAULT_KIND_PRIORITY: Record<KindToken, number> = {
  silence: 50,
  curse: 32,
  mud: 22,
  plain: 10,
  plain_aged: 0,
};

type DifficultyFlags = {
  solidWalls: boolean;
  hardStep: boolean;
  silence: boolean;
  madCurse: boolean;
  madPressure: boolean;
};

const DEFAULT_DIFFICULTY: DifficultyFlags = {
  solidWalls: false,
  hardStep: false,
  silence: false,
  madCurse: false,
  madPressure: false,
};

/** 活選項（可疊加；確認時由預設＋旗標重算袋）。灰項見表單底部。 */
const LIVE_DIFFICULTIES: readonly {
  key: keyof DifficultyFlags;
  n: number;
  label: string;
  hint: string;
}[] = [
  { key: 'solidWalls', n: 1, label: '堅固圍牆', hint: '開場 6 牆改完整、未老化、不進老化表' },
  { key: 'hardStep', n: 2, label: '寸步難移', hint: '出生後內圈空格鋪 3 泥濘' },
  { key: 'silence', n: 3, label: '沉默無聲', hint: '沉默 +1，從一般格扣 1' },
  { key: 'madCurse', n: 5, label: '瘋狂詛咒', hint: '詛咒約一般格 1/3，總格不變' },
  { key: 'madPressure', n: 6, label: '瘋狂壓力', hint: '4 格牌 +2、2 格牌 −2，袋 +4 一般格' },
];

type ResetSetup = {
  mapRadius: number;
  bossHp: number;
  deckSize: number;
  place2: number;
  place3: number;
  place4: number;
  agedWalls: number;
  intactWalls: number;
  curseTiles: number;
  silenceTiles: number;
  mudTiles: number;
  kindPriority: Record<KindToken, number>;
  extraSmallIds: Record<ClassId, string[]>;
  difficulty: DifficultyFlags;
};

function emptyExtraSmall(): Record<ClassId, string[]> {
  return { knight: [], gunner: [], mage: [] };
}

const DEFAULT_RESET_SETUP: ResetSetup = {
  mapRadius: DEFAULT_MAP_RADIUS,
  bossHp: BOSS_HP_DEFAULT,
  deckSize: 30,
  place2: 15,
  place3: 12,
  place4: 3,
  agedWalls: 0,
  intactWalls: 62,
  curseTiles: 15,
  silenceTiles: 1,
  mudTiles: 0,
  kindPriority: { ...DEFAULT_KIND_PRIORITY },
  extraSmallIds: emptyExtraSmall(),
  difficulty: { ...DEFAULT_DIFFICULTY },
};

function defaultBagCounts() {
  return {
    place2: DEFAULT_RESET_SETUP.place2,
    place3: DEFAULT_RESET_SETUP.place3,
    place4: DEFAULT_RESET_SETUP.place4,
    agedWalls: DEFAULT_RESET_SETUP.agedWalls,
    intactWalls: DEFAULT_RESET_SETUP.intactWalls,
    curseTiles: DEFAULT_RESET_SETUP.curseTiles,
    silenceTiles: DEFAULT_RESET_SETUP.silenceTiles,
    mudTiles: DEFAULT_RESET_SETUP.mudTiles,
  };
}

/** 確認重製：袋／放置由預設＋旗標重算；半徑／王HP／小技來自表單。 */
function applyDifficultyToSetup(draft: ResetSetup): ResetSetup {
  const bag = applyDifficultyBag(defaultBagCounts(), {
    silence: draft.difficulty.silence,
    madCurse: draft.difficulty.madCurse,
    madPressure: draft.difficulty.madPressure,
  });
  return { ...draft, ...bag };
}

function openingBoardOpts(flags: DifficultyFlags) {
  return flags.solidWalls ? { intactUnagedStarterWalls: true } : {};
}

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
}

function buildBossDeck(place2: number, place3: number, place4: number): BossCountCard[] {
  const cards: BossCountCard[] = [];
  for (let i = 0; i < place2; i++) cards.push({ n: 2 });
  for (let i = 0; i < place3; i++) cards.push({ n: 3 });
  for (let i = 0; i < place4; i++) cards.push({ n: 4 });
  return shuffleInPlace(cards);
}

function buildKindBag(
  aged: number,
  intact: number,
  curse: number,
  silence: number,
  mud: number,
): KindToken[] {
  const bag: KindToken[] = [];
  for (let i = 0; i < intact; i++) bag.push('plain');
  for (let i = 0; i < aged; i++) bag.push('plain_aged');
  for (let i = 0; i < curse; i++) bag.push('curse');
  for (let i = 0; i < silence; i++) bag.push('silence');
  for (let i = 0; i < mud; i++) bag.push('mud');
  return shuffleInPlace(bag);
}

function summarizeBossDeck(
  deck: readonly BossCountCard[],
  bag: readonly KindToken[],
  showAged: boolean,
  showMud: boolean,
): BossDeckHoverInfo {
  const byN = { n2: 0, n3: 0, n4: 0 };
  for (const c of deck) {
    if (c.n === 2) byN.n2 += 1;
    else if (c.n === 3) byN.n3 += 1;
    else byN.n4 += 1;
  }
  const byKind = { plain: 0, plainAged: 0, curse: 0, silence: 0, mud: 0 };
  for (const t of bag) {
    if (t === 'plain') byKind.plain += 1;
    else if (t === 'plain_aged') byKind.plainAged += 1;
    else if (t === 'curse') byKind.curse += 1;
    else if (t === 'silence') byKind.silence += 1;
    else if (t === 'mud') byKind.mud += 1;
  }
  return {
    remainingCards: deck.length,
    byN,
    byKind,
    showAged,
    showMud,
  };
}

const TURN_MOVES_PER_ROUND = 2;
const TURN_ACTIONS_PER_ROUND = 1;
const PUNISH_PER_ZERO_DAMAGE = 2;

const COLOR_ACT = { fill: '#3d7ea6', stroke: '#7ec8ff' };
const COLOR_SEL = { fill: '#3d8a5a', stroke: '#a0e8b0' };
const COLOR_END = { fill: '#5a5a5a', stroke: '#9a9a9a' };

type ClassActor = {
  hex: Axial;
  hand: HandCard[];
  /** 剩餘抽牌堆（開場 15−4；輪初抽 1）。 */
  deck: HandCard[];
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
  sealed: boolean;
  eliminated: boolean;
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
  | { kind: 'devotion'; card: HandCard }
  | { kind: 'attack'; card: HandCard };

type Phase = 'playing' | 'spawn-pick' | 'reset-setup';

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

/** 預設 15 張：6 基礎 + 4 小技×2 + 1 大招。重製可再加 0–2 張小技各 +1。 */
const BASIC_CARD: Record<ClassId, string> = {
  knight: 'attack',
  gunner: 'shot',
  mage: 'magic_arrow',
};
const SMALL_SKILLS: Record<ClassId, readonly string[]> = {
  knight: ['heroic_charge', 'faith', 'taunt', 'devotion'],
  gunner: ['playful_bottle', 'mischief_bottle', 'turbulence', 'power_up'],
  mage: ['amplify', 'wind', 'focus', 'barrier'],
};
const ULT_CARD: Record<ClassId, string> = {
  knight: 'undying',
  gunner: 'big_show',
  mage: 'planar_swap',
};

function defFor(id: ClassId, cardId: string) {
  if (id === 'gunner') return GUNNER_CARD_DEFS[cardId as GunnerCardId];
  if (id === 'mage') return MAGE_CARD_DEFS[cardId as MageCardId];
  return KNIGHT_CARD_DEFS[cardId as KnightCardId];
}

function buildShuffledDeck(
  id: ClassId,
  seqBase: number,
  extraSmallIds: string[] = [],
): HandCard[] {
  const extras = extraSmallIds.filter((s) => SMALL_SKILLS[id].includes(s));
  const ids: string[] = [
    ...Array(6).fill(BASIC_CARD[id]),
    ...SMALL_SKILLS[id].flatMap((s) => [s, s]),
    ULT_CARD[id],
    ...extras,
  ];
  shuffleInPlace(ids);
  const prefix = id === 'gunner' ? 'g' : id === 'mage' ? 'm' : 'k';
  return ids.map((cardId, i) => {
    const def = defFor(id, cardId);
    return enrichCard(
      `${prefix}-${seqBase}-${i}-${cardId}`,
      cardId,
      def.name,
      def.countsTowardAction,
      def.silenced,
    );
  });
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

/** 從牌庫抽 count 張；不足則 short。新手牌超過上限時棄最新。 */
function drawFromDeck(
  id: ClassId,
  actor: ClassActor,
  count: number,
): {
  actor: ClassActor;
  drawn: HandCard[];
  discarded: HandCard[];
  short: boolean;
} {
  if (count <= 0) {
    return { actor, drawn: [], discarded: [], short: false };
  }
  const take = Math.min(count, actor.deck.length);
  const drawn = actor.deck.slice(0, take);
  const rest = actor.deck.slice(take);
  const { hand, discarded } = applyHandCap(id, [...actor.hand, ...drawn]);
  return {
    actor: {
      ...actor,
      hand,
      deck: rest,
      drawSeq: actor.drawSeq + drawn.length,
    },
    drawn,
    discarded,
    short: drawn.length < count,
  };
}

function freshActor(
  id: ClassId,
  hex: Axial,
  board: Board,
  extraSmallIds: string[] = [],
): ClassActor {
  const all = buildShuffledDeck(id, 0, extraSmallIds);
  const rawHand = all.slice(0, OPENING_HAND);
  const deck = all.slice(OPENING_HAND);
  const { hand } = applyHandCap(id, rawHand);
  return {
    hex,
    hand,
    deck,
    movesLeft: basicMoveCap(board, hex, TURN_MOVES_PER_ROUND),
    actionsLeft: TURN_ACTIONS_PER_ROUND,
    moveLocked: false,
    hasMovedThisTurn: false,
    endedThisRound: false,
    ammo: EMPTY_AMMO_SLOT,
    amplifiedPending: false,
    mayPlayShotIgnoreRange: false,
    curseStacks: 0,
    drawSeq: 1,
    sealed: false,
    eliminated: false,
  };
}

function bootActors(
  hexes: Record<ClassId, Axial>,
  board: Board = createOpeningBoard(),
  extras: Record<ClassId, string[]> = emptyExtraSmall(),
): Actors {
  const actors = {} as Actors;
  for (const id of CLASS_ORDER) {
    actors[id] = freshActor(id, hexes[id], board, extras[id] ?? []);
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
  if (p.kind === 'attack') return '指定鄰 1：王或可拆牆（不能打其他職業）';
  return '';
}

/** 騎士攻擊可選鄰 1：王或可拆牆。不可選其他職業。 */
function occupantAt(actors: Actors, hex: Axial, self?: ClassId): ClassId | null {
  for (const id of CLASS_ORDER) {
    if (self && id === self) continue;
    if (equals(actors[id].hex, hex) && !actors[id].eliminated) return id;
  }
  return null;
}

function listKnightAttackTargets(
  board: Board,
  attacker: Axial,
  actors: Actors,
  self: ClassId,
): Axial[] {
  return neighbors(attacker).filter((h) => {
    if (occupantAt(actors, h, self)) return false;
    const tile = getTile(board, h);
    if (equals(h, BOSS_HEX)) return true;
    if (!tile) return false;
    if (
      tile.kind === 'silence' ||
      tile.kind === 'curse' ||
      tile.kind === 'punish' ||
      tile.kind === 'mud'
    ) {
      return false;
    }
    return kindAllowsCrack(tile.kind);
  });
}

function occupiedExcept(actors: Actors, self: ClassId): Axial[] {
  return CLASS_ORDER.filter((id) => id !== self && !actors[id].eliminated).map(
    (id) => actors[id].hex,
  );
}

function allHexes(actors: Actors): Axial[] {
  return CLASS_ORDER.filter((id) => !actors[id].eliminated).map(
    (id) => actors[id].hex,
  );
}

function toThreatActors(actors: Actors): ThreatActor[] {
  return CLASS_ORDER.filter((id) => !actors[id].eliminated).map((id) => ({
    id,
    hex: actors[id].hex,
    role: id === 'knight' ? 'melee' : 'ranged',
    curseStacks: actors[id].curseStacks,
  }));
}

function markEliminated(actor: ClassActor): ClassActor {
  if (actor.eliminated) return actor;
  return {
    ...actor,
    eliminated: true,
    endedThisRound: true,
    movesLeft: 0,
    actionsLeft: 0,
    moveLocked: false,
  };
}

function leaveActor(
  board: Board,
  actorsSnap: Actors,
  id: ClassId,
): { board: Board; actors: Actors; ageKey: string | null; did: boolean } {
  const a = actorsSnap[id];
  if (a.eliminated) {
    return { board, actors: actorsSnap, ageKey: null, did: false };
  }
  const left = placeUnagedPlainIfEmpty(board, a.hex);
  return {
    board: left.board,
    actors: { ...actorsSnap, [id]: markEliminated(a) },
    ageKey: left.placed ? hexKey(a.hex) : null,
    did: true,
  };
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

function pathOptsFor(
  actors: Actors,
  self: ClassId,
): { occupied: Axial[]; curseCarry: { stacks: number; cap: number } } {
  const me = actors[self];
  return {
    occupied: occupiedExcept(actors, self),
    curseCarry: {
      stacks: me.curseStacks,
      cap: curseCarryCap(self),
    },
  };
}

const INITIAL_HEXES = { ...START_HEX };
const INITIAL_ACTORS = bootActors(INITIAL_HEXES);

export function App() {
  const [phase, setPhase] = useState<Phase>('reset-setup');
  const [hasStarted, setHasStarted] = useState(false);
  const [spawnStep, setSpawnStep] = useState(0); // 0騎 1槍 2法
  const [spawnHexes, setSpawnHexes] = useState<Partial<Record<ClassId, Axial>>>(
    {},
  );
  const [resetDraft, setResetDraft] = useState<ResetSetup>(() => ({
    ...DEFAULT_RESET_SETUP,
    kindPriority: { ...DEFAULT_KIND_PRIORITY },
    extraSmallIds: emptyExtraSmall(),
    difficulty: { ...DEFAULT_DIFFICULTY },
  }));
  const [matchExtraSmall, setMatchExtraSmall] = useState<Record<ClassId, string[]>>(
    () => emptyExtraSmall(),
  );
  const [matchDifficulty, setMatchDifficulty] = useState<DifficultyFlags>(
    () => ({ ...DEFAULT_DIFFICULTY }),
  );
  const [mapRadius, setMapRadius] = useState(DEFAULT_MAP_RADIUS);
  const [bossHpMax, setBossHpMax] = useState(BOSS_HP_DEFAULT);
  const [showAgedInDeck, setShowAgedInDeck] = useState(false);
  const [bossDeck, setBossDeck] = useState<BossCountCard[]>(() =>
    buildBossDeck(
      DEFAULT_RESET_SETUP.place2,
      DEFAULT_RESET_SETUP.place3,
      DEFAULT_RESET_SETUP.place4,
    ),
  );
  const [kindBag, setKindBag] = useState<KindToken[]>(() =>
    buildKindBag(
      DEFAULT_RESET_SETUP.agedWalls,
      DEFAULT_RESET_SETUP.intactWalls,
      DEFAULT_RESET_SETUP.curseTiles,
      DEFAULT_RESET_SETUP.silenceTiles,
      DEFAULT_RESET_SETUP.mudTiles,
    ),
  );
  const [showMudInDeck, setShowMudInDeck] = useState(false);
  const [selected, setSelected] = useState<ClassId>('gunner');
  const [actors, setActors] = useState<Actors>(() => INITIAL_ACTORS);
  const actorsRef = useRef(actors);
  actorsRef.current = actors;
  const [board, setBoard] = useState<Board>(() => createOpeningBoard());
  const [bossHp, setBossHp] = useState(BOSS_HP_DEFAULT);
  const [won, setWon] = useState(false);
  const [lost, setLost] = useState(false);
  const [roundIndex, setRoundIndex] = useState(0);
  const [bossDamagedThisRound, setBossDamagedThisRound] = useState(false);
  const [aging, setAging] = useState<Map<string, number>>(() => new Map());
  const [wallsPlacedThisRound, setWallsPlacedThisRound] = useState<string[]>(
    [],
  );
  const [log, setLog] = useState<string[]>(() => [
    '薄 UI：請先重製設定再開局。越打越擠是主軸。',
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
    const others = CLASS_ORDER.filter(
      (id) => id !== selected && !actors[id].eliminated,
    );
    const adj = others.find(
      (id) => distance(actors[selected].hex, actors[id].hex) === 1,
    );
    return adj ?? others[0] ?? CLASS_ORDER.find((id) => id !== selected)!;
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
    if (me.eliminated) return null;
    const opts = pathOptsFor(actors, selected);
    const path = shortestPath(board, unitHex, hoverHex, opts);
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

  const attackTargets = useMemo(() => {
    if (phase !== 'playing') return null;
    if (!pendingPlay || pendingPlay.kind !== 'attack') return null;
    if (me.endedThisRound) return null;
    return listKnightAttackTargets(board, unitHex, actors, selected);
  }, [actors, board, me.endedThisRound, pendingPlay, phase, selected, unitHex]);

  const showSweetZone =
    hoveredCard?.cardId === 'shot' || hoveredCard?.cardId === 'magic_arrow';

  const bossDeckInfo = useMemo(
    () => summarizeBossDeck(bossDeck, kindBag, showAgedInDeck, showMudInDeck),
    [bossDeck, kindBag, showAgedInDeck, showMudInDeck],
  );

  const boardActors: BoardActorView[] = CLASS_ORDER.filter(
    (id) => !actors[id].eliminated,
  ).map((id) => {
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
      curseStacks: a.curseStacks,
      sealed: a.sealed,
      eliminated: false,
      adjacentSilence: isAdjacentToSilence(board, a.hex),
    };
  });

  const spawnHint =
    phase === 'spawn-pick'
      ? `選出生點 ${spawnStep + 1}/3：請點可站空格放置「${classLabel(CLASS_ORDER[spawnStep]!)}」`
      : null;

  function pushLog(line: string) {
    setLog((prev) => [...prev, line]);
  }

  /** 盤面變更後：封印標誌／出局離場（壓封印者本體或之後任何出局）。 */
  function syncEnclosureOnBoard(
    boardNow: Board,
    actorsSnap: Actors,
    placedHexes: readonly Axial[] = [],
  ): { board: Board; actors: Actors; ageKeys: string[] } {
    const bounds = { radius: mapRadius };
    let boardOut = boardNow;
    let next = { ...actorsSnap } as Actors;
    const ageKeys: string[] = [];
    const sealedLogs: string[] = [];
    const elimLogs: string[] = [];

    for (const placed of placedHexes) {
      for (const id of CLASS_ORDER) {
        const a = next[id];
        if (a.eliminated) continue;
        if (wouldEliminate(boardOut, a.hex, bounds, placed)) {
          const left = leaveActor(boardOut, next, id);
          boardOut = left.board;
          next = left.actors;
          if (left.ageKey) ageKeys.push(left.ageKey);
          next[id] = { ...next[id], sealed: true };
          elimLogs.push(`【出局】${classLabel(id)} 出局，離場，格改一般`);
        }
      }
    }

    for (const id of CLASS_ORDER) {
      const a = next[id];
      if (a.eliminated) continue;
      const sealed = isSealed(boardOut, a.hex, bounds);
      if (sealed && !a.sealed) {
        sealedLogs.push(`【封印】${classLabel(id)} → 封`);
      }
      if (sealed !== a.sealed) {
        next[id] = { ...a, sealed };
      }
    }

    for (const line of elimLogs) pushLog(line);
    for (const line of sealedLogs) pushLog(line);
    if (elimLogs.length > 0) {
      setToast(elimLogs[elimLogs.length - 1]!.replace('【出局】', ''));
    } else if (sealedLogs.length > 0) {
      setToast(sealedLogs[sealedLogs.length - 1]!.replace('【封印】', '封印：'));
    }
    return { board: boardOut, actors: next, ageKeys };
  }

  function maybeLoseIfAllOut(next: Actors, hpNow: number): boolean {
    if (hpNow <= 0) return false;
    if (!CLASS_ORDER.every((id) => next[id].eliminated)) return false;
    setLost(true);
    pushLog('【敗北】三人皆出局，王仍存活');
    setToast('敗北：全員出局');
    return true;
  }

  function finishRoundIfAllDone(
    boardNow: Board,
    nextActors: Actors,
    damaged: boolean,
  ) {
    if (CLASS_ORDER.every((c) => nextActors[c].eliminated)) return;
    const allDone = CLASS_ORDER.every(
      (c) => nextActors[c].endedThisRound || nextActors[c].eliminated,
    );
    if (!allDone) return;
    finishRound(
      boardNow,
      nextActors,
      aging,
      wallsPlacedThisRound,
      damaged,
    );
  }

  function applyCurseFullIfNeeded(
    boardNow: Board,
    actorsSnap: Actors,
    id: ClassId,
    absorbedCount: number,
  ): { board: Board; actors: Actors; ageKeys: string[] } {
    const a = actorsSnap[id];
    if (
      a.eliminated ||
      !curseFullAfterAbsorb(id, a.curseStacks, absorbedCount)
    ) {
      return { board: boardNow, actors: actorsSnap, ageKeys: [] };
    }
    const left = leaveActor(boardNow, actorsSnap, id);
    if (left.did) {
      pushLog(`【出局】${classLabel(id)} 出局，離場，格改一般`);
      setToast(`${classLabel(id)} 出局，離場，格改一般`);
    }
    return {
      board: left.board,
      actors: left.actors,
      ageKeys: left.ageKey ? [left.ageKey] : [],
    };
  }

  function applyBoardAndEnclosure(
    boardNow: Board,
    actorsSnap?: Actors,
    placedHexes: readonly Axial[] = [],
    extraAgeKeys: string[] = [],
    opts?: { hpNow?: number; canAdvanceRound?: boolean; damaged?: boolean },
  ) {
    const base = actorsSnap ?? actors;
    const synced = syncEnclosureOnBoard(boardNow, base, placedHexes);
    const ageKeys = [...extraAgeKeys, ...synced.ageKeys];
    setBoard(synced.board);
    setActors(synced.actors);
    if (ageKeys.length > 0) {
      setWallsPlacedThisRound((w) => [...w, ...ageKeys]);
    }
    const hpNow = opts?.hpNow ?? bossHp;
    const lostAll = maybeLoseIfAllOut(synced.actors, hpNow);
    if (
      opts?.canAdvanceRound !== false &&
      !lostAll &&
      hpNow > 0
    ) {
      finishRoundIfAllDone(
        synced.board,
        synced.actors,
        opts?.damaged ?? bossDamagedThisRound,
      );
    }
    return synced;
  }

  function patchActor(id: ClassId, patch: Partial<ClassActor>) {
    setActors((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  }

  function commitActors(next: Actors) {
    actorsRef.current = next;
    setActors(next);
  }

  function updateActor(
    id: ClassId,
    updater: (a: ClassActor) => ClassActor,
  ) {
    const snap = actorsRef.current;
    const next: Actors = { ...snap, [id]: updater(snap[id]) };
    commitActors(next);
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

  /** 有效傷王：扣 HP＋抽王牌庫 N 格並依地形袋鋪放。 */
  function noteBossDamage(
    amount: number,
    liveBoard: Board = board,
    extraExclude: Axial[] = [],
    liveActors?: Actors,
    extraAgeKeys: string[] = [],
  ) {
    if (amount <= 0 || won || lost) return;
    const actorsForThreat = liveActors ?? actors;
    setBossDamagedThisRound(true);
    const hpAfter = Math.max(0, bossHp - amount);
    setBossHp(hpAfter);
    if (hpAfter <= 0) {
      setWon(true);
      setToast('勝利：王 HP ≤ 0');
      setLog((prev) => [...prev, '【勝利】王 HP ≤ 0，停止繼續操作']);
    }

    if (bossDeck.length === 0) {
      pushLog('【王】牌盡（無法再抽鋪放）');
      if (hpAfter > 0) {
        setLost(true);
        pushLog('【敗北】王牌盡且王仍存活');
        setToast('敗北：王牌盡');
      }
      return;
    }

    const card = bossDeck[0]!;
    const restDeck = bossDeck.slice(1);
    setBossDeck(restDeck);

    const protectedHexes = collectProtected(tauntRestriction, barrierAura);
    const exclude = [
      ...wallsPlacedThisRound.map((k) => {
        const [q, r] = k.split(',').map(Number);
        return { q: q!, r: r! };
      }),
      ...extraExclude,
    ];
    const picks = pickThreatPlacementHexes(
      liveBoard,
      toThreatActors(actorsForThreat),
      card.n,
      {
        occupied: allHexes(actorsForThreat),
        protectedHexes,
        bounds: { radius: mapRadius },
        exclude,
        crushHexes: CLASS_ORDER.filter(
          (id) =>
            actorsForThreat[id].sealed && !actorsForThreat[id].eliminated,
        ).map((id) => actorsForThreat[id].hex),
      },
    );

    let boardNow = liveBoard;
    let bagNow = [...kindBag];
    const placedParts: string[] = [];
    const ageKeys: string[] = [];
    const take = Math.min(picks.length, bagNow.length);
    const tokens = bagNow.slice(0, take);
    bagNow = bagNow.slice(take);

    for (let i = 0; i < tokens.length; i++) {
      const pick = picks[i]!;
      const tok = tokens[i]!;
      if (tok === 'plain') {
        boardNow = placeTerrain(boardNow, pick, 'plain');
        ageKeys.push(hexKey(pick));
        placedParts.push(`一般格@(${pick.q},${pick.r})`);
      } else if (tok === 'plain_aged') {
        boardNow = placeTerrain(boardNow, pick, 'plain', { aged: true });
        placedParts.push(`老化@(${pick.q},${pick.r})`);
      } else if (tok === 'curse') {
        boardNow = placeTerrain(boardNow, pick, 'curse');
        placedParts.push(`詛咒@(${pick.q},${pick.r})`);
      } else if (tok === 'silence') {
        boardNow = placeTerrain(boardNow, pick, 'silence');
        placedParts.push(`沉默@(${pick.q},${pick.r})`);
      } else if (tok === 'mud') {
        boardNow = placeTerrain(boardNow, pick, 'mud');
        placedParts.push(`泥濘@(${pick.q},${pick.r})`);
      }
    }

    setKindBag(bagNow);
    if (ageKeys.length > 0) {
      setWallsPlacedThisRound((w) => [...w, ...ageKeys]);
    }
    const placeDesc =
      placedParts.length > 0 ? placedParts.join('、') : '（無空位／袋空）';
    pushLog(
      `【王】抽了 ${card.n} 格，擺放：${placeDesc}（剩牌 ${restDeck.length}）`,
    );

    let nextActors: Actors = { ...(liveActors ?? actors) };
    for (const id of CLASS_ORDER) {
      const a = nextActors[id];
      if (a.eliminated) continue;
      const cap = basicMoveCap(boardNow, a.hex, TURN_MOVES_PER_ROUND);
      if (a.movesLeft > cap) {
        nextActors = {
          ...nextActors,
          [id]: { ...a, movesLeft: cap },
        };
        if (cap === 1 && isAdjacentToMud(boardNow, a.hex)) {
          pushLog(`【泥濘】${classLabel(id)} 基礎移動上限變 1（鄰泥濘）`);
        }
      }
    }
    applyBoardAndEnclosure(boardNow, nextActors, picks, extraAgeKeys, {
      hpNow: hpAfter,
      canAdvanceRound: hpAfter > 0,
      damaged: true,
    });
  }

  function finishRound(liveBoard: Board, liveActors: Actors, liveAging: Map<string, number>, liveWalls: string[], damaged: boolean) {
    const logs: string[] = [];
    let boardNow = liveBoard;
    let agingNow = liveAging;
    let punishPicks: Axial[] = [];

    if (!damaged) {
      const protectedHexes = collectProtected(tauntRestriction, barrierAura);
      const picks = pickThreatPlacementHexes(
        boardNow,
        toThreatActors(liveActors),
        PUNISH_PER_ZERO_DAMAGE,
        {
          occupied: allHexes(liveActors),
          protectedHexes,
          bounds: { radius: mapRadius },
        },
      );
      punishPicks = picks;
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

    // 重置三人可行動；保留裝填；各從牌庫抽 1
    let nextActors = { ...liveActors } as Actors;
    const drawNames: string[] = [];
    for (const id of CLASS_ORDER) {
      const prev = liveActors[id];
      if (prev.eliminated) {
        nextActors[id] = {
          ...prev,
          movesLeft: 0,
          actionsLeft: 0,
          moveLocked: false,
          hasMovedThisTurn: false,
          endedThisRound: true,
          amplifiedPending: false,
          mayPlayShotIgnoreRange: false,
        };
        continue;
      }
      const moveCap = basicMoveCap(boardNow, prev.hex, TURN_MOVES_PER_ROUND);
      if (moveCap === 1 && isAdjacentToMud(boardNow, prev.hex)) {
        logs.push(`【泥濘】${classLabel(id)} 鄰泥濘，基礎移動上限 1`);
      }
      let a: ClassActor = {
        ...prev,
        movesLeft: moveCap,
        actionsLeft: TURN_ACTIONS_PER_ROUND,
        moveLocked: false,
        hasMovedThisTurn: false,
        endedThisRound: false,
        amplifiedPending: false,
        mayPlayShotIgnoreRange: false,
        // ammo / deck / curseStacks 保留
      };
      const pulled = drawFromDeck(id, a, 1);
      a = pulled.actor;
      if (pulled.short) {
        logs.push(`【抽牌】${classLabel(id)} 牌庫空了`);
      }
      if (pulled.discarded.length > 0) {
        logs.push(
          `【手牌上限】${classLabel(id)} 棄最新 ${pulled.discarded.map((c) => c.name).join('、')}`,
        );
      }
      for (const c of pulled.drawn) {
        if (a.hand.some((h) => h.instanceId === c.instanceId)) {
          drawNames.push(`${classLabel(id)}:${c.name}`);
        }
      }
      nextActors[id] = a;
    }
    if (drawNames.length) {
      logs.push(`【抽牌】${drawNames.join('；')}`);
      setLastDraw(drawNames.join(' / '));
    }

    const enc = syncEnclosureOnBoard(boardNow, nextActors, punishPicks);
    boardNow = enc.board;
    nextActors = enc.actors;
    maybeLoseIfAllOut(nextActors, bossHp);
    setBoard(boardNow);
    setAging(agingNow);
    setWallsPlacedThisRound(enc.ageKeys);
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

  function endTurn(
    reason = '結束回合',
    opts?: { force?: boolean; actorsNow?: Actors },
  ) {
    if (won) {
      pushLog('【結束回合】已勝利，停止操作');
      setToast('已勝利');
      return;
    }
    if (lost) {
      pushLog('【結束回合】已敗北，停止操作');
      setToast('已敗北');
      return;
    }
    if (phase !== 'playing') return;
    const id = selected;
    const snapshot = opts?.actorsNow ?? actors;
    const actor = snapshot[id];
    if (actor.eliminated) {
      pushLog(`【結束回合】${classLabel(id)} 已出局`);
      setToast('已出局');
      return;
    }
    if (actor.endedThisRound) {
      pushLog(`【結束回合】${classLabel(id)} 本輪已結束`);
      setToast('本輪已結束');
      return;
    }

    const stillMoves = actor.movesLeft > 0;
    const hasCountedPlayable = actor.hand.some((c) => {
      if (!lookupCountsTowardAction(id, c.cardId)) return false;
      if (actor.actionsLeft > 0) return true;
      return c.cardId === 'shot' && actor.mayPlayShotIgnoreRange;
    });
    const canStillAct = stillMoves || hasCountedPlayable;

    if (!opts?.force && canStillAct && endConfirmFor !== id) {
      setEndConfirmFor(id);
      const msg = '還可移動／出牌';
      pushLog(`【結束回合】${classLabel(id)} 提醒：${msg}（再點一次確認）`);
      setToast(msg);
      return;
    }

    setEndConfirmFor(null);
    setPendingPlay(null);
    const nextActors: Actors = {
      ...snapshot,
      [id]: { ...actor, endedThisRound: true, moveLocked: false },
    };
    commitActors(nextActors);
    pushLog(`【結束回合】${classLabel(id)}／${reason}`);
    setToast(`${classLabel(id)} 結束（灰）`);

    const allEnded = CLASS_ORDER.every(
      (c) =>
        (c === id ? true : nextActors[c].endedThisRound) ||
        nextActors[c].eliminated,
    );
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

  function openResetSetup() {
    setResetDraft({
      ...DEFAULT_RESET_SETUP,
      kindPriority: { ...DEFAULT_KIND_PRIORITY },
      extraSmallIds: emptyExtraSmall(),
      difficulty: { ...DEFAULT_DIFFICULTY },
    });
    setPhase('reset-setup');
    setPendingPlay(null);
    setEndConfirmFor(null);
    setToast('請確認重製設定');
  }

  function beginSpawnPick(setup: ResetSetup) {
    setMapRadius(setup.mapRadius);
    setBossHpMax(setup.bossHp);
    setBossHp(setup.bossHp);
    setShowAgedInDeck(setup.agedWalls > 0);
    setShowMudInDeck(setup.mudTiles > 0);
    setBossDeck(buildBossDeck(setup.place2, setup.place3, setup.place4));
    setKindBag(
      buildKindBag(
        setup.agedWalls,
        setup.intactWalls,
        setup.curseTiles,
        setup.silenceTiles,
        setup.mudTiles,
      ),
    );
    setMatchExtraSmall({
      knight: [...setup.extraSmallIds.knight],
      gunner: [...setup.extraSmallIds.gunner],
      mage: [...setup.extraSmallIds.mage],
    });
    setMatchDifficulty({ ...setup.difficulty });
    setPhase('spawn-pick');
    setSpawnStep(0);
    setSpawnHexes({});
    setBoard(createOpeningBoard(openingBoardOpts(setup.difficulty)));
    setWon(false);
    setLost(false);
    setRoundIndex(0);
    setBossDamagedThisRound(false);
    setAging(new Map());
    setWallsPlacedThisRound([]);
    setPendingPlay(null);
    setEndConfirmFor(null);
    setHoverHex(null);
    setBarrierAura(null);
    setTauntRestriction(null);
    setLog([
      `重製對局：半徑 ${setup.mapRadius}・王HP ${setup.bossHp}・牌庫 ${setup.deckSize}。依序點 騎士 → 槍手 → 法師 出生格。`,
    ]);
    setToast('請點騎士出生格');
  }

  function confirmResetSetup() {
    const s = applyDifficultyToSetup(resetDraft);
    setResetDraft(s);
    const placeSum = s.place2 + s.place3 + s.place4;
    if (placeSum !== s.deckSize) {
      const msg = `放置張數合計 ${placeSum} ≠ 手卡張數 ${s.deckSize}`;
      setToast(msg);
      pushLog(`【重製】${msg}`);
      return;
    }
    const hexCapacity = s.place2 * 2 + s.place3 * 3 + s.place4 * 4;
    const kindSum =
      s.agedWalls +
      s.intactWalls +
      s.curseTiles +
      s.silenceTiles +
      s.mudTiles;
    if (kindSum !== hexCapacity) {
      const msg = `地形袋合計 ${kindSum} ≠ 可鋪總格數 ${hexCapacity}`;
      setToast(msg);
      pushLog(`【重製】${msg}`);
      return;
    }
    if (s.mapRadius < 3 || s.mapRadius > 8) {
      setToast('地圖半徑建議 3–8');
      return;
    }
    for (const id of CLASS_ORDER) {
      const extras = s.extraSmallIds[id] ?? [];
      const unique = [...new Set(extras)];
      if (unique.length !== extras.length) {
        setToast(`${classLabel(id)} 小技不可重複`);
        return;
      }
      if (unique.length > 2) {
        setToast(`${classLabel(id)} 小技最多加 2 張`);
        return;
      }
      if (unique.some((c) => !SMALL_SKILLS[id].includes(c))) {
        setToast(`${classLabel(id)} 小技不在該職業列表`);
        return;
      }
    }
    beginSpawnPick(s);
  }

  function completeSpawnAndStart(hexes: Record<ClassId, Axial>) {
    let opening = createOpeningBoard(openingBoardOpts(matchDifficulty));
    const mudNotes: string[] = [];
    if (matchDifficulty.hardStep) {
      const muds = pickInteriorEmptyHexes(
        opening,
        CLASS_ORDER.map((id) => hexes[id]),
        mapRadius,
        3,
      );
      for (const h of muds) {
        opening = placeTerrain(opening, h, 'mud');
      }
      if (muds.length > 0) {
        mudNotes.push(
          `【寸步難移】內圈泥濘 ${muds.map((h) => `(${h.q},${h.r})`).join('、')}`,
        );
      } else {
        mudNotes.push('【寸步難移】無空位可鋪泥濘');
      }
    }
    const next = bootActors(hexes, opening, matchExtraSmall);
    for (const id of CLASS_ORDER) {
      const cap = basicMoveCap(opening, hexes[id], TURN_MOVES_PER_ROUND);
      if (cap === 1 && isAdjacentToMud(opening, hexes[id])) {
        mudNotes.push(`【泥濘】${classLabel(id)} 鄰泥濘，基礎移動上限 1`);
      }
    }
    setActors(next);
    setSelected('gunner');
    setHasStarted(true);
    setPhase('playing');
    setSpawnHexes({});
    setSpawnStep(0);
    setBoard(opening);
    setWon(false);
    setLost(false);
    setRoundIndex(0);
    setBossDamagedThisRound(false);
    setAging(new Map());
    setWallsPlacedThisRound([]);
    const extraNotes = CLASS_ORDER.flatMap((id) => {
      const xs = matchExtraSmall[id];
      return xs.length
        ? [`【牌庫】${classLabel(id)} 加 ${xs.map((c) => defFor(id, c).name).join('、')}`]
        : [];
    });
    const diffOn = LIVE_DIFFICULTIES.filter((d) => matchDifficulty[d.key]).map(
      (d) => d.label,
    );
    setLog([
      '薄 UI：三職業平衡試玩。出生完成。傷王抽牌鋪地形；三人皆結束才進下一輪。',
      `【出生】騎(${hexes.knight.q},${hexes.knight.r}) 槍(${hexes.gunner.q},${hexes.gunner.r}) 法(${hexes.mage.q},${hexes.mage.r})`,
      ...mudNotes,
      ...extraNotes,
      ...(diffOn.length ? [`【難度】${diffOn.join('、')}`] : []),
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
    if (lost) {
      setToast('已敗北，停止操作');
      return;
    }
    if (me.eliminated) {
      setToast('已出局，無法行動');
      pushLog('【移動】拒絕：已出局');
      return;
    }
    if (me.endedThisRound) {
      setToast('本輪已結束（唯讀）');
      pushLog('【移動】拒絕：本輪已結束');
      return;
    }
    if (me.sealed) {
      setToast('已封印，無法移動');
      pushLog('【移動】拒絕：已封印');
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

    const opts = pathOptsFor(actors, selected);
    const occupied = opts.occupied;
    const path = shortestPath(board, unitHex, hex, opts);
    if (path === null) {
      const hitOther = occupied.some((o) => equals(o, hex));
      const atCap = me.curseStacks >= curseCarryCap(selected);
      const towardCurse = getTile(board, hex)?.kind === 'curse';
      const why = equals(hex, BOSS_HEX)
        ? '不可站王格'
        : hitOther
          ? '不可站其他職業格'
          : atCap && towardCurse
            ? '詛咒已達上限，不可再踩'
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
    const cap = curseCarryCap(selected);
    const absorbed = absorbCursesAlongPath(board, path, me.curseStacks, cap);
    const blockCurse = absorbed.curseStacks >= cap;
    let nextLocked = true;
    let stuckUnlock = false;
    if (left <= 0) {
      nextLocked = false;
    } else {
      const canCont = neighbors(dest).some((n) =>
        canStandAt(absorbed.board, n, { occupied, blockCurse }),
      );
      if (!canCont) {
        nextLocked = false;
        stuckUnlock = true;
      }
    }

    const moved: Actors = {
      ...actors,
      [selected]: {
        ...actors[selected],
        hex: dest,
        hasMovedThisTurn: true,
        movesLeft: left,
        moveLocked: nextLocked,
        curseStacks: absorbed.curseStacks,
      },
    };
    const curseLeave = applyCurseFullIfNeeded(
      absorbed.board,
      moved,
      selected,
      absorbed.absorbedHexes.length,
    );
    applyBoardAndEnclosure(
      curseLeave.board,
      curseLeave.actors,
      [],
      curseLeave.ageKeys,
    );
    setEndConfirmFor(null);

    const via =
      steps === 2
        ? `經 (${path[1]!.q},${path[1]!.r}) 兩步一次套用`
        : '一步';
    const curseNote =
      absorbed.absorbedHexes.length > 0
        ? ` · 吸咒×${absorbed.absorbedHexes.length}→層${absorbed.curseStacks}`
        : '';
    const lockNote = nextLocked
      ? ' · 移動鎖定中（須走完才可出牌）'
      : stuckUnlock
        ? ''
        : ' · 移動完成，可出牌';
    pushLog(
      `【移動】${classLabel(selected)} (${from.q},${from.r}) → (${dest.q},${dest.r})` +
        `（${via} · 剩餘移動 ${left}${curseNote}${lockNote}）`,
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
    const opts = pathOptsFor(actors, selected);
    const occupied = opts.occupied;
    const full = shortestPath(board, unitHex, hex, opts);
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
    const cap = curseCarryCap(selected);
    const absorbed = absorbCursesAlongPath(
      board,
      full,
      actors[selected].curseStacks,
      cap,
    );
    const drop = new Set([
      pending.card.instanceId,
      ...result.discardedBottleIds,
    ]);
    const moved: Actors = {
      ...actors,
      [selected]: {
        ...actors[selected],
        hex: result.actorPosition,
        hasMovedThisTurn: true,
        curseStacks: absorbed.curseStacks,
        hand: actors[selected].hand.filter((c) => !drop.has(c.instanceId)),
        actionsLeft: lookupCountsTowardAction(selected, 'turbulence')
          ? Math.max(0, actors[selected].actionsLeft - 1)
          : actors[selected].actionsLeft,
      },
    };
    const curseLeave = applyCurseFullIfNeeded(
      absorbed.board,
      moved,
      selected,
      absorbed.absorbedHexes.length,
    );
    applyBoardAndEnclosure(
      curseLeave.board,
      curseLeave.actors,
      [],
      curseLeave.ageKeys,
    );
    setPendingPlay(null);
    const curseNote =
      absorbed.absorbedHexes.length > 0
        ? ` · 吸咒×${absorbed.absorbedHexes.length}→層${absorbed.curseStacks}`
        : '';
    pushLog(
      `【大亂流】→ (${result.actorPosition.q},${result.actorPosition.r})` +
        ` steps=${result.steps}${curseNote}` +
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
      actors: CLASS_ORDER.filter((id) => !actors[id].eliminated).map((id) => ({
        id,
        hex: actors[id].hex,
      })),
    });
    if (!result.ok) {
      pushLog(`【御風術】失敗：${result.reason}`);
      setToast(`御風失敗：${result.reason}`);
      return;
    }
    const nextActors: Actors = {
      ...actors,
      [selected]: {
        ...actors[selected],
        amplifiedPending: false,
        hand: actors[selected].hand.filter((c) => c.instanceId !== card.instanceId),
        actionsLeft: lookupCountsTowardAction(selected, 'wind')
          ? Math.max(0, actors[selected].actionsLeft - 1)
          : actors[selected].actionsLeft,
      },
    };
    applyBoardAndEnclosure(result.board, nextActors);
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
    const others = CLASS_ORDER.filter(
      (id) => id !== selected && !actors[id].eliminated,
    ).map((id) => ({
      id,
      hex: actors[id].hex,
    }));
    const final = resolveHeroicCharge({
      board,
      actorPosition: unitHex,
      direction: dir,
      bounds: { radius: mapRadius },
      units: others,
    });
    if (!final.ok) {
      pushLog(`【英勇衝鋒】失敗：${final.reason}`);
      setToast(`衝鋒失敗：${final.reason}`);
      setPendingPlay(null);
      if (final.forceEndTurn) endTurn('英勇衝鋒失敗強制結束', { force: true });
      return;
    }
    const absorbedCount = final.events.filter(
      (e) => e.type === 'CurseAbsorbed',
    ).length;
    const cap = curseCarryCap(selected);
    const nextStacks = Math.min(
      cap,
      actors[selected].curseStacks + absorbedCount,
    );
    const charged: Actors = {
      ...actors,
      [selected]: {
        ...actors[selected],
        hex: final.actorPosition,
        hasMovedThisTurn: true,
        endedThisRound: true,
        moveLocked: false,
        curseStacks: nextStacks,
        hand: actors[selected].hand.filter((c) => c.instanceId !== card.instanceId),
        actionsLeft: lookupCountsTowardAction(selected, 'heroic_charge')
          ? Math.max(0, actors[selected].actionsLeft - 1)
          : actors[selected].actionsLeft,
      },
    };
    const curseLeave = applyCurseFullIfNeeded(
      final.board,
      charged,
      selected,
      absorbedCount,
    );
    setPendingPlay(null);
    setEndConfirmFor(null);
    if (final.bossDamage > 0) {
      noteBossDamage(
        final.bossDamage,
        curseLeave.board,
        [],
        curseLeave.actors,
        curseLeave.ageKeys,
      );
    } else {
      applyBoardAndEnclosure(
        curseLeave.board,
        curseLeave.actors,
        [],
        curseLeave.ageKeys,
        { damaged: bossDamagedThisRound },
      );
    }
    pushLog(
      `【英勇衝鋒】→ (${final.actorPosition.q},${final.actorPosition.r})` +
        ` 強制結束` +
        ` bossDamage=${final.bossDamage}` +
        ` / events=${formatEvents(final.events)}`,
    );
    setToast(`衝鋒至 (${final.actorPosition.q},${final.actorPosition.r})，回合結束`);
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
    const nextActors: Actors = {
      ...actors,
      [selected]: {
        ...actors[selected],
        hex: result.actorPosition!,
        hand: actors[selected].hand.filter((c) => c.instanceId !== card.instanceId),
      },
    };
    applyBoardAndEnclosure(result.board, nextActors);
    setIsDead(false);
    setPendingPlay(null);
    pushLog(
      `【不死存在】復活於 (${result.actorPosition!.q},${result.actorPosition!.r})` +
        ` / events=${formatEvents(result.events)}`,
    );
    setToast(`復活於 (${result.actorPosition!.q},${result.actorPosition!.r})`);
    if (result.forceEndTurn) endTurn('不死存在強制結束', { force: true });
  }

  function completeKnightAttack(hex: Axial, card: HandCard) {
    const targets = listKnightAttackTargets(board, unitHex, actors, selected);
    if (!targets.some((t) => equals(t, hex))) {
      pushLog(`【攻擊】(${hex.q},${hex.r}) 不是有效目標`);
      setToast('請點高亮的鄰 1 目標');
      return;
    }
    const counts = lookupCountsTowardAction(selected, 'attack');
    const result = resolveKnightAttack({
      board,
      attacker: unitHex,
      target: hex,
    });
    const nextActors: Actors = {
      ...actors,
      [selected]: {
        ...actors[selected],
        hand: actors[selected].hand.filter((c) => c.instanceId !== card.instanceId),
        actionsLeft: counts
          ? Math.max(0, actors[selected].actionsLeft - 1)
          : actors[selected].actionsLeft,
      },
    };
    if (result.ok) {
      applyBoardAndEnclosure(result.board, nextActors);
    } else {
      setActors(nextActors);
    }
    setPendingPlay(null);
    if (result.ok) {
      const cleared = equals(hex, BOSS_HEX) ? [] : [hex];
      noteBossDamage(result.bossDamage, result.board, cleared, nextActors);
    }
    const tgtDesc = equals(hex, BOSS_HEX) ? '王' : `牆(${hex.q},${hex.r})`;
    pushLog(
      `【攻擊】→ ${tgtDesc} bossDamage=${result.bossDamage}` +
        ` / events=${formatEvents(result.events)}`,
    );
    setToast(
      result.ok
        ? `攻擊 ${tgtDesc}：王傷 ${result.bossDamage}`
        : `攻擊失敗：${result.reason ?? '未知'}`,
    );
  }

  function completeDevotion(hex: Axial, card: HandCard) {
    const targetId = CLASS_ORDER.find(
      (id) => !actors[id].eliminated && equals(actors[id].hex, hex),
    );
    if (!targetId || targetId === selected) {
      pushLog('【奉獻】請點其他職業棋子格');
      setToast('請點友軍格');
      return;
    }
    const result = resolveDevotion({
      actorHex: unitHex,
      allyHex: hex,
      selfCurseStacks: curseStacks,
      allyCurseStacks: actors[targetId].curseStacks,
    });
    if (!result.ok) {
      pushLog(`【奉獻】失敗：${result.reason}`);
      setToast(`奉獻失敗：${result.reason}`);
      setPendingPlay(null);
      return;
    }
    const absorbedCount = Math.max(0, result.selfCurseStacks - curseStacks);
    const updated: Actors = {
      ...actors,
      [selected]: {
        ...actors[selected],
        curseStacks: result.selfCurseStacks,
        hand: actors[selected].hand.filter((c) => c.instanceId !== card.instanceId),
      },
      [targetId]: {
        ...actors[targetId],
        curseStacks: result.allyCurseStacks,
      },
    };
    const curseLeave = applyCurseFullIfNeeded(
      board,
      updated,
      selected,
      absorbedCount,
    );
    applyBoardAndEnclosure(
      curseLeave.board,
      curseLeave.actors,
      [],
      curseLeave.ageKeys,
    );
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
      if (pendingPlay.kind === 'attack') {
        completeKnightAttack(hex, pendingPlay.card);
        return;
      }
    }
    tryMoveTo(hex);
  }

  function onPlay(card: HandCard) {
    const meNow = actorsRef.current[selected];
    const attacker = meNow.hex;
    const counts = lookupCountsTowardAction(selected, card.cardId);
    const bonusShot =
      card.cardId === 'shot' && meNow.mayPlayShotIgnoreRange === true;
    const actionsNow = meNow.actionsLeft;
    const ammoNow = meNow.ammo;
    const handNow = meNow.hand;

    if (won) {
      pushLog(`【${card.name}】已勝利，停止出牌`);
      setToast('已勝利');
      return;
    }
    if (lost) {
      pushLog(`【${card.name}】已敗北，停止出牌`);
      setToast('已敗北');
      return;
    }
    if (meNow.eliminated) {
      pushLog(`【${card.name}】已出局，無法出牌`);
      setToast('已出局');
      return;
    }
    if (meNow.sealed) {
      pushLog(`【${card.name}】已封印，無法出牌`);
      setToast('已封印，無法出牌');
      return;
    }
    if (meNow.endedThisRound) {
      pushLog(`【${card.name}】本輪已結束（唯讀）`);
      setToast('本輪已結束（唯讀）');
      return;
    }
    if (card.silenced === true && isAdjacentToSilence(board, meNow.hex)) {
      pushLog(`【${card.name}】鄰近沉默，無法打出（受沉默）`);
      setToast('鄰近沉默：無法打出此牌');
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
    if (counts && actionsNow <= 0 && !bonusShot) {
      const msg = '本回合行動已用完';
      pushLog(`【${card.name}】→ ${msg}`);
      setToast(msg);
      return;
    }

    if (card.cardId === 'shot') {
      const result = resolveGunnerShot({
        attacker,
        ammo: ammoNow,
        ignoreRangePenalty: bonusShot,
      });
      const spent: ClassActor = {
        ...meNow,
        ammo: result.ammo,
        mayPlayShotIgnoreRange: bonusShot ? false : meNow.mayPlayShotIgnoreRange,
        hand: meNow.hand.filter((c) => c.instanceId !== card.instanceId),
        actionsLeft:
          bonusShot || !counts
            ? meNow.actionsLeft
            : Math.max(0, meNow.actionsLeft - 1),
      };
      const pulled = drawFromDeck(selected, spent, result.drawFromAmmo);
      commitActors({ ...actorsRef.current, [selected]: pulled.actor });
      const drawnNames = pulled.drawn
        .filter((c) =>
          pulled.actor.hand.some((h) => h.instanceId === c.instanceId),
        )
        .map((c) => c.name);
      if (pulled.discarded.length > 0) {
        pushLog(
          `【手牌上限】槍手 棄最新 ${pulled.discarded.map((c) => c.name).join('、')}`,
        );
      }
      noteBossDamage(result.bossDamage, board, [], {
        ...actorsRef.current,
        [selected]: pulled.actor,
      });
      pushLog(
        `【射擊】attacker=(${attacker.q},${attacker.r}) → bossDamage=${result.bossDamage}` +
          (result.drawFromAmmo > 0
            ? ` · 裝填抽 ${drawnNames.join('、') || '0'}（要 ${result.drawFromAmmo}）`
            : '') +
          (pulled.short ? ' · 牌庫不夠' : '') +
          ` / events=${formatEvents(result.events)}`,
      );
      setToast(
        result.drawFromAmmo > 0
          ? `射擊：王傷 ${result.bossDamage}，抽 ${drawnNames.length}`
          : `射擊：王傷 ${result.bossDamage}`,
      );
      return;
    }

    if (card.cardId === 'playful_bottle' || card.cardId === 'mischief_bottle') {
      const input = { ammo: ammoNow, hand: toGunnerInstances(handNow) };
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
        const spend = lookupCountsTowardAction(selected, card.cardId);
        return {
          ...a,
          ammo: result.ammo,
          hand: a.hand.filter((c) => !drop.has(c.instanceId)),
          actionsLeft: spend ? Math.max(0, a.actionsLeft - 1) : a.actionsLeft,
        };
      });
      pushLog(
        `【${card.name}】OK → 裝填 dmg+${result.ammo.damageBonus} draw+${result.ammo.drawBonus}（計次）`,
      );
      setToast(`${card.name}：裝填（計次）`);
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
        ammo: ammoNow,
      });
      if (!result.ok) {
        pushLog(`【Power UP!!】失敗：${result.reason}`);
        setToast(`Power UP 失敗：${result.reason}`);
        return;
      }
      const spent: ClassActor = {
        ...meNow,
        ammo: result.ammo ?? meNow.ammo,
        hand: meNow.hand.filter((c) => c.instanceId !== card.instanceId),
        actionsLeft: counts ? Math.max(0, meNow.actionsLeft - 1) : meNow.actionsLeft,
      };
      const pulled = drawFromDeck(selected, spent, result.drawFromAmmo ?? 0);
      commitActors({ ...actorsRef.current, [selected]: pulled.actor });
      noteBossDamage(result.bossDamage ?? 0, board, [], {
        ...actorsRef.current,
        [selected]: pulled.actor,
      });
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
      const usedAmp = meNow.amplifiedPending;
      const result = resolveMagicArrow({
        attacker,
        amplified: usedAmp,
      });
      const spent: ClassActor = {
        ...meNow,
        amplifiedPending: false,
        hand: meNow.hand.filter((c) => c.instanceId !== card.instanceId),
        actionsLeft: counts
          ? Math.max(0, meNow.actionsLeft - 1)
          : meNow.actionsLeft,
      };
      const nextActors: Actors = { ...actorsRef.current, [selected]: spent };
      commitActors(nextActors);
      noteBossDamage(result.bossDamage, board, [], nextActors);
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
      const spent: ClassActor = {
        ...actors[selected],
        amplifiedPending: false,
        hand: actors[selected].hand.filter(
          (c) => c.instanceId !== card.instanceId,
        ),
      };
      const pulled = drawFromDeck(selected, spent, result.drawCount);
      const nextActors: Actors = { ...actors, [selected]: pulled.actor };
      const drawnNames = pulled.drawn
        .filter((c) =>
          pulled.actor.hand.some((h) => h.instanceId === c.instanceId),
        )
        .map((c) => c.name);
      if (pulled.discarded.length > 0) {
        pushLog(
          `【手牌上限】${classLabel(selected)} 棄最新 ${pulled.discarded.map((c) => c.name).join('、')}`,
        );
      }
      pushLog(
        `【聚精會神】抽 ${drawnNames.join('、') || '0'}` +
          `（要 ${result.drawCount}${usedAmp ? '／增幅' : ''}）` +
          (pulled.short ? ' · 牌庫不夠' : '') +
          ` endTurn=${result.endTurn}`,
      );
      setToast(
        `聚精：抽 ${drawnNames.length}/${result.drawCount}（強制結束）`,
      );
      if (result.endTurn) {
        endTurn('聚精會神強制結束', { force: true, actorsNow: nextActors });
      } else {
        setActors(nextActors);
      }
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
      if (actors[allyId].eliminated) {
        pushLog('【位面調換】失敗：無存活友軍');
        setToast('位面失敗：無存活友軍');
        return;
      }
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
      const targets = listKnightAttackTargets(board, attacker, actors, selected);
      if (targets.length === 0) {
        const msg = '需鄰王，或鄰格有可拆牆（不能打其他職業／沉默／詛咒／懲罰）';
        pushLog(`【攻擊】失敗：${msg}`);
        setToast(`攻擊失敗：${msg}`);
        return;
      }
      setPendingPlay({ kind: 'attack', card });
      pushLog(`【攻擊】進入指定：可選 ${targets.length} 格`);
      setToast('攻擊：點高亮鄰格目標');
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
          必須重製開局。出局離場；吸咒滿層出局。越打越擠是主軸。
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
          selectedHex={
            phase === 'playing' && !me.eliminated ? unitHex : undefined
          }
          hoverPath={hoverPath}
          targetHexes={attackTargets}
          onHexClick={onHexClick}
          onHexHover={setHoverHex}
          showSweetZone={showSweetZone && phase === 'playing'}
          onReset={openResetSetup}
          spawnHint={spawnHint}
          mapRadius={mapRadius}
          bossDeckInfo={bossDeckInfo}
        />

        <section className="log-panel" aria-label="事件日誌">
          <h2>事件日誌</h2>
          <ul className="log">
            {log.length === 0 ? (
              <li className="empty">尚無紀錄</li>
            ) : (
              [...log].reverse().map((line, i) => (
                <li
                  key={`${log.length - 1 - i}-${line.slice(0, 24)}`}
                  className={i === 0 ? 'newest' : undefined}
                >
                  {line}
                </li>
              ))
            )}
          </ul>
          <div className="log-footer">
            <button
              type="button"
              className="end-turn"
              onClick={() => endTurn('玩家結束')}
              disabled={
                won ||
                lost ||
                phase !== 'playing' ||
                me.endedThisRound
              }
            >
              結束回合
            </button>
          </div>
        </section>
      </div>

      <div className="turn-row">
        <span className="tab">
          {classLabel(selected)}
          {' · '}王HP {bossHp}/{bossHpMax}
          {' · '}輪 {roundIndex}
          {won ? ' · 勝利' : ''}
          {lost ? ' · 敗北' : ''}
          {' · '}移動 {movesLeft}/
          {basicMoveCap(board, unitHex, TURN_MOVES_PER_ROUND)}
          {' · '}行動 {actionsLeft}/{TURN_ACTIONS_PER_ROUND}
          {moveLocked ? ' · 移動鎖定' : ''}
          {hasMovedThisTurn ? ' · 已移動' : ''}
          {me.endedThisRound ? ' · 本輪已結束' : ''}
          {mayPlayShotIgnoreRange ? ' · 大招可射' : ''}
          {' · '}({unitHex.q},{unitHex.r})
          {selected === 'gunner' ? ` · ${ammoHint}` : ''}
          {selected === 'mage' && amplifiedPending ? ' · 增幅待用' : ''}
          {selected === 'mage' && barrierAura ? ' · 屏障中' : ''}
          {` · 手牌 ${hand.length}/${HAND_CAP[selected]}`}
          {` · 牌庫 ${me.deck.length}`}
          {curseStacks > 0 ? ` · 咒${curseStacks}` : ''}
          {isAdjacentToSilence(board, unitHex) ? ' · 鄰沉默' : ''}
          {me.sealed ? ' · 封' : ''}
          {me.eliminated ? ' · 出局' : ''}
          {tauntRestriction ? ' · 嘲諷中' : ''}
          {pendingPlay ? ` · 指定:${pendingPlay.kind}` : ''}
          {lastDraw ? ` · 上次抽 ${lastDraw}` : ''}
        </span>
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

      <div className="class-picks" role="group" aria-label="職業">
          {CLASS_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              className={
                'card-btn' +
                (id === selected ? ' selected' : '') +
                (actors[id].endedThisRound || actors[id].eliminated
                  ? ' ended'
                  : '')
              }
              onClick={() => selectClass(id)}
              disabled={phase !== 'playing'}
            >
              <span className="name">{classLabel(id)}</span>
              <span className="meta">
                ({actors[id].hex.q},{actors[id].hex.r})
                {actors[id].eliminated
                  ? ' · 出局'
                  : actors[id].endedThisRound
                    ? ' · 已結束'
                    : ' · 可行動'}
                {actors[id].curseStacks >= 1 ? ' · 咒' : ''}
                {isAdjacentToSilence(board, actors[id].hex)
                  ? ' · 鄰沉默'
                  : ''}
                {actors[id].sealed && !actors[id].eliminated ? ' · 封' : ''}
              </span>
            </button>
          ))}
      </div>
      <Hand
        cards={hand}
        onPlay={onPlay}
        onCardHover={setHoveredCard}
        adjacentSilence={isAdjacentToSilence(board, unitHex)}
        actionsLeft={actionsLeft}
        mayBonusShot={mayPlayShotIgnoreRange}
        sealed={me.sealed}
      />

      <div className="toast" role="status">
        {toast}
      </div>

      {phase === 'reset-setup' ? (
        <div className="reset-modal-backdrop" role="dialog" aria-modal="true">
          <div className="reset-modal">
            <h2>重製對局設定</h2>
            <div className="reset-form">
              <label>
                <span className="reset-label-text">地圖半徑</span>
                <input
                  type="number"
                  min={3}
                  max={8}
                  value={resetDraft.mapRadius}
                  onChange={(e) =>
                    setResetDraft((d) => ({
                      ...d,
                      mapRadius: Number(e.target.value),
                    }))
                  }
                />
              </label>
              <label>
                <span className="reset-label-text">王 HP</span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={resetDraft.bossHp}
                  onChange={(e) =>
                    setResetDraft((d) => ({
                      ...d,
                      bossHp: Number(e.target.value),
                    }))
                  }
                />
              </label>
              <fieldset>
                <legend>職業小技 +1（每職可選 0–2）</legend>
                <p className="reset-prio-hint">
                  預設 15 張（6 基礎＋4 小技×2＋1 大招）。勾選的小技再 +1 張。
                </p>
                {CLASS_ORDER.map((id) => {
                  const picked = resetDraft.extraSmallIds[id] ?? [];
                  return (
                    <div key={id} className="reset-skill-block">
                      <p className="reset-prio-hint">
                        {classLabel(id)}（{picked.length}/2）
                      </p>
                      {SMALL_SKILLS[id].map((sid) => {
                        const on = picked.includes(sid);
                        return (
                          <label key={sid} className="reset-check">
                            <input
                              type="checkbox"
                              checked={on}
                              disabled={!on && picked.length >= 2}
                              onChange={() => {
                                setResetDraft((d) => {
                                  const cur = d.extraSmallIds[id] ?? [];
                                  const next = cur.includes(sid)
                                    ? cur.filter((x) => x !== sid)
                                    : cur.length >= 2
                                      ? cur
                                      : [...cur, sid];
                                  return {
                                    ...d,
                                    extraSmallIds: {
                                      ...d.extraSmallIds,
                                      [id]: next,
                                    },
                                  };
                                });
                              }}
                            />{' '}
                            {defFor(id, sid).name}
                          </label>
                        );
                      })}
                    </div>
                  );
                })}
              </fieldset>
              <fieldset className="reset-diff-list">
                <legend>難度</legend>
                <p className="reset-prio-hint">可疊加，確認時重算袋與放置。</p>
                {LIVE_DIFFICULTIES.map((d) => (
                  <label key={d.key} className="reset-check">
                    <input
                      type="checkbox"
                      checked={resetDraft.difficulty[d.key]}
                      onChange={(e) => {
                        const on = e.target.checked;
                        setResetDraft((prev) =>
                          applyDifficultyToSetup({
                            ...prev,
                            difficulty: { ...prev.difficulty, [d.key]: on },
                          }),
                        );
                      }}
                    />
                    <span className="reset-diff-title">{d.label}</span>
                    <span className="reset-diff-hint">{d.hint}</span>
                  </label>
                ))}
                <label className="reset-check reset-disabled-opt">
                  <input type="checkbox" disabled />
                  <span className="reset-diff-title">代價移動</span>
                  <span className="reset-diff-hint">
                    基礎移動 1，翻牌換步（尚未實作）
                  </span>
                </label>
              </fieldset>
              <label className="reset-boss-deck">
                <span className="reset-label-text">手卡張數</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={resetDraft.deckSize}
                  onChange={(e) =>
                    setResetDraft((d) => ({
                      ...d,
                      deckSize: Number(e.target.value),
                    }))
                  }
                />
              </label>
              <fieldset>
                <legend>放置張數（合計＝手卡）</legend>
                <div className="reset-place-grid">
                <label>
                  2 格
                  <input
                    type="number"
                    min={0}
                    value={resetDraft.place2}
                    onChange={(e) =>
                      setResetDraft((d) => ({
                        ...d,
                        place2: Number(e.target.value),
                      }))
                    }
                  />
                </label>
                <label>
                  3 格
                  <input
                    type="number"
                    min={0}
                    value={resetDraft.place3}
                    onChange={(e) =>
                      setResetDraft((d) => ({
                        ...d,
                        place3: Number(e.target.value),
                      }))
                    }
                  />
                </label>
                <label>
                  4 格
                  <input
                    type="number"
                    min={0}
                    value={resetDraft.place4}
                    onChange={(e) =>
                      setResetDraft((d) => ({
                        ...d,
                        place4: Number(e.target.value),
                      }))
                    }
                  />
                </label>
                </div>
              </fieldset>
              <fieldset>
                <legend>地形袋（合計＝可鋪格）</legend>
                <p className="reset-prio-hint">
                  可鋪 {resetDraft.place2 * 2 + resetDraft.place3 * 3 + resetDraft.place4 * 4}
                  格（2×{resetDraft.place2}＋3×{resetDraft.place3}＋4×{resetDraft.place4}）。袋會洗，鋪哪格才看威脅。
                </p>
                <label className="reset-kind-row">
                  <span className="reset-kind-name">老化</span>
                  <span className="reset-kind-inputs">
                    <input
                      type="number"
                      min={0}
                      value={resetDraft.agedWalls}
                      onChange={(e) =>
                        setResetDraft((d) => ({
                          ...d,
                          agedWalls: Number(e.target.value),
                        }))
                      }
                    />
                  </span>
                </label>
                <label className="reset-kind-row">
                  <span className="reset-kind-name">一般格</span>
                  <span className="reset-kind-inputs">
                    <input
                      type="number"
                      min={0}
                      value={resetDraft.intactWalls}
                      onChange={(e) =>
                        setResetDraft((d) => ({
                          ...d,
                          intactWalls: Number(e.target.value),
                        }))
                      }
                    />
                  </span>
                </label>
                <label className="reset-kind-row">
                  <span className="reset-kind-name">詛咒</span>
                  <span className="reset-kind-inputs">
                    <input
                      type="number"
                      min={0}
                      value={resetDraft.curseTiles}
                      onChange={(e) =>
                        setResetDraft((d) => ({
                          ...d,
                          curseTiles: Number(e.target.value),
                        }))
                      }
                    />
                  </span>
                </label>
                <label className="reset-kind-row">
                  <span className="reset-kind-name">沉默</span>
                  <span className="reset-kind-inputs">
                    <input
                      type="number"
                      min={0}
                      value={resetDraft.silenceTiles}
                      onChange={(e) =>
                        setResetDraft((d) => ({
                          ...d,
                          silenceTiles: Number(e.target.value),
                        }))
                      }
                    />
                  </span>
                </label>
                <label className="reset-kind-row">
                  <span className="reset-kind-name">泥濘格</span>
                  <span className="reset-kind-inputs">
                    <input
                      type="number"
                      min={0}
                      value={resetDraft.mudTiles}
                      onChange={(e) =>
                        setResetDraft((d) => ({
                          ...d,
                          mudTiles: Number(e.target.value),
                        }))
                      }
                    />
                  </span>
                </label>
              </fieldset>
            </div>
            <div className="reset-actions">
              {hasStarted ? (
                <button
                  type="button"
                  onClick={() => {
                    setPhase('playing');
                    setToast('已取消重製');
                  }}
                >
                  取消
                </button>
              ) : null}
              <button
                type="button"
                className="primary"
                onClick={confirmResetSetup}
              >
                確認並選出生點
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
