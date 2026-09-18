/**
 * 騎士「英勇衝鋒」×2：沿軸向直線衝到圖邊或硬停；計次；受沉默。
 * 破碎牆撞破續衝；完整牆（不論老化）停前一格並打一下（只破碎、不傷王）。
 * 只有破壞老化牆才傷王。撞 punish／silence／mud／王／邊緣／單位前一格硬停。
 * 結算後一律 forceEndTurn。見 design-amendments 2026-09-19。
 */

import {
  BOSS_HEX,
  absorbCurseAt,
  destroyTile,
  getTile,
  kindAllowsCrack,
  type Board,
  type Tile,
} from '../../board/index.js';
import { applyTerrainHit } from '../../combat/index.js';
import {
  DEFAULT_MAP_RADIUS,
  isInMap,
  type MapBounds,
} from '../../enclosure/index.js';
import { add, equals, type Axial } from '../../hex/index.js';
import {
  HEROIC_CHARGE_BOSS_DRAWS,
  HEROIC_CHARGE_BOSS_HIT_DAMAGE,
  HEROIC_CHARGE_WALL_DAMAGE_CAP,
} from './constants.js';
import type {
  CurseStopMode,
  HeroicChargeResult,
  KnightCardEvent,
} from './types.js';

/** 衝鋒路徑上的其他單位（不含自己）。 */
export type HeroicChargeUnit = {
  id: string;
  hex: Axial;
};

export type ResolveHeroicChargeInput = {
  board: Board;
  /** 衝鋒前角色位置。 */
  actorPosition: Axial;
  /**
   * 衝鋒方向（應為 AXIAL_DIRECTIONS 之一）。
   * 呼叫端負責選方向；本函式不驗證是否在六向表內。
   */
  direction: Axial;
  /**
   * 遇詛咒行為。預設 `absorb`（穿過並清格）。
   * 難度可傳 `stop`。
   */
  curseStop?: CurseStopMode;
  /**
   * 地圖邊界。未傳則用 DEFAULT_MAP_RADIUS。
   * // UNRESOLVED/param: 正式半徑未鎖定。
   */
  bounds?: MapBounds;
  bossHex?: Axial;
  /**
   * 其他單位（不含自己）。路徑撞到時改落到 landingHex。
   */
  units?: readonly HeroicChargeUnit[];
  /**
   * 撞單位時的落點（須為該單位鄰 1 且 canStandAt）。
   */
  landingHex?: Axial;
};

/** 完整牆（plain／plain_starter，不論老化）→ 停前一格並打一下。 */
function isIntactWall(tile: Tile): boolean {
  return tile.kind === 'plain' || tile.kind === 'plain_starter';
}

function findUnitAt(
  units: readonly HeroicChargeUnit[],
  hex: Axial,
): HeroicChargeUnit | undefined {
  return units.find((u) => equals(u.hex, hex));
}

/**
 * 結算英勇衝鋒（純函式）。
 * 回傳新 board、新 actorPosition；forceEndTurn 恆 true。
 */
