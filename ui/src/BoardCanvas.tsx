/**
 * 學習筆記（六角 Canvas 棋盤）：
 * 1) 規則在 core：開場牆用 createOpeningBoard；地圖範圍用 DEFAULT_MAP_RADIUS + listMapHexes。
 * 2) 畫面只負責「axial → 像素」畫六角形；點一下回傳座標給 App 寫進日誌。
 * 3) 取向：flat-top（平頂）— 參考 Red Blob Games「Hex to pixel」公式。
 *    為什麼選 flat-top：與常見棋盤示意一致；之後若要 pointy-top 只要改公式常數。
 *
 * Red Blob flat-top（size = 中心到頂邊距離）：
 *   x = size * (3/2 * q)
 *   y = size * (√3/2 * q + √3 * r)
 */
import { useEffect, useMemo, useRef, type MouseEvent } from 'react';
import {
  BOSS_HEX,
  createOpeningBoard,
  getTile,
  hexKey,
  type Board,
  type Tile,
} from '@core/board/index.js';
import { distance, equals, type Axial } from '@core/hex/index.js';
import {
  DEFAULT_MAP_RADIUS,
  listMapHexes,
} from '@core/enclosure/index.js';

type BoardCanvasProps = {
  /** 點到一格時呼叫；App 可寫進事件日誌。 */
  onHexClick?: (hex: Axial) => void;
};

/** 六角形「中心到頂邊」的像素半徑（flat-top）。 */
const HEX_SIZE = 28;

/** canvas 內邊距，避免邊緣被裁切。 */
const PAD = 24;

/** flat-top：axial → 像素（相對原點）。 */
function axialToPixel(h: Axial, size: number): { x: number; y: number } {
  const x = size * ((3 / 2) * h.q);
  const y = size * ((Math.sqrt(3) / 2) * h.q + Math.sqrt(3) * h.r);
  return { x, y };
}

/** flat-top：像素 → 最接近的 axial（點擊用）。 */
function pixelToAxial(px: number, py: number, size: number): Axial {
  const q = ((2 / 3) * px) / size;
  const r = ((-1 / 3) * px + (Math.sqrt(3) / 3) * py) / size;
  return cubeRound(q, r, -q - r);
}

/** 把浮點立方座標四捨五入回整數格（Red Blob cube_round）。 */
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

/** 平頂六角形的 6 個頂點（相對中心）。 */
function hexCorners(cx: number, cy: number, size: number): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < 6; i++) {
    // flat-top：從 0° 開始（右邊尖），每 60° 一個頂點
    const angle = (Math.PI / 180) * (60 * i);
    pts.push([cx + size * Math.cos(angle), cy + size * Math.sin(angle)]);
  }
  return pts;
}

function fillForHex(hex: Axial, board: Board): string {
  if (equals(hex, BOSS_HEX)) return '#8b3a3a'; // 王：暗紅
  const tile = getTile(board, hex);
  if (!tile) return '#1e2430'; // 空格
  return fillForTile(tile);
}

function fillForTile(tile: Tile): string {
  // 開場牆 = plain_broken + aged → 偏灰藍，看得出「已破碎且老化」
  if (tile.kind === 'plain_broken') {
    return tile.aged ? '#5a6a7e' : '#4a5568';
  }
  if (tile.kind === 'plain' || tile.kind === 'plain_starter') {
    return tile.aged ? '#6b7c93' : '#7a8aa0';
  }
  if (tile.kind === 'punish') return '#6b3a5a';
  if (tile.kind === 'curse') return '#4a3a6b';
  if (tile.kind === 'silence') return '#3a4a5a';
  return '#2a3140';
}

function strokeForHex(hex: Axial): string {
  if (equals(hex, BOSS_HEX)) return '#e8a0a0';
  return '#3d4658';
}

function labelForHex(hex: Axial, board: Board): string {
  if (equals(hex, BOSS_HEX)) return '王';
  const tile = getTile(board, hex);
  if (!tile) return '';
  if (tile.kind === 'plain_broken' && tile.aged) return '牆';
  if (tile.kind === 'plain' && tile.aged) return '牆';
  return '';
}

/** 畫一張開場棋盤：半徑 DEFAULT_MAP_RADIUS、王在 (0,0)、六鄰開場牆。 */
export function BoardCanvas({ onHexClick }: BoardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const board = useMemo(() => createOpeningBoard(), []);
  const hexes = useMemo(
    () => listMapHexes({ radius: DEFAULT_MAP_RADIUS }),
    [],
  );

  // 預先算畫布尺寸與原點偏移（讓 (0,0) 落在中央）
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

      ctx.beginPath();
      ctx.moveTo(corners[0][0], corners[0][1]);
      for (let i = 1; i < corners.length; i++) {
        ctx.lineTo(corners[i][0], corners[i][1]);
      }
      ctx.closePath();
      ctx.fillStyle = fillForHex(h, board);
      ctx.fill();
      ctx.strokeStyle = strokeForHex(h);
      ctx.lineWidth = equals(h, BOSS_HEX) ? 2 : 1;
      ctx.stroke();

      const label = labelForHex(h, board);
      if (label) {
        ctx.fillStyle = '#e8eaef';
        ctx.font = '11px "Segoe UI", "Noto Sans TC", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, cx, cy);
      } else if (distance(h, BOSS_HEX) <= 2) {
        // 近中心空格標座標，方便對照學習（外圈省略以免雜亂）
        ctx.fillStyle = '#6b7385';
        ctx.font = '9px ui-monospace, Consolas, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${h.q},${h.r}`, cx, cy);
      }
    }
  }, [board, hexes, layout]);

  function handleClick(e: MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || !onHexClick) return;
    const rect = canvas.getBoundingClientRect();
    // 把滑鼠座標轉成 canvas 像素（考慮 CSS 縮放）
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX - layout.originX;
    const py = (e.clientY - rect.top) * scaleY - layout.originY;
    const hex = pixelToAxial(px, py, HEX_SIZE);
    // 只接受圖內格
    if (distance(hex, BOSS_HEX) > DEFAULT_MAP_RADIUS) return;
    onHexClick(hex);
  }

  const wallCount = board.tiles.size;

  return (
    <section className="board-panel" aria-label="六角棋盤">
      <h2>開場棋盤（Canvas）</h2>
      <p className="muted board-hint">
        半徑 {DEFAULT_MAP_RADIUS} · flat-top · 王 (0,0) · 開場牆 {wallCount} 格（
        {hexKey({ q: 0, r: -1 })} 等六鄰，plain_broken+aged）· 點格寫入日誌
      </p>
      <canvas
        ref={canvasRef}
        className="board-canvas"
        width={layout.width}
        height={layout.height}
        onClick={handleClick}
        role="img"
        aria-label={`六角地圖半徑 ${DEFAULT_MAP_RADIUS}，王在中央`}
      />
    </section>
  );
}
