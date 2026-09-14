# 設計修訂（人類定案）

> 本檔優先於交接檔／舊修訂中被點名覆寫的條文。未提及的仍以主交接檔為準。  
> 寫入規則：僅在人類定案後追加；只寫「覆寫哪一條、新規則、未定」。  
> 玩起來有問題再調：下列鎖定可被後續修訂覆寫。

## 文件分工（同步約定）

| 檔 | 誰寫 | 內容 |
|---|---|---|
| 主交接檔 / `BOT_HANDOFF.md` | 少改 | 總規格，當憲法 |
| `docs/design-amendments.md` | 人類定案才追加 | 覆寫哪一條、新規則、未定 |
| `docs/sync-YYYY-MM-DD.md` | bot 定期 | 短列表進度 |

---

## 2026-09-09b — 開場牆與遠程傷害（鎖定）

> 來源：人類定案摘錄「開場牆與遠程傷害」。  
> **整段覆寫**先前「甜區 ≤2／擋線 −1／近戰也 ≤2」等討論與本檔舊節「2026-09-09 — 王位置、受擊距離、開場牆」中相衝突的句子。

### 定案

1. **王**在 axial `(0,0)`，佔 1 格，玩家不能進王格。
2. **開場 6 牆**：距離 = 1 的 6 格為 `plain_starter`（或不老化 plain）  
   - 不老化；**拆掉會傷王**（見 2026-09-09d）  
   - **擋移動**（近戰要拆／繞才能進鄰 1 打王本體）  
   - **不擋遠程傷害**  
   - 仍算包圍
3. **近戰有效傷**  
   - 打王本體：必須鄰 1  
   - 打已老化、非開場的可破壞牆：拆掉 + 王 1 傷  
   - 開場牆不老化，不能靠拆它傷王
4. **遠程傷害**（射擊／魔法箭）  
   - 可指定王，不限距離  
   - 甜區：`distance((0,0)) <= 3` → 完整傷（基礎 + 裝填／增幅）  
   - 區外：`distance > 3` → 傷害 −1  
   - **沒有擋線 −1**（未老化牆／開場牆／懲罰／沉默都不修正遠程傷害）  
   - 最低 1；≥ 1 即有效傷 → 王抽牌  
   - 常數：`RANGED_SWEET_RADIUS = 3`  
   - 預留 `ignoreRangePenalty`（第一版不實作該牌）

### 給 bot（禁改）

- 不要把擋線 −1 加回遠程結算  
- 不要改開場 6 牆為不擋移動或會老化  
- 不要改甜區半徑（保持 3）  
- 牆仍影響走位、包圍、護身視線、近戰貼臉

### 未定（玩起來再調亦可）

- 主交接檔其餘 UNRESOLVED（王 HP、王牌構成、詛咒／沉默細節等）  
- 開場牆拆後再鋪是否一定老化（預設會）

---

## （已覆寫）2026-09-09 — 王位置、受擊距離、開場牆

> **狀態：已廢棄／被 2026-09-09b 覆寫。** 勿再依本节的「近戰也 ≤2」「甜區 ≤2」「射界擋線」實作。  
> 僅保留作歷史：曾討論過距離 ≤2 一併放寬近戰與射手；後改為近戰鎖鄰 1、遠程甜區 ≤3、無擋線 −1。


---

## 2026-09-09c — 踩詛咒後格消失（鎖定）

### 定案

自願踩上 `curse` 格後：

- 詛咒**上身**（層數／死亡由上層結算）
- **格上詛咒地形消失**（清空該格）

覆寫／明確化交接表「自願踩則上身」：上身同時清格，不留下空的 curse 牆。

### 實作

`core/board.absorbCurseAt(board, hex)`：僅當該格為 curse 時清空並回新 board；上身不在本層。


---

## 2026-09-09e — Power UP!! 無移動前置（鎖定）

**Power UP!!** 本身**沒有**「本回合須已移動」限制。  
覆寫舊交接／實作中的 `hasMovedThisTurn` 門檻（大招「來吧!」仍為出牌前不可移動）。


---

## 2026-09-09f — 英勇衝鋒與嘲諷（鎖定）

> 來源：人類定案「騎士鎖牌重設」。  
> **覆寫／取代**舊「盾牌衝鋒」「護身」牌面與結算；其餘騎士牌（攻擊／堅定信仰／奉獻／不死存在）不變。

### 定案 — 換牌

| 移除 | 新增 | 張數 |
|---|---|---|
| 護身 `guard` | 嘲諷 `taunt` | ×2 |
| 盾牌衝鋒 `shield_charge` | 英勇衝鋒 `heroic_charge` | ×2 |

- **英勇衝鋒**：計次 `countsTowardAction:true`；受沉默 `silenced:true`（同舊衝鋒）。
- **嘲諷**：不計次 `countsTowardAction:false`；**不受沉默** `silenced:false`；無傷害。

### 定案 — 英勇衝鋒 `resolveHeroicCharge`

沿單一軸向直線前進，直到地圖邊界或硬停：

