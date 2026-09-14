/**
 * 狂妄氣瓶推牆：射擊後玩家點選 N 個鄰格，各沿徑向推 1 步。
 * 不傷王（plain_broken 相撞銷毀不走 applyTerrainHit／tileDestroyDamagesBoss）。
 */

import {
  BOSS_HEX,
  getTile,
  setTile,
  type Board,
  type Tile,
} from '../../board/index.js';
import {
  DEFAULT_MAP_RADIUS,
  isInMap,
  type MapBounds,
} from '../../enclosure/index.js';
import { equals, type Axial } from '../../hex/index.js';

const PLAIN_FAMILY = new Set(['plain', 'plain_broken', 'plain_starter']);

/** 徑向目標：dest = 2*tile − gunner（同軸再遠一步）。 */
export function radialDest(gunner: Axial, tile: Axial): Axial {
  return { q: 2 * tile.q - gunner.q, r: 2 * tile.r - gunner.r };
}

export type TryArrogantPushInput = {
  board: Board;
  /** 槍手所在格（推牆原點）。 */
  gunnerHex: Axial;
  /** 玩家點選的鄰格（須有 plain 系地形才會動）。 */
  chosenHex: Axial;
  /** 單位佔格（含自己；dest 有單位則跳過）。 */
  occupied?: readonly Axial[];
  bounds?: MapBounds;
};

export type TryArrogantPushResult = {
  board: Board;
  /** 是否發生任何盤面變更。 */
  changed: boolean;
  reason?:
    | 'empty'
    | 'not_plain_family'
    | 'dest_off_map'
    | 'dest_occupied'
    | 'dest_boss'
    | 'skipped';
};

function copyTile(tile: Tile): Tile {
  return {
    kind: tile.kind,
    aged: tile.aged === true,
    noAge: tile.noAge === true,
  };
}

/**
 * 對單一選格嘗試徑向推 1。
 * SKIP：空格／非 plain 系／dest 圖外／dest 有單位／dest 是王。
 * dest 空：搬移整塊（保留 aged/noAge/kind）。
 * dest 有 plain 系：intact→plain_broken；已 broken→清空（不傷王）；來源格不動。
 */
export function tryArrogantPush(input: TryArrogantPushInput): TryArrogantPushResult {
  const bounds = input.bounds ?? { radius: DEFAULT_MAP_RADIUS };
  const occupied = input.occupied ?? [];
  const { board, gunnerHex, chosenHex } = input;
  const tile = getTile(board, chosenHex);
  if (!tile) {
    return { board, changed: false, reason: 'empty' };
  }
  if (!PLAIN_FAMILY.has(tile.kind)) {
    return { board, changed: false, reason: 'not_plain_family' };
  }

  const dest = radialDest(gunnerHex, chosenHex);
  if (!isInMap(dest, bounds)) {
    return { board, changed: false, reason: 'dest_off_map' };
  }
  if (equals(dest, BOSS_HEX)) {
    return { board, changed: false, reason: 'dest_boss' };
  }
  if (occupied.some((o) => equals(o, dest))) {
    return { board, changed: false, reason: 'dest_occupied' };
  }

  const destTile = getTile(board, dest);
  if (!destTile) {
    // 搬移
    let next = setTile(board, chosenHex, undefined);
    next = setTile(next, dest, copyTile(tile));
    return { board: next, changed: true };
  }

  if (!PLAIN_FAMILY.has(destTile.kind)) {
    // 非 plain 系佔 dest：來源不動
    return { board, changed: false, reason: 'skipped' };
  }

  // 相撞：來源不動；dest intact→broken；broken→清（不傷王）
  if (destTile.kind === 'plain_broken') {
    const next = setTile(board, dest, undefined);
    return { board: next, changed: true };
  }
  // plain / plain_starter → plain_broken，保留 aged/noAge
  const broken: Tile = {
    kind: 'plain_broken',
    aged: destTile.aged === true,
    noAge: destTile.noAge === true || destTile.kind === 'plain_starter',
  };
  return { board: setTile(board, dest, broken), changed: true };
}

/**
 * 依序對多個選格推牆（後一次看前一次 board）。
 */
export function applyArrogantPushes(
  board: Board,
  gunnerHex: Axial,
  chosenHexes: readonly Axial[],
  occupied: readonly Axial[] = [],
  bounds?: MapBounds,
): { board: Board; changedCount: number } {
  let next = board;
  let changedCount = 0;
  for (const h of chosenHexes) {
    const r = tryArrogantPush({
      board: next,
      gunnerHex,
      chosenHex: h,
      occupied,
      bounds,
    });
    next = r.board;
    if (r.changed) changedCount += 1;
  }
  return { board: next, changedCount };
}
