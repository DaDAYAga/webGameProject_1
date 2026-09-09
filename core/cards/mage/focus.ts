/**
 * 法師「聚精會神」×2：抽 2（增幅 3）；不計次；立刻結束回合。
 */

import { FOCUS_DRAW, FOCUS_DRAW_AMPLIFIED } from './constants.js';
import type { FocusResult, MageCardEvent } from './types.js';

export type ResolveFocusInput = {
  /** 是否消耗強能增幅。 */
  amplified?: boolean;
  /** 基礎／增幅抽數覆寫。 */
  baseDraw?: number;
  amplifiedDraw?: number;
};

/**
 * 結算聚精會神（純函式；實際抽牌由上層依 drawCount 執行）。
 */
export function resolveFocus(input: ResolveFocusInput = {}): FocusResult {
  const amplified = input.amplified === true;
  const drawCount = amplified
    ? (input.amplifiedDraw ?? FOCUS_DRAW_AMPLIFIED)
    : (input.baseDraw ?? FOCUS_DRAW);

  const events: MageCardEvent[] = [
    { type: 'DrawRequested', count: drawCount },
    { type: 'TurnForceEnded', reason: 'focus' },
  ];

  return {
    ok: true,
    events,
    counted: false,
    drawCount,
    amplified,
    endTurn: true,
  };
}