1. **地圖邊界**（`MapBounds`／`DEFAULT_MAP_RADIUS` 或呼叫端 bounds）：不可踏出圖外；停在最後一格圖內。
2. **空格**：繼續前進。
3. **詛咒 `curse`**：基準＝穿過並 `absorbCurseAt`（清格）；難度選項可改截停。預設 absorb。
4. **未老化破碎 `plain_broken`（aged!==true）**：穿過並清格；**不傷王**；可連續穿越。
5. **老化牆**（aged 的 plain／plain_broken／starter）：穿過並銷毀；每牆王傷 +1，但**牆傷加總上限 2**；可連續穿越多面老化牆直到邊界或硬停。
6. **完整未老化牆**（plain／plain_starter 且未 aged）：停在**前一格**；對牆 `applyTerrainHit` 一次（破碎）；`forceEndTurn`。
7. **punish／silence**：停在前一格；不銷毀；`forceEndTurn`。
8. **王格**：不進入；對王造成 **2** 傷；整次衝鋒**只抽 1 張王牌**（若同時穿牆傷王，仍只抽 1）；牆傷與王本體傷可加總（例：牆 2 + 王 2 = 4）；`forceEndTurn`。
9. **撞其他單位**（可選 `units`，不含自己）：停在互動前；落到呼叫端指定的 `landingHex`（須為該單位鄰 1 且 `canStandAt`）；`forceEndTurn`。

**抽牌／事件**：若有任一牆傷或王本體命中 → 單次抽牌旗標（`HEROIC_CHARGE_BOSS_DRAWS=1`）；可發一次總傷 `BossDamaged`／`WallPierce` + 抽牌事件。

**結束回合**：英勇衝鋒結算後**一律** `forceEndTurn:true`（大移動）。

常數：

- `HEROIC_CHARGE_BOSS_HIT_DAMAGE = 2`
- `HEROIC_CHARGE_WALL_DAMAGE_CAP = 2`
- `HEROIC_CHARGE_BOSS_DRAWS = 1`

### 定案 — 嘲諷 `resolveTaunt`

- 輸入：`isOthersTurn:boolean`（必須為 true）、`knightHex`、可選既有屏障。
- 非他人回合 → 失敗。
- 成功：`bossPlaceRestriction: { type:'taunt', center: knightHex, ringDistance:1 }`，`tauntPriority: 100`。
- 不計次、不受沉默、`bossDamage:0`。

### 定案 — 與磁力屏障優先級

- `TAUNT_PRIORITY = 100`
- `BARRIER_PRIORITY = 10`
- **嘲諷覆蓋屏障**：同格／衝突時以優先級較高者為準（嘲諷勝）。

### 給 bot（禁改）

- 不要把舊護身／盾牌衝鋒加回牌表
- 不要拿掉牆傷 cap 2 或王命中 2
- 不要讓嘲諷受沉默或計次
- 不要讓英勇衝鋒預設遇咒截停（預設 absorb）

### 未定（玩起來再調）

- 遇咒難度選項 `stop` 的正式開關位置
- 穿未老化破碎是否一定清格（本鎖定採清格）

---

## 2026-09-09g — 來吧! 大鬧一場! 強化（鎖定）

> 來源：人類定案「來吧! 大鬧一場! 強化」＋後續訂正（不抽牌；射擊須耗手上射擊牌）。  
> **保留**：×1；出牌前不可移動（`hasMovedThisTurn` 失敗）；計次；受沉默。  
> **覆寫**：舊「抽 3／非射擊可立刻用」作廢；**覆寫**白送臨時射擊／`TempShotPlayed` 自動結算（太強）。  
> 更新標記：`2026-09-09g`（手牌射擊耗卡）。

### 定案 — 結算流程

1. `hasMovedThisTurn` → 失敗（裝填不變、不授旗）。
2. **不抽牌**（無 `BIG_SHOW_DRAW`／`CardsDrawn`／`immediatePlayEligible`）。
3. **免費氣瓶**：`+BIG_SHOW_FREE_DAMAGE`（頑皮）＋`+BIG_SHOW_FREE_DRAW`（胡鬧）；**不棄射擊**；**可超** `AMMO_SLOT_MAX_TOTAL`（走 `addAmmoUnchecked`）。一般氣瓶 cap=2 不變。保留 `AmmoSlotLoaded`／`BigShowAmmoGranted` 事件。
4. **授予** `mayPlayShot: true` ＋ `ignoreRangePenalty: true`（結果欄 `ignoreRangePenaltyForShot`；事件 `MayPlayShot`）：玩家可打 **1 張手上射擊**（**消耗該卡**）。**禁止**在 `resolveBigShow` 內立刻 `resolveGunnerShot`／發 `TempShotPlayed`。
5. 計次；受沉默。

### 峰值示例（基礎射擊傷 1；皆為後續**手上射擊**結算時）

| 大招前槽 | 免費後（射擊前） | 手上射擊結果 |
|---|---|---|
| 空 `{0,0}` | `{1,1}` | 2 傷 + 抽 1 |
| 滿 `{1,1}` | `{2,2}` | **3 傷 + 抽 2**（常見高潮） |
| 偏 `{2,0}` | `{3,1}` | **4 傷 + 抽 1** |
| 偏 `{0,2}` | `{1,3}` | **2 傷 + 抽 3** |

**峰值讀法（鎖定）**

- 常見高潮：`{1,1}` → `{2,2}` → **3 傷 + 抽 2**（須耗 1 張手上射擊）。
- 單邊峰值互斥：4 傷+抽 1 **或** 2 傷+抽 3；勿混成同一包。
- **禁止**寫成「三傷＋三抽」最大組合；大招本身**不再另抽牌**，射擊抽僅來自 `drawBonus`。
- 無手上射擊則無法兌現峰值（大招仍成功授旗／裝填）。

