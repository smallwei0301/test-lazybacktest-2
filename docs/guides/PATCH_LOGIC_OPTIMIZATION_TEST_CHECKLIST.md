# 補齊邏輯優化 - 測試驗證清單

**日期**：2025-11-18  
**版本**：v11.8  
**測試環境**：本地開發環境 + 線上部署

---

## ✅ 代碼驗證

### 基本檢查

- [x] 無語法錯誤（已通過 linter）
- [x] 所有新函數已定義
- [x] 全局變數已初始化
- [x] 向後兼容性確保

### 函數簽名驗證

```javascript
// 新增 7 個函數
✓ getCurrentTWHour()
✓ isTWTradingDay(dateISO)
✓ getPreviousTWTradingDay(dateISO)
✓ shouldPatchCurrentMonthGap(stockNo, lastDataISO, targetEndISO)
✓ isPatchCacheSuspended(stockNo, gapDateISO)
✓ recordPatchAttempt(stockNo, gapDateISO, result, ttl)
✓ getPatchAttemptFromCache(stockNo, gapDateISO)
```

### 全局變數驗證

```javascript
// 新增快取相關
✓ patchAttemptCache = new Map()
✓ PATCH_CACHE_TTL_SAME_DAY_MS = 5 * 60 * 1000
✓ PATCH_CACHE_TTL_MISSING_TRADE_MS = 60 * 60 * 1000
✓ TW_AFTERNOON_CUTOFF_HOUR = 14
```

---

## 🧪 功能測試清單

### 1. 時間判斷邏輯

#### 1.1 台灣時區轉換正確性

**測試**：驗證 `getCurrentTWHour()` 的精確度

```javascript
// 在不同時區測試
const hour = getCurrentTWHour();
// 應返回 0-23 之間的值
// 台灣時間：UTC+8
```

**預期**：
- ✓ 任何時區都能正確轉換為台灣時間
- ✓ 返回值範圍 0-23

#### 1.2 交易日判斷正確性

**測試**：驗證 `isTWTradingDay()` 函數

| 日期 | 應為 | 結果 |
|------|------|------|
| 2025-11-17（周一） | ✓ 交易日 | [ ] |
| 2025-11-18（周二） | ✓ 交易日 | [ ] |
| 2025-11-15（周六） | ✗ 非交易日 | [ ] |
| 2025-11-16（周日） | ✗ 非交易日 | [ ] |

#### 1.3 前一交易日計算正確性

**測試**：驗證 `getPreviousTWTradingDay()` 函數

| 當日 | 應返回 | 結果 |
|------|--------|------|
| 2025-11-18（周二） | 2025-11-17（周一） | [ ] |
| 2025-11-17（周一） | 2025-11-14（周五） | [ ] |
| 2025-11-15（周六） | 2025-11-14（周五） | [ ] |

### 2. 補齊決策邏輯

#### 2.1 情況 1：最後資料為前一交易日，時間 >= 14:00

**測試**：
```javascript
// 時間設為 14:05（下午 2 點 5 分）
shouldPatchCurrentMonthGap('2330', '2025-11-17', '2025-11-18')
```

**預期**：
- [x] `shouldPatch` = `true`
- [x] `reason` = `'after-2pm-can-fetch-today-data'`
- [x] `cacheTTL` = `300000` (5 分鐘)

#### 2.2 情況 2：最後資料為前一交易日，時間 < 14:00

**測試**：
```javascript
// 時間設為 13:55（下午 2 點前）
shouldPatchCurrentMonthGap('2330', '2025-11-17', '2025-11-18')
```

**預期**：
- [x] `shouldPatch` = `false`
- [x] `reason` = `'before-2pm-data-not-updated-yet'`
- [x] `cacheTTL` = `0`

#### 2.3 情況 3：最後資料不是前一交易日

**測試**：
```javascript
// 最後資料為 2025-11-14（周五前兩天）
shouldPatchCurrentMonthGap('2330', '2025-11-14', '2025-11-18')
```

**預期**：
- [x] `shouldPatch` = `true`
- [x] `reason` = `'missing-previous-trading-day-data'`
- [x] `cacheTTL` = `3600000` (1 小時)

