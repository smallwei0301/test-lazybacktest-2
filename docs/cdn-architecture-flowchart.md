# LazyBacktest CDN 架構與資料流向圖

> **版本**: LB-CDN-ARCH-20251209A
> **目的**: 說明台股與美股的 CDN 功能架構與資料流向

---

## 一、系統架構總覽

```mermaid
flowchart TB
    subgraph Client["🖥️ 客戶端 (瀏覽器)"]
        UI["回測介面"]
        Worker["Web Worker"]
        IDB["IndexedDB<br>(Year Superset)"]
        Memory["記憶體快取"]
    end
    
    subgraph CDN["🌐 Netlify CDN 層"]
        CDNL["CDN Edge Cache<br>s-maxage=3600~31536000"]
    end
    
    subgraph Functions["⚡ Netlify Functions (Serverless)"]
        StockRange["stock-range.js<br>(年度快取彙整)"]
        TWSEProxy["twse-proxy.js<br>(台股 TWSE/TPEX)"]
        USProxy["us-proxy.js<br>(美股)"]
        TPEXProxy["tpex-proxy.js<br>(上櫃)"]
    end
    
    subgraph Blob["💾 Netlify Blobs Storage"]
        YearCache["Year Cache Store<br>(stock_year_cache_store)"]
        TWSECache["TWSE Cache Store<br>(twse_cache_store)"]
        TPEXCache["TPEX Cache Store<br>(tpex_cache_store)"]
        USCache["US Price Store<br>(us_price_store)"]
    end
    
    subgraph External["🌍 外部資料來源"]
        TWSE["證交所 TWSE API"]
        TPEX["櫃買中心 TPEX API"]
        FinMind["FinMind API"]
        Yahoo["Yahoo Finance API"]
    end
    
    UI --> Worker
    Worker --> Memory
    Worker --> IDB
    Worker --> CDNL
    CDNL --> StockRange
    CDNL --> TWSEProxy
    CDNL --> USProxy
    CDNL --> TPEXProxy
    
    StockRange --> YearCache
    TWSEProxy --> TWSECache
    TPEXProxy --> TPEXCache
    USProxy --> USCache
    
    TWSEProxy --> TWSE
    TWSEProxy --> FinMind
    TWSEProxy --> Yahoo
    TPEXProxy --> Yahoo
    TPEXProxy --> FinMind
    USProxy --> FinMind
    USProxy --> Yahoo
```

---

## 二、台股資料流向圖

### 2.1 台股完整流程圖

```mermaid
flowchart TD
    subgraph 請求階段
        A["用戶發起回測請求<br>(股號、日期範圍)"]
        B["Worker 計算查詢範圍"]
        C{"IndexedDB<br>Year Superset<br>命中?"}
    end
    
    subgraph 本地快取層
        D["使用本地快取資料"]
        E["計算缺口範圍"]
    end
    
    subgraph CDN層["CDN 層"]
        F["Worker 呼叫 stock-range.js"]
        G{"Netlify CDN<br>Edge Cache<br>命中?"}
        H["CDN 回傳快取<br>TTL: 歷史=1年, 當前=1小時"]
    end
    
    subgraph Blob層["Netlify Blob 層"]
        I["stock-range 讀取<br>Year Cache Store"]
        J{"Blob Year Cache<br>命中?"}
        K["Blob 回傳年度資料"]
    end
    
    subgraph Proxy層["Proxy 層"]
        L["呼叫 twse-proxy.js"]
        M["讀取 TWSE Cache Store"]
        N{"月度快取<br>命中?"}
        O["TWSE 月度快取命中"]
    end
    
    subgraph 外部API["外部 API 層"]
        P["呼叫證交所 TWSE API"]
        Q{"TWSE 成功?"}
        R["FinMind 備援"]
        S["Yahoo Finance 備援"]
    end
    
    subgraph 回存階段
        T["寫入月度快取"]
        U["觸發 Year Cache 重建"]
        V["回存 IndexedDB"]
        W["回傳給 Worker"]
    end
    
    A --> B --> C
    C -->|是| D
    C -->|否| E --> F --> G
    G -->|是| H --> W
    G -->|否| I --> J
    J -->|是| K --> W
    J -->|否| L --> M --> N
    N -->|是| O --> W
    N -->|否| P --> Q
    Q -->|是| T --> U --> W
    Q -->|否| R --> T
    R -.->|失敗| S --> T
    W --> V
```

### 2.2 台股資料來源優先級

