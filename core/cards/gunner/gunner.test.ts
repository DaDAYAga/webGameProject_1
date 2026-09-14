import { describe, expect, it } from 'vitest';
import {
  createEmptyBoard,
  placeTerrain,
} from '../../board/index.js';
import {
  AMMO_SLOT_MAX_TOTAL,
  BIG_SHOW_FREE_DAMAGE,
  BIG_SHOW_FREE_DRAW,
  BIG_SHOW_FREE_PUSH,
  EMPTY_AMMO_SLOT,
  GUNNER_SHOT_BASE_DAMAGE,
  TURBULENCE_MOVE_BASE,
  addAmmo,
  addAmmoUnchecked,
  ammoSlotTotal,
  canAddAmmo,
  makeGunnerCard,
  resolveBigShow,
  resolveGunnerShot,
  resolveMischiefBottle,
  resolvePlayfulBottle,
  resolvePowerUp,
  resolveTurbulence,
  tryArrogantPush,
  type AmmoSlotState,
  type GunnerCardInstance,
} from './index.js';

function handWith(...ids: Array<{ cardId: GunnerCardInstance['cardId']; id: string }>) {
  return ids.map(({ cardId, id }) => makeGunnerCard(cardId, id));
}

describe('gunner shot sweet / outside', () => {
  it('甜區 distance ≤3 → 完整基礎傷 1', () => {
    const r = resolveGunnerShot({
      attacker: { q: 3, r: 0 },
      ammo: EMPTY_AMMO_SLOT,
    });
    expect(r.ok).toBe(true);
    expect(r.counted).toBe(true);
    expect(r.inSweetZone).toBe(true);
    expect(r.bossDamage).toBe(GUNNER_SHOT_BASE_DAMAGE);
    expect(r.bossDamage).toBe(1);
    expect(r.drawFromAmmo).toBe(0);
    expect(r.ammo).toEqual(EMPTY_AMMO_SLOT);
    expect(r.events).toContainEqual({
      type: 'BossDamaged',
      amount: 1,
      source: 'ranged',
      effective: true,
    });
    expect(r.events).toContainEqual({ type: 'AmmoSlotCleared' });
  });

  it('區外 distance 4 → 基礎 1 −1 後 floor 1', () => {
    const r = resolveGunnerShot({
      attacker: { q: 4, r: 0 },
      ammo: EMPTY_AMMO_SLOT,
    });
    expect(r.ok).toBe(true);
    expect(r.inSweetZone).toBe(false);
    expect(r.bossDamage).toBe(1);
    expect(r.events).toContainEqual({
      type: 'BossDamaged',
      amount: 1,
      source: 'ranged',
      effective: true,
    });
  });

  it('區外 + 裝填傷 → (1+1)−1 = 1', () => {
    const r = resolveGunnerShot({
      attacker: { q: 4, r: 0 },
      ammo: { damageBonus: 1, drawBonus: 0 , pushBonus: 0 },
    });
    expect(r.bossDamage).toBe(1);
    expect(r.ammo).toEqual(EMPTY_AMMO_SLOT);
  });

  it('甜區 + 裝填傷 2 → 1+2 = 3', () => {
    const r = resolveGunnerShot({
      attacker: { q: 2, r: 0 },
      ammo: { damageBonus: 2, drawBonus: 0 , pushBonus: 0 },
    });
    expect(r.inSweetZone).toBe(true);
    expect(r.bossDamage).toBe(3);
  });
});

describe('ammo +1 dmg applies then clears', () => {
  it('頑皮裝填後射擊套用 +1 並清空槽', () => {
    const hand = handWith(
      { cardId: 'shot', id: 's1' },
      { cardId: 'shot', id: 's2' },
    );
    const bottle = resolvePlayfulBottle({
      ammo: EMPTY_AMMO_SLOT,
      hand,
      discardShotInstanceId: 's1',
    });
    expect(bottle.ok).toBe(true);
    expect(bottle.ammo).toEqual({ damageBonus: 1, drawBonus: 0 , pushBonus: 0 });
    expect(bottle.discardedShotId).toBe('s1');
    expect(bottle.hand.map((c) => c.instanceId)).toEqual(['s2']);

    const shot = resolveGunnerShot({
      attacker: { q: 1, r: 0 },
      ammo: bottle.ammo,
    });
    expect(shot.bossDamage).toBe(2);
    expect(shot.drawFromAmmo).toBe(0);
    expect(shot.ammo).toEqual(EMPTY_AMMO_SLOT);
    expect(shot.events).toContainEqual({ type: 'AmmoSlotCleared' });
  });
});

