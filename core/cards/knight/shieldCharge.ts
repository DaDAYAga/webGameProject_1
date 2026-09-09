/**
 * 騎士「盾牌衝鋒」×2：直線最多 2 格；計次。
 * 撞未老化完整牆 → 停前一格、破碎、強制結束回合。
 * 撞老化牆 → 穿過拆掉、王 1 傷、結束回合。
 * punish／王格不可進，仍結束回合。
 * // UNRESOLVED: 遇詛咒截停或吸 1（curseStop 參數）
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
import { add, equals, type Axial } from '../../hex/index.js';
import type {
  CurseStopMode,
  KnightCardEvent,
  ShieldChargeResult,
} from './types.js';

/** 衝鋒最大步數。 */
export const SHIELD_CHARGE_MAX_STEPS = 2;

export type ResolveShieldChargeInput = {
  board: Board;
  /** 衝鋒前角色位置。 */
  actorPosition: Axial;
  /**
   * 衝鋒方向（應為 AXIAL_DIRECTIONS 之一）。
   * 呼叫端負責選方向；本函式不驗證是否在六向表內。
   */
  direction: Axial;
  /**
   * 遇詛咒行為。
   * // UNRESOLVED: 交接標「截停或吸 1」未鎖定。
   * 預設保守 `stop`。
   */
  curseStop?: CurseStopMode;
  bossHex?: Axial;
};

/** 完整且未老化的 plain／plain_starter → 停前一格並破碎。 */
function isIntactUnagedWall(tile: Tile): boolean {
  if (tile.kind === 'plain' || tile.kind === 'plain_starter') {
    return tile.aged !== true;
  }
  return false;
}

/** 老化可拆牆（含開場預設 aged plain_broken）。 */
function isAgedCrackableWall(tile: Tile): boolean {
  if (!kindAllowsCrack(tile.kind)) return false;
  return tile.aged === true;
}

/**
 * 結算盾牌衝鋒（純函式）。
 * 回傳新 board、新 actorPosition、是否 forceEndTurn。
 */
export function resolveShieldCharge(
  input: ResolveShieldChargeInput,
): ShieldChargeResult {
  // UNRESOLVED: curseStop 預設 stop（保守）；亦可傳 absorbMax1
  const curseStop: CurseStopMode = input.curseStop ?? 'stop';
  const bossHex = input.bossHex ?? BOSS_HEX;
  let board = input.board;
  let pos = input.actorPosition;
  const start = input.actorPosition;
  const dir = input.direction;
  const events: KnightCardEvent[] = [];
  let forceEndTurn = false;
  let bossDamage = 0;
  let cursesAbsorbed = 0;

  for (let step = 1; step <= SHIELD_CHARGE_MAX_STEPS; step++) {
    const next = add(pos, dir);

    if (equals(next, bossHex)) {
      events.push({ type: 'ChargeBlocked', hex: next, reason: 'boss' });
      events.push({ type: 'TurnForceEnded', reason: 'charge_into_boss' });
      forceEndTurn = true;
      break;
    }

    const tile = getTile(board, next);

    if (!tile) {
      pos = next;
      continue;
    }

    if (tile.kind === 'punish') {
      events.push({ type: 'ChargeBlocked', hex: next, reason: 'punish' });
      events.push({ type: 'TurnForceEnded', reason: 'charge_into_punish' });
      forceEndTurn = true;
      break;
    }

    if (tile.kind === 'silence') {
      // 未明訂；比照不可進入障礙，結束回合
      events.push({ type: 'ChargeBlocked', hex: next, reason: 'silence' });
      events.push({ type: 'TurnForceEnded', reason: 'charge_into_silence' });
      forceEndTurn = true;
      break;
    }

    if (tile.kind === 'curse') {
      // UNRESOLVED: 截停或吸最多 1
      if (curseStop === 'stop') {
        events.push({ type: 'CurseStopped', hex: next });
        break;
      }
      if (cursesAbsorbed >= 1) {
        events.push({ type: 'CurseStopped', hex: next });
        break;
      }
      const cleared = absorbCurseAt(board, next);
      if (cleared) {
        board = cleared;
        cursesAbsorbed += 1;
        events.push({ type: 'CurseAbsorbed', hex: next });
        pos = next;
        continue;
      }
      events.push({ type: 'CurseStopped', hex: next });
      break;
    }

    if (kindAllowsCrack(tile.kind)) {
      if (isAgedCrackableWall(tile)) {
        // 老化牆：穿過拆掉；開場預設 aged broken 亦走此路
        const destroyed = destroyTile(board, next);
        board = destroyed.board;
        if (destroyed.damagesBoss) {
          bossDamage += 1;
          events.push({
            type: 'BossDamaged',
            amount: 1,
            source: 'aged_wall_destroy',
            effective: true,
          });
        }
        pos = next;
        events.push({
          type: 'TurnForceEnded',
          reason: 'charge_through_aged_wall',
        });
        forceEndTurn = true;
        break;
      }

      // 新牆／未老化完整牆，或未老化 plain_broken：停前一格、打一下、結束回合
      if (isIntactUnagedWall(tile) || tile.kind === 'plain_broken') {
        const hit = applyTerrainHit(board, next);
        board = hit.board;
        events.push(...hit.events);
        if (hit.bossDamaged) bossDamage += 1;
        events.push({
          type: 'TurnForceEnded',
          reason: 'charge_into_fresh_wall',
        });
        forceEndTurn = true;
        break;
      }
    }

    // 未知地形：停住
    break;
  }

  if (!equals(pos, start)) {
    events.unshift({ type: 'ActorMoved', from: start, to: pos });
  }

  return {
    ok: true,
    board,
    actorPosition: pos,
    events,
    counted: true,
    forceEndTurn,
    bossDamage,
    curseStop,
  };
}