```mermaid
flowchart LR
    subgraph Primary["主要來源"]
        A["1️⃣ TWSE 證交所<br>(上市股票)"]
    end
    
    subgraph Fallback["備援來源"]
        B["2️⃣ FinMind API<br>(TWSE 失敗時)"]
        C["3️⃣ Yahoo Finance<br>(僅限還原價格)"]
    end
    
    A -->|失敗| B
    B -->|失敗| C
```

### 2.3 台股快取層級與 TTL

| 快取層級 | 儲存位置 | TTL (存活時間) | 說明 |
|---------|---------|---------------|------|
| **L1: 記憶體快取** | Worker 變數 | 單次回測 | 最快存取，單次請求內有效 |
| **L2: IndexedDB** | 瀏覽器本地 | 永久 (帶版本) | Year Superset，跨回測持久化 |
| **L3: CDN Edge** | Netlify CDN | 歷史=1年, 當前=1hr | CDN 邊緣快取 |
| **L4: Blob Year Cache** | Netlify Blobs | 2-3 天 | 年度彙總資料 |
| **L5: Blob Month Cache** | Netlify Blobs | 24 小時 | 月度原始資料 |

---

## 三、美股資料流向圖

### 3.1 美股完整流程圖

```mermaid
flowchart TD
    subgraph 請求階段["請求階段"]
        A["用戶發起美股回測<br>(如 AAPL、MSFT)"]
        B["Worker 識別美股代號"]
        C["呼叫 us-proxy.js"]
    end
    
    subgraph CDN層["CDN 層"]
        D{"Netlify CDN<br>Edge Cache<br>命中?"}
        E["CDN 回傳快取"]
    end
    
    subgraph Cache層["Netlify Blob 層"]
        F["讀取 us_price_store"]
        G{"Memory Cache<br>命中?"}
        H["記憶體快取回傳"]
        I{"Blob Cache<br>命中?"}
        J["Blob 快取回傳"]
    end
    
    subgraph API層["外部 API 層"]
        K["呼叫 FinMind<br>USStockPrice"]
        L{"FinMind 成功且<br>有資料?"}
        M["回傳 FinMind 資料"]
        N["呼叫 Yahoo Finance<br>備援"]
        O{"Yahoo 成功?"}
        P["回傳 Yahoo 資料"]
        Q["雙來源皆失敗<br>回傳錯誤"]
    end
    
    subgraph 回存階段["回存階段"]
        R["寫入 Memory + Blob"]
        S["設定 CDN Header<br>s-maxage"]
    end
    
    A --> B --> C --> D
    D -->|是| E
    D -->|否| F --> G
    G -->|是| H
    G -->|否| I
    I -->|是| J
    I -->|否| K --> L
    L -->|是| M --> R --> S
    L -->|否| N --> O
    O -->|是| P --> R
    O -->|否| Q
```

### 3.2 美股資料來源優先級

```mermaid
flowchart LR
    subgraph Primary["主要來源"]
        A["1️⃣ FinMind API<br>(USStockPrice)"]
    end
    
    subgraph Fallback["備援來源"]
        B["2️⃣ Yahoo Finance<br>(FinMind 無資料或失敗)"]
    end
    
    A -->|失敗或無資料| B
```

### 3.3 美股快取層級與 TTL

| 快取層級 | 儲存位置 | TTL (存活時間) | 說明 |
|---------|---------|---------------|------|
| **L1: 記憶體快取** | Function 變數 | 12 小時 | Netlify Function 記憶體 |
| **L2: CDN Edge** | Netlify CDN | 歷史=1年, 當前=1hr | CDN 邊緣快取 |
| **L3: Blob Cache** | us_price_store | 12 小時 | 價格資料快取 |
| **L4: Info Cache** | us_info_store | 7 天 | 股票基本資訊快取 |

---

## 四、CDN 快取策略詳解

### 4.1 動態快取策略

```mermaid
flowchart TD
    A["判斷請求日期範圍"]
    B{"結束日期 小於 今日?"}
    C["歷史資料模式"]
    D["當前資料模式"]
    E["Cache-Control:<br>max-age=31536000<br>immutable"]
    F["Cache-Control:<br>max-age=3600"]
    G["Netlify-CDN-Cache-Control:<br>s-maxage=31536000"]
    H["Netlify-CDN-Cache-Control:<br>s-maxage=3600"]
    
    A --> B
    B -->|是| C --> E --> G
    B -->|否| D --> F --> H
```

### 4.2 CDN Header 設定

