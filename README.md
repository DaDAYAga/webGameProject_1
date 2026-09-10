# web-game-project-1

六角格網頁遊戲專案（核心邏輯先行）。

## 目前進度

### core/hex（完成）

純函式的六角格幾何，採用 Red Blob Games 的 cube / axial 座標。
- 型別：Axial、Cube
- 向量：add / subtract / scale / equals
- 鄰居：neighbors（標準軸向 DIR，恰好 6 格）
- 距離：distance（立方距離）
- 縮距扇形 shrinkingFanCells：兩點間**純幾何**最短路徑廊道（不含障礙；繞牆請用 board/path）

此層不含棋盤、回合、戰鬥、卡牌、React UI、AI。

### core/board（完成）

地形放置層（handoff §12 step 2）：
- 開場：王 `(0,0)` 周圍距離 1 的 6 格預設 `plain_broken`+aged（難度選項可改完整 aged plain）
- 破碎／拆牆（plain → broken → 移除）
- 站格判定（不可站牆／王格等）
- 推牆（kind 允許時）
- **可站最短路徑** `shortestPath(board, from, toward, options?)`：BFS + `canStandAt`（起點不重驗；目標預設須可站）
- 輔助：`shortestPathLength`／`isOnShortestStandablePath`；廊道過濾 `standableShrinkingFanCells`（**非繞牆**，僅幾何扇形∩可站）
- 分層：`core/hex/shrinkingFanCells`＝純幾何；`core/board/path`＝看障礙的真實最短路徑
- 不含包圍、回合、戰鬥、卡牌、React

### core/enclosure（完成）

包圍／封印／出局（純函式）：
- `MapBounds`：`radius`（**UNRESOLVED/param**，建議測試用 `DEFAULT_MAP_RADIUS = 5`）或自訂 `isInMap`
- 阻擋：圖外、王格、`kindCountsForEnclosure` 地形；**玩家佔格不算**
- 六鄰皆擋 → 封印；已封印再壓本體格 → 出局
- 可選 `cannotAbsorbPlacements`：空格不足吸收多格放置時溢出訊號

不含回合、戰鬥、卡牌、React。

### core/turn（完成）

回合／對局 glue（handoff §12 step 4）：
- 自訂行動隊列；跳過封印／出局（不抽、不出）
- 行動者回合骨架：抽 1（stub）→ 移動點 ≤2 → 出 1 計次牌（旗標）→ `END_ACTOR_TURN`／`ADVANCE`
- 可行動者皆結束 → `RoundEnded`；`punishEnabled` 且本輪王傷 0 → `PunishPlace` 意圖（不在此層鋪格）
- 牆老化：`MatchState.aging` 計數；鋪設輪末登錄 0，再滿兩輪 → `WallAged`（開場／noAge 不進管線）

不含戰鬥結算、真實牌庫、React。

### core/combat（完成）

戰鬥純函式（design-amendments 2026-09-09b／開場 aged 傷王路徑）：
- 常數 `RANGED_SWEET_RADIUS = 3`
- 近戰打王本體：僅 `distance === 1` 有效
- 遠程（射擊／魔法箭）：任意距離；甜區 ≤3 完整傷，區外 −1；**無擋線 −1**；最低 1 ⇒ effective
- 預留 `ignoreRangePenalty`
- 拆老化 plain／plain_broken 傷王（`tileDestroyDamagesBoss`／`applyTerrainHit` → `BossDamaged`）
- 不含完整卡牌目錄、AI、React

### core/cards/knight（完成）

騎士 PVE 純函式結算（handoff §8；可調常數見 `constants.ts`）：
- **攻擊** `resolveKnightAttack`：計次；對王鄰 1 → 2 傷；對 plain 系 crack／destroy；不可指定 punish／curse
- **盾牌衝鋒** `resolveShieldCharge`：直線最多 2 格；撞牆／punish／王格規則；`curseStop` UNRESOLVED
- **堅定信仰** `resolveFaith`：未移動清自己 1 層詛咒；計次
- **護身** `resolveGuard`：直線友軍；完整牆／咒／懲／沉默擋視線；`plain_broken` 可穿；落到友軍旁可站格
- **奉獻** `resolveDevotion`：鄰 1 吸隊友詛咒；不計次；致死 → `UndyingExtracted`；不傷王
- **不死存在** `resolveUndying`：輪末復活；周圍破碎清空／完整改破碎；不傷王；奉獻同回合 defer

共用薄型別：`core/cards/types.ts`（`CardDefinition`／`CardKindTag`）。

### core/cards/gunner（完成）

槍手 PVE 純函式結算（handoff §9 + 遠程修訂；`constants.ts`）：
- **射擊**／**氣瓶**／裝填槽（合計 ≤2，射擊清槽）
- **大亂流** `resolveTurbulence`：棄最多 2 張氣瓶牌 → 走棄牌數+1；不穿破碎
- **Power UP!!** `resolvePowerUp`：須已移動；檢 2 射擊或臨時射擊（清槽、不可立刻氣瓶）
- **來吧! 大鬧一場!** `resolveBigShow`：未移動；不抽牌；免費超 cap 氣瓶；授予 mayPlayShot＋ignoreRange（出手上 1 射擊耗卡）

### core/cards/mage（完成）

法師 PVE 純函式結算（handoff §10；`constants.ts`）：
- **御風術**／**位面調換**／**魔法箭**（`amplified` 已銜接）
- **強能增幅** `resolveAmplify`：不計次；**不棄牌**；`amplifiedPending` 供下一張招
- **聚精會神** `resolveFocus`：抽 2（增幅 3）；不計次；強制結束回合
- **磁力屏障** `resolveBarrier`：本輪王不可鋪目標鄰 1；增幅寄出 dist≤3；下一回合不可再出屏障；計次（UNRESOLVED 預設）

不含牌庫 UI、React。

### ui/（薄手牌 + 六角 Canvas 棋盤 + 單位移動）

Vite + React + TS：
- **BoardCanvas**：flat-top 六角網；王 + 開場牆；畫單位「我」標記（`unitHex`）
- **移動 demo**：點鄰格且 `canStandAt` → 更新位置；牆／王格拒絕；遠格日誌「此 demo 一次只走鄰格」（非真實 AP／A*）
- 槍手／法師手牌；**射擊**／**魔法箭**以目前 `unitHex` 為 attacker（不再 hardcode）
- core 仍純 TS、無 React import

## 如何跑測試

安裝依賴後執行：

```bash
npm test
# 或
npx vitest run
```

## 薄 UI：手牌 + 棋盤 Canvas + 單位移動（完成）

`ui/` 為 Vite + React + TypeScript 薄殼：開場六角棋盤、單位一步鄰格移動、硬編碼手牌、點牌呼叫 core、事件日誌。
不含牌庫組建、AI、完整對局 loop、真實 AP／路徑尋路。

```bash
npm install
npm run dev    # Vite，預設 http://localhost:5173
npm run build  # 輸出 dist-ui/
```

試玩：開 `npm run dev` → 點單位鄰近空格移動 → 點「射擊」或「魔法箭」看 attacker 隨單位格變；點牆／王格／遠格看日誌拒絕。

學習入口：
1. `ui/src/BoardCanvas.tsx` — axial↔像素、開場牆、單位標記
2. `ui/src/App.tsx` — 鄰格移動 + `canStandAt`；點牌 → core（attacker = unitHex）

## 下一步

**balance 控制台**、騎士近戰 tab（僅鄰王可打）、或真實 AP／多步移動（handoff 後續）。不要一次做完整牌庫／AI／對局 loop。
