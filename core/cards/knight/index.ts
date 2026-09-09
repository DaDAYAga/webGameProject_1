/**
 * 騎士 PVE 卡牌（core/cards/knight）。
 * 已實作：攻擊、盾牌衝鋒。其餘為 TODO stub。
 */

export type {
  KnightCardId,
  KnightCardInstance,
  KnightCardEvent,
  KnightAttackResult,
  CurseStopMode,
  ShieldChargeResult,
} from './types.js';

export {
  KNIGHT_ATTACK_BOSS_DAMAGE,
  resolveKnightAttack,
  knightAttackDistance,
  type ResolveKnightAttackInput,
} from './attack.js';

export {
  SHIELD_CHARGE_MAX_STEPS,
  resolveShieldCharge,
  type ResolveShieldChargeInput,
} from './shieldCharge.js';

export {
  resolveFaithStub,
  resolveGuardStub,
  resolveDevotionStub,
  resolveUndyingStub,
  makeKnightCard,
} from './stubs.js';
