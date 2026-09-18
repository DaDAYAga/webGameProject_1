/**
 * 學習筆記（六角 Canvas／三職業試玩）：
 * 1) 規則在 core；畫面只做 axial→像素、三棋子色、地形統一標籤；半徑由 props 傳入。
 * 2) 老化牆：凡 plain 系且 aged:true → 同一填色＋「老化」（開場牆＝王鋪老化後同貌）。
 * 3) 未老化 plain 系 → 「一般格」＋較亮填色；空地板 #1e2430。
 * 4) hoverPath 螢光綠；攻擊目標珊瑚紅；甜區琥珀；Canvas 數學當黑盒。
 * 5) 右上角王牌庫 chip：懸停看剩餘張數／N 分布／地形袋。
 */
import { useEffect, useMemo, useRef, type MouseEvent } from 'react';
import {
  BOSS_HEX,
  getTile,
  type Board,
  type Tile,
} from '@core/board/index.js';
import { distance, equals, neighbors, type Axial } from '@core/hex/index.js';
import {
  DEFAULT_MAP_RADIUS,
  listMapHexes,
} from '@core/enclosure/index.js';
import {
  RANGED_SWEET_RADIUS,
  isInRangedSweetZone,
} from '@core/combat/index.js';

/** 走路預覽：降亮度半透明綠。 */
const PATH_FILL = 'rgba(57, 255, 20, 0.28)';
const PATH_STROKE = 'rgba(184, 255, 102, 0.7)';
const PATH_START_FILL = 'rgba(57, 255, 20, 0.16)';
/** 可走範圍常駐（比路徑更淡）。 */
const LEGAL_FILL = 'rgba(57, 255, 20, 0.12)';
/** 屏障禁鋪淡藍。 */
const BARRIER_FILL = 'rgba(90, 170, 230, 0.34)';
const BARRIER_STROKE = 'rgba(140, 200, 240, 0.85)';
/** 位面距離圈。 */
const RANGE_FILL = 'rgba(160, 120, 220, 0.26)';
/** 嘲諷詢問時的鄰 1 環。 */
const TAUNT_FILL = 'rgba(232, 184, 74, 0.38)';
const TAUNT_STROKE = '#e8b84a';

/** 攻擊／指定目標：珊瑚紅（與路徑綠區隔）。 */
const TARGET_FILL = 'rgba(255, 72, 110, 0.42)';
const TARGET_STROKE = '#ff8aa8';

/** 遠程甜區琥珀洗。 */
const SWEET_FILL = 'rgba(255, 176, 46, 0.32)';
const SWEET_FILL_UNIT = 'rgba(255, 176, 46, 0.48)';

/** 空地板（與老化牆必須分明）。 */
const FLOOR_FILL = '#1e2430';
/** 任意已老化 plain 系（開場牆／王鋪後老化）共用。 */
const AGED_PLAIN_FILL = '#5a6b80';
/** 未老化 plain 系「一般格」。 */
const UNAGED_PLAIN_FILL = '#8a9bb0';

export type BoardActorView = {
  id: string;
  /** 棋子短標（騎／槍／法 或全名）。 */
  label: string;
  hex: Axial;
  /** can-act 藍／selected 綠／ended 灰。 */
  fill: string;
  stroke: string;
  /** 詛咒狀態：≥1 顯示單一「咒」標。 */
  curseStacks?: number;
  /** 包圍封印：顯示「封」環標。 */
  sealed?: boolean;
  /** 出局：灰化棋子。 */
  eliminated?: boolean;
  /** 鄰沉默：棋子旁小「默」標（有別於咒／封）。 */
  adjacentSilence?: boolean;
};

/** 王牌庫懸停摘要（由 App 組好）。 */
export type BossDeckHoverInfo = {
  remainingCards: number;
  byN: { n2: number; n3: number; n4: number };
  byKind: {
    plain: number;
    plainAged: number;
    curse: number;
    silence: number;
    mud: number;
  };
  /** 重製表單老化牆體 >0 時才顯示老化剩餘。 */
  showAged: boolean;
  /** 重製表單泥濘格 >0 時才顯示泥濘剩餘。 */
  showMud: boolean;
};

