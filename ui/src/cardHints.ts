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
  planar_swap: '跟隊友換位子',
  attack: '近戰一般攻擊',
  faith: '清咒',
  heroic_charge: '直線衝刺，撞碎牆或王後結束回合',
  devotion: '吸鄰 1 隊友身上的詛咒或一個詛咒格',
  taunt: '',
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
    how: '能被氣瓶強化。限制：只打王、任意距離、無擋線；氣瓶槽加成在這一槍結算後清空；大招後的免費射擊不計次、無視距離懲罰',
  },
  playful_bottle: {
    title: '頑皮氣瓶',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '丟掉手上 1 張射擊，使下次射擊多打 1 點傷害。',
    how: '無射擊卡時不可用。氣瓶卡總和上限 2 張。限制：手上須有射擊可棄；頑皮／胡鬧／狂妄合計上限 2（大招可超）',
  },
  mischief_bottle: {
    title: '胡鬧氣瓶',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '下次射擊結束後可抽 n 張牌。',
    how: 'n = 胡鬧氣瓶卡數。氣瓶卡總和上限 2 張。限制：頑皮／胡鬧／狂妄合計上限 2（大招可超）',
  },
  turbulence: {
    title: '大亂流',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '最多丟掉手上 2 張氣瓶卡，獲得 n + 1 格步數。',
    how: 'n = 丟掉的氣瓶卡數。限制：可棄 0～2 張任意氣瓶卡；步數＝棄牌數＋1；路徑須可站、不穿破碎牆',
  },
  power_up: {
    title: '狂妄氣瓶',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '下次射擊結束後，從身邊選格子往外推直線 1 格。',
    how: '只能推一般格，路徑上有其他格子會撞碎格子，已撞碎的格會破壞。氣瓶卡總和上限 2 張。限制：cardId 仍為 power_up；頑皮／胡鬧／狂妄合計上限 2（大招可超）',
  },
  big_show: {
    title: '大鬧一場！',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '填充頑皮、胡鬧、狂妄氣瓶卡各 1 張（可超過上限），如果手上有射擊卡，可選擇是否使用且無視距離懲罰。',
    how: '這回合還沒走動才能出。限制：免費三層可超過裝填上限 2；後續射擊不計次、無視距離懲罰',
  },
  amplify: {
    title: '強能增幅',
    countsLabel: '不計次',
    silenceLabel: '受沉默',
    sideEffects: '下一張可增幅卡變強。',
    how: '限制：不棄牌；未用則回合結束失效',
  },
  magic_arrow: {
    title: '魔法箭',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '1 點傷害，離王距離 >3 格時減少 1 點傷害（最小不低於 1）。',
    how: '能被強能增幅強化。限制：只打王、任意距離、無擋線；增幅額外 +1 傷',
  },
  wind: {
    title: '御風術',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '把一個格子往指定方向推動。',
    how: '增幅時多推 1 步。沉默/詛咒/懲罰/泥濘不能推。限制：不可推沉默、懲罰、泥濘、詛咒',
  },
  focus: {
    title: '聚精會神',
    countsLabel: '不計次',
    silenceLabel: '受沉默',
    sideEffects: '抽 2 張，強制回合結束。',
    how: '增幅時抽 3 張。手牌超過上限就丟掉最新抽到的。',
  },
  barrier: {
    title: '磁力屏障',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '王不能在目標鄰 1 格鋪牆。下一輪不能再出同樣的卡。',
    how: '增幅時能選與自己 <=３ 格距離的友方目標。會被其他技能覆蓋。限制：成功後下一回合不可再出屏障；優先級低於嘲諷（衝突時嘲諷覆蓋）',
  },
  planar_swap: {
    title: '位面調換',
    countsLabel: '不計次',
    silenceLabel: '受沉默',
    sideEffects: '跟與自己 <=３ 格距離的任意友方目標(含自己)交換位子，友方目標換位後不受沉默/封印影響。強制回合結束。',
    how: '增幅時此卡不受沉默/封印影響。限制：定義受沉默；增幅後該張不受沉默/封印影響；被交換者須在距離自身 ≤3 格內；不可換王',
  },
  attack: {
    title: '攻擊',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '可選目標(一般格/王)：打王 2 點傷害。',
    how: '一般格受攻擊時會破碎，已經破碎的格子再被攻擊會破壞，如果該格子已經老化，王會受到 1 點傷害。限制：須鄰 1；不可指定其他職業、詛咒、沉默、懲罰、泥濘',
  },
  faith: {
    title: '堅定信仰',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '清掉自己身上 1 層詛咒。使用前不可移動。',
    how: '',
  },
  heroic_charge: {
    title: '英勇衝鋒',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '沿直線往前衝。老化牆會被撞破並繼續前進；撞到完整牆、沉默、王、地圖邊緣會停下來。強制回合結束。撞碎牆體時若該格已經老化，王會受到 1 點傷害(可累加)，撞到王會造成 2 點傷害。最多造成 4 點傷害。',
    how: '點直線上任一格決定方向。限制：成功或失敗結算後一律結束回合',
  },
  devotion: {
    title: '奉獻',
    countsLabel: '不計次',
    silenceLabel: '受沉默',
    sideEffects: '從旁邊隊友身上吸 1 層詛咒，或吃掉旁邊 1 格詛咒地形（自身會疊加詛咒層數）。',
    how: '如果因為此卡導致詛咒層數達到上限。會自動從牌庫中抽出不死存在卡，若現有牌庫中沒有不死存在卡，則無法抽卡。',
  },
  taunt: {
    title: '嘲諷',
    countsLabel: '不計次',
    silenceLabel: '不受沉默',
    sideEffects: '王必須在自身鄰 1 格鋪牆。',
    how: '用勾選框決定，不能主動使用，只能在他人回合使用。優先級高於磁力屏障。限制：須他人回合才能出；優先級高於磁力屏障',
  },
  undying: {
    title: '不死存在',
    countsLabel: '不計次',
    silenceLabel: '不受沉默',
    sideEffects: '被封印時才能出。地圖上選一格跳過去。強制回合結束。',
    how: '限制：封印中才能出；落地不改周圍地形',
  },
};


/** 牌面額外標記（計次／沉默由 HandCard 旗標推導；這裡只補 endsTurn 等）。 */
export type CardFlagId = 'endTurn' | 'noMove' | 'sealedOnly' | 'cooldown';

export const CARD_FLAGS: Record<string, readonly CardFlagId[]> = {
  faith: ['noMove'],
  big_show: ['noMove'],
  focus: ['endTurn'],
  heroic_charge: ['endTurn'],
  undying: ['endTurn', 'sealedOnly'],
  barrier: ['cooldown'],
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
    title: '多踩一格',
    sideHint: '詛咒上限 2',
    sideEffects: '別人帶 1 層詛咒就滿，你能帶到 2 層才咒滿。',
    how: '不用出牌。走路踩到詛咒格會上身並清掉那格。限制：不是手牌，不會進牌庫。',
  },
};
