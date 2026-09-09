/**
 * 騎士 PVE 卡牌（core/cards/knight）。
 * 已實作：攻擊、衝鋒、堅定信仰、護身、奉獻、不死存在。
 */

export type {
  KnightCardId,
  KnightCardInstance,
  KnightCardEvent,
  KnightAttackResult,
  CurseStopMode,
  ShieldChargeResult,
  FaithResult,
  GuardResult,
  DevotionResult,
  UndyingResult,
} from './types.js';

export {
  KNIGHT_CURSE_DEATH_STACKS,
  FAITH_CURSE_CLEAR,
  DEVOTION_ABSORB,
  UNDYING_LANDING_RADIUS,
} from './constants.js';

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
  resolveFaith,
  type ResolveFaithInput,
} from './faith.js';

export {
  guardSightBlockedByTile,
  straightLineDirection,
  hexesBetweenOnLine,
  hasGuardLineOfSight,
  resolveGuard,
  type ResolveGuardInput,
} from './guard.js';

export {
  resolveDevotion,
  type ResolveDevotionInput,
} from './devotion.js';

export {
  resolveUndying,
  type ResolveUndyingInput,
} from './undying.js';

export {
  KNIGHT_CARD_DEFS,
  makeKnightCard,
} from './stubs.js';
