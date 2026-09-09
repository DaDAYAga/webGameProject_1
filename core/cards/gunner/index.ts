/**
 * 槍手 PVE 卡牌（core/cards/gunner）。
 * 已實作：射擊、頑皮／胡鬧氣瓶（裝填槽）。其餘為 TODO stub。
 */

export type {
  GunnerCardId,
  AmmoSlotState,
  GunnerCardInstance,
  GunnerCardEvent,
  GunnerShotResult,
  GunnerBottleResult,
} from './types.js';

export {
  EMPTY_AMMO_SLOT,
  AMMO_SLOT_MAX_TOTAL,
} from './types.js';

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
  resolveTurbulenceStub,
  resolvePowerUpStub,
  resolveBigShowStub,
  GUNNER_CARD_DEFS,
  makeGunnerCard,
} from './stubs.js';
