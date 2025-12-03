# 實作計畫：客戶端動態分流請求 (Client-Side Request Splitting) - IDB Alignment

## 1. 目標 (Goal)
將 `worker.js` 中的 `tryFetchRangeFromBlob` 請求邏輯進行拆分，**嚴格參照 IndexedDB 的資料區分方式** (Year Superset vs Current Cache)。
*   **歷史區間 (Historical)**：對應 IDB 的 `Year Superset` (年度資料桶)。範圍為 `起始日` ~ `去年 12/31`。
*   **當前區間 (Current)**：對應 IDB 的 `stock_cache` (當月/近期)。範圍為 `今年 01/01` ~ `結束日`。

## 2. 核心策略 (Strategy)

### 2.1 切分點計算 (The Split)
*   **基準**：`Current Year` (今年)。
*   **切分日**：`LastYear-12-31`。
*   **邏輯**：
    *   任何早於或等於 `LastYear-12-31` 的請求，視為 **Historical (Immutable)**。
    *   任何晚於 `LastYear-12-31` 的請求，視為 **Current (Mutable)**。

### 2.2 拆分執行 (Execution)
當請求範圍 (`startDate` ~ `endDate`) 跨越 `LastYear-12-31` 時，拆分為兩個並行請求：

1.  **請求 A (Historical / Year Superset)**
    *   **範圍**：`startDate` ~ `LastYear-12-31`
    *   **特性**：`endDate < Today`
    *   **Server 行為**：`stock-range.js` 回傳 `Cache-Control: max-age=31536000` (1年)。
    *   **對應 IDB**：此段資料完美對應 IDB 的 `Year Superset` 結構 (完整年度)。

2.  **請求 B (Current / Monthly)**
    *   **範圍**：`CurrentYear-01-01` ~ `endDate`
    *   **特性**：`endDate >= Today`
    *   **Server 行為**：`stock-range.js` 回傳 `Cache-Control: max-age=3600` (1小時)。
    *   **對應 IDB**：此段資料對應 IDB 的 `stock_cache` (變動資料)。

## 3. 實作細節 (Implementation Details)

### 3.1 修改 `worker.js` -> `tryFetchRangeFromBlob`

```javascript
// 1. 計算切分點
const today = new Date();
const currentYear = today.getFullYear();
const splitDateStr = `${currentYear - 1}-12-31`;

// 2. 判斷是否跨越切分點
if (startDate <= splitDateStr && endDate > splitDateStr) {
    console.log(`[Worker] 執行請求分流: 歷史(${startDate}~${splitDateStr}) + 當前(${currentYear}-01-01~${endDate})`);
    
    // 3. 並行請求
    const [histResult, currResult] = await Promise.all([
        fetchRange(startDate, splitDateStr), // Hit 1-Year Cache
        fetchRange(`${currentYear}-01-01`, endDate) // Hit 1-Hour Cache
    ]);

    // 4. 合併結果
    // 合併 aaData, 處理 diagnostics
    return mergeResults(histResult, currResult);
} else {
    // 未跨越，維持單一請求
    return fetchRange(startDate, endDate);
}
```

## 4. 預期效益 (Benefits)

1.  **極致快取 (CDN Maximization)**：
    *   歷史資料 (佔比 80%+) 將永久命中 CDN，**每日測試零流量**。
    *   僅當年度資料 (佔比 <20%) 需每日更新。
2.  **架構一致性 (Architectural Alignment)**：
    *   請求分界線與 IDB 的 `Year Superset` (歷史) 和 `stock_cache` (當前) 分界線完全一致。
    *   未來若要將 Blob 資料直接寫入 IDB Year Superset，此拆分已做好準備。

## 5. 驗證計畫 (Verification)
*   **測試案例**：2330 (2020-01-01 ~ 2025-12-03)
*   **預期 Log**：
    *   `[Worker] 執行請求分流: 歷史(2020-01-01~2024-12-31) + 當前(2025-01-01~2025-12-03)`
    *   檢查 Network Tab：應有兩個 `stock-range` 請求。
        *   請求 1 (歷史)：Status 200 (from disk cache / CDN)
        *   請求 2 (當前)：Status 200 (from network / CDN 1hr)
