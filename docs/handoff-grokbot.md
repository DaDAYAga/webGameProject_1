# Grokbot 交接（2026-09-19）

人類要把**小 bug**丟給 grokbot 修。  
**檢核／回歸測試**由另一個 Grok Build 會話負責（不要兩邊同時改 `App.tsx`）。

讀完本檔再動手。規則以 `docs/design-amendments.md` **最後幾段 2026-09-19／19b／19c** 為準，不要用過時的 README。

---

## 0. Git（先看這個）

```
git log -8 --oneline
git status
git diff
```

預期：

| 項目 | 值 |
|---|---|
| 分支 | `main`（可能超前 `origin/main`，**不要 push** 除非人類說） |
| 階段點 A | `1ba0ef7` `playtest: 2026-09-19 rules, taunt interrupt, readable UI` |
| 階段點 B | 本交接之後的 commit（咒滿 2 層、破碎外觀、氣瓶／增幅、位面兩目標、屏障擋輪末懲罰、封印跳過回合） |

若 `git status` 還有未提交檔，**先問人類**，不要擅自 `git restore`。

---

## 1. 你（grokbot）可以做／不可以做

**可以**

- 單一、可描述的 playtest bug（出牌擋錯、高亮漏、文案、CSS、一小段 glue）
- 對應的 **core 測試**（`core/**/*.test.ts`）
- 改完跑 `npm test`（專案根目錄，**不要**在家目錄跑 `npx vitest`）

**不可以**

- 重寫／搬空 `ui/src/App.tsx`（約 3600 行，對局狀態機在這裡）
- 改 `DEFAULT_MAP_RADIUS`、讓御風再推詛咒、把嘲諷改回「他人回合」勾選、從棄牌堆 tutor 不死
- 下一隻魔王、代價移動、新手教學、GitHub Pages
- 一次修超過 **3 個無關 bug**（拆開會話）
- 發明新規則。沒寫在 2026-09-19 系列修訂裡 → 停手問人類

**動 `App.tsx` 時**

- 寫 React state 後若**同一事件**還要讀它（傷王鋪格、輪末懲罰、結束回合），必須同步寫對應 `*Ref.current`（已有：`actorsRef`、`bossDeckRef`、`barrierAuraRef`、`tauntRestrictionRef`）。
- 反例：`setBarrierAura(aura)` 完立刻 `endTurn` → `finishRound` 讀 `barrierAuraRef`，沒寫 ref 就會在法師鄰 1 鋪懲罰。已修，不要改回。

---

## 2. 結構（最短）

```
core/     純 TS：hex → board → enclosure → combat → cards → turn（老化／威脅／難度）
ui/src/App.tsx     真正的對局循環（UI 不呼叫 createMatch／applyCommand）
ui/src/BoardCanvas.tsx  六角繪製／高亮／嘲諷彈窗
ui/src/Hand.tsx / cardHints.ts / cardFace.ts  手牌
docs/design-amendments.md  鎖定規則（由下往上讀 09-19）
```

`core/turn/match.ts` **UI 不用**。不要接它、不要刪它（除非人類要）。

測試：`npm test` → vitest 只收 `core/**/*.test.ts`。UI 沒有自動測試；改 glue 用 playtest 清單。

---

## 3. 已鎖定、不要改回去

詳見 `design-amendments.md` 2026-09-19／19b／19c。摘要：

