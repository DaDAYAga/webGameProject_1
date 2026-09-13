/**
 * 學習筆記（六角 Canvas／三職業試玩）：
 * 1) 規則在 core；畫面只做 axial→像素、三棋子色、地形統一標籤。
 * 2) 老化牆：凡 plain 系且 aged:true → 同一填色＋「老化」（開場牆＝王鋪老化後同貌）。
 * 3) 未老化 plain 系 → 「牆體」＋較亮填色；空地板 #1e2430。
 * 4) hoverPath 螢光綠；甜區琥珀；Canvas 數學當黑盒。
 */
import { useEffect, useMemo, useRef, type MouseEvent } from 'react';
import {
  BOSS_HEX,
  getTile,
  type Board,
  type Tile,
} from '@core/board/index.js';
import { distance, equals, type Axial } from '@core/hex/index.js';
import {
  DEFAULT_MAP_RADIUS,
  listMapHexes,
} from '@core/enclosure/index.js';
import {
  RANGED_SWEET_RADIUS,
  isInRangedSweetZone,
} from '@core/combat/index.js';

/** 走路預覽螢光綠。 */
const PATH_FILL = '#39FF14';
const PATH_STROKE = '#b8ff66';
const PATH_START_FILL = 'rgba(57, 255, 20, 0.28)';

/** 遠程甜區琥珀洗。 */
const SWEET_FILL = 'rgba(255, 176, 46, 0.32)';
const SWEET_FILL_UNIT = 'rgba(255, 176, 46, 0.48)';

/** 空地板（與老化牆必須分明）。 */
const FLOOR_FILL = '#1e2430';
/** 任意已老化 plain 系（開場牆／王鋪後老化）共用。 */
const AGED_PLAIN_FILL = '#5a6b80';
/** 未老化 plain 系「牆體」。 */
const UNAGED_PLAIN_FILL = '#8a9bb0';

export type BoardActorView = {
  id: string;
  /** 棋子短標（騎／槍／法 或全名）。 */
  label: string;
  hex: Axial;
  /** can-act 藍／selected 綠／ended 灰。 */
  fill: string;
  stroke: string;
};

type BoardCanvasProps = {
  board: Board;
  /** 三職業棋子（取代舊 我／友）。 */
  actors: readonly BoardActorView[];
  /** 目前選中職業格（甜區「甜」標用）。 */
  selectedHex?: Axial;
  hoverPath?: Axial[] | null;
  onHexClick?: (hex: Axial) => void;
  onHexHover?: (hex: Axial | null) => void;
  showSweetZone?: boolean;
  /** 重製對局：板內右下角。 */
  onReset?: () => void;
  /** 選出生點時提示。 */
  spawnHint?: string | null;
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
 * 標籤：plain 系以 tile.aged 決定「老化」／「牆體」（不依 plain_broken）。
 */
function labelForHex(hex: Axial, board: Board): string {
  if (equals(hex, BOSS_HEX)) return '王';
  const tile = getTile(board, hex);
  if (!tile) return '';
  if (tile.kind === 'silence') return '沉默';
  if (tile.kind === 'curse') return '詛咒';
  if (tile.kind === 'punish') return '懲罰';
  if (isPlainFamily(tile.kind)) {
    return tile.aged === true ? '老化' : '牆體';
  }
  return '';
}

function labelFill(label: string, onPath: boolean, isPathStart: boolean): string {
  if (label === '沉默') return '#111111';
  if (onPath && !isPathStart) return '#0a1a08';
  return '#e8eaef';
}

function pathIndex(path: Axial[] | null | undefined, hex: Axial): number {
  if (!path || path.length === 0) return -1;
  return path.findIndex((h) => equals(h, hex));
}

export function BoardCanvas({
  board,
  actors,
  selectedHex,
  hoverPath,
  onHexClick,
  onHexHover,
  showSweetZone = false,
  onReset,
  spawnHint,
}: BoardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const hexes = useMemo(
    () => listMapHexes({ radius: DEFAULT_MAP_RADIUS }),
    [],
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

      ctx.beginPath();
      ctx.moveTo(corners[0][0], corners[0][1]);
      for (let i = 1; i < corners.length; i++) {
        ctx.lineTo(corners[i][0], corners[i][1]);
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
      if (onPath) {
        ctx.fillStyle = isPathStart ? PATH_START_FILL : PATH_FILL;
        ctx.fill();
      }
      if (onPath) {
        ctx.strokeStyle = PATH_STROKE;
        ctx.lineWidth = 2.5;
      } else {
        ctx.strokeStyle = strokeForHex(h, board, actors);
        const isActor = actors.some((a) => equals(a.hex, h));
        ctx.lineWidth =
          equals(h, BOSS_HEX) || isActor ? 2 : 1;
      }
      ctx.stroke();

      const label = labelForHex(h, board);
      if (label) {
        ctx.fillStyle = labelFill(label, onPath, isPathStart);
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
        !onPath
      ) {
        ctx.fillStyle = '#6b7385';
        ctx.font = '9px ui-monospace, Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${h.q},${h.r}`, cx, cy);
      }
    }

    // 三職業棋子
    for (const actor of actors) {
      const { x, y } = axialToPixel(actor.hex, HEX_SIZE);
      const cx = layout.originX + x;
      const cy = layout.originY + y;
      ctx.beginPath();
      ctx.arc(cx, cy, HEX_SIZE * 0.36, 0, Math.PI * 2);
      ctx.fillStyle = actor.fill;
      ctx.fill();
      ctx.strokeStyle = actor.stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#f0f7ff';
      ctx.font =
        actor.label.length >= 2
          ? 'bold 11px "Segoe UI", "Noto Sans TC", sans-serif'
          : 'bold 12px "Segoe UI", "Noto Sans TC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(actor.label, cx, cy);
    }
  }, [actors, board, focusHex, hexes, hoverPath, layout, showSweetZone]);

  function eventToHex(e: MouseEvent<HTMLCanvasElement>): Axial | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX - layout.originX;
    const py = (e.clientY - rect.top) * scaleY - layout.originY;
    const hex = pixelToAxial(px, py, HEX_SIZE);
    if (distance(hex, BOSS_HEX) > DEFAULT_MAP_RADIUS) return null;
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
      <h2>開場棋盤（Canvas）</h2>
      <p className="muted board-hint">
        半徑 {DEFAULT_MAP_RADIUS} · flat-top · 王 (0,0)
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
      <canvas
        ref={canvasRef}
        className="board-canvas"
        width={layout.width}
        height={layout.height}
        onClick={handleClick}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        role="img"
        aria-label={`六角地圖半徑 ${DEFAULT_MAP_RADIUS}`}
      />
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
