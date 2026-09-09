/**
 * 騎士 PVE 卡牌（core/cards/knight）。
 * 已實作：攻擊、英勇衝鋒、堅定信仰、嘲諷、奉獻、不死存在。
 */

export type {
  KnightCardId,
  KnightCardInstance,
  KnightCardEvent,
  KnightAttackResult,
  CurseStopMode,
  HeroicChargeResult,
  FaithResult,
  BossPlaceRestriction,
  TauntResult,
  DevotionResult,
  UndyingResult,
} from './types.js';

export {
  KNIGHT_CURSE_DEATH_STACKS,
  FAITH_CURSE_CLEAR,
  DEVOTION_ABSORB,
  UNDYING_LANDING_RADIUS,
  HEROIC_CHARGE_BOSS_HIT_DAMAGE,
  HEROIC_CHARGE_WALL_DAMAGE_CAP,
  HEROIC_CHARGE_BOSS_DRAWS,
  TAUNT_PRIORITY,
} from './constants.js';

export {
  KNIGHT_ATTACK_BOSS_DAMAGE,
  resolveKnightAttack,
  knightAttackDistance,
  type ResolveKnightAttackInput,
} from './attack.js';

export {
  resolveHeroicCharge,
  type ResolveHeroicChargeInput,
  type HeroicChargeUnit,
} from './heroicCharge.js';

export {
  resolveFaith,
  type ResolveFaithInput,
} from './faith.js';

export {
  TAUNT_RING_DISTANCE,
  tauntBlocksPlacement,
  resolveTaunt,
  type ResolveTauntInput,
} from './taunt.js';

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
