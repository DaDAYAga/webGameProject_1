import { describe, expect, it } from 'vitest';
import {
  createEmptyBoard,
  createOpeningBoard,
  placeTerrain,
} from '../board/index.js';
import { DEFAULT_MAP_RADIUS } from '../enclosure/index.js';
import {
  assignKindsByPriority,
  pickThreatPlacementHexes,
  type ThreatActor,
} from './threat.js';

const bounds = { radius: DEFAULT_MAP_RADIUS };

describe('pickThreatPlacementHexes', () => {
  it('略過王格、佔格、既有地形', () => {
    let board = createOpeningBoard();
    board = placeTerrain(board, { q: 2, r: 1 }, 'plain');
    const actors: ThreatActor[] = [
      { id: 'g', hex: { q: 2, r: 0 }, role: 'ranged' },
      { id: 'm', hex: { q: 3, r: -1 }, role: 'ranged' },
      { id: 'k', hex: { q: 2, r: -2 }, role: 'melee' },
    ];
    const occupied = actors.map((a) => a.hex);
    const picks = pickThreatPlacementHexes(board, actors, 3, {
      bounds,
      occupied,
    });
    expect(picks.length).toBe(3);
    for (const p of picks) {
      expect(p).not.toEqual({ q: 0, r: 0 });
      expect(occupied.some((o) => o.q === p.q && o.r === p.r)).toBe(false);
      expect(board.tiles.has(`${p.q},${p.r}`)).toBe(false);
    }
  });

  it('尊重 protectedHexes（嘲諷／屏障）', () => {
    const board = createEmptyBoard();
    const actors: ThreatActor[] = [
      { id: 'k', hex: { q: 2, r: 0 }, role: 'melee' },
    ];
    const protectedHexes = [
      { q: 3, r: 0 },
      { q: 2, r: 1 },
      { q: 1, r: 1 },
      { q: 1, r: 0 },
      { q: 2, r: -1 },
      { q: 3, r: -1 },
    ];
    const picks = pickThreatPlacementHexes(board, actors, 1, {
      bounds,
      occupied: [actors[0]!.hex],
      protectedHexes,
    });
    expect(picks.length).toBe(1);
    const p = picks[0]!;
    expect(protectedHexes.some((h) => h.q === p.q && h.r === p.r)).toBe(false);
  });

  it('瀕封格（5／6）優先於一般鄰格', () => {
    // 空圖：騎士在 (2,0)；先手動鋪其 5 鄰為牆，留下一格空鄰
    let board = createEmptyBoard();
    const knight = { q: 2, r: 0 };
    const nbs = [
      { q: 3, r: 0 },
      { q: 2, r: 1 },
      { q: 1, r: 1 },
      { q: 1, r: 0 },
      { q: 2, r: -1 },
      // 留 { q: 3, r: -1 } 空 → 鋪此即封印
    ];
    for (const h of nbs.slice(0, 5)) {
      board = placeTerrain(board, h, 'plain');
    }
    const sealHex = { q: 3, r: -1 };
    const farRanged: ThreatActor = {
      id: 'g',
      hex: { q: -3, r: 0 },
      role: 'ranged',
    };
    const actors: ThreatActor[] = [
      { id: 'k', hex: knight, role: 'melee', curseStacks: 0 },
      farRanged,
    ];
    const picks = pickThreatPlacementHexes(board, actors, 1, {
      bounds,
      occupied: [knight, farRanged.hex],
    });
    expect(picks[0]).toEqual(sealHex);
  });

  it('同條件下遠程優先於近距（鄰格競爭）', () => {
    const board = createEmptyBoard();
    // 兩人各有獨立鄰空；遠程加權應勝
    const gunner = { q: 3, r: 0 };
    const knight = { q: -3, r: 0 };
    const actors: ThreatActor[] = [
      { id: 'g', hex: gunner, role: 'ranged' },
      { id: 'k', hex: knight, role: 'melee' },
    ];
    const picks = pickThreatPlacementHexes(board, actors, 1, {
      bounds,
      occupied: [gunner, knight],
    });
    expect(picks.length).toBe(1);
    const p = picks[0]!;
    const nearGun =
      Math.abs(p.q - gunner.q) +
        Math.abs(p.r - gunner.r) +
        Math.abs(-p.q - p.r + gunner.q + gunner.r) ===
      2; // axial dist 1 → cube manhattan 2
    // distance via simple: neighbor check
    const isNb = (a: { q: number; r: number }, b: { q: number; r: number }) => {
      const dq = a.q - b.q;
      const dr = a.r - b.r;
      return (
        (dq === 1 && dr === 0) ||
        (dq === 1 && dr === -1) ||
        (dq === 0 && dr === -1) ||
        (dq === -1 && dr === 0) ||
        (dq === -1 && dr === 1) ||
        (dq === 0 && dr === 1)
      );
    };
    expect(isNb(p, gunner)).toBe(true);
    expect(isNb(p, knight)).toBe(false);
  });

  it('n=2 回兩格且不重複', () => {
    const board = createOpeningBoard();
    const actors: ThreatActor[] = [
      { id: 'g', hex: { q: 2, r: 0 }, role: 'ranged' },
      { id: 'm', hex: { q: 3, r: -1 }, role: 'ranged' },
      { id: 'k', hex: { q: 2, r: -2 }, role: 'melee' },
    ];
    const picks = pickThreatPlacementHexes(board, actors, 2, {
      bounds,
      occupied: actors.map((a) => a.hex),
    });
    expect(picks.length).toBe(2);
    expect(`${picks[0]!.q},${picks[0]!.r}`).not.toBe(
      `${picks[1]!.q},${picks[1]!.r}`,
    );
  });

  it('佔格（含封印本體）一律跳過，不可再壓出局', () => {
    const board = createEmptyBoard();
    const sealedBody = { q: 2, r: 0 };
    const actors: ThreatActor[] = [
      { id: 'k', hex: sealedBody, role: 'melee' },
    ];
    const picks = pickThreatPlacementHexes(board, actors, 3, {
      bounds,
      occupied: [sealedBody],
    });
    expect(picks.every((p) => !(p.q === sealedBody.q && p.r === sealedBody.r))).toBe(
      true,
    );
  });
});