export function resolveHeroicCharge(
  input: ResolveHeroicChargeInput,
): HeroicChargeResult {
  const curseStop: CurseStopMode = input.curseStop ?? 'absorb';
  const bossHex = input.bossHex ?? BOSS_HEX;
  const bounds: MapBounds = input.bounds ?? { radius: DEFAULT_MAP_RADIUS };
  const units = input.units ?? [];
  let board = input.board;
  let pos = input.actorPosition;
  const start = input.actorPosition;
  const dir = input.direction;
  const events: KnightCardEvent[] = [];
  let wallDamage = 0;
  let hitBoss = false;
  let endReason = 'heroic_charge_complete';

  // 安全上限：半徑內直徑步數足夠到邊
  const maxSteps = Math.max(1, (bounds as { radius?: number }).radius ?? DEFAULT_MAP_RADIUS) * 2 + 2;

  for (let step = 1; step <= maxSteps; step++) {
    const next = add(pos, dir);

    if (!isInMap(next, bounds)) {
      events.push({ type: 'ChargeBlocked', hex: next, reason: 'map_edge' });
      endReason = 'charge_map_edge';
      break;
    }

    if (equals(next, bossHex)) {
      hitBoss = true;
      events.push({ type: 'ChargeBlocked', hex: next, reason: 'boss' });
      endReason = 'charge_into_boss';
      break;
    }

    const hitUnit = findUnitAt(units, next);
    if (hitUnit) {
      // 不打人：停在前一格，不佔他人格、不失敗。
      events.push({ type: 'ChargeBlocked', hex: next, reason: 'unit' });
      endReason = 'charge_into_unit';
      break;
    }

    const tile = getTile(board, next);

    if (!tile) {
      pos = next;
      continue;
    }

    if (tile.kind === 'punish') {
      events.push({ type: 'ChargeBlocked', hex: next, reason: 'punish' });
      endReason = 'charge_into_punish';
      break;
    }

    if (tile.kind === 'silence') {
      events.push({ type: 'ChargeBlocked', hex: next, reason: 'silence' });
      endReason = 'charge_into_silence';
      break;
    }

    if (tile.kind === 'mud') {
      events.push({ type: 'ChargeBlocked', hex: next, reason: 'mud' });
      endReason = 'charge_into_mud';
      break;
    }

    if (tile.kind === 'curse') {
      if (curseStop === 'stop') {
        events.push({ type: 'CurseStopped', hex: next });
        endReason = 'charge_curse_stop';
        break;
      }
      const cleared = absorbCurseAt(board, next);
      if (cleared) {
        board = cleared;
        events.push({ type: 'CurseAbsorbed', hex: next });
        pos = next;
        continue;
      }
      events.push({ type: 'CurseStopped', hex: next });
      endReason = 'charge_curse_stop';
      break;
    }

    if (kindAllowsCrack(tile.kind)) {
      // 完整牆：停下、打一下（破碎）；未破壞所以不傷王
      if (isIntactWall(tile)) {
        const hit = applyTerrainHit(board, next);
        board = hit.board;
        events.push(...hit.events);
        events.push({
          type: 'WallPierce',
          hex: next,
          bossDamageApplied: 0,
        });
        endReason = 'charge_into_intact_wall';
        break;
      }

      // 破碎牆：撞破續衝；破壞且老化才傷王
      if (tile.kind === 'plain_broken') {
        const destroyed = destroyTile(board, next);
        board = destroyed.board;
        let applied = 0;
        if (destroyed.damagesBoss && wallDamage < HEROIC_CHARGE_WALL_DAMAGE_CAP) {
          applied = 1;
          wallDamage += 1;
        }
        events.push({
          type: 'WallPierce',
          hex: next,
          bossDamageApplied: applied,
        });
        pos = next;
        continue;
      }
    }

    // 未知地形：停住
    endReason = 'charge_unknown_terrain';
    break;
  }

  const bossHitDamage = hitBoss ? HEROIC_CHARGE_BOSS_HIT_DAMAGE : 0;
  const bossDamage = wallDamage + bossHitDamage;
  const bossDraw = wallDamage > 0 || hitBoss;

  if (wallDamage > 0) {
    events.push({
      type: 'BossDamaged',
      amount: wallDamage,
      source: 'aged_wall_destroy',
      effective: true,
    });
  }
  if (hitBoss) {
    events.push({
      type: 'BossDamaged',
      amount: HEROIC_CHARGE_BOSS_HIT_DAMAGE,
      source: 'heroic_charge',
      effective: true,
    });
  }
  if (bossDraw) {
    events.push({
      type: 'DrawRequested',
      count: HEROIC_CHARGE_BOSS_DRAWS,
      reason: 'heroic_charge',
    });
  }

  if (!equals(pos, start)) {
    events.unshift({ type: 'ActorMoved', from: start, to: pos });
  }
  events.push({ type: 'TurnForceEnded', reason: endReason });

  return {
    ok: true,
    board,
    actorPosition: pos,
    events,
    counted: true,
    forceEndTurn: true,
    bossDamage,
    wallDamage,
    hitBoss,
    bossDraw,
    curseStop,
  };
}

function failHeroic(
  board: Board,
  actorPosition: Axial,
  curseStop: CurseStopMode,
  reason: string,
): HeroicChargeResult {
  return {
    ok: false,
    reason,
    board,
    actorPosition,
    events: [{ type: 'TurnForceEnded', reason: 'heroic_charge_failed' }],
    counted: true,
    forceEndTurn: true,
    bossDamage: 0,
    wallDamage: 0,
    hitBoss: false,
    bossDraw: false,
    curseStop,
  };
}
