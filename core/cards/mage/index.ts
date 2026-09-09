/**
 * 法師 PVE 卡牌（core/cards/mage）。
 * 已實作：御風、位面、魔法箭、強能增幅、聚精會神、磁力屏障。
 */

export type {
  MageCardId,
  MageActorRef,
  MageCardInstance,
  MageCardEvent,
  WindControlResult,
  PlanarSwapResult,
  MagicArrowResult,
  AmplifyResult,
  FocusResult,
  BarrierAura,
  BarrierResult,
} from './types.js';

export {
  AMPLIFY_ARROW_BONUS,
  FOCUS_DRAW,
  FOCUS_DRAW_AMPLIFIED,
  BARRIER_RETARGET_MAX_DIST,
  BARRIER_NEXT_TURN_DRAW_DELTA,
} from './constants.js';

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
  resolveAmplify,
  type ResolveAmplifyInput,
} from './amplify.js';

export {
  resolveFocus,
  type ResolveFocusInput,
} from './focus.js';

export {
  barrierProtectedHexes,
  barrierBlocksPlacement,
  resolveBarrier,
  type ResolveBarrierInput,
} from './barrier.js';

export {
  MAGE_CARD_DEFS,
  makeMageCard,
} from './stubs.js';
