/**
 * 騎士「攻擊」×5：計次、近戰打王或拆純障礙。
 * 對王且鄰 1 → 2 傷；對 plain 系先破碎再拆；不可指定 punish／curse。
 */

import {
  BOSS_HEX,
  getTile,
  kindAllowsCrack,
  type Board,
} from '../../board/index.js';
import {
  applyTerrainHit,
  bossDamagedEventFromMelee,
  computeMeleeDamageToBoss,
} from '../../combat/index.js';
import { distance, equals, type Axial } from '../../hex/index.js';
import type { KnightAttackResult } from './types.js';

/** 攻擊對王本體基礎傷害。 */
export const KNIGHT_ATTACK_BOSS_DAMAGE = 2;

export type ResolveKnightAttackInput = {
  board: Board;
  /** 攻擊者所在格。 */
  attacker: Axial;
  /** 指定目標：王格或可拆地形格。 */
  target: Axial;
  bossHex?: Axial;
};

/**
 * 結算騎士攻擊（純函式）。
 * - 目標為王且 distance === 1：2 傷（combat 近戰 helper）
 * - 目標為可拆 plain 系：applyTerrainHit（僅破碎不傷王；拆老化才傷王）
 * - punish／curse：拒絕
 */
export function resolveKnightAttack(
  input: ResolveKnightAttackInput,
): KnightAttackResult {
  const bossHex = input.bossHex ?? BOSS_HEX;
  const { board, attacker, target } = input;

  if (equals(target, bossHex)) {
    const melee = computeMeleeDamageToBoss({
      attacker,
      baseDamage: KNIGHT_ATTACK_BOSS_DAMAGE,
      bossHex,
    });
    const events = [];
    const bossEvt = bossDamagedEventFromMelee(melee);
    if (bossEvt) events.push(bossEvt);
    return {
      ok: true,
      board,
      events,
      counted: true,
      bossDamage: melee.effective ? melee.damage : 0,
      ...(melee.adjacent ? {} : { reason: 'not_adjacent' }),
    };
  }

  const tile = getTile(board, target);
  if (!tile) {
    return {
      ok: false,
      reason: 'empty_target',
      board,
      events: [],
      counted: true,
      bossDamage: 0,
    };
  }

  if (tile.kind === 'punish' || tile.kind === 'curse') {
    return {
      ok: false,
      reason: `cannot_target_${tile.kind}`,
      board,
      events: [],
      counted: true,
      bossDamage: 0,
    };
  }

  if (!kindAllowsCrack(tile.kind)) {
    return {
      ok: false,
      reason: 'cannot_crack',
      board,
      events: [],
      counted: true,
      bossDamage: 0,
    };
  }

  // 純障礙：一擊破碎／二擊拆掉；僅 cracking 不傷王
  const hit = applyTerrainHit(board, target);
  if (!hit.ok) {
    return {
      ok: false,
      reason: 'terrain_hit_failed',
      board,
      events: [],
      counted: true,
      bossDamage: 0,
    };
  }

  return {
    ok: true,
    board: hit.board,
    events: hit.events,
    counted: true,
    bossDamage: hit.bossDamaged ? 1 : 0,
  };
}

/** 目標距離（測試／UI 輔助）。 */
export function knightAttackDistance(attacker: Axial, target: Axial): number {
  return distance(attacker, target);
}
