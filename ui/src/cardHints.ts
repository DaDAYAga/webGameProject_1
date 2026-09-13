/**
 * 薄 UI 副作用提示（僅顯示；結算仍走 core）。
 */
export const CARD_SIDE_HINTS: Record<string, string> = {
  shot: '遠程傷王',
  playful_bottle: '棄1射擊裝填',
  mischief_bottle: '棄1射擊裝填抽',
  turbulence: '棄瓶移動',
  power_up: '臨時射擊',
  big_show: '免費氣瓶＋可再射',
  magic_arrow: '遠程傷王',
  amplify: '下一招增幅',
  wind: '推地形',
  focus: '結束回合',
  barrier: '下回合不可再用',
  planar_swap: '與友換位',
  attack: '鄰1傷王／拆牆',
  faith: '清1詛咒（未移動）',
  heroic_charge: '直線衝鋒',
  taunt: '限制王鋪牆',
  devotion: '吸友軍詛咒',
  undying: '輪末復活',
};

export function sideHintFor(cardId: string): string {
  return CARD_SIDE_HINTS[cardId] ?? '';
}
