# web-game-project-1

六角格網頁遊戲專案（核心邏輯先行）。

## 目前進度：core/hex

純函式的六角格幾何，採用 Red Blob Games 的 cube / axial 座標。
- 型別：Axial、Cube
- 向量：add / subtract / scale / equals
- 鄰居：neighbors（標準軸向 DIR，恰好 6 格）
- 距離：distance（立方距離）
- 縮距扇形 shrinkingFanCells：兩點間最短路徑廊道

此層不含棋盤、回合、戰鬥、卡牌、React UI、AI。

### 端點預設

shrinkingFanCells 預設不含起點、不含終點（只要兩者之間的廊道）。
可用 includeOrigin / includeTarget 調整。

## 如何跑測試

安裝依賴後執行 package.json 的 test 腳本（vitest run）。

## 下一步

實作 core/board（棋盤資料結構）。React UI 會更後面才接上。
