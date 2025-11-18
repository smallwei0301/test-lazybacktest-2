# 回測補齊邏輯優化 - 快速參考指南

**版本**：v11.8  
**更新日期**：2025-11-18  
**重點**：時間敏感的補齊決策 + 智能快取

---

## 🎯 核心改進（三大支柱）

### 1️⃣ 時間智能判斷

```
若最後資料為前一交易日：
  ├─ 台灣時間 >= 14:00  →  ✅ 補齊（快取 5 分鐘）
  └─ 台灣時間 <  14:00  →  ❌ 不補（資料未更新）

若最後資料 != 前一交易日：
  └─ 任何時間  →  ✅ 補齊（快取 1 小時）
```

### 2️⃣ 智能快取

```
快取鑰匙：`${stockNo}|${日期}`
補齊成功後記錄快取
同日期同股票，5分鐘-1小時內自動複用

預期效果：減少 70-90% 重複補齊 API 呼叫
```

### 3️⃣ 清晰的狀態區分

```
補齊成功   →  合併資料，快取結果
補齊失敗   →  標記「部分資料」，清楚的失敗日誌
被跳過     →  告知用戶為什麼跳過（時間/資料現況）
```

---

## 📝 新增函數一覽

| 函數 | 功能 | 用途 |
|------|------|------|
| `getCurrentTWHour()` | 取得台灣時區小時數 | 判斷是否超過下午 2 點 |
| `isTWTradingDay(date)` | 判斷是否台灣交易日 | 確認周一至周五 |
| `getPreviousTWTradingDay(date)` | 取得前一交易日 | 比較最後資料是否為前交易日 |
| `shouldPatchCurrentMonthGap()` | **主決策函數** | 決定是否補齊 + TTL |
| `recordPatchAttempt()` | 記錄補齊到快取 | 後續複用 |
| `getPatchAttemptFromCache()` | 讀取快取結果 | 避免重複補齊 |
| `isPatchCacheSuspended()` | 檢查快取是否有效 | 輔助判斷 |

---

## 🔍 關鍵決策函數說明

### `shouldPatchCurrentMonthGap(stockNo, lastDataISO, targetEndISO)`

**輸入**：
- `stockNo`：股票代碼（如 "2330"）
- `lastDataISO`：最後一筆資料的日期 (YYYY-MM-DD)
- `targetEndISO`：目標結束日期（通常是當日）

**輸出**：
```javascript
{
  shouldPatch: boolean,        // true=應補齊, false=跳過
  reason: string,              // 決策理由
  cacheTTL: number            // 快取有效期(毫秒) 0=不快取
}
```

**決策邏輯**：
```
1. 若 lastData >= targetEnd → { shouldPatch: false, reason: 'data-up-to-date' }
2. 計算前一交易日 prevTradingDay
3. 若 lastData === prevTradingDay
   - 若 TW時間 >= 14:00 → { shouldPatch: true, reason: 'after-2pm-can-fetch-today-data', TTL: 5分 }
   - 若 TW時間 <  14:00 → { shouldPatch: false, reason: 'before-2pm-data-not-updated-yet', TTL: 0 }
4. 若 lastData !== prevTradingDay → { shouldPatch: true, reason: 'missing-previous-trading-day-data', TTL: 1小時 }
```

---

## 📊 API 呼叫減少效果預測

### 單個使用者場景

| 場景 | 原始呼叫 | 優化後 | 改進 |
|------|---------|--------|------|
| 單次回測 | 1 | 1 | - |
| 5 分鐘內重複補齊 | 5 | 1 | ✅ 80% 減少 |
| 同時 5 個回測 | 5 | 1 | ✅ 80% 減少 |

### 每日系統級別

| 指標 | 值 |
|------|-----|
| 日均使用者 | 50 |
| 平均回測/人/天 | 10 |
| 含補齊的回測比例 | 30% |
| **原始日均補齊呼叫** | 1,500 |
| **優化後日均補齊呼叫** | 300-450 |
| **日均減少** | 1,050-1,200 呼叫 |
| **改進比例** | **70-80%** |

---

## 🚀 使用示例

### 場景 1：下午 3 點執行回測（最後資料為前交易日）

```javascript
// worker.js 內部流程
const decision = shouldPatchCurrentMonthGap('2330', '2025-11-17', '2025-11-18');
// 返回 {
//   shouldPatch: true,
//   reason: 'after-2pm-can-fetch-today-data',
//   cacheTTL: 300000
// }

// 檢查快取
const cached = getPatchAttemptFromCache('2330', '2025-11-18');
if (cached) {
  // ✅ 使用快取結果
  console.log('[Worker] 補齊快取命中 (2330|2025-11-18, TTL: 300000ms)');
} else {
  // 執行補齊 API
  const result = await fetchCurrentMonthGapPatch({...});
  recordPatchAttempt('2330', '2025-11-18', result, 300000);
}
```

### 場景 2：下午 1 點執行回測（最後資料為前交易日）

```javascript
const decision = shouldPatchCurrentMonthGap('2330', '2025-11-17', '2025-11-18');
// 返回 {
//   shouldPatch: false,
//   reason: 'before-2pm-data-not-updated-yet',
//   cacheTTL: 0
// }

// ✅ 跳過補齊
console.log('[Worker] 當前台灣時間未過下午2點 (14:00)，官方資料未更新，使用現有資料。');
// 使用現有資料繼續回測
```

### 場景 3：最後資料為 2 天前

```javascript
const decision = shouldPatchCurrentMonthGap('2330', '2025-11-14', '2025-11-18');
// 返回 {
//   shouldPatch: true,
//   reason: 'missing-previous-trading-day-data',
//   cacheTTL: 3600000
// }

// 執行補齊，快取 1 小時
const result = await fetchCurrentMonthGapPatch({...});
recordPatchAttempt('2330', '2025-11-18', result, 3600000);
```