### 常數

- `BIG_SHOW_FREE_DAMAGE = 1`
- `BIG_SHOW_FREE_DRAW = 1`
- （已移除 `BIG_SHOW_DRAW`）

### 給 bot（禁改）

- 不要拿掉「出牌前不可移動」
- 不要讓一般氣瓶也忽略 cap
- 不要改回「抽 3」或白送不耗卡臨時射擊
- 不要把 ignoreRangePenalty 做成永久被動
- 不要改法師

---

## 2026-09-09h — 法師增幅／屏障（鎖定）

> 來源：人類定案「法師鎖牌：強能增幅不再棄牌；磁力屏障改冷卻」。  
> **覆寫**舊「強能增幅棄 1」「磁力屏障下一回合抽 −1」。

### 定案 — 強能增幅 `resolveAmplify`

- ×2；**不計次**；**受沉默**（定義表不變）。
- **不再棄牌**（移除 discard-1／`discardInstanceId`／手牌棄牌路徑）。
- 成功僅武裝本回合 buff：`amplifiedPending:true` → 下一張招帶 `amplified`；未使用則回合結束失效。
- 升級效果不變：箭 +1；御風 2 步；位面不受沉默；聚精 +1 抽；屏障改寄出。

### 定案 — 磁力屏障 `resolveBarrier` 副作用

- **移除**成功路徑的 `nextTurnDrawDelta: -1`／`BARRIER_NEXT_TURN_DRAW_DELTA` 抽牌懲罰。
- **改為**：下一回合**不可再出屏障**（冷卻）。
  - 結果旗標：`barrierBlockedNextTurn: true`
  - 光環／事件欄：`blockBarrierNextTurn: true`
- 常數：`BARRIER_BLOCK_NEXT_TURN = true`；`BARRIER_NEXT_TURN_DRAW_DELTA` 僅 deprecated 防舊引用。
- **維持**：計次；受沉默；本輪結束前保護目標鄰 1；增幅寄出 dist≤3；`BARRIER_PRIORITY=10`（嘲諷 100 覆蓋）不變。

### 給 bot（禁改）

- 不要把棄 1 加回增幅
- 不要把下回合抽 −1 加回屏障成功路徑
- 不要改屏障計次／沉默／優先級（除非測試被迫）

### 未定（玩起來再調）

- 屏障冷卻是否跨輪／僅下一自己回合（本鎖定＝下一回合不可再出）
- 磁力屏障是否計次（仍 UNRESOLVED，預設計次）

---

## 2026-09-13i — 兩步移動鎖定再出牌（鎖定）

> 來源：人類定案「per turn 移動預算 2；首步成功後鎖定出牌至走完」。  
> **覆寫**薄 UI 舊「一次只走鄰格／TURN_MOVES_PER_ROUND=1」demo 行為。

### 定案

1. **每回合移動預算** `TURN_MOVES_PER_ROUND = 2`（步數；非核心 turn 命名空間，薄 UI 常數）。
2. **本回合尚未移動前**：可自由出牌（計次／不計次皆可，仍受 actionsLeft 約束）。
3. **第一次成功移動後**進入 `moveLocked`／`mustFinishMove`：  
   **一切出牌皆擋**（計次與不計次）直到移動結束。
4. **移動結束**條件（解鎖出牌，同回合可再出）：
   - 本回合已消耗 2 步；或
   - 無合法續走（目前格無 `canStandAt` 鄰格）→ 日誌「無法續走，解鎖出牌」
5. **點擊目標**：`shortestPath(board, unitHex, dest)`（`core/board`）。  
   拒絕：`null`、目標＝自己、或 **路徑步數 > 2**（`steps = path.length - 1`，路徑含起點）。
6. **路徑 1 步**：走到鄰格；若仍剩 1 步且可續走 → 保持鎖定。
7. **路徑 2 步**：一次點擊套用兩步（單位直接到 dest、花 2 步）→ 解鎖。
8. **路徑 2 步但 `movesLeft === 1`**：拒絕（只允許 ≤ movesLeft 的路徑；不自動只走第一步）。
9. **endTurn**：`movesLeft=2`、清除移動鎖；行動／增幅重置同既有薄殼。
10. **牆／王格仍不可站**；開場盤面不變。

### 給 bot（禁改）

- 不要把預算改回 1，或拿掉首步鎖定
- 不要在鎖定中放行氣瓶／增幅等「不計次」牌
- 不要改 `shortestPath` 的 `canStandAt` 語意
- 不要改開場牆／王格站立規則

### 未定（玩起來再調）

- 可走範圍高亮（本鎖定可選略過）
- 是否與真實 `core/turn` 移動點對接

---

## 2026-09-13j — 薄 UI 牌目標指定（pendingPlay）（鎖定）

> 來源：人類任務「wire remaining class cards」；**UI-only** 指定慣例，不改 core 結算。

### 定案

