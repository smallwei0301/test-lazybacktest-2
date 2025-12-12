# GA4 下載追蹤遷移完成報告

> **Patch Tag**: LB-GA4-FRONTEND-DOWNLOAD-20251212A  
> **完成時間**: 2025-12-12T12:15:00+08:00

---

## 變更摘要

| 類型 | 檔案 | 變更 |
|------|------|------|
| **刪除** | `netlify/functions/price-inspector-download.js` | 完全移除 |
| **修改** | `public/app/js/backtest.js` | +100 行 / -90 行 |
| **修改** | `public/app/index.html` | UI 文案由 JS 動態覆寫 |

---

## GA4 事件參數對照表

### 事件名稱

| 英文名稱 | 中文說明 |
|----------|----------|
| `price_download` | 價格表下載事件 |

### 自訂參數（本專案設定）

| 英文欄位 | 中文說明 | 實際範例 |
|----------|----------|----------|
| `stock_no` | 股票代碼 | `2330`、`0050`、`AAPL` |
| `market` | 市場別 | `TWSE`（上市）、`TPEx`（上櫃）、`US`（美股） |
| `format` | 下載格式 | `csv`、`json` |
| `size_bytes` | 檔案大小（位元組） | `12345`（約 12 KB） |

### GA4 自動收集參數

| 英文欄位 | 中文說明 | 備註 |
|----------|----------|------|
| `ga_session_id` | GA 工作階段 ID | 識別單次瀏覽器訪問 |
| `ga_session_number` | 工作階段編號 | 該使用者第幾次工作階段 |
| `engagement_time_msec` | 互動時間（毫秒） | 使用者在頁面上的互動時長 |
| `page_location` | 頁面網址 | 觸發事件時的完整 URL |
| `page_referrer` | 來源頁面 | 使用者從哪個頁面進來 |
| `page_title` | 頁面標題 | 當前頁面的 `<title>` |
| `batch_ordering_id` | 批次排序 ID | GA4 內部批次處理用 |
| `batch_page_id` | 批次頁面 ID | GA4 內部批次處理用 |
| `ignore_referrer` | 忽略來源旗標 | GA4 內部處理，通常為 `true/false` |

### GA4 查詢方式

1. **即時檢視**：進入 Google Analytics → Reports → Realtime，篩選 Event Name = `price_download`
2. **歷史分析**：進入 Explore → Free Form，選擇維度 `stock_no`、`market`、`format`，可分析下載分布

---

## 實作內容

### 1. GA4 事件追蹤工具（含環境檢查）

```javascript
function isGtagAvailable() {
    return typeof window !== 'undefined' && typeof window.gtag === 'function';
}

function sendPriceDownloadEvent(params) {
    if (!isGtagAvailable()) {
        console.warn('[GA4] gtag 不可用，略過事件回報');
        return;
    }
    window.gtag('event', 'price_download', { ... });
}
```

### 2. 批次佇列模式

已實作 `enqueue` → `schedulePriceDownloadFlush` → `beforeunload`/`visibilitychange` 綁定，佇列上限 500 筆。

### 3. 參數轉換邏輯

```
stock_no   ← context.stockNo || 'N/A'
market     ← context.market || currentMarket || 'TWSE'
format     ← format || 'csv'
size_bytes ← Number(sizeBytes) || 0
```

---

## GA4_DOWNLOAD_MODE 開關說明

| 模式 | 說明 |
|------|------|
| `'single'` | 每次下載立即送 GA4（**預設**，事件完整性較高） |
| `'batch'` | 佇列事件，於頁面卸載時一次送出（事件可能略有流失） |

切換方式：修改 `backtest.js` 中的 `const GA4_DOWNLOAD_MODE = 'single';`

---

## 已知限制與行為改變

1. **GA 封鎖影響**：若使用者的瀏覽器封鎖 GA / gtag（廣告阻擋、隱私模式、內網防火牆等），該使用者的下載行為將**不會被統計**。

2. **Netlify Blobs 不再維護**：過去的 `totalDownloads` / `totalBytes` / `byFormat` / `lastEvents` 不再維護，站內即時統計 UI 已移除，下載趨勢請以 GA4 報表為準。

3. **批次模式限制**：`batch` 模式依賴 `beforeunload` / `visibilitychange`，在極端情況（瀏覽器崩潰、裝置瞬間斷電）仍可能有部分事件未送出。

---

## 驗證結果

| 檢查項目 | 結果 |
|----------|------|
| `price-inspector-download.js` 已刪除 | ✅ |
| `sendPriceDownloadEvent` 含 `isGtagAvailable()` 防護 | ✅ |
| 批次佇列含上限保護 (500 筆) | ✅ |

---

## 預期效益

| 指標 | 遷移前 | 遷移後 |
|------|--------|--------|
| 每次下載 | 1 次 POST | **0 次** |
| Serverless 月消耗 | ~1,000+ 次 | **0 次** |