type BoardCanvasProps = {
  board: Board;
  /** 三職業棋子（取代舊 我／友）。 */
  actors: readonly BoardActorView[];
  /** 目前選中職業格（甜區「甜」標用）。 */
  selectedHex?: Axial;
  hoverPath?: Axial[] | null;
  /** 騎士攻擊等指定目標高亮（有別於走路路徑）。 */
  targetHexes?: Axial[] | null;
  /** 可走範圍（無 pending 時）。 */
  legalHexes?: Axial[] | null;
  /** 屏障保護／禁鋪格。 */
  barrierHexes?: Axial[] | null;
  /** 位面等距離圈。 */
  rangeWash?: { center: Axial; radius: number } | null;
  onHexClick?: (hex: Axial) => void;
  onHexHover?: (hex: Axial | null) => void;
  showSweetZone?: boolean;
  /** 重製對局：板內右下角。 */
  onReset?: () => void;
  /** 選出生點時提示。 */
  spawnHint?: string | null;
  /** 游標停在可選格上的說明（如奉獻）。 */
  hexHoverHint?: string | null;
  /** 地圖半徑（勿改 core DEFAULT；由此傳入）。 */
  mapRadius?: number;
  /** 右上角王牌庫 chip。 */
  bossDeckInfo?: BossDeckHoverInfo | null;
  /** 隊友傷王時問騎士要不要嘲諷。 */
  tauntPrompt?: {
    knightHex: Axial;
    onAccept: () => void;
    onDecline: () => void;
  } | null;
};

const HEX_SIZE = 28;
const PAD = 24;

function axialToPixel(h: Axial, size: number): { x: number; y: number } {
  const x = size * ((3 / 2) * h.q);
  const y = size * ((Math.sqrt(3) / 2) * h.q + Math.sqrt(3) * h.r);
  return { x, y };
}

function pixelToAxial(px: number, py: number, size: number): Axial {
  const q = ((2 / 3) * px) / size;
  const r = ((-1 / 3) * px + (Math.sqrt(3) / 3) * py) / size;
  return cubeRound(q, r, -q - r);
}

function cubeRound(fq: number, fr: number, fs: number): Axial {
  let q = Math.round(fq);
  let r = Math.round(fr);
  let s = Math.round(fs);
  const dq = Math.abs(q - fq);
  const dr = Math.abs(r - fr);
  const ds = Math.abs(s - fs);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return { q, r };
}

function hexCorners(cx: number, cy: number, size: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    pts.push([cx + size * Math.cos(angle), cy + size * Math.sin(angle)]);
  }
  return pts;
}

function isPlainFamily(kind: Tile['kind']): boolean {
  return kind === 'plain' || kind === 'plain_broken' || kind === 'plain_starter';
}

/** 地形填色：老化 plain 系共用一色；未老化牆體另一色；空地板固定。 */
function fillForHex(hex: Axial, board: Board): string {
  if (equals(hex, BOSS_HEX)) return '#8b3a3a';
  const tile = getTile(board, hex);
  if (!tile) return FLOOR_FILL;
  return fillForTile(tile);
}

function fillForTile(tile: Tile): string {
  if (isPlainFamily(tile.kind)) {
    return tile.aged === true ? AGED_PLAIN_FILL : UNAGED_PLAIN_FILL;
  }
  if (tile.kind === 'punish') return '#6b3a5a';
  if (tile.kind === 'curse') return '#4a3a6b';
  if (tile.kind === 'silence') return '#f5f5f5';
  if (tile.kind === 'mud') return '#6b4a2a';
  return '#2a3140';
}

function strokeForHex(
  hex: Axial,
  board: Board,
  actors: readonly BoardActorView[],
): string {
  const actor = actors.find((a) => equals(a.hex, hex));
  if (actor) return actor.stroke;
  if (equals(hex, BOSS_HEX)) return '#e8a0a0';
  const tile = getTile(board, hex);
  if (tile?.kind === 'silence') return '#222222';
  return '#3d4658';
}

/**
 * 標籤：plain 系以 tile.aged 決定「老化」／「一般格」（不依 plain_broken）。
 */