1. **`pendingPlay`**：出牌進入指定模式後，`onHexClick` **優先完成牌目標**，不走移動。
2. **取消**：提供「取消指定」清除 pending；切職業／結束回合亦清。
3. **與 moveLocked**：鎖定期間仍**不可開始出牌**（含大亂流／英勇衝鋒）。可於首步前或走完 2 步後發動。
4. **各牌指定**  
   - 大亂流：自動棄最多 2 氣瓶 → 點恰好 N 步終點（`shortestPath` → path 不含起點交給 `resolveTurbulence`）  
   - 御風：先點地形來源 → 再點鄰格當方向  
   - 英勇衝鋒：點軸向直線上任一格決定方向 → `resolveHeroicCharge`  
   - 不死存在：點可站落點（須 demo 旗 isDead + atRoundEnd）  
   - 奉獻：隊友鄰 1 則直接結算，否則點隊友格
5. **大招後續射擊**：`mayPlayShot` 授旗後，下一張手上射擊可 `ignoreRangePenalty` 且**不另扣** actionsLeft。
6. **強制結束**：聚精／衝鋒／位面／不死成功（或衝鋒失敗且 forceEndTurn）→ 呼叫同一套薄殼 `endTurn`。

### 給 bot（禁改）

- 不要在 moveLocked 中放行一般出牌
- 不要把 pending 點格誤當成走路移動
- 不要改 core resolve* 簽名來遷就 UI

### 未定

- 可走／可指定範圍高亮
- Power UP dig_shots 模式（薄 demo 目前固定 temp_shot）

---

## 2026-09-13k — 盟友佔格、demo 測試地形、懸停走路路徑（鎖定）

> 來源：人類任務「ally blockers + demo tiles + hover path preview」。

### 定案

1. **盟友佔格**：不寫入 `Board.tiles`。走路／`shortestPath`／`hasStandableNeighbor` 視盟友格為不可站（與牆同層阻擋）。不可落地於盟友。**自身不擋自己**（起點不重驗；`occupied` 不含行走者）。
2. **API**：`canStandAt(board, hex, { occupied? })`；`shortestPath` 選項 `occupied` 轉傳同一語意。
3. **Demo 測試地形**（`createDemoBoard()`＝開場牆＋樣本）：  
   - 完整老化牆 `plain`+`aged`：`(3,0)` `(1,1)`  
   - `silence`：`(2,1)` `(4,0)`  
   - `curse`：`(3,1)` `(4,1)`（路徑**可**踩）  
   - 不與單位 `(2,0)`、隊友 `(3,-1)`、王、開場 6 牆重疊。畫布標籤：呢／默／整牆（破碎開場牆仍「牆」）。
4. **懸停走路預覽**：`BoardCanvas` 回報 `onHexHover`；`App` 用與 `tryMoveTo` **同一套** `shortestPath` + 步數 ≤ `movesLeft` 與 `TURN_MOVES_PER_ROUND`。有 `pendingPlay` 不顯示。螢光綠 `#39FF14`（別於隊友綠）。無效／離板清除。

### 給 bot（禁改）

- 不要把單位寫進 `Board.tiles`
- 不要在 pending 指定模式顯示走路路徑預覽
- 不要改開場 6 牆預設為完整牆（demo 額外鋪完整牆即可）

### 未定

- 可走範圍常駐高亮（非懸停）
- 真實多單位佔格列表接 `core/turn`

---

## 2026-09-13l — 手牌懸停遠程甜區預覽（鎖定）

> 來源：人類任務「shot hover shows sweet zone」。**UI-only** 預覽慣例；結算仍走 `computeRangedDamageToBoss`。

### 定案

1. **`Hand.onCardHover`**：`onMouseEnter` → card、`onMouseLeave` → null；**不**觸發出牌／`pendingPlay`／移動。
2. **觸發牌**：`shot` 與 `magic_arrow`（同一遠程甜區規則）→ `BoardCanvas.showSweetZone`。
3. **甜區幾何**：地圖格 `distance(hex, BOSS_HEX) <= RANGED_SWEET_RADIUS`（常數來自 `core/combat`，UI **不硬編 3**）。
4. **畫層**：琥珀／金半透明洗色（約 0.28–0.48 alpha）畫在地形之上、單位／隊友／走路路徑之下；與路徑 `#39FF14`、隊友 `#a0e8b0` 區隔。單位在區內可略加強洗色並標「甜」；區外仍顯示整圈甜區。可選文案：在甜區內／在甜區外（`isInRangedSweetZone(unitHex)`）。
5. **並存**：手牌懸停甜區時，棋盤格懸停走路路徑仍可疊在上面。

### 給 bot（禁改）

- 不要在 hover 時開始 pendingPlay 或移動
- 不要在 UI 硬編碼甜區半徑 3（用 `RANGED_SWEET_RADIUS`）
- 不要把甜區洗色畫成螢光綠或隊友綠

### 未定

- 其他遠程牌（若日後新增）是否一併預覽
- 常駐甜區開關（非懸停）

---

## 2026-09-13m — 薄 UI 可玩回合 loop（core/turn）（鎖定）

> 來源：人類任務「playable turn loop via core/turn」。**UI glue**；不改 core 規則實作。

### 定案