| 資料類型 | Cache-Control | CDN s-maxage | 說明 |
|---------|---------------|--------------|------|
| **歷史資料** | `public, max-age=31536000, immutable` | 1 年 (31536000s) | 歷史不變，極長快取 |
| **當前資料** | `public, max-age=3600` | 1 小時 (3600s) | 需要定期更新 |
| **股票資訊** | `public, max-age=604800` | 1 週 (604800s) | 基本資料變動少 |

---

## 五、台股 vs 美股 對比

| 特徵 | 台股 (TWSE/TPEX) | 美股 (US) |
|-----|-----------------|----------|
| **主要來源** | TWSE 證交所 API | FinMind USStockPrice |
| **備援來源 1** | FinMind | Yahoo Finance |
| **備援來源 2** | Yahoo Finance (還原價) | - |
| **Proxy 函式** | `twse-proxy.js`, `tpex-proxy.js` | `us-proxy.js` |
| **年度快取** | ✅ `stock_year_cache_store` | ❌ 無年度彙總 |
| **月度快取** | ✅ `twse_cache_store` | ❌ 無月度分割 |
| **範圍快取** | ❌ | ✅ `us_price_store` |
| **CDN TTL (歷史)** | 1 年 | 1 年 |
| **CDN TTL (當前)** | 1 小時 | 1 小時 |
| **Blob TTL** | 24-72 小時 | 12 小時 |

---

## 六、關鍵函式路徑

### 6.1 台股資料獲取路徑

```
Worker (fetchStockData)
    ↓
tryFetchRangeFromBlob()        → stock-range.js → Year Cache
    ↓ (缺口或失敗)
fetchMissingRanges()           → twse-proxy.js → Month Cache → TWSE/FinMind/Yahoo
    ↓
recordYearSupersetSlices()     → 寫入 IndexedDB
```

### 6.2 美股資料獲取路徑

```
Worker (fetchUSStockData)
    ↓
us-proxy.js
    ↓
readCache()                    → Memory/Blob Cache
    ↓ (未命中)
fetchUSPriceRange()            → FinMind → Yahoo (備援)
    ↓
writeCache()                   → Memory + Blob
```

---

## 七、快取失效與更新機制

```mermaid
flowchart TD
    A["月快取寫入成功"]
    B["triggerYearCacheRefresh()"]
    C["非同步呼叫 stock-range.js"]
    D["stock-range 重讀月快取"]
    E["更新 Year Cache Blob"]
    F["下次請求命中 Year Cache"]
    
    A --> B --> C --> D --> E --> F
```

### 快取失效觸發條件

1. **TTL 過期**: 超過設定的存活時間自動失效
2. **月快取更新**: 月度資料更新後觸發年度快取重建
3. **手動 cacheBust**: URL 參數可強制繞過快取
4. **當日資料策略**: 台灣時間 14:00 後檢查當日資料

---

## 八、設計優勢

1. **多層快取極致優化**
   - 瀏覽器本地 → CDN 邊緣 → Blob 儲存 → 外部 API
   - 歷史資料幾乎零流量消耗

2. **智能備援機制**
   - 台股: TWSE → FinMind → Yahoo
   - 美股: FinMind → Yahoo
   - 任一來源失敗自動切換

3. **動態 TTL 策略**
   - 歷史資料設定 `immutable`，CDN 極長快取
   - 當前資料 1 小時更新，平衡新鮮度與流量

4. **Year Cache 聚合**
   - 將月度資料聚合為年度，減少 API 呼叫次數
   - 一次請求獲取整年資料

---

## 相關檔案

| 功能 | 檔案路徑 |
|------|---------|
| 年度快取彙整 | [stock-range.js](file:///c:/Users/KN222/Documents/GitHub/test-lazybacktest/v0%20design%20code/netlify/functions/stock-range.js) |
| 台股 Proxy | [twse-proxy.js](file:///c:/Users/KN222/Documents/GitHub/test-lazybacktest/v0%20design%20code/netlify/functions/twse-proxy.js) |
| 上櫃 Proxy | [tpex-proxy.js](file:///c:/Users/KN222/Documents/GitHub/test-lazybacktest/v0%20design%20code/netlify/functions/tpex-proxy.js) |
| 美股 Proxy | [us-proxy.js](file:///c:/Users/KN222/Documents/GitHub/test-lazybacktest/v0%20design%20code/netlify/functions/us-proxy.js) |
| Worker 資料獲取 | [worker.js](file:///c:/Users/KN222/Documents/GitHub/test-lazybacktest/v0%20design%20code/public/app/js/worker.js) |