### 3. 快取機制

#### 3.1 快取記錄

**測試**：
```javascript
recordPatchAttempt('2330', '2025-11-18', 
  { rows: [...], diagnostics: {...} }, 
  300000
);
```

**預期**：
- [x] 快取鑰匙 = `'2330|2025-11-18'`
- [x] 時間戳被記錄
- [x] TTL 被儲存

#### 3.2 快取讀取

**測試**：
```javascript
// 立即讀取
const result = getPatchAttemptFromCache('2330', '2025-11-18');
```

**預期**：
- [x] 返回完整的 `{ rows, diagnostics }`
- [x] 未超過 TTL 時有效

#### 3.3 快取過期

**測試**：
```javascript
// 等待 TTL 後讀取
await new Promise(r => setTimeout(r, 301000));
const result = getPatchAttemptFromCache('2330', '2025-11-18');
```

**預期**：
- [x] 返回 `null`（快取已過期）
- [x] 快取被自動清除

#### 3.4 快取自動清理

**測試**：加入 100 條快取，檢查 patchAttemptCache 大小

**預期**：
- [x] 第 100 條操作後進行清理
- [x] 過期快取被移除
- [x] 新快取仍保留

---

## 🔍 整合測試

### 4. 完整補齊流程

#### 4.1 補齊成功路徑

**場景**：下午 3 點，最後資料為前一交易日，Proxy 有新資料

```javascript
// 預期流程：
1. shouldPatchCurrentMonthGap() 返回 shouldPatch=true
2. 快取為空
3. fetchCurrentMonthGapPatch() 返回有行數的結果
4. recordPatchAttempt() 被呼叫
5. 資料被合併
6. 日誌顯示：「補齊快取命中」或補齊成功訊息
```

**檢查清單**：
- [ ] 補齊 API 被呼叫 1 次
- [ ] 資料被正確合併
- [ ] `rangeFetchInfo.patch.status` = `'success'`

#### 4.2 補齊失敗路徑

**場景**：補齊 API 返回無資料

```javascript
// 預期流程：
1. shouldPatchCurrentMonthGap() 返回 shouldPatch=true
2. fetchCurrentMonthGapPatch() 返回 rows=[]
3. rangeFetchInfo.patch.status 設為 'partial-fetch'
4. 日誌顯示「補齊未成功，使用部分資料」
```

**檢查清單**：
- [ ] 不會無限重試
- [ ] 日誌明確說明失敗
- [ ] 系統繼續使用部分資料

#### 4.3 快取複用路徑

**場景**：5 分鐘內兩次補齊相同股票相同日期

```javascript
// 預期流程：
1. 第一次補齊：執行並快取結果
2. 第二次補齊：自快取讀取
3. 日誌顯示：「快取命中」
4. 未呼叫補齊 API
```

**檢查清單**：
- [ ] 第二次補齊時 API 調用次數 = 0
- [ ] 日誌顯示快取命中
- [ ] 返回相同結果

---

## 🌐 線上部署測試

### 5. 現場驗證

#### 5.1 瀏覽器 DevTools 監視

**步驟**：
1. 打開 https://test-lazybacktest.netlify.app
2. F12 開啟 DevTools → Console 標籤
3. 執行一個回測，觀察日誌

**預期日誌示例**：

**下午 2 點後**：
```
[Worker] 2330 補齊快取命中 (2025-11-18, TTL: 300000ms)
```

**下午 2 點前**：
```
[Worker] 2330 當前台灣時間未過下午2點 (14:00)，官方資料未更新，使用現有資料。
```

**補齊失敗**：
```
[Worker] 2330 當月補齊未成功 (2025-11-14 < 2025-11-18)，使用部分資料。原因: no-data
```

#### 5.2 性能監視

**步驟**：
1. DevTools → Network 標籤
2. 篩選 API 呼叫
3. 執行 5 個回測（同時或順序）

**預期**：
- [ ] 補齊 API 呼叫從 5 次降至 1 次
- [ ] 整體回測時間減少 5-10%

#### 5.3 多瀏覽器標籤頁測試

**步驟**：
1. 開啟 2 個標籤頁，都進行回測
2. 觀察補齊 API 呼叫