| 主題 | 現況 |
|---|---|
| 行動序 | 可走完再出或先出再走；**禁止走→出→再走**。該角色一行動必須結束才能換人。結束自動切下一可行動者。 |
| 咒滿 | 槍／法 **2** 層、騎 **3** 層才鋪鄰封印，並**清身上咒層**。1 層只是「咒1」。 |
| 封印 | 六鄰皆擋（含詛咒地形）。封者不可走／出牌，唯一例外騎士手裡的**不死存在**。中途被封且沒有不死 → **本輪結束**；下輪仍封則**跳過**。 |
| 衝鋒 | 完整牆停下只破碎、0 傷；破碎續衝；**破壞老化牆**才 +1 王傷。 |
| 位面 | 計次。點牌後**選兩個**範圍內角色（可含自己，可換另外兩人），都選完才換。增幅距離 +1（3→4）。 |
| 嘲諷 | 隊友傷王鋪格前，騎士頭上「嘲諷／×」。不要勾選框。 |
| 屏障 | 出完強制結束。保護鄰 1 **含輪末懲罰格**。冷卻＝下一**自己**回合不能再出。 |
| 懲罰格 | **整輪無人有效傷王**、三人結束後，輪末鋪 2 格 punish。有傷王則不鋪。 |
| 狂妄 | 先推完，王才鋪格。 |
| 大招 | 可再打 1 張射擊，打完或結束放棄才結束回合。 |
| 代價移動 | **不做**。 |

牌面文案：`ui/src/cardHints.ts`。不要用 `docs/skill-copy.json`（舊稿）。

---

## 4. 已知陷阱（修 bug 前先搜）

1. **`setState` 後同 tick 讀 state** → 用 ref。`noteBossDamage`／`finishRound` 的屏障、嘲諷、actors、王牌庫都走 ref。
2. **Hand 封印**：`sealed={me.sealed && !me.sealImmuneThisRound}`。位面免疫時金環可能仍在（`actor.sealed`）但手牌可打——那是免疫，不是漏擋。
3. **可走洗色**：咒／沉默／懲罰／泥濘不要再鋪綠色可走 fill（咒格會看起來像兩種顏色）。
4. **結束回合「還可移動／出牌」**：已封印且沒有不死時 `canStillAct` 必須是 false（`sealedSkipsTurn`）。
5. **選人自動切**：`nextActionableId`／`firstActionableId` 要跳過封印且沒有不死的人。

---

## 5. 小 bug 候選（人類逐條丟，不要一次全做）

未完成、適合 grokbot 的：

1. **位面第一目標**沒有獨立標記（第二目標才是珊瑚紅）。建議：已選的第一人用另一色圈，避免以為沒選到。
2. **嘲諷彈窗**在畫布邊緣可能被裁切。
3. **README.md** 停在 09-13，跟現況不符。可改成短學習入口＋指向本檔與 09-19 修訂。不要在 README 發明規則。
4. **懸停 tooltip 1 秒**（`Hand.tsx`）vs 舊修訂寫 2 秒。改前問人類。
5. **日誌**最新在上、很長。可做摺疊，不要改結算。
6. **重製表單**仍擠。只排版，不要改預設數值。

不要做：拆 App、接 `core/turn/match`、教學、代價移動。

---

## 6. 驗收（ grokbot 自己先跑，人類再找檢核會話）

根目錄：

```
npm test
```

必須 13 files／215 tests 全過（數字若因你加測而增加，說明加了什麼）。

Playtest 最短清單（改到哪條就打哪條）：

- 槍／法踩 **1** 咒格 → 只有咒1，不鋪鄰、不封；第 2 層才咒滿並清咒層。
- 被封的槍／法不能出牌、不能走；結束回合**一次**就過，不要「還可移動／出牌」。
- 三人零傷、法師**最後**出屏障結束 → 輪末 2 懲罰**不得**落在淡藍保護鄰 1。
- 位面：先點槍手再點騎士 → 兩人對調、法師可不在其中。
- 完整一般格打一下 → 標「破碎」+ 裂痕；再打才清空。
- 槍手職業卡／棋子看得到 `傷n抽n推n`；法師增幅待用看得到「增幅」。

---

## 7. 給 grokbot 的回報格式

修完用這段回人類（檢核會話也看這個）：

```
修了：（一句）
檔案：
測試：npm test → N passed
playtest：做了／沒做哪些
沒動：App 大搬、半徑、御風詛咒、嘲諷勾選……
```

檢核會話（我）只看：diff 是否超出條目、規則有沒有被改回去、`npm test`、以及上面 playtest 有沒有漏。
