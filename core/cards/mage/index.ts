/**
 * 法師 PVE 卡牌（core/cards/mage）。
 * 已實作：御風術、位面調換；魔法箭薄包遠程。其餘 TODO stub。
 */

export type {
  MageCardId,
  MageActorRef,
  MageCardInstance,
  MageCardEvent,
  WindControlResult,
  PlanarSwapResult,
  MagicArrowResult,
} from './types.js';

export {
  WIND_BASE_STEPS,
  WIND_AMPLIFIED_STEPS,
  mageWindAllowsKind,
  canWindPushFrom,
  wouldWindCrush,
  resolveWindControl,
  type ResolveWindControlInput,
} from './wind.js';

export {
  PLANAR_SWAP_MAX_DISTANCE,
  resolvePlanarSwap,
  type ResolvePlanarSwapInput,
} from './planar.js';

export {
  MAGIC_ARROW_BASE_DAMAGE,
  resolveMagicArrow,
  type ResolveMagicArrowInput,
} from './magicArrow.js';

export {
  resolveAmplifyStub,
  resolveFocusStub,
  resolveBarrierStub,
  MAGE_CARD_DEFS,
  makeMageCard,
} from './stubs.js';