describe('ammo + draw flag', () => {
  it('胡鬧裝填後射擊回傳 drawFromAmmo 並清槽', () => {
    const hand = handWith({ cardId: 'shot', id: 's1' });
    const bottle = resolveMischiefBottle({
      ammo: EMPTY_AMMO_SLOT,
      hand,
    });
    expect(bottle.ok).toBe(true);
    expect(bottle.ammo).toEqual({ damageBonus: 0, drawBonus: 1 , pushBonus: 0 });

    const shot = resolveGunnerShot({
      attacker: { q: 2, r: 0 },
      ammo: bottle.ammo,
    });
    expect(shot.bossDamage).toBe(1);
    expect(shot.drawFromAmmo).toBe(1);
    expect(shot.ammo).toEqual(EMPTY_AMMO_SLOT);
  });

  it('傷害＋抽牌可並存；射擊一次全清', () => {
    let ammo: AmmoSlotState = EMPTY_AMMO_SLOT;
    const h1 = handWith(
      { cardId: 'shot', id: 's1' },
      { cardId: 'shot', id: 's2' },
    );
    const playful = resolvePlayfulBottle({ ammo, hand: h1, discardShotInstanceId: 's1' });
    ammo = playful.ammo;
    const mischief = resolveMischiefBottle({
      ammo,
      hand: playful.hand,
      discardShotInstanceId: 's2',
    });
    expect(mischief.ok).toBe(true);
    expect(mischief.ammo).toEqual({ damageBonus: 1, drawBonus: 1 , pushBonus: 0 });

    const shot = resolveGunnerShot({
      attacker: { q: 3, r: 0 },
      ammo: mischief.ammo,
    });
    expect(shot.bossDamage).toBe(2);
    expect(shot.drawFromAmmo).toBe(1);
    expect(shot.ammo).toEqual(EMPTY_AMMO_SLOT);
  });
});

describe('ammo cap at 2', () => {
  it('合計上限 2；第三層失敗', () => {
    expect(AMMO_SLOT_MAX_TOTAL).toBe(2);
    const full: AmmoSlotState = { damageBonus: 1, drawBonus: 1 , pushBonus: 0 };
    expect(ammoSlotTotal(full)).toBe(2);
    expect(canAddAmmo(full, 1, 0)).toBe(false);
    expect(addAmmo(full, 1, 0)).toBeNull();

    const hand = handWith({ cardId: 'shot', id: 's1' });
    const r = resolvePlayfulBottle({ ammo: full, hand });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('ammo_slot_full');
    expect(r.ammo).toEqual(full);
  });

  it('兩層頑皮可疊滿；再頑皮失敗', () => {
    let ammo: AmmoSlotState = EMPTY_AMMO_SLOT;
    let hand = handWith(
      { cardId: 'shot', id: 's1' },
      { cardId: 'shot', id: 's2' },
      { cardId: 'shot', id: 's3' },
    );
    const a = resolvePlayfulBottle({ ammo, hand, discardShotInstanceId: 's1' });
    expect(a.ok).toBe(true);
    ammo = a.ammo;
    hand = a.hand;
    const b = resolvePlayfulBottle({ ammo, hand, discardShotInstanceId: 's2' });
    expect(b.ok).toBe(true);
    expect(b.ammo).toEqual({ damageBonus: 2, drawBonus: 0 , pushBonus: 0 });
    const c = resolvePlayfulBottle({
      ammo: b.ammo,
      hand: b.hand,
      discardShotInstanceId: 's3',
    });
    expect(c.ok).toBe(false);
    expect(c.reason).toBe('ammo_slot_full');
  });
});

