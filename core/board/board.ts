/**
 * 棋盤地形層：放置、破碎、站格、推（handoff §12 step 2）。
 * 不含包圍、回合、戰鬥、卡牌。
 */

import { equals, neighbors, type Axial } from '../hex/index.js';
import {
  kindAllowsCrack,
  kindAllowsPush,
  kindAllowsStand,
  makeTile,
  tileDestroyDamagesBoss,
} from './kinds.js';
import type { Board, TerrainHitResult, TerrainKind, Tile } from './types.js';

/** 王固定佔格；玩家不可進入。 */
export const BOSS_HEX: Axial = { q: 0, r: 0 };

/**
 * 把 axial 編成 Map 鍵。
 * 為什麼：Board.tiles 用字串鍵，避免物件參照比較。
 */
export function hexKey(h: Axial): string {
  return `${h.q},${h.r}`;
}

/** 由鍵還原 axial（測試／除錯用）。 */
export function parseHexKey(key: string): Axial {
  const [qs, rs] = key.split(',');
  return { q: Number(qs), r: Number(rs) };
}

function cloneTiles(board: Board): Map<string, Tile> {
  return new Map(board.tiles);
}

function withTiles(tiles: Map<string, Tile>): Board {
  return { tiles };
}

/**
 * 建立完全空的棋盤（無任何地形）。
 * 為什麼：測試或自訂開場前的空白底圖。
 */
export function createEmptyBoard(): Board {
  return { tiles: new Map() };
}

/**
 * 開場棋盤：王 (0,0) 周圍距離 1 的 6 格鋪開場牆。
 * 預設：已破碎且已老化（plain_broken + aged）— 一擊可拆；拆掉走「拆老化牆傷王」同一條。
 * 難度選項 intactStarterWalls：開場為完整但已老化的 plain（需先破碎再拆）。
 * 擋移動；不擋遠程傷害。不跑老化計時（開場直接是 aged 狀態）。
 */
export type OpeningBoardOptions = {
  /** true = 開場牆完整（較難）；預設 false = 開場已破碎 */
  intactStarterWalls?: boolean;
};

export function createOpeningBoard(opts: OpeningBoardOptions = {}): Board {
  const intact = opts.intactStarterWalls === true;
  const tiles = new Map<string, Tile>();
  for (const h of neighbors(BOSS_HEX)) {
    tiles.set(
      hexKey(h),
      intact
        ? makeTile('plain', { aged: true })
        : makeTile('plain_broken', { aged: true }),
    );
  }
  return { tiles };
}

/**
 * 讀取某格地形；無地形回 undefined。
 */
export function getTile(board: Board, hex: Axial): Tile | undefined {
  return board.tiles.get(hexKey(hex));
}

/**
 * 寫入或清除某格地形（tile 為 undefined 則刪除）。
 * 回傳新 Board（不可變更新）。
 */
export function setTile(board: Board, hex: Axial, tile: Tile | undefined): Board {
  const tiles = cloneTiles(board);
  const key = hexKey(hex);
  if (tile === undefined) {
    tiles.delete(key);
  } else {
    tiles.set(key, tile);
  }
  return withTiles(tiles);
}

/**
 * 在指定格放置地形。
 * 為什麼：王抽牌鋪牆、技能產生地形時的統一入口。
 */
export function placeTerrain(
  board: Board,
  hex: Axial,
  kind: TerrainKind,
  opts: { aged?: boolean; noAge?: boolean } = {},
): Board {
  return setTile(board, hex, makeTile(kind, opts));
}

/**
 * 對地形打一下：plain／starter → 破碎；plain_broken → 銷毀。
 * 不可拆的 kind（punish／curse／silence）回 ok:false，棋盤不變。
 */
export function crackTile(board: Board, hex: Axial): TerrainHitResult {
  const tile = getTile(board, hex);
  if (!tile) {
    return { board, cracked: false, destroyed: false, damagesBoss: false, ok: false };
  }
  if (!kindAllowsCrack(tile.kind)) {
    return { board, cracked: false, destroyed: false, damagesBoss: false, ok: false };
  }

  if (tile.kind === 'plain' || tile.kind === 'plain_starter') {
    const keepNoAge = tile.kind === 'plain_starter' || tile.noAge === true;
    const broken: Tile = {
      kind: 'plain_broken',
      aged: keepNoAge ? false : tile.aged === true,
      noAge: keepNoAge,
    };
    return {
      board: setTile(board, hex, broken),
      cracked: true,
      destroyed: false,
      damagesBoss: false,
      ok: true,
    };
  }

  if (tile.kind === 'plain_broken') {
    return destroyTile(board, hex);
  }

  return { board, cracked: false, destroyed: false, damagesBoss: false, ok: false };
}

/**
 * 強制移除格上地形（第二下拆掉或特殊「吃掉」入口）。
 * 一般攻擊應走 crackTile；此函式供明確銷毀／吃掉路徑。
 * // UNRESOLVED: 吃掉詛咒、沉默格一般拆 — 呼叫端自行決定是否允許。
 */
export function destroyTile(board: Board, hex: Axial): TerrainHitResult {
  const tile = getTile(board, hex);
  if (!tile) {
    return { board, cracked: false, destroyed: false, damagesBoss: false, ok: false };
  }
  const damagesBoss = tileDestroyDamagesBoss(tile);
  return {
    board: setTile(board, hex, undefined),
    cracked: false,
    destroyed: true,
    damagesBoss,
    ok: true,
  };
}

/**
 * 玩家／單位能否站在此格。
 * - 王格 (0,0)：否
 * - 空格：是
 * - 有地形：依 kindAllowsStand（curse 可自願踩；牆／punish／silence 預設否）
 */
export function canStandAt(board: Board, hex: Axial): boolean {
  if (equals(hex, BOSS_HEX)) return false;
  const tile = getTile(board, hex);
  if (!tile) return true;
  return kindAllowsStand(tile.kind);
}

/**
 * 目標格是否可作為「被推過來的地形」落點。
 * 為什麼：推牆需要空格且不能壓王格。
 */
export function canPushOnto(board: Board, hex: Axial): boolean {
  if (equals(hex, BOSS_HEX)) return false;
  return getTile(board, hex) === undefined;
}

/**
 * 某格現有地形是否允許被推走。
 */
export function canPushFrom(board: Board, hex: Axial): boolean {
  const tile = getTile(board, hex);
  if (!tile) return false;
  return kindAllowsPush(tile.kind);
}

/**
 * 把 from 上的地形推到 to（若 from 可推且 to 可落）。
 * 成功回新 Board；失敗回 null。
 */
export function pushTerrain(board: Board, from: Axial, to: Axial): Board | null {
  if (equals(from, to)) return null;
  if (!canPushFrom(board, from)) return null;
  if (!canPushOnto(board, to)) return null;
  const tile = getTile(board, from);
  if (!tile) return null;
  let next = setTile(board, from, undefined);
  next = setTile(next, to, { ...tile });
  return next;
}

/**
 * 自願踩上詛咒格：格上 curse 消失（清空）。
 * 為什麼：定案「踩詛咒之後，詛咒（格）會消失」；角色上身層數由 turn／combat 上層加。
 * 非 curse 或空格 → 回 null。
 */
export function absorbCurseAt(board: Board, hex: Axial): Board | null {
  const tile = getTile(board, hex);
  if (!tile || tile.kind !== 'curse') return null;
  return setTile(board, hex, undefined);
}