describe('assignKindsByPriority', () => {
  const priority = {
    silence: 40,
    curse: 30,
    mud: 20,
    plain: 10,
    plain_aged: 0,
  } as const;
  type Tok = keyof typeof priority;

  it('assigns highest-priority kinds to first (most threatening) picks', () => {
    const picks = [
      { q: 1, r: 0 },
      { q: 2, r: 0 },
      { q: 3, r: 0 },
    ];
    const bag: Tok[] = ['plain', 'silence', 'curse', 'mud'];
    const { tokens, remaining } = assignKindsByPriority(picks, bag, priority);
    expect(tokens).toEqual(['silence', 'curse', 'mud']);
    expect(remaining).toEqual(['plain']);
  });

  it('is stable: equal priority keeps bag order', () => {
    const picks = [{ q: 1, r: 0 }, { q: 2, r: 0 }];
    const bag: Tok[] = ['plain', 'plain_aged', 'plain'];
    const { tokens, remaining } = assignKindsByPriority(picks, bag, priority);
    expect(tokens).toEqual(['plain', 'plain']);
    expect(remaining).toEqual(['plain_aged']);
  });

  it('n > bag uses whole bag; empty picks leave bag intact', () => {
    const bag: Tok[] = ['mud', 'curse'];
    const over = assignKindsByPriority(
      [{ q: 0, r: 1 }, { q: 0, r: 2 }, { q: 0, r: 3 }],
      bag,
      priority,
    );
    expect(over.tokens).toEqual(['curse', 'mud']);
    expect(over.remaining).toEqual([]);
    const none = assignKindsByPriority([], bag, priority);
    expect(none.tokens).toEqual([]);
    expect(none.remaining).toEqual(bag);
  });
});