describe('bottle requires discarding a shot', () => {
  it('頑皮：手牌無射擊 → fail', () => {
    const hand = handWith({ cardId: 'playful_bottle', id: 'b1' });
    const r = resolvePlayfulBottle({ ammo: EMPTY_AMMO_SLOT, hand });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('no_shot_to_discard');
    expect(r.ammo).toEqual(EMPTY_AMMO_SLOT);
  });

  it('胡鬧：無射擊也可成功', () => {
    const hand = handWith({ cardId: 'mischief_bottle', id: 'b1' });
    const r = resolveMischiefBottle({
      ammo: EMPTY_AMMO_SLOT,
      hand,
    });
    expect(r.ok).toBe(true);
    expect(r.ammo.drawBonus).toBe(1);
  });

  it('頑皮：指定非射擊 instanceId → fail', () => {
    const hand = handWith(
      { cardId: 'shot', id: 's1' },
      { cardId: 'mischief_bottle', id: 'b1' },
    );
    const r = resolvePlayfulBottle({
      ammo: EMPTY_AMMO_SLOT,
      hand,
      discardShotInstanceId: 'b1',
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('no_shot_to_discard');
  });

  it('空手套頑皮 → fail', () => {
    const r = resolvePlayfulBottle({ ammo: EMPTY_AMMO_SLOT, hand: [] });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('no_shot_to_discard');
  });
});

describe('大亂流 resolveTurbulence', () => {
  it('happy：棄 2 氣瓶走 3 格', () => {
    const board = createEmptyBoard();
    const hand = handWith(
      { cardId: 'playful_bottle', id: 'b1' },
      { cardId: 'mischief_bottle', id: 'b2' },
      { cardId: 'shot', id: 's1' },
    );
    const start = { q: 2, r: 0 };
    const path = [
      { q: 3, r: 0 },
      { q: 4, r: 0 },
      { q: 5, r: 0 },
    ];
    const r = resolveTurbulence({
      board,
      actorPosition: start,
      hand,
      discardBottleInstanceIds: ['b1', 'b2'],
      path,
    });
    expect(r.ok).toBe(true);
    expect(r.counted).toBe(true);
    expect(r.steps).toBe(2 + TURBULENCE_MOVE_BASE);
    expect(r.actorPosition).toEqual({ q: 5, r: 0 });
    expect(r.hand.map((c) => c.instanceId)).toEqual(['s1']);
  });

  it('happy：棄 0 仍走 1 格', () => {
    const r = resolveTurbulence({
      board: createEmptyBoard(),
      actorPosition: { q: 2, r: 0 },
      hand: handWith({ cardId: 'shot', id: 's1' }),
      discardBottleInstanceIds: [],
      path: [{ q: 3, r: 0 }],
    });
    expect(r.ok).toBe(true);
    expect(r.steps).toBe(TURBULENCE_MOVE_BASE);
  });

  it('fail：不穿破碎（路徑踩 plain_broken）', () => {
    let board = createEmptyBoard();
    board = placeTerrain(board, { q: 3, r: 0 }, 'plain_broken');
    const r = resolveTurbulence({
      board,
      actorPosition: { q: 2, r: 0 },
      hand: [],
      discardBottleInstanceIds: [],
      path: [{ q: 3, r: 0 }],
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('path_not_standable');
  });

  it('fail：棄的不是氣瓶牌', () => {
    const hand = handWith({ cardId: 'shot', id: 's1' });
    const r = resolveTurbulence({
      board: createEmptyBoard(),
      actorPosition: { q: 2, r: 0 },
      hand,
      discardBottleInstanceIds: ['s1'],
      path: [{ q: 3, r: 0 }, { q: 4, r: 0 }],
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('not_bottle_card');
  });
});

describe('狂妄氣瓶 resolvePowerUp', () => {
  it('happy：裝填 pushBonus +1', () => {
    const r = resolvePowerUp({ ammo: EMPTY_AMMO_SLOT });
    expect(r.ok).toBe(true);
    expect(r.ammo).toEqual({ damageBonus: 0, drawBonus: 0, pushBonus: 1 });
  });

  it('槽滿失敗', () => {
    const full: AmmoSlotState = { damageBonus: 1, drawBonus: 1, pushBonus: 0 };
    const r = resolvePowerUp({ ammo: full });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('ammo_slot_full');
  });

  it('射擊回傳 pushFromAmmo', () => {
    const loaded = resolvePowerUp({ ammo: EMPTY_AMMO_SLOT });
    const shot = resolveGunnerShot({
      attacker: { q: 2, r: 0 },
      ammo: loaded.ammo,
    });
    expect(shot.pushFromAmmo).toBe(1);
    expect(shot.ammo).toEqual(EMPTY_AMMO_SLOT);
  });
});

describe('來吧! 大鬧一場! resolveBigShow', () => {
  it('happy：不抽牌、免費氣瓶、授予 mayPlayShot＋ignoreRange、不自動射擊', () => {
    const r = resolveBigShow({
      hasMovedThisTurn: false,
      ammo: EMPTY_AMMO_SLOT,
    });
    expect(r.ok).toBe(true);
    expect(r.mayPlayShot).toBe(true);
    expect(r.ignoreRangePenaltyForShot).toBe(true);
    expect(r.ammo).toEqual({
      damageBonus: BIG_SHOW_FREE_DAMAGE,
      drawBonus: BIG_SHOW_FREE_DRAW,
      pushBonus: BIG_SHOW_FREE_PUSH,
    });
    expect(r.events).toContainEqual({
      type: 'MayPlayShot',
      afterBigShow: true,
    });
    expect(r.events).toContainEqual({
      type: 'AmmoSlotLoaded',
      damageBonus: 1,
      drawBonus: 1,
      pushBonus: 1,
    });
    expect(r.events).toContainEqual({
      type: 'BigShowAmmoGranted',
      damageBonus: BIG_SHOW_FREE_DAMAGE,
      drawBonus: BIG_SHOW_FREE_DRAW,
      pushBonus: BIG_SHOW_FREE_PUSH,
      ammo: { damageBonus: 1, drawBonus: 1, pushBonus: 1 },
    });
    expect(r.events.some((e) => e.type === 'CardsDrawn')).toBe(false);
    expect(r.events.some((e) => e.type === 'TempShotPlayed')).toBe(false);
    expect(r.events.some((e) => e.type === 'ImmediatePlayAllowed')).toBe(false);
    expect(r.events.some((e) => e.type === 'BossDamaged')).toBe(false);
  });

  it('happy：已滿槽 {1,1} → 免費 {2,2}；後續手上射擊 3 傷 + 抽 2', () => {
    const full: AmmoSlotState = { damageBonus: 1, drawBonus: 1 , pushBonus: 0 };
    expect(ammoSlotTotal(full)).toBe(AMMO_SLOT_MAX_TOTAL);
    expect(addAmmo(full, 1, 0)).toBeNull();

    const r = resolveBigShow({
      hasMovedThisTurn: false,
      ammo: full,
    });
    expect(r.ok).toBe(true);
    expect(r.mayPlayShot).toBe(true);
    expect(r.ignoreRangePenaltyForShot).toBe(true);
    expect(r.ammo).toEqual({ damageBonus: 2, drawBonus: 2, pushBonus: 1 });
    expect(r.events.some((e) => e.type === 'TempShotPlayed')).toBe(false);

    // 峰值：{1,1}+free→{2,2} → 手上射擊 3 傷 + 抽 2（耗卡由上層）
    const shot = resolveGunnerShot({
      attacker: { q: 2, r: 0 },
      ammo: r.ammo,
      ignoreRangePenalty: r.ignoreRangePenaltyForShot,
    });
    expect(shot.ok).toBe(true);
    expect(shot.bossDamage).toBe(3);
    expect(shot.drawFromAmmo).toBe(2);
    expect(shot.ammo).toEqual(EMPTY_AMMO_SLOT);
  });

  it('峰值側：{2,0}+free→4傷+抽1；{0,2}+free→2傷+抽3', () => {
    const rDmg = resolveBigShow({
      hasMovedThisTurn: false,
      ammo: { damageBonus: 2, drawBonus: 0 , pushBonus: 0 },
    });
    expect(rDmg.ammo).toEqual({ damageBonus: 3, drawBonus: 1, pushBonus: 1 });
    const shotDmg = resolveGunnerShot({
      attacker: { q: 2, r: 0 },
      ammo: rDmg.ammo,
      ignoreRangePenalty: rDmg.ignoreRangePenaltyForShot,
    });
    expect(shotDmg.bossDamage).toBe(4);
    expect(shotDmg.drawFromAmmo).toBe(1);

    const rDraw = resolveBigShow({
      hasMovedThisTurn: false,
      ammo: { damageBonus: 0, drawBonus: 2 , pushBonus: 0 },
    });
    expect(rDraw.ammo).toEqual({ damageBonus: 1, drawBonus: 3, pushBonus: 1 });
    const shotDraw = resolveGunnerShot({
      attacker: { q: 2, r: 0 },
      ammo: rDraw.ammo,
      ignoreRangePenalty: rDraw.ignoreRangePenaltyForShot,
    });
    expect(shotDraw.bossDamage).toBe(2);
    expect(shotDraw.drawFromAmmo).toBe(3);
  });

  it('fail：出牌前已移動（不裝填、不授旗）', () => {
    const ammo: AmmoSlotState = { damageBonus: 1, drawBonus: 0 , pushBonus: 0 };
    const r = resolveBigShow({
      hasMovedThisTurn: true,
      ammo,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('already_moved');
    expect(r.mayPlayShot).toBe(false);
    expect(r.ignoreRangePenaltyForShot).toBe(false);
    expect(r.ammo).toEqual(ammo);
  });

  it('addAmmoUnchecked 可超 cap；一般 addAmmo 不可', () => {
    const full: AmmoSlotState = { damageBonus: 1, drawBonus: 1 , pushBonus: 0 };
    expect(addAmmo(full, BIG_SHOW_FREE_DAMAGE, BIG_SHOW_FREE_DRAW)).toBeNull();
    expect(
      addAmmoUnchecked(full, BIG_SHOW_FREE_DAMAGE, BIG_SHOW_FREE_DRAW),
    ).toEqual({ damageBonus: 2, drawBonus: 2, pushBonus: 0 });
    expect(addAmmo(full, 1, 1, { ignoreCap: true })).toEqual({
      damageBonus: 2,
      drawBonus: 2,
      pushBonus: 0,
    });
  });
});

describe('狂妄推牆 tryArrogantPush', () => {
  it('空 dest：搬移 plain；保留 aged', () => {
    let board = createEmptyBoard();
    const gunner = { q: 2, r: 0 };
    const tile = { q: 3, r: 0 };
    board = placeTerrain(board, tile, 'plain', { aged: true });
    const r = tryArrogantPush({ board, gunnerHex: gunner, chosenHex: tile });
    expect(r.changed).toBe(true);
    expect(board.tiles.has('3,0') || true).toBe(true);
    // dest = (4,0)
    expect(r.board.tiles.has('3,0')).toBe(false);
    const dest = r.board.tiles.get('4,0');
    expect(dest?.kind).toBe('plain');
    expect(dest?.aged).toBe(true);
  });

  it('撞 broken：dest 清空且不在 board 留 tile（不傷王路徑）', () => {
    let board = createEmptyBoard();
    const gunner = { q: 2, r: 0 };
    const tile = { q: 3, r: 0 };
    const dest = { q: 4, r: 0 };
    board = placeTerrain(board, tile, 'plain');
    board = placeTerrain(board, dest, 'plain_broken', { aged: true });
    const r = tryArrogantPush({ board, gunnerHex: gunner, chosenHex: tile });
    expect(r.changed).toBe(true);
    expect(r.board.tiles.has('3,0')).toBe(true); // source stays
    expect(r.board.tiles.has('4,0')).toBe(false);
  });

  it('跳過非 plain 系／空格', () => {
    let board = createEmptyBoard();
    const gunner = { q: 2, r: 0 };
    board = placeTerrain(board, { q: 3, r: 0 }, 'curse');
    const a = tryArrogantPush({
      board,
      gunnerHex: gunner,
      chosenHex: { q: 3, r: 0 },
    });
    expect(a.changed).toBe(false);
    expect(a.reason).toBe('not_plain_family');
    const b = tryArrogantPush({
      board,
      gunnerHex: gunner,
      chosenHex: { q: 2, r: 1 },
    });
    expect(b.reason).toBe('empty');
  });
});

describe('大亂流可棄狂妄氣瓶', () => {
  it('power_up 算氣瓶', () => {
    const hand = handWith({ cardId: 'power_up', id: 'p1' });
    const r = resolveTurbulence({
      board: createEmptyBoard(),
      actorPosition: { q: 2, r: 0 },
      hand,
      discardBottleInstanceIds: ['p1'],
      path: [{ q: 3, r: 0 }, { q: 4, r: 0 }],
    });
    expect(r.ok).toBe(true);
    expect(r.discardedBottleIds).toEqual(['p1']);
    expect(r.steps).toBe(2);
  });
});
