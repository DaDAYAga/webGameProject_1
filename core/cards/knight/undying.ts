/**
 * 騎士「不死存在」×1：非一般存活出牌。
 * 僅死亡且卡在手，該輪可行動者皆結束後復活。
 * 落點周圍：破碎普通牆清空、未破普通牆改破碎；punish／curse／silence 不動；不傷王。
 * 落地後本輪結束。奉獻同回合檢出 → 須等下一個輪末。
 * // UNRESOLVED: 落點可先為任意可站格；之後可能限死亡鄰近。
 */

import {
  canStandAt,
  getTile,
  setTile,
  type Board,
} from '../../board/index.js';
import { neighbors, type Axial } from '../../hex/index.js';
import { UNDYING_LANDING_RADIUS } from './constants.js';
import type { KnightCardEvent, UndyingResult } from './types.js';

export type ResolveUndyingInput = {
  board: Board;
  /**
   * 復活落點。
   * // UNRESOLVED: 目前任意可站格；之後可能限死亡格鄰近。
   */
  landingHex: Axial;
  /** 是否已死亡（未死亡不可觸發）。 */
  isDead: boolean;
  /** 手牌是否持有不死存在。 */
  hasUndyingInHand: boolean;
  /**
   * 本回合是否由奉獻抽出（同回合不可復活，須等下一個輪末）。
   */
  extractedThisRound?: boolean;
  /**
   * 觸發時機是否為「可行動者皆結束後的輪末」。
   * 呼叫端負責；此旗為 false 則拒絕。
   */
  atRoundEndAfterActors?: boolean;
};

/**
 * 結算不死存在復活（純函式）。
 * 周圍影響僅鄰 1（UNDYING_LANDING_RADIUS）；清破碎牆不走 destroyTile（避免傷王）。
 */
export function resolveUndying(input: ResolveUndyingInput): UndyingResult {
  if (!input.isDead) {
    return failUndying(input.board, 'not_dead');
  }
  if (!input.hasUndyingInHand) {
    return failUndying(input.board, 'not_in_hand');
  }
  if (input.extractedThisRound === true) {
    return failUndying(input.board, 'extracted_this_round_defer');
  }
  if (input.atRoundEndAfterActors !== true) {
    return failUndying(input.board, 'not_round_end');
  }
  if (!canStandAt(input.board, input.landingHex)) {
    return failUndying(input.board, 'landing_not_standable');
  }

  // UNRESOLVED: 落點未限死亡鄰近；僅驗證可站。
  void UNDYING_LANDING_RADIUS;

  let board = input.board;
  const events: KnightCardEvent[] = [];
  const affected: Axial[] = [];

  for (const h of neighbors(input.landingHex)) {
    const tile = getTile(board, h);
    if (!tile) continue;
    if (tile.kind === 'plain_broken') {
      // 清空；刻意不走 destroyTile → 不傷王
      board = setTile(board, h, undefined);
      affected.push(h);
      events.push({ type: 'UndyingClearedBroken', hex: h });
      continue;
    }
    if (tile.kind === 'plain' || tile.kind === 'plain_starter') {
      board = setTile(board, h, {
        kind: 'plain_broken',
        aged: tile.aged === true,
        noAge: tile.noAge === true || tile.kind === 'plain_starter',
      });
      affected.push(h);
      events.push({ type: 'UndyingCrackedPlain', hex: h });
      continue;
    }
    // punish / curse / silence：不動
  }

  events.push({ type: 'ActorRevived', hex: input.landingHex });
  events.push({ type: 'TurnForceEnded', reason: 'undying_revive' });

  return {
    ok: true,
    board,
    actorPosition: input.landingHex,
    events,
    counted: false,
    forceEndTurn: true,
    bossDamage: 0,
    affectedHexes: affected,
  };
}

function failUndying(board: Board, reason: string): UndyingResult {
  return {
    ok: false,
    reason,
    board,
    events: [],
    counted: false,
    forceEndTurn: false,
    bossDamage: 0,
    affectedHexes: [],
  };
}