1. **王 HP demo**＝12；既有回報 `bossDamage` 的牌（射擊／魔法箭／Power UP／攻擊／英勇衝鋒等）扣 HP；`HP≤0` → 勝利 toast／日誌並停玩。
2. **結束回合**接 `createMatch`／`applyCommand`；行動序 `player` → `boss`；`punishEnabled: true`。
3. **玩家結束**：本回合有有效王傷 → `MARK_BOSS_DAMAGED`，再 `END_ACTOR_TURN`。
4. **DrawStub**（玩家回合開始）：槍手＋`shot`、法師＋`magic_arrow`、騎士＋`attack`；日誌 DrawStub。無完整牌庫。
5. **輪末**：以結束前 snapshot 呼叫 `advanceWallAging(aging, wallsPlaced, { board })`，把 newlyAged 寫回 `tile.aged`。僅本局王鋪且 `REGISTER_WALL_PLACED` 的牆進老化；開場／demo 預老化牆不進。
6. **王回合 v0**（scripted）：空位鋪 1 未老化 `plain`＋`REGISTER_WALL_PLACED`（優先 ring-2／鄰接地形）；若本輪零王傷再鋪 1 `punish`（無空則 skip 日誌）。結束後回到玩家：移動 2／行動 1／清 moveLocked；**保留裝填**。
7. **UI**：顯示王 HP、輪、行動者、上次抽；老化牆既有變色／標籤。

### 給 bot（禁改）

- 不要做完整牌庫／真實 AI／包圍勝負
- 不要讓開場／demo 預老化牆進入 aging registry
- 不要在勝利後繼續出牌／結束回合

### 未定

- 可走範圍常駐高亮
- 與 `STUB_MOVE` 移動點對接

---

## 2026-09-13n — 三職業平衡試玩 loop（鎖定）

> 來源：人類任務「BALANCE PLAYTEST」。**覆寫** 2026-09-13m 的「player→boss 王回合 v0 鋪牆」：無王行動者回合。

### 定案

1. **三棋子常駐**：騎士／槍手／法師同時在盤上；選職業鈕＝選棋子（綠）＋看該手牌。可行動未選＝淺藍；本輪已結束＝灰。
2. **一輪**：僅當三人皆按「結束回合」才 `round++`；無 boss actor turn。
3. **傷王即鋪**：任何有效 `noteBossDamage` → 立刻威脅序鋪 1 未老化 `plain`（可續走）；不待結束回合。
4. **懲罰**：真輪末且本輪零王傷 → 恰好 2 `punish`（威脅序）；不再另鋪 plain。
5. **威脅序**：`pickThreatPlacementHexes`（core/turn）：邊緣 → 易圍死／詛咒弱體 → 遠程 → 近距；偏好完成 5/6 封；略過佔格／王／地形／嘲諷屏障保護格。
6. **手牌上限**：騎／槍 7、法 8；抽後超限棄最新並日誌。
7. **重製**：開場盤 → 依序點 3 出生格（騎→槍→法）。
8. **地形繪製**：凡 plain 系 `aged:true` 共用填色＋標「老化」；未老化＝「牆體」。開場牆與王鋪後老化同貌。

### 給 bot（禁改）

- 不要加回結束回合才鋪 plain 的王回合 v0
- 不要讓開場牆進老化 registry
- 不要做真實 AI／包圍勝畫面／Hearthstone 扇形手牌

### 未定

- 可走範圍常駐高亮
- 與 `STUB_MOVE`／完整牌庫對接


---

## 2026-09-13o — 騎士指定攻擊／王牌庫／重製設定（鎖定）

> 來源：人類 playtest follow-ups。**覆寫** 2026-09-13n 的「傷王即鋪 1 plain」與「重製直接出生」。

### 定案

1. **結束回合**：按鈕在事件日誌下方、右對齊（不與職業鈕／狀態列並列）。
2. **騎士攻擊**：出牌進入指定；高亮鄰 1 有效目標（王或可拆 plain 系）；不可選友軍格／沉默／詛咒／懲罰；點選後 `resolveKnightAttack`；取消指定可用。
3. **卡牌懸停 2 秒**：短 meta 仍在卡上；滿 2 秒顯示完整 tooltip（標題＋計次／受沉默＋副作用＋用法）。
4. **重製設定**：重製先表單（預設半徑 5、王 HP 20、牌庫 30；放置 15/12/3；地形袋 老化 0／完整 16／詛咒 13／沉默 1）；合計須＝手卡張數否則 toast；確認後再出生點。
5. **傷王抽牌**：洗牌王牌庫（N=2/3/4）＋地形袋；每次有效傷抽 1 張放置 N 格（袋不夠則有多少放多少）；僅未老化 plain 進老化 registry；牌盡且王仍活 → 敗北。零傷輪末仍恰好 2 punish。
6. **王牌庫 widget**：棋盤右上；懸停顯示剩餘牌／N 分布／地形袋；重製老化＝0 時不顯示老化剩餘。

### 給 bot（禁改）

- 不要改回自動選王／自動選第一可拆牆
- 不要改 core `DEFAULT_MAP_RADIUS` 常數本身（半徑由 UI state 傳入）
- 不要讓開場牆進老化 registry

### 未定

- 可走範圍常駐高亮
- 與完整牌庫／STUB_MOVE 對接

---

## 2026-09-13p — 無職業 HP／詛咒狀態／沉默鄰接／包圍 UI／官方牌庫（鎖定）

> 來源：人類定案 2026-09-13。薄 UI＋少量 core 輔助；**不改** `DEFAULT_MAP_RADIUS`。

### 定案

