/**
 * 薄 UI 副作用提示（僅顯示；結算仍走 core）。
 */
export const CARD_SIDE_HINTS: Record<string, string> = {
  shot: '遠程傷王',
  playful_bottle: '棄1射擊裝填',
  mischief_bottle: '裝填抽（不棄）',
  turbulence: '棄瓶移動',
  power_up: '裝填推牆',
  big_show: '免費三瓶＋可再射',
  magic_arrow: '遠程傷王',
  amplify: '下一招增幅',
  wind: '推地形',
  focus: '結束回合',
  barrier: '下回合不可再用',
  planar_swap: '與友換位',
  attack: '鄰1傷王／拆牆（職業無血量）',
  faith: '清1詛咒（未移動）',
  heroic_charge: '直線衝鋒',
  taunt: '限制王鋪牆',
  devotion: '吸友軍／咒格',
  undying: '封印中解封移動',
};

export type CardRichTooltip = {
  title: string;
  countsLabel: string;
  silenceLabel: string;
  sideEffects: string;
  how: string;
};

/** 懸停 2 秒後的完整說明（zh-Hant）。 */
export const CARD_RICH_TOOLTIPS: Record<string, CardRichTooltip> = {
  shot: {
    title: '射擊',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '消耗裝填槽加成；遠程傷王。',
    how: '對王結算遠程傷害：甜區（距王 ≤3）完整傷，區外 −1（最低 1）。有裝填時一併結算並清空槽；抽到的牌仍要有行動點才能打。大招授予的「可再射」可不耗行動點且可忽略距離懲罰。',
  },
  playful_bottle: {
    title: '頑皮氣瓶',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '棄 1 張射擊 → 裝填傷害 +1。',
    how: '手牌須有射擊可棄；裝填槽合計上限 2。成功後耗 1 行動點。',
  },
  mischief_bottle: {
    title: '胡鬧氣瓶',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '不棄牌 → 裝填抽牌 +1。',
    how: '裝填槽合計上限 2（傷＋抽＋推）；槽滿則失敗。成功後耗 1 行動點。',
  },
  turbulence: {
    title: '大亂流',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '可棄最多 2 張氣瓶（含狂妄），移動步數＝棄牌數＋1。',
    how: '進入指定後點恰好 N 步的可站終點；路徑不可穿牆。棄掉的氣瓶與本牌一併離手。',
  },
  power_up: {
    title: '狂妄氣瓶',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '裝填推牆 +1（計入槽上限 2）。',
    how: '下次射擊若有 pushBonus，結算後點 N 個鄰格做徑向推牆（不傷王）。',
  },
  big_show: {
    title: '來吧! 大鬧一場!',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '免費頑皮+胡鬧+狂妄（可超 cap）＋授予再打 1 張手上射擊。',
    how: '須尚未移動。成功後可再打 1 張手上射擊且不耗該次行動點、忽略距離懲罰。',
  },
  amplify: {
    title: '強能增幅',
    countsLabel: '不計次',
    silenceLabel: '受沉默',
    sideEffects: '武裝下一招增幅。',
    how: '不棄其他牌。下一張吃增幅的法術（魔法箭／御風／聚精／位面等）套用加成後清除 pending。',
  },
  magic_arrow: {
    title: '魔法箭',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '遠程傷王；可吃增幅。',
    how: '對王結算遠程傷害（甜區規則同射擊）。若有增幅 pending 則加成後清除。',
  },
  wind: {
    title: '御風術',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '推動一格地形；增幅時多推 1 步。',
    how: '先點有地形的來源格，再點其鄰格決定方向；沿該方向推動直到受阻。不可推動沉默（牌面限制）。',
  },
  focus: {
    title: '聚精會神',
    countsLabel: '不計次',
    silenceLabel: '受沉默',
    sideEffects: '抽 2（增幅 3）後強制結束回合。',
    how: '從牌庫抽 2 張（有強能增幅則 3），超過手牌上限棄最新，再強制結束目前職業回合。',
  },
  barrier: {
    title: '磁力屏障',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '保護自己鄰 1；下回合不可再出屏障。',
    how: '以法師為中心保護鄰格，阻擋王鋪牆。本薄 UI 略過增幅寄出，固定套自己。',
  },
  planar_swap: {
    title: '位面調換',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '與友軍換位；可能強制結束。',
    how: '與鄰近優先／預設友軍交換座標。增幅時依 core 規則強化。成功且 endTurn 則強制結束。',
  },
  attack: {
    title: '攻擊',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '鄰 1：傷王 2，或拆／破 plain 系牆。不能打其他職業。',
    how: '出牌後進入指定：高亮可選鄰格（王或可拆牆）。不可選其他職業、沉默／詛咒／懲罰。',
  },
  faith: {
    title: '堅定信仰',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '本回合未移動時清除自己 1 層詛咒。',
    how: '若本回合已移動則失敗。成功減少 curseStacks 並耗行動點。',
  },
  heroic_charge: {
    title: '英勇衝鋒',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '直線衝鋒：穿老化牆並落到該格續衝；撞完整牆／沉默／王／邊緣硬停；強制結束回合。',
    how: '點軸向直線上的格決定方向。破壞老化格後站上該格繼續衝，直到完整牆、沉默、王或地圖邊緣。出牌後立刻結束回合。',
  },
  devotion: {
    title: '奉獻',
    countsLabel: '不計次',
    silenceLabel: '受沉默',
    sideEffects: '吸鄰 1 友軍 1 層詛咒，或清鄰 1 詛咒地形（自己 +1）。',
    how: '點友軍或詛咒格。達 cap 走咒滿鋪鄰封印，不再抽出不死離場。',
  },
  taunt: {
    title: '嘲諷',
    countsLabel: '不計次',
    silenceLabel: '不受沉默',
    sideEffects: '限制王不可在騎士鄰 1 鋪牆。',
    how: '須在「他人回合」情境（薄 UI 以勾選模擬）。優先級可覆寫屏障保護。',
  },
  undying: {
    title: '不死存在',
    countsLabel: '不計次',
    silenceLabel: '不受沉默',
    sideEffects: '封印中可出：移到可站落點並解封；無周圍地形特效。鄰沉默不擋。',
    how: '須已封印。點可站落點移動；若落地立刻六鄰滿則再封印。強制結束回合。',
  },
};

export function sideHintFor(cardId: string): string {
  return CARD_SIDE_HINTS[cardId] ?? '';
}

export function richTooltipFor(cardId: string): CardRichTooltip | null {
  return CARD_RICH_TOOLTIPS[cardId] ?? null;
}
