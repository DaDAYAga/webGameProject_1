/**
 * 槍手 PVE 卡牌（core/cards/gunner）。
 * 已實作：射擊、氣瓶、大亂流、Power UP!!、來吧! 大鬧一場!
 */

export type {
  GunnerCardId,
  AmmoSlotState,
  GunnerCardInstance,
  GunnerCardEvent,
  GunnerShotResult,
  GunnerBottleResult,
  TurbulenceResult,
  PowerUpResult,
  BigShowResult,
} from './types.js';

export {
  EMPTY_AMMO_SLOT,
  AMMO_SLOT_MAX_TOTAL,
} from './types.js';

export {
  TURBULENCE_MAX_BOTTLE_DISCARD,
  TURBULENCE_MOVE_BASE,
  POWER_UP_DIG_SHOTS,
  BIG_SHOW_DRAW,
} from './constants.js';

export {
  ammoSlotTotal,
  canAddAmmo,
  addAmmo,
  clearAmmoSlot,
} from './ammo.js';

export {
  GUNNER_SHOT_BASE_DAMAGE,
  resolveGunnerShot,
  type ResolveGunnerShotInput,
} from './shot.js';

export {
  resolvePlayfulBottle,
  resolveMischiefBottle,
  type ResolveBottleInput,
} from './bottles.js';

export {
  resolveTurbulence,
  type ResolveTurbulenceInput,
} from './turbulence.js';

export {
  resolvePowerUp,
  type PowerUpMode,
  type ResolvePowerUpInput,
} from './powerUp.js';

export {
  resolveBigShow,
  type ResolveBigShowInput,
} from './bigShow.js';

export {
  GUNNER_CARD_DEFS,
  makeGunnerCard,
} from './stubs.js';
