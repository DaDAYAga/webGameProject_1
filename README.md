# web-game-project-1

六角格網頁遊戲專案（核心邏輯先行）。

## 目前進度

### core/hex（完成）

純函式的六角格幾何，採用 Red Blob Games 的 cube / axial 座標。
- 型別：Axial、Cube
- 向量：add / subtract / scale / equals
- 鄰居：neighbors（標準軸向 DIR，恰好 6 格）
- 距離：distance（立方距離）
- 縮距扇形 shrinkingFanCells：兩點間最短路徑廊道

此層不含棋盤、回合、戰鬥、卡牌、React UI、AI。

### core/board（完成）

地形放置層（handoff §12 step 2）：
- 開場：王 `(0,0)` 周圍距離 1 的 6 格預設 `plain_broken`+aged（難度選項可改完整 aged plain）
- 破碎／拆牆（plain → broken → 移除）
- 站格判定（不可站牆／王格等）
- 推牆（kind 允許時）
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

### core/cards/knight（攻擊＋衝鋒完成）

騎士 PVE 純函式結算（handoff §8／§12 step 6）：
- **攻擊** `resolveKnightAttack`：計次；對王鄰 1 → 2 傷；對 plain 系 crack／destroy；不可指定 punish／curse；拆老化傷王
- **盾牌衝鋒** `resolveShieldCharge`：直線最多 2 格；撞未老化牆 → 停前格破碎並強制結束回合；撞老化牆 → 穿過拆掉＋王 1 傷＋結束回合；punish／王格不可進仍結束回合
- 詛咒截停：`curseStop: 'stop' | 'absorbMax1'`（**UNRESOLVED**，預設 `stop`）
- 信仰／護身／奉獻／不死：TODO stub 匯出 only

不含槍手／法師牌、牌庫 UI、React。

## 如何跑測試

安裝依賴後執行：

```bash
npm test
# 或
npx vitest run
```

## 下一步

實作 **槍手射擊＋裝填**（handoff §12 step 7；甜區／ammo 槽）。不要一次做 UI／完整牌庫。
