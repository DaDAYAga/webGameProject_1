/**
 * 手牌說明：短標 → 效果 → 用法。限制一律放 how 最後「限制：…」。
 */
export const CARD_SIDE_HINTS: Record<string, string> = {
  shot: '遠程一般攻擊',
  playful_bottle: '下一槍多傷',
  mischief_bottle: '下一槍多抽',
  turbulence: '丟氣瓶換步數',
  power_up: '下一槍推格子',
  big_show: '補三瓶再開槍',
  amplify: '下一招變強',
  magic_arrow: '遠程一般攻擊',
  wind: '推一格',
  focus: '抽牌後結束',
  barrier: '擋住王鋪牆',
  planar_swap: '跟隊友換位子',
  attack: '近戰一般攻擊',
  faith: '清咒',
  heroic_charge: '直線衝刺',
  devotion: '吸鄰咒',
  taunt: '逼王貼著鋪',
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
    sideEffects: '對王打 1 點。離王超過 3 格少 1 點，最少還是 1。',
    how: '有氣瓶就這一槍一起算，打完瓶子清空。大招送的那一槍不花行動點，也不吃距離懲罰。限制：只打王；任意距離、無擋線。',
  },
  playful_bottle: {
    title: '頑皮氣瓶',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '丟掉手上 1 張射擊，裝進瓶子。下次射擊多打 1 點。',
    how: '限制：手上要有射擊才能出；三種氣瓶合計最多 2 支（大招可超）。',
  },
  mischief_bottle: {
    title: '胡鬧氣瓶',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '裝進瓶子。下次射擊結束後多抽 n 張（n＝胡鬧層數）。',
    how: '限制：三種氣瓶合計最多 2 支（大招可超）。',
  },
  turbulence: {
    title: '大亂流',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '最多丟掉手上 2 張氣瓶，多走 n＋1 步（n＝丟掉張數）。',
    how: '點一個剛好那麼多步、站得上去的格子。限制：可棄 0～2 張任意氣瓶；路被牆擋住或不可站就不行。',
  },
  power_up: {
    title: '狂妄氣瓶',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '裝進瓶子。下次射擊結束後，從身邊選 n 格各往外推直線 1 格（n＝狂妄層數）。',
    how: '只能推一般格。推過去撞到已有格會破碎，已破碎再撞會破壞（不傷王）。推不動就跳過。限制：三種氣瓶合計最多 2 支（大招可超）。',
  },
  big_show: {
    title: '大鬧一場！',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '白塞頑皮、胡鬧、狂妄各 1 層（可超過 2 支上限）。手上有射擊的話，可選擇打一槍且無視距離懲罰。',
    how: '限制：這回合還沒走動才能出；後面那一槍不計次。',
  },
  amplify: {
    title: '強能增幅',
    countsLabel: '不計次',
    silenceLabel: '受沉默',
    sideEffects: '下一張可增幅卡變強。',
    how: '不用丟牌。可增幅：魔法箭、御風、聚精會神、磁力屏障、位面調換。用掉就沒了。限制：回合結束還沒用就失效。',
  },
  magic_arrow: {
    title: '魔法箭',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '對王打 1 點。離王超過 3 格少 1 點，最少還是 1。',
    how: '有強能增幅這一箭多 1 點，然後增幅消失。限制：只打王；任意距離、無擋線。',
  },
  wind: {
    title: '御風術',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '把一格往指定方向推。增幅時多推 1 步。',
    how: '先點要推的格，再點旁邊決定方向，一路推到推不動。限制：沉默、詛咒、懲罰、泥濘不能推。',
  },
  focus: {
    title: '聚精會神',
    countsLabel: '不計次',
    silenceLabel: '受沉默',
    sideEffects: '抽 2 張，這個職業這回合結束。',
    how: '增幅時改抽 3 張。手牌超過上限就丟掉最新抽到的。限制：出完強制結束回合。',
  },
  barrier: {
    title: '磁力屏障',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '王不能在目標鄰 1 格鋪牆。下一輪不能再出這張。',
    how: '沒增幅保護自己。增幅時改寄給距離 ≤3 的隊友（不能寄自己）。限制：成功後下一回合不可再出屏障；優先級低於嘲諷，衝突時嘲諷覆蓋。',
  },
  planar_swap: {
    title: '位面調換',
    countsLabel: '不計次',
    silenceLabel: '受沉默',
    sideEffects: '跟距離 ≤3 的友方換位子。換位後雙方本回合不受沉默、也不受封印。出完強制結束回合。',
    how: '點要換的隊友。增幅時這張本身不受沉默。限制：不可換王；雙方落點都要站得上去。',
  },
  attack: {
    title: '攻擊',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '打鄰 1 的王或一般格。打王 2 點。一般格先破碎，已破碎再打會破壞；若該格已老化，破壞時王再吃 1 點。',
    how: '出牌後點高亮格子。限制：必須鄰 1；不能打其他職業、詛咒、沉默、懲罰、泥濘。',
  },
  faith: {
    title: '堅定信仰',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '清掉自己 1 層詛咒。',
    how: '限制：這回合還沒走動才能出。',
  },
  heroic_charge: {
    title: '英勇衝鋒',
    countsLabel: '計次',
    silenceLabel: '受沉默',
    sideEffects: '沿直線往前衝。老化牆會被撞破並繼續衝；撞到完整牆、沉默、王、地圖邊緣會停。撞碎已老化的牆，王吃 1 點（牆傷最多 2）；撞到王再打 2 點。整次最多 4 點。出完強制結束回合。',
    how: '點直線上任一格決定方向。限制：成功或失敗都結束回合。',
  },
  devotion: {
    title: '奉獻',
    countsLabel: '不計次',
    silenceLabel: '受沉默',
    sideEffects: '從鄰 1 隊友吸 1 層詛咒，或吃掉鄰 1 的詛咒格（層數加到自己）。',
    how: '點隊友或詛咒格。若因此咒滿：周圍鋪一般並封印，並從自己牌庫抽出「不死存在」；牌庫沒有這張就抽不到。限制：目標必須鄰 1。',
  },
  taunt: {
    title: '嘲諷',
    countsLabel: '不計次',
    silenceLabel: '不受沉默',
    sideEffects: '王必須在你鄰 1 格鋪牆。',
    how: '這版用旁邊勾選假裝，不能主動當手牌打出去，只能在他人回合生效。限制：須他人回合；優先級高於磁力屏障，衝突時覆蓋屏障。',
  },
  undying: {
    title: '不死存在',
    countsLabel: '不計次',
    silenceLabel: '不受沉默',
    sideEffects: '被封印時才能出。在地圖上選一格站得上去的地方跳過去，身邊地形不動。出完強制結束回合。',
    how: '旁邊有沉默也擋不住這張。落地後如果六格又被圍滿，會再被封。限制：封印中才能出。',
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

/** 職業被動（不是手牌）。目前只有騎士。 */
export const CLASS_PASSIVES: Partial<Record<string, ClassPassiveHint>> = {
  knight: {
    title: '多踩一格',
    sideHint: '詛咒上限 2',
    sideEffects: '別人帶 1 層詛咒就滿，你能帶到 2 層才咒滿。',
    how: '不用出牌。走路踩到詛咒格會上身並清掉那格。限制：不是手牌，不會進牌庫。',
  },
};