1. **無職業／單位 HP**：移除試玩 HP。騎士攻擊**不能打其他職業**（只選王／可拆牆）。
2. **詛咒是狀態**：踩 `curse` → `curseStacks += 1`，`absorbCurseAt` 清格。棋子在類名旁／下顯示單一「咒」標（≥1 層只一枚）。全員開場 stacks＝0（騎士不再預設 2）。
3. **攜帶上限**：其他職業 1、騎士 2（被動多踩一格）。已達上限則該 curse 格對其不可站／不可路徑通過（`shortestPath.curseCarry`／`canStandAt.blockCurse`）。一般走與大亂流皆適用。英勇衝鋒仍可依 core 清咒格，但 stacks 只加到 cap。
4. **路徑吸咒**：走過路徑**每一格**（含途經）都 absorb，不只終點。
5. **沉默**：若角色鄰 1 有 `silence` 地形，不可打出 `CardDefinition.silenced === true` 的牌；`silenced: false`（如嘲諷）仍可。檢查在 `onPlay` 開頭。
6. **包圍 UI**：盤面變更後對存活者跑 `isSealed(board, hex, { radius: mapRadius })`；封印顯示「封」環／標（有別於「咒」）。剛封印時日誌／toast。`wouldEliminate`（地形壓上已封印者本體）→ 出局（不可行動、列表灰「出局」）。單位不擋包圍（core 原規則）。
7. **官方牌庫**：每職 16 張洗牌；起手 4、其餘 12 為抽牌堆；輪初抽 1（取代 DrawStub）。手牌上限仍 7/7/8（超則棄最新）。牌庫空 → 跳過抽並日誌「牌庫空了」。

### 份數假設（人類未指定張數分配，實作採用）

| 職業 | 16 張構成 |
|---|---|
| 騎士 | attack×6、heroic_charge×2、faith×2、taunt×2、devotion×2、undying×2 |
| 槍手 | shot×6、playful_bottle×2、mischief_bottle×2、turbulence×2、power_up×2、big_show×2 |
| 法師 | magic_arrow×6、amplify×2、wind×2、focus×2、barrier×2、planar_swap×2 |

### 給 bot（禁改）

- 不要加回職業 HP／打人扣血
- 不要改 core `DEFAULT_MAP_RADIUS`
- 不要讓單位佔格擋包圍

### 未定

- 牌庫份數是否再調 → **2026-09-13t** 改預設 15
- 出局棋子是否移出盤面 → **2026-09-13t** 離場、格改一般

---

## 2026-09-13q — 路徑吸咒／衝鋒落地續衝／起手 4／不打人（鎖定）

1. 最短路徑途經 `curse` 一律上身清格（等長路徑優先走詛咒格）。
2. 英勇衝鋒：穿老化牆後**站上該格繼續衝**，直到完整牆／沉默／王／邊緣（或他人格前一格）。出牌後立刻結束回合（不再用舊座標覆蓋落地）。
3. 起手固定 4；狀態列顯示手牌／牌庫張數。舊對局若仍 7 張請重製。
4. 騎士攻擊不可選其他職業。


---

## 2026-09-13r — 鄰沉默 UI／泥濘地形／基礎移動 −1／種類威脅優先級（鎖定）

> 來源：人類 playtest follow-up 2026-09-13。**不改** `DEFAULT_MAP_RADIUS`。

### 定案

1. **鄰沉默出牌（鎖定）**  
   角色鄰 1 有 `silence` 地形時，不可打出 `silenced === true` 的牌（檢查已在 `onPlay`）。手牌按鈕：`adjacentSilence && card.silenced` → disabled、灰／變淡、`title`「鄰近沉默，無法打出」。`silenced: false`（嘲諷）仍可點。狀態列／職業鈕顯示「鄰沉默」。棋子可加小「默」標（有別於咒／封）。

2. **新地形 `mud`（泥濘）**  
   - 不可站／不可通過（`kindAllowsStand` false）  
   - 不可拆（`kindAllowsCrack` false）  
   - 不可推（`kindAllowsPush` false）  
   - 不老化（老化仍僅 plain 系）  
   - 計入包圍  
   - 英勇衝鋒：硬停前一格（同 silence／punish）  
   - 御風術：不可搬 mud  
   - 畫面：棕填 `#6b4a2a`、標籤「泥濘」

3. **鄰泥濘只扣基礎移動 −1**  
   `basicMoveCap(board, hex, base = 2)` → `max(0, base - (adjacent mud ? 1 : 0))`。只影響 `tryMoveTo`／`movesLeft`。卡牌移動（大亂流、英勇衝鋒、御風）不扣。  
   出生／`freshActor`、輪末 `finishRound`（punish 鋪完後的 board）用 cap 設 `movesLeft`。王中途鋪地（`noteBossDamage`）後把存活者剩餘 `movesLeft` clamp 到新 cap。cap 因泥濘為 1 時寫日誌。

4. **種類威脅優先級**  
   選格仍 `pickThreatPlacementHexes`（位置威脅序）。種類**不**再把袋隨機 shift 到格上。  
   `ResetSetup.kindPriority` 預設（高＝先鋪到最威脅空格）：silence 40、curse 30、mud 20、plain（完整）10、plain_aged 0。  
   重製表單每 kind 一個「威脅優先級」數字（在數量旁）。  
   放置 N 格：picks 已高→低；袋拷貝依 priority 降序穩定排序，依序指派，用掉的 token 從袋移除。輔助：`assignKindsByPriority`。

