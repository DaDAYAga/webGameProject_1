/**
 * 槍手「Power UP!!」×2：本回合須已移動後可出。
 * 二選一：(a) 從牌庫檢最多 2 張射擊；(b) 本牌當臨時射擊（吃裝填清槽，之後不可立刻氣瓶）。
 * 計次；受沉默。
 */

import type { Axial } from '../../hex/index.js';
import { POWER_UP_DIG_SHOTS } from './constants.js';
import { resolveGunnerShot } from './shot.js';
import type {
  AmmoSlotState,
  GunnerCardEvent,
  GunnerCardInstance,
  PowerUpResult,
} from './types.js';

export type PowerUpMode = 'dig_shots' | 'temp_shot';

export type ResolvePowerUpInput = {
  /** 本回合是否已移動；未移動不可出。 */
  hasMovedThisTurn: boolean;
  mode: PowerUpMode;
  /**
   * dig_shots：牌庫頂端順序（本層只從中取出射擊，最多 POWER_UP_DIG_SHOTS）。
   * 不足則檢到的都給（1 或 0）。
   */
  deck?: GunnerCardInstance[];
  /** temp_shot：攻擊者格＋裝填槽。 */
  attacker?: Axial;
  ammo?: AmmoSlotState;
  ignoreRangePenalty?: boolean;
  bossHex?: Axial;
  /** 檢牌上限；預設 POWER_UP_DIG_SHOTS。 */
  digLimit?: number;
};

/**
 * 結算 Power UP!!（純函式）。
 */
export function resolvePowerUp(input: ResolvePowerUpInput): PowerUpResult {
  if (!input.hasMovedThisTurn) {
    return {
      ok: false,
      reason: 'not_moved',
      events: [],
      counted: true,
      mode: input.mode,
      dugShots: [],
      remainingDeck: input.deck ?? [],
      cannotBottleImmediately: false,
    };
  }

  if (input.mode === 'dig_shots') {
    const limit = input.digLimit ?? POWER_UP_DIG_SHOTS;
    const deck = [...(input.deck ?? [])];
    const dugShots: GunnerCardInstance[] = [];
    const remainingDeck: GunnerCardInstance[] = [];
    for (const c of deck) {
      if (dugShots.length < limit && c.cardId === 'shot') {
        dugShots.push(c);
      } else {
        remainingDeck.push(c);
      }
    }
    // 檢牌：從牌庫「找出」射擊，非射擊留在庫（順序保留相對）
    const events: GunnerCardEvent[] = [
      {
        type: 'ShotsDug',
        instanceIds: dugShots.map((c) => c.instanceId),
        count: dugShots.length,
      },
    ];
    return {
      ok: true,
      events,
      counted: true,
      mode: 'dig_shots',
      dugShots,
      remainingDeck,
      cannotBottleImmediately: false,
    };
  }

  // temp_shot
  if (!input.attacker || !input.ammo) {
    return {
      ok: false,
      reason: 'temp_shot_missing_input',
      events: [],
      counted: true,
      mode: 'temp_shot',
      dugShots: [],
      remainingDeck: input.deck ?? [],
      cannotBottleImmediately: false,
    };
  }

  const shot = resolveGunnerShot({
    attacker: input.attacker,
    ammo: input.ammo,
    ignoreRangePenalty: input.ignoreRangePenalty,
    bossHex: input.bossHex,
  });

  const events: GunnerCardEvent[] = [
    { type: 'TempShotPlayed' },
    ...shot.events,
  ];

  return {
    ok: true,
    events,
    counted: true,
    mode: 'temp_shot',
    dugShots: [],
    remainingDeck: input.deck ?? [],
    cannotBottleImmediately: true,
    bossDamage: shot.bossDamage,
    inSweetZone: shot.inSweetZone,
    drawFromAmmo: shot.drawFromAmmo,
    ammo: shot.ammo,
  };
}
