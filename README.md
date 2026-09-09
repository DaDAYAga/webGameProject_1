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
- 開場：王 `(0,0)` 周圍 6 格 `plain_starter`（不老化）
- 破碎／拆牆（plain → broken → 移除）
- 站格判定（不可站牆／王格等）
- 推牆（kind 允許時）
- 不含包圍、回合、戰鬥、卡牌、React

## 如何跑測試

安裝依賴後執行：

```bash
npm test
# 或
npx vitest run
```

## 下一步

實作 **core/enclosure**（包圍／封印）。不要一次做 turn／combat／UI。
