/**
 * 手牌說明：以使用者 JSON 原文為準；限制收在 how 最後「限制：…」。
 */
export const CARD_SIDE_HINTS: Record<string, string> = {
  shot: '遠程一般攻擊',
  playful_bottle: '棄射擊，下一槍多傷，無射擊可棄時不可用。',
  mischief_bottle: '下一槍多抽',
  turbulence: '丟氣瓶換步數',
  power_up: '下一槍推身邊的格子',
  big_show: '補氣瓶 + 可選是否打射擊牌的大爆發',
  amplify: '下一招變強',
  magic_arrow: '遠程一般攻擊',
  wind: '推一格',
  focus: '抽牌後結束',
  barrier: '擋住王鋪牆',
  planar_swap: '選兩人換位子',
  attack: '近戰一般攻擊',
  faith: '清咒',
  heroic_charge: '直線衝刺，撞碎牆或王後結束回合',
  devotion: '吸鄰 1 隊友身上的詛咒或一個詛咒格',
  taunt: '隊友傷王時可讓王鋪在自己旁邊',
  undying: '逃離封印',
};

export type CardRichTooltip = {
  title: string;
  countsLabel: string;
  silenceLabel: string;
  sideEffects: string;
  how: string;
};

/** 懸停 1 秒後的完整說明。 */
export const CARD_RICH_TOOLTIPS: Record<string, CardRichTooltip> = {
  shot: {
    title: '射擊',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '1 點傷害，離王距離 >3 格時減少 1 點傷害（最小不低於 1）。',
    how: '能被氣瓶強化。',
  },
  playful_bottle: {
    title: '頑皮氣瓶',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '丟掉手上 1 張射擊，使下次射擊多打 1 點傷害。',
    how: '無射擊卡時不可用。氣瓶卡總和上限 2 張。',
  },
  mischief_bottle: {
    title: '胡鬧氣瓶',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '下次射擊結束後可抽 n 張牌。',
    how: 'n = 胡鬧氣瓶卡數。氣瓶卡總和上限 2 張。',
  },
  turbulence: {
    title: '大亂流',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '最多丟掉手上 2 張氣瓶卡，獲得 n + 1 格步數。',
    how: 'n = 丟掉的氣瓶卡數。氣瓶卡總和上限 2 張。',
  },
  power_up: {
    title: '狂妄氣瓶',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '下次射擊結束後，從身邊選格子往外推直線 1 格。',
    how: '只能推一般格，路徑上有其他格子會使格子破碎，已破碎的格子會破壞。氣瓶卡總和上限 2 張。',
  },
  big_show: {
    title: '大鬧一場！',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '填充頑皮、胡鬧、狂妄氣瓶卡各 1 張（可超過上限）。若手上有射擊，可再打 1 張且無視距離懲罰（不計次）。打完或放棄後結束回合。',
    how: '這回合還沒走動才能出。',
  },
  amplify: {
    title: '強能增幅',
    countsLabel: '不計次',
    silenceLabel: '不受沉默',
    sideEffects: '下一張可增幅卡變強。',
    how: '增幅效果不可繼承至下回合。鄰沉默仍可出。',
  },
  magic_arrow: {
    title: '魔法箭',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '1 點傷害，離王距離 >3 格時減少 1 點傷害（最小不低於 1）。受增幅時額外 +1 傷害。',
    how: '能被強能增幅強化。',
  },
  wind: {
    title: '御風術',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '把一個格子往指定方向推動。受增幅時多推 1 步。',
    how: '能被強能增幅強化。不可推沉默、懲罰、泥濘、詛咒。',
  },
  focus: {
    title: '聚精會神',
    countsLabel: '不計次',
    silenceLabel: '受沉默',
    sideEffects: '抽 2 張，強制回合結束，超過手牌上限就丟掉最新抽到的。受增幅時抽牌數 +1 張。',
    how: '能被強能增幅強化。',
  },
  barrier: {
    title: '磁力屏障',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '王不能在目標鄰 1 格鋪牆。下一自己回合不能再出。強制結束回合。受增幅時能選與自己 <=３ 格距離的友方目標。',
    how: '能被強能增幅強化。',
  },
  planar_swap: {
    title: '位面調換',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '選距離 <=３ 的兩名角色互換（可含自己，也可換另外兩人）。雙方本回合不受沉默／封印。強制結束回合。受增幅時此卡不受沉默／封印，且距離 +1。',
    how: '點牌後依序點兩個目標，都選完才換。點同一人可取消第一目標。',
  },
  attack: {
    title: '攻擊',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '可選目標(一般格/王)：打王 2 點傷害。',
    how: '格子攻擊時會破碎，已經破碎的格子再被攻擊會破壞，如果該格子已經老化，王會受到 1 點傷害。',
  },
  faith: {
    title: '堅定信仰',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '清掉自己身上 1 層詛咒。使用後本回合不可再移動。',
    how: '',
  },
  heroic_charge: {
    title: '英勇衝鋒',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '選擇一個方向沿直線往前衝。破碎牆撞破續衝；完整牆停下只破碎不傷王。強制結束回合。只有破壞老化牆才傷王（每面 1、合計最多 2）。撞到王造成 2 點傷害。',
    how: '點直線上任一格決定方向。',
  },
  devotion: {
    title: '奉獻',
    countsLabel: '不計次',
    silenceLabel: '受沉默',
    sideEffects: '從旁邊隊友身上吸 1 層詛咒，或吃掉旁邊 1 格詛咒（自身會疊加詛咒層數）。',
    how: '如果因為此卡導致詛咒層數達到上限。會自動從牌庫中抽出不死存在卡，若現有牌庫中沒有不死存在卡，則無法抽卡。',
  },
  taunt: {
    title: '嘲諷',
    countsLabel: '不計次',
    silenceLabel: '不受沉默',
    sideEffects: '王必須在自身鄰 1 格鋪牆。',
    how: '不用主動打。隊友傷王、王要鋪格前，騎士頭上會問要不要用。點 × 則這次不用。優先級高於磁力屏障。',
  },
  undying: {
    title: '不死存在',
    countsLabel: '不計次',
    silenceLabel: '不受沉默',
    sideEffects: '被封印時才能出。地圖上選一格跳過去。強制回合結束。',
    how: '',
  },
};


/** 牌面額外標記（計次／沉默由 HandCard 旗標推導；這裡只補 endsTurn 等）。 */
export type CardFlagId = 'endTurn' | 'noMove' | 'sealedOnly' | 'cooldown';

export const CARD_FLAGS: Record<string, readonly CardFlagId[]> = {
  big_show: ['noMove', 'endTurn'],
  focus: ['endTurn'],
  heroic_charge: ['endTurn'],
  undying: ['endTurn', 'sealedOnly'],
  barrier: ['cooldown', 'endTurn'],
  planar_swap: ['endTurn'],
};

export function sideHintFor(cardId: string): string {
  return CARD_SIDE_HINTS[cardId] ?? '';
}

export function richTooltipFor(cardId: string): CardRichTooltip | null {
  return CARD_RICH_TOOLTIPS[cardId] ?? null;
}

export type ClassPassiveHint = {
  title: string;
  sideHint: string;
  sideEffects: string;
  how: string;
};

/** 職業被動（不是手牌）。目前只有騎士；文案可再改。 */
export const CLASS_PASSIVES: Partial<Record<string, ClassPassiveHint>> = {
  knight: {
    title: '詛咒之軀',
    sideHint: '詛咒上限 3',
    sideEffects: '詛咒上限 +1（其餘 2 層才咒滿）。',
    how: '',
  },
};