function labelForHex(hex: Axial, board: Board): string {
  if (equals(hex, BOSS_HEX)) return '王';
  const tile = getTile(board, hex);
  if (!tile) return '';
  if (tile.kind === 'silence') return '沉默';
  if (tile.kind === 'curse') return '詛咒';
  if (tile.kind === 'punish') return '懲罰';
  if (tile.kind === 'mud') return '泥濘';
  if (isPlainFamily(tile.kind)) {
    return tile.aged === true ? '老化' : '一般';
  }
  return '';
}

function labelFill(
  label: string,
  onPath: boolean,
  isPathStart: boolean,
  onTarget: boolean,
): string {
  if (label === '沉默') return '#111111';
  if (onTarget) return '#2a0810';
  if (onPath && !isPathStart) return '#0a1a08';
  return '#e8eaef';
}

function pathIndex(path: Axial[] | null | undefined, hex: Axial): number {
  if (!path || path.length === 0) return -1;
  return path.findIndex((h) => equals(h, hex));
}

function isTargetHex(targets: Axial[] | null | undefined, hex: Axial): boolean {
  if (!targets || targets.length === 0) return false;
  return targets.some((h) => equals(h, hex));
}

export function BoardCanvas({
  board,
  actors,
  selectedHex,
  hoverPath,
  targetHexes,
  legalHexes,
  barrierHexes,
  rangeWash,
  onHexClick,
  onHexHover,
  showSweetZone = false,
  onReset,
  spawnHint,
  hexHoverHint,
  mapRadius = DEFAULT_MAP_RADIUS,
  bossDeckInfo,
  tauntPrompt = null,
}: BoardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const hexes = useMemo(
    () => listMapHexes({ radius: mapRadius }),
    [mapRadius],
  );

  const layout = useMemo(() => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const h of hexes) {
      const { x, y } = axialToPixel(h, HEX_SIZE);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const width = Math.ceil(maxX - minX + HEX_SIZE * 2 + PAD * 2);
    const height = Math.ceil(maxY - minY + HEX_SIZE * 2 + PAD * 2);
    const originX = PAD + HEX_SIZE - minX;
    const originY = PAD + HEX_SIZE - minY;
    return { width, height, originX, originY };
  }, [hexes]);

  const focusHex = selectedHex ?? actors[0]?.hex ?? { q: 2, r: 0 };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, layout.width, layout.height);

    for (const h of hexes) {
      const { x, y } = axialToPixel(h, HEX_SIZE);
      const cx = layout.originX + x;
      const cy = layout.originY + y;
      const corners = hexCorners(cx, cy, HEX_SIZE - 1);
      const pi = pathIndex(hoverPath, h);
      const onPath = pi >= 0;
      const isPathStart = onPath && pi === 0;
      const onTarget = isTargetHex(targetHexes, h);
      const onLegal = isTargetHex(legalHexes, h);
      const onBarrier = isTargetHex(barrierHexes, h);
      const onTauntRing =
        tauntPrompt != null &&
        neighbors(tauntPrompt.knightHex).some((n) => equals(n, h));
      const inRange =
        rangeWash != null && distance(h, rangeWash.center) <= rangeWash.radius;

      ctx.beginPath();
      ctx.moveTo(corners[0]![0], corners[0]![1]);
      for (let i = 1; i < corners.length; i++) {
        ctx.lineTo(corners[i]![0], corners[i]![1]);
      }
      ctx.closePath();
      ctx.fillStyle = fillForHex(h, board);
      ctx.fill();
      const inSweet =
        showSweetZone && distance(h, BOSS_HEX) <= RANGED_SWEET_RADIUS;
      if (inSweet) {
        const unitIn = equals(h, focusHex);
        ctx.fillStyle = unitIn ? SWEET_FILL_UNIT : SWEET_FILL;
        ctx.fill();
      }
      if (inRange && !inSweet) {
        ctx.fillStyle = RANGE_FILL;
        ctx.fill();
      }
      if (onBarrier) {
        ctx.fillStyle = BARRIER_FILL;
        ctx.fill();
      }
      if (onTauntRing) {
        ctx.fillStyle = TAUNT_FILL;
        ctx.fill();
      }
      if (onLegal && !onPath && !onTarget) {
        ctx.fillStyle = LEGAL_FILL;
        ctx.fill();
      }
      if (onTarget) {
        ctx.fillStyle = TARGET_FILL;
        ctx.fill();
      }
      if (onPath) {
        ctx.fillStyle = isPathStart ? PATH_START_FILL : PATH_FILL;
        ctx.fill();
      }
      if (onTarget && !onPath) {
        ctx.strokeStyle = TARGET_STROKE;
        ctx.lineWidth = 2.5;
      } else if (onTauntRing && !onPath) {
        ctx.strokeStyle = TAUNT_STROKE;
        ctx.lineWidth = 2;
      } else if (onBarrier && !onPath) {
        ctx.strokeStyle = BARRIER_STROKE;
        ctx.lineWidth = 2;
      } else if (onPath) {
        ctx.strokeStyle = PATH_STROKE;
        ctx.lineWidth = 2.5;
      } else {
        ctx.strokeStyle = strokeForHex(h, board, actors);
        const isActor = actors.some((a) => equals(a.hex, h));
        ctx.lineWidth = equals(h, BOSS_HEX) || isActor ? 2 : 1;
      }
      ctx.stroke();

      const label = labelForHex(h, board);
      if (label) {
        ctx.fillStyle = labelFill(label, onPath, isPathStart, onTarget);
        ctx.font =
          label.length >= 2
            ? '10px "Segoe UI", "Noto Sans TC", sans-serif'
            : '11px "Segoe UI", "Noto Sans TC", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, cx, cy);
      } else if (
        showSweetZone &&
        equals(h, focusHex) &&
        isInRangedSweetZone(focusHex)
      ) {
        ctx.fillStyle = '#5a3a00';
        ctx.font = 'bold 12px "Segoe UI", "Noto Sans TC", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('甜', cx, cy - HEX_SIZE * 0.55);
      } else if (
        distance(h, BOSS_HEX) <= 2 &&
        !actors.some((a) => equals(a.hex, h)) &&
        !onPath &&
        !onTarget
      ) {
        ctx.fillStyle = '#6b7385';
        ctx.font = '9px ui-monospace, Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${h.q},${h.r}`, cx, cy);
      }
    }

    // 三職業棋子（咒／封標）；出局已由 App 濾掉、離場不畫。
    for (const actor of actors) {
      if (actor.eliminated) continue;
      const { x, y } = axialToPixel(actor.hex, HEX_SIZE);
      const cx = layout.originX + x;
      const cy = layout.originY + y;
      const fill = actor.eliminated ? '#4a4a4a' : actor.fill;
      const stroke = actor.eliminated ? '#7a7a7a' : actor.stroke;
      ctx.beginPath();
      ctx.arc(cx, cy, HEX_SIZE * 0.36, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
      if (actor.sealed && !actor.eliminated) {
        ctx.beginPath();
        ctx.arc(cx, cy, HEX_SIZE * 0.46, 0, Math.PI * 2);
        ctx.strokeStyle = '#e8b84a';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      ctx.fillStyle = actor.eliminated ? '#b0b0b0' : '#f0f7ff';
      ctx.font =
        actor.label.length >= 2
          ? 'bold 11px "Segoe UI", "Noto Sans TC", sans-serif'
          : 'bold 12px "Segoe UI", "Noto Sans TC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(actor.label, cx, cy);
      const badges: string[] = [];
      if ((actor.curseStacks ?? 0) >= 1) badges.push('咒');
      if (actor.adjacentSilence) badges.push('默');
      if (actor.sealed) badges.push('封');
      if (actor.eliminated) badges.push('出局');
      if (badges.length > 0) {
        ctx.font = 'bold 9px "Segoe UI", "Noto Sans TC", sans-serif';
        ctx.fillStyle = actor.eliminated
          ? '#c0c0c0'
          : badges.includes('封') && !badges.includes('咒')
            ? '#e8b84a'
            : badges.includes('咒')
              ? '#d4a0ff'
              : badges.includes('默')
                ? '#d8dce8'
                : '#e8b84a';
        ctx.fillText(badges.join(''), cx, cy + HEX_SIZE * 0.42);
      }
    }
  }, [
    actors,
    board,
    focusHex,
    hexes,
    hoverPath,
    layout,
    legalHexes,
    barrierHexes,
    rangeWash,
    showSweetZone,
    targetHexes,
    tauntPrompt,
  ]);

  function eventToHex(e: MouseEvent<HTMLCanvasElement>): Axial | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX - layout.originX;
    const py = (e.clientY - rect.top) * scaleY - layout.originY;
    const hex = pixelToAxial(px, py, HEX_SIZE);
    if (distance(hex, BOSS_HEX) > mapRadius) return null;
    return hex;
  }

  function handleClick(e: MouseEvent<HTMLCanvasElement>) {
    if (!onHexClick) return;
    const hex = eventToHex(e);
    if (!hex) return;
    onHexClick(hex);
  }

  function handleMove(e: MouseEvent<HTMLCanvasElement>) {
    if (!onHexHover) return;
    onHexHover(eventToHex(e));
  }

  function handleLeave() {
    onHexHover?.(null);
  }

  const wallCount = board.tiles.size;
  const posHint = actors
    .map((a) => `${a.label}(${a.hex.q},${a.hex.r})`)
    .join(' · ');

  return (
    <section className="board-panel" aria-label="六角棋盤">
      <h2>棋盤</h2>
      {bossDeckInfo ? (
        <div className="boss-deck-chip" title="">
          <span className="boss-deck-chip-label">王牌庫</span>
          <span className="boss-deck-chip-count">
            {bossDeckInfo.remainingCards}
          </span>
          <div className="boss-deck-hover" role="tooltip">
            <div>剩餘牌：{bossDeckInfo.remainingCards}</div>
            <div>
              2 格×{bossDeckInfo.byN.n2}　3 格×{bossDeckInfo.byN.n3}　4 格×
              {bossDeckInfo.byN.n4}
            </div>
            <div>
              一般格×{bossDeckInfo.byKind.plain}　詛咒×
              {bossDeckInfo.byKind.curse}　沉默×{bossDeckInfo.byKind.silence}
              {bossDeckInfo.showAged
                ? `　老化×${bossDeckInfo.byKind.plainAged}`
                : ''}
              {bossDeckInfo.showMud
                ? `　泥濘×${bossDeckInfo.byKind.mud}`
                : ''}
            </div>
          </div>
        </div>
      ) : null}
      <p className="muted board-hint">
        半徑 {mapRadius} · flat-top · 王 (0,0)
        {posHint ? ` · ${posHint}` : ''} · 地形 {wallCount} 格
        {showSweetZone
          ? isInRangedSweetZone(focusHex)
            ? ' · 在甜區內'
            : ' · 在甜區外'
          : ''}
      </p>
      {spawnHint ? (
        <p className="spawn-hint" role="status">
          {spawnHint}
        </p>
      ) : null}
      {hexHoverHint ? (
        <p className="hex-hover-hint" role="status">
          {hexHoverHint}
        </p>
      ) : null}
      <div className="board-canvas-wrap">
        <canvas
          ref={canvasRef}
          className="board-canvas"
          width={layout.width}
          height={layout.height}
          onClick={tauntPrompt ? undefined : handleClick}
          onMouseMove={handleMove}
          onMouseLeave={handleLeave}
          role="img"
          aria-label={`六角地圖半徑 ${mapRadius}`}
        />
        {tauntPrompt
          ? (() => {
              const { x, y } = axialToPixel(tauntPrompt.knightHex, HEX_SIZE);
              const leftPct =
                ((layout.originX + x) / layout.width) * 100;
              const topPct =
                ((layout.originY + y - HEX_SIZE * 0.55) / layout.height) * 100;
              return (
                <div
                  className="taunt-popup"
                  style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                  role="dialog"
                  aria-label="是否使用嘲諷"
                >
                  <button
                    type="button"
                    className="taunt-popup-yes"
                    onClick={tauntPrompt.onAccept}
                  >
                    嘲諷
                  </button>
                  <button
                    type="button"
                    className="taunt-popup-no"
                    onClick={tauntPrompt.onDecline}
                    aria-label="這次不用"
                    title="這次不用"
                  >
                    ×
                  </button>
                </div>
              );
            })()
          : null}
      </div>
      <div className="board-footer">
        {onReset ? (
          <button type="button" className="board-reset" onClick={onReset}>
            重製對局
          </button>
        ) : null}
      </div>
    </section>
  );
}