5. **重製／王牌庫**  
   `KindToken` 含 `'mud'`；`ResetSetup.mudTiles` 預設 **0**；`buildKindBag` 計入泥濘。袋合計：aged＋intact＋curse＋silence＋**mud** ＝ deckSize。懸停 `byKind.mud`；重製泥濘＝0 時不顯示剩餘（同老化）。

### 給 bot（禁改）

- 不要改 core `DEFAULT_MAP_RADIUS`
- 不要讓泥濘扣卡牌移動
- 不要把 kind 袋隨機 shift 蓋過 priority 指派

---

## 2026-09-13s — 種類袋＝可鋪格數／一般格／魔王選格（鎖定）

1. 地形袋合計須＝`place2×2 + place3×3 + place4×4`（預設 78），不再等於手卡張數 30。
2. 預設：一般格 62、詛咒 15（約一般的 1/4）、沉默 1、泥濘 0、老化 0。
3. 畫面「牆體」改稱「一般」／「一般格」。
4. 選格改魔王視角：封死／瀕封仍最高；遠程與接近王的路線加權；一格鄰兩人加分；未帶咒比已帶咒更想壓。種類優先級預設沉默 50／詛咒 32／泥濘 22／一般 10／老化 0。


---

## 2026-09-13t — 越打越擠／出局離場／咒滿出局／15 張牌庫／必須重製／難度疊加（鎖定）

> 來源：人類定案 2026-09-13。**不改** `DEFAULT_MAP_RADIUS`。線上合作／教學／GitHub Pages 不是本任務。

### 定案 — 越打越擠是主軸

半徑 5 上 78 格種類袋（預設 15×2＋12×3＋3×4）是**刻意**的擠壓，不是漏算。玩起來再調。

### 定案 — 出局離場，格改一般

當單位出局（包圍壓上 **或** 咒滿 **或** 之後任何原因）：

- 若該格仍空：`placeTerrain(..., 'plain')` 未老化一般格，並登錄老化（同其他未老化一般）。
- 若格上已有地形（壓上）**不**重複鋪。
- `eliminated: true`、`endedThisRound: true`、moves/actions 0。
- **不畫棋子**（`boardActors` 濾掉 eliminated）。
- `occupiedExcept`／威脅佔格／出生：跳過 eliminated，不再擋格。
- 職業鈕仍顯示「出局」。
- 日誌「出局，離場，格改一般」。
- 三人皆出局且王仍存活 → 敗北。

輔助：`placeUnagedPlainIfEmpty`、`curseFullAfterAbsorb`。

### 定案 — 咒滿＝出局

`curseCarryCap`：騎士 2、其餘 1。**任何**吸咒使 `curseStacks >= cap`（走路路徑、衝鋒吸收、奉獻）立刻依上條出局。槍手／法師第一層出局；騎士第二層出局。不可停在 cap 上。仍存活時 cap 仍擋再踩咒格。

### 定案 — 玩家牌庫預設 15

- 6× 基礎：騎 `attack`、槍 `shot`、法 `magic_arrow`
- 4 小技 ×2：騎 heroic_charge / faith / taunt / devotion；槍 playful_bottle / mischief_bottle / turbulence / power_up；法 amplify / wind / focus / barrier
- 1× 大招：騎 `undying`、槍 `big_show`、法 `planar_swap`

重製表單每職 4 個小技核取；可選 **0–2**；每勾 +1 張。預設全不勾。`buildShuffledDeck(id, seq, extraSmallIds)`。起手仍 4，上限 7/7/8。

**必須經重製開局**：initial `phase = 'reset-setup'`（不是 `'playing'`）。勝／敗後既有重製鈕。

### 定案 — 難度（可疊加核取；確認時由預設＋旗標重算袋／放置）

活選項（表單由上到下）：

1. **堅固圍牆** — 開場 6 牆＝完整 `plain` + `aged:false` + `noAge`（`createOpeningBoard({ intactUnagedStarterWalls: true })`）。預設 OFF＝現況破碎＋老化。
2. **寸步難移** — 出生完成後在隨機**內圈**空格鋪 3 泥濘（非邊緣、非王、非佔格、非既有地形）。不進種類袋。
3. **沉默無聲** — `silenceTiles += 1`（預設 1→2），從一般格扣 1（`intactWalls -= 1`），袋合計仍＝可鋪格數。
5. **瘋狂詛咒** — 詛咒約為一般格 1/3，總格不變。沉默／泥／老化先固定，其餘 `intact = round(remaining×3/4)`。例：關 62/15/1；開（沉默 1）≈58/19/1＝78。
6. **瘋狂壓力** — `place4 += 2`、`place2 -= 2`（13/12/5），可鋪 82；袋自動 +4 一般格。

疊加序：壓力 → 沉默 → 詛咒。

灰項**置底**（`disabled`，不實作規則）：**4 代價移動**（即原「C版」；C 版不是另一項）。線上合作之後再做。

### 給 bot（禁改）

- 不要改 core `DEFAULT_MAP_RADIUS`
- 不要實作代價移動／C 版規則
- 不要把灰項排到活選項前面


---

## 2026-09-14a — 聚精會神實際抽牌（鎖定）

