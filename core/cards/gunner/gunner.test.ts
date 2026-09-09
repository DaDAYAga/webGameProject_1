import { describe, expect, it } from 'vitest';
import {
  AMMO_SLOT_MAX_TOTAL,
  EMPTY_AMMO_SLOT,
  GUNNER_SHOT_BASE_DAMAGE,
  addAmmo,
  ammoSlotTotal,
  canAddAmmo,
  makeGunnerCard,
  resolveGunnerShot,
  resolveMischiefBottle,
  resolvePlayfulBottle,
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
      ammo: { damageBonus: 1, drawBonus: 0 },
    });
    expect(r.bossDamage).toBe(1);
    expect(r.ammo).toEqual(EMPTY_AMMO_SLOT);
  });

  it('甜區 + 裝填傷 2 → 1+2 = 3', () => {
    const r = resolveGunnerShot({
      attacker: { q: 2, r: 0 },
      ammo: { damageBonus: 2, drawBonus: 0 },
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
    expect(bottle.ammo).toEqual({ damageBonus: 1, drawBonus: 0 });
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
    expect(bottle.ammo).toEqual({ damageBonus: 0, drawBonus: 1 });

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
    expect(mischief.ammo).toEqual({ damageBonus: 1, drawBonus: 1 });

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
    const full: AmmoSlotState = { damageBonus: 1, drawBonus: 1 };
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
    expect(b.ammo).toEqual({ damageBonus: 2, drawBonus: 0 });
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
  it('手牌無射擊 → fail', () => {
    const hand = handWith({ cardId: 'playful_bottle', id: 'b1' });
    const r = resolvePlayfulBottle({ ammo: EMPTY_AMMO_SLOT, hand });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('no_shot_to_discard');
    expect(r.ammo).toEqual(EMPTY_AMMO_SLOT);
  });

  it('指定非射擊 instanceId → fail', () => {
    const hand = handWith(
      { cardId: 'shot', id: 's1' },
      { cardId: 'mischief_bottle', id: 'b1' },
    );
    const r = resolveMischiefBottle({
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