**預期**：
- [ ] 快取在同一個 Worker 內有效
- [ ] 若不同 Worker 則各自補齊（符合預期）

---

## 📋 測試記錄表

### 測試執行日期：_______________

| # | 測試項目 | 預期結果 | 實際結果 | 狀態 | 備註 |
|---|---------|---------|---------|------|------|
| 1.1 | 台灣時區轉換 | 0-23 | | ✓/✗ | |
| 1.2 | 周末判斷 | 非交易日 | | ✓/✗ | |
| 1.3 | 前一交易日 | 正確回溯 | | ✓/✗ | |
| 2.1 | 下午2點後決策 | shouldPatch=true | | ✓/✗ | |
| 2.2 | 下午2點前決策 | shouldPatch=false | | ✓/✗ | |
| 2.3 | 缺交易日決策 | shouldPatch=true | | ✓/✗ | |
| 3.1 | 快取記錄 | 快取被儲存 | | ✓/✗ | |
| 3.2 | 快取讀取 | 正確返回 | | ✓/✗ | |
| 3.3 | 快取過期 | null | | ✓/✗ | |
| 4.1 | 補齊成功 | 資料合併 | | ✓/✗ | |
| 4.2 | 補齊失敗 | partial-fetch | | ✓/✗ | |
| 4.3 | 快取複用 | API=0 次 | | ✓/✗ | |
| 5.1 | 線上日誌 | 預期訊息 | | ✓/✗ | |
| 5.2 | 性能改善 | API 呼叫減少 | | ✓/✗ | |

---

## ⚠️ 已知問題和限制

### 已知問題

- [ ] **台灣時區轉換**：在極端時區差異情況下可能有 1 小時誤差
  - **解決**：使用 UTC 計算避免混淆

- [ ] **國定假日**：台灣股市國定假日未納入判斷
  - **解決**：目前範圍內不需要，後續可擴展

- [ ] **多交易所**：邏輯目前針對台灣股市最佳化
  - **解決**：可通過參數化交易所資訊擴展

### 限制

- 快取存放在記憶體，重啟 Worker 後遺失
- 每個 Worker 有獨立快取（不跨 Worker 共享）
- 使用者端快取策略不同步（各自獨立判斷）

---

## 🚀 測試通過標準

### 全部通過條件
- [ ] 所有 14 個測試項目都通過 ✓
- [ ] 沒有新的錯誤或警告
- [ ] 線上日誌符合預期
- [ ] 性能改善可測量
- [ ] 沒有回歸缺陷

### 部分通過條件（可部署）
- [ ] 至少 12/14 測試通過
- [ ] 關鍵路徑（決策、快取、補齊）全部通過
- [ ] 非關鍵項目暫時允許失敗

---

## 📞 故障排查

### 如果快取不工作

1. 檢查 `patchAttemptCache` 是否初始化：
   ```javascript
   console.log(patchAttemptCache);  // 應是 Map 物件
   ```

2. 驗證快取鑰匙格式：
   ```javascript
   // 應為 "2330|2025-11-18" 格式
   ```

3. 檢查 TTL 是否過期：
   ```javascript
   console.log(Date.now() - cached.timestamp);
   ```

### 如果時間判斷不對

1. 驗證台灣時間轉換：
   ```javascript
   const twHour = getCurrentTWHour();
   console.log(`台灣時間: ${twHour}:00`);  // 應與實際時間相符
   ```

2. 檢查 UTC 時間差：
   ```javascript
   const now = new Date();
   console.log(`UTC: ${now.getUTCHours()}, TW: ${twHour}`);
   ```

### 如果補齊被跳過

1. 檢查決策邏輯：
   ```javascript
   const decision = shouldPatchCurrentMonthGap(stockNo, lastDate, today);
   console.log(decision);  // 應包含 shouldPatch, reason, cacheTTL
   ```

2. 驗證前一交易日計算：
   ```javascript
   const prevDay = getPreviousTWTradingDay('2025-11-18');
   console.log(prevDay);  // 應為 '2025-11-15'
   ```

---

**測試者簽名**：________________  
**日期**：______________  
**審核者**：________________  