`resolveFocus` 本來就算 2／增幅 3，薄 UI 只寫「應抽」。現在依 `drawCount` 從該職牌庫抽進手牌（上限棄最新；牌庫不夠就抽到空），再強制結束回合。結束回合必須帶抽完後的 actors，避免輪末蓋掉新手牌。


---

## 2026-09-14b — 重製小技上移／槍手行動點（鎖定）

1. 重製表：職業小技 +1、難度 緊接在半徑／王 HP 後面；袋數字往下。
2. 氣瓶／射擊／Power UP 耗行動後，計次牌（含裝填抽到的射擊）不可再打。只有大招授予的那 1 張射擊可免費打。
3. 射擊／臨時射擊依 `drawFromAmmo` 真的抽牌。


---

## 2026-09-14c — C 版＝代價移動（鎖定）

難度灰項只留 **4 代價移動**。C 版（計畫中）就是這項，已從表單移除。


---

## 2026-09-14d — 威脅優先級＝選格，不是抽袋（鎖定）

人類原意：優先級只排「鋪哪一格最能壓人」（`pickThreatPlacementHexes`）。
袋子種類開場洗亂，每次鋪格依袋順序抽出，**不再** `assignKindsByPriority` 先吐沉默／詛咒。
重製表格種只留張數，右側優先數字移除。


---

## 2026-09-14e — 封印擋出牌／壓封印本體出局（鎖定）

1. 已封印不可出牌、不可移動。
2. 六鄰滿仍只先封印；下一次王鋪格可選已封印者本體並出局（選格不再跳過該佔格）。
3. 魔法箭等傷王鋪格必須帶出手後的 actors，避免行動點被蓋回。


---

## 2026-09-14f — 封印留下／咒滿鋪鄰／奉獻咒格／不死解封／狂妄氣瓶（鎖定）

覆寫 **2026-09-14e** 中「壓封印本體出局」與咒滿離場／不死輪末復活／Power UP 臨時射擊等相衝突條文。

### 定案 — 封印留下（不壓出局）

1. 六鄰滿仍只 **封印**。王鋪格 **不可** 再選已佔格（含封印者本體）；移除 crush／place-on-sealed eliminate。
2. 封印者留在盤上、佔格、計入他人包圍、仍繪製；不可移動、不可出牌（**唯一例外**：騎士「不死存在」）。
3. **解封**：任一鄰被清／推開使六鄰不再滿 → 解封（攻擊／衝鋒／御風／狂妄推／不死移動／任何破格後重算）。不必清滿六鄰。
4. **新封印獎懲（王牌）**：每次有人從「未封 → 封」（咒滿、王補滿六鄰等），從王 **張數牌庫**（place2／3／4）抽掉 1 張並丟棄、**不鋪格**。優先最小：有 2 先丟 2，否則 3，否則 4。同一動作封兩人 → 丟兩張。再封再丟。牌庫空則跳過（既有牌盡敗北仍適用）。
5. **敗北**：三人皆封印且王仍在＝敗北；保留三人皆 eliminated 安全網。咒滿／封印 **不** 設 eliminated。
6. ~~輪末依封印人數額外鋪 N 格~~：**未鎖定／取消**，勿實作。

### 定案 — 咒滿＝留場＋鋪鄰＋封印

吸咒達 cap（騎 2、其餘 1）→ **不** 離場、**不** 把自己格改地形。對每個 **空** 鄰鋪未老化一般（`makeTile('plain')`／`placeUnagedPlainIfEmpty`）；跳過既有地形／王／存活單位佔格。新 plain 進老化管線；**不** 吃種類袋。然後重算包圍（通常自封）；日誌：咒滿 → 周圍鋪一般 → 封印。鄰被鋪滿也可能封到別人。六鄰已滿則只封印、不再鋪。

### 定案 — 奉獻

仍可吸鄰 1 友軍 1 層咒。**亦可** 點鄰 1 詛咒地形：清該格（不傷王）、自己 +1 層。達 cap 走咒滿鋪鄰封印，**不再** 走 extractedUndying／離場死。

### 定案 — 不死存在

封印中可出（手牌勿灰掉此牌）；不要求 isDead／輪末。**不受沉默**（`silenced: false`，鄰沉默不擋）。出牌時選可站落點（非王、非佔），移過去並解封；**不** 變更落點周圍地形。強制結束回合。落地後若六鄰滿則再封印。

### 定案 — 槍手氣瓶／狂妄

- 頑皮：維持棄 1 射擊 → +1 傷。
- 胡鬧：**不棄牌** → +1 抽；僅槽滿失敗。
- Power UP!! 顯示名 **狂妄氣瓶**（id 仍 `power_up`）：+1 pushBonus；不再 dig／臨時射擊。
- `AmmoSlotState.pushBonus`；合計 = 傷+抽+推；手牌氣瓶 cap 仍 2；大招 `addAmmoUnchecked` 可超。
- 射擊若 pushBonus>0：先照常結算（傷／抽／清槽，先存 N 與槍手格），再讓玩家點 N 個鄰格徑向推 1。跳過條件見實作；撞碎 broken 清空 **不傷王**。推完後解封檢查。
- 大招免費三層：頑皮+胡鬧+狂妄；大亂流 `BOTTLE_IDS` 含 `power_up`。
- 狂妄推／御風／不死 **不** 造成老化牆近戰傷王；騎士攻擊／衝鋒仍可。