---

## ⏱️ 時間判斷邏輯深入

### 為什麼下午 2 點 (14:00) 是分界點？

台灣股市交易時間：
- **開盤**：上午 9:00
- **收盤**：下午 1:30
- **官方數據發佈**：下午 2:00-2:30 左右

因此：
- 下午 2 點前：官方還在處理數據，補齊會失敗 → ❌ 不補
- 下午 2 點後：官方已發佈，補齊有希望成功 → ✅ 可補

### 為什麼要區分「前交易日」和「更早資料」？

| 情況 | 含義 | 行動 |
|------|------|------|
| 最後資料 = 前交易日 | 資料幾乎最新，可能只缺一天 | 根據時間判斷（下午 2 點） |
| 最後資料 ≠ 前交易日 | 缺少多天資料，可能是異常 | 立即補齊，無時間限制 |

---

## 🔧 配置調整

### 改變下午 2 點的門檻

```javascript
// worker.js 行 489
const TW_AFTERNOON_CUTOFF_HOUR = 14;  // 改為 15 = 下午 3 點
```

### 改變快取有效期

```javascript
// worker.js 行 477-478
const PATCH_CACHE_TTL_SAME_DAY_MS = 5 * 60 * 1000;  // 改為 10 * 60 * 1000 = 10 分鐘
const PATCH_CACHE_TTL_MISSING_TRADE_MS = 60 * 60 * 1000;  // 改為 120 * 60 * 1000 = 2 小時
```

### 禁用快取（測試用）

```javascript
// 在 shouldPatchCurrentMonthGap() 返回後
if (shouldPerformPatch) {
  // 注釋快取檢查
  // const cachedPatchResult = getPatchAttemptFromCache(stockNo, gapDateISO);
  
  // 總是執行補齊
  const patchResult = await fetchCurrentMonthGapPatch({...});
}
```

---

## 📈 監控重點

### 應監控的指標

```javascript
// 在 DevTools Console 中觀察
[Worker] 補齊快取命中    // ✅ 表示快取有效，減少 API 呼叫
[Worker] 當月補齊被跳過   // ✅ 表示時間判斷有效
[Worker] 當月補齊未成功    // ⚠️  表示補齊失敗，使用部分資料

// API Network 請求
/api/twse/...            // 補齊 API 呼叫次數（應大幅減少）
/.netlify/functions/stock-range  // Blob 快取請求
```

### 效能基準線

| 指標 | 期望值 |
|------|--------|
| 單次回測補齊時間 | < 500ms |
| 快取命中率（同日多次） | > 90% |
| 日均補齊 API 呼叫減少 | 70-80% |
| 整體回測速度改善 | 5-10% |

---

## ⚙️ 故障排查速查表

| 問題 | 檢查項目 | 解決方法 |
|------|---------|---------|
| 快取不工作 | `patchAttemptCache` Map 是否初始化 | 確保全局變數在行 475 正確初始化 |
| 時間判斷錯誤 | `getCurrentTWHour()` 返回值 | 檢查 UTC+8 轉換公式 |
| 補齊被無限重試 | 檢查 shouldPatchCurrentMonthGap 邏輯 | 確保 cacheTTL > 0 |
| 日誌看不到新訊息 | 檢查快取是否命中 | 清空 `patchAttemptCache.clear()` 重試 |
| 跨交易日邊界錯誤 | `getPreviousTWTradingDay` 返回值 | 確保考慮周末 |

---

## 📞 聯絡和支援

### 代碼位置速查

| 功能 | 檔案 | 行數 |
|------|------|------|
| 全局常數 | worker.js | 475-489 |
| 新增函數 | worker.js | 2347-2490 |
| 補齊調用 | worker.js | 5142-5249 |
| 狀態判斷 | worker.js | 5278-5330 |

### 相關文檔

- 📄 `PATCH_LOGIC_OPTIMIZATION_2025-11-18.md` - 完整優化報告
- 📋 `PATCH_LOGIC_OPTIMIZATION_TEST_CHECKLIST.md` - 測試驗證清單

---

## 🎓 理解決策流程圖

```
┌─────────────────────────────────────────┐
│  檢測到當月資料缺失                      │
└────────────┬────────────────────────────┘
             │
             ↓
┌─────────────────────────────────────────┐
│  shouldPatchCurrentMonthGap()             │
│  決定是否應補齊 + TTL                    │
└────────────┬────────────────────────────┘
             │
     ┌───────┴───────┐
     ↓               ↓
  (是)            (否)
     │               │
     ↓               ↓
  快取檢查    跳過補齊，記錄原因
     │               │
  ┌──┴──┐          │
  ↓     ↓          ↓
 (命中)(未命中)     │
  │     │          │
  ↓     ↓          ↓
複用  新補齊   繼續回測
 │     │
 └─────┼─────────┐
       ↓         ↓
   (成功)      (失敗)
     │           │
     ↓           ↓
  合併數據   部分數據
   快取結果   標記失敗
     │           │
     └─────┬─────┘
           ↓
       回測繼續
```

---

## ✨ 總結

此次優化通過以下三個層面改進回測資料補齊邏輯：

1. **⏰ 時間智能化**：根據台灣時區和交易時間決定補齊策略
2. **💾 快取優化**：同日期同股票 5-60 分鐘內複用補齊結果
3. **📊 狀態清晰化**：區分「待更新」「補齊中」「補齊失敗」「使用部分資料」

**預期收益**：
- API 呼叫減少 70-90%
- 回測速度提升 5-10%
- 用戶體驗明顯改善

---

**最後更新**：2025-11-18  
**版本**：v11.8  
**狀態**：✅ 已完成實施，待測試驗證  
