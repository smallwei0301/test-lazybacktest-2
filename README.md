# LazyBacktest Netlify 部署與 Proxy 說明

## 1. Proxy 設定（Netlify Function）

此專案使用多支 Netlify Function 作為 proxy，負責在伺服端整合台灣與美國市場的行情來源：

- `netlify/functions/tpex-proxy.js`：以 Fugle API 為主來源取得上櫃（TPEX）日線，必要時才回退至 TPEX 官網或 FinMind，並統一加上 `Access-Control-Allow-Origin: *` 以避免瀏覽器 CORS 限制。
- `netlify/functions/twse-proxy.js`：優先使用 Fugle API 抓取上市（TWSE）日線資料，若 Fugle 失敗則依序落回 TWSE 官網與 FinMind 備援，維持原始/還原股價與快取治理。
- `netlify/functions/us-proxy.js`：優先透過 FinMind `USStockPrice`/`USStockInfo` 取得美股行情與名稱，若 FinMind 失敗或無資料則自動改用 Yahoo Finance 備援，並維持快取與錯誤分類訊息。

`netlify.toml` 已針對上述來源設定 redirect：

- `/api/tpex/*` → `/.netlify/functions/tpex-proxy?path=:splat`
- `/api/twse/*` → `/.netlify/functions/twse-proxy`
- `/api/us/*` → `/.netlify/functions/us-proxy`

因此前端仍可透過 `/api/...` 路徑 fetch 所需資料，而不需關注實際後端來源。

## 2. 本地開發 Proxy

建議用 [http-proxy-middleware](https://github.com/chimurai/http-proxy-middleware) 或 [vite](https://vitejs.dev/config/server-options.html#server-proxy) 來做本地 proxy。

範例（Node.js express）：

```js
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();
app.use('/api/tpex', createProxyMiddleware({
  target: 'https://www.tpex.org.tw/web/stock/aftertrading/daily_trading_info',
  changeOrigin: true,
  pathRewrite: { '^/api/tpex': '' }
}));
app.use(express.static('.'));
app.listen(3000);
```

## 3. Netlify 部署教學

1. 登入 [Netlify](https://app.netlify.com/) 並連結你的 GitHub repo。
2. 確認 `netlify.toml` 已在專案根目錄。
3. 部署後，`/api/tpex/*` 會自動 proxy 到 TPEX 官網，`/api/twse/*` 會串接 TWSE/FinMind 代理，而 `/api/us/*` 則會優先透過 FinMind 取得美股資料、必要時退回 Yahoo Finance 備援；同時可透過 `/.netlify/functions/taiwan-directory` 快取 FinMind `TaiwanStockInfo` 清單，提供上市／上櫃名稱與市場別。

> **環境變數**：
> - `FUGLE_API_TOKEN`：TWSE 與 TPEX proxy 的主來源，請於 Netlify 專案設定 Fugle Token 後部署，否則代理會直接回報錯誤。
> - `FINMIND_TOKEN`：TWSE/TPEX 的備援資料與 US proxy 主要來源均依賴 FinMind API，需 Sponsor 等級 Token 才能確保完整資料；若缺少 Token 將落回 Yahoo（美股）或僅能使用 Fugle/TWSE/TPEX 備援。

注意：如果你在 Functions 中使用了第三方套件（例如 `node-fetch` 或其他），請確保專案根目錄有 `package.json` 並把相依套件列入 `dependencies`。Netlify 在部署時會自動安裝這些相依套件；在本機測試前也可以先執行 `npm install`。

## 4. 前端如何呼叫

直接 fetch `/api/tpex/st43_result.php?...`、`/api/twse/...` 或 `/api/us/?stockNo=AAPL`，不用寫死 localhost。

> **前端名稱查詢**：股票代碼若以數字開頭，會等到輸入滿四碼才啟動名稱辨識；純英文字母則採 800ms 防抖即可查詢，確保美股代號能即時比對。數字開頭且前四碼為數字的代號一律限縮在上市／上櫃資料源間查詢，避免誤用美股名稱。頁面載入時會先呼叫 `/.netlify/functions/taiwan-directory` 載入台股官方清單並寫入記憶體／`localStorage` 雙層快取，清單中已內建台灣加權指數與櫃買指數等指數代碼，輸入 `TAIEX`、`OTC` 等代碼即可顯示名稱並套用零手續費預設。若使用者手動切換市場，系統會暫停自動辨識與市場切換，直到重新輸入代碼為止；名稱顯示僅呈現股票名稱及市場分類，不再附帶來源或清單版本資訊，減少畫面干擾。

> **名稱快取治理（LB-US-NAMECACHE-20250622A）**：台股名稱維持記憶體＋`localStorage` 雙層快取（7 天 TTL），美股代號亦同步寫入 `localStorage`（3 天 TTL）並在頁面載入時回填記憶體快取，確保重複輸入 AAPL、TSLA 等代碼時可立即命中名稱而無需重新呼叫 proxy。快取項目皆以「市場｜代碼」為 key，過期時會自動清除記憶體與本地儲存，避免舊名錄殘留。

> **美股回測（LB-US-BACKTEST-20250621A）**：市場選擇「美股 (US)」後，回測參數會驗證 1～6 碼的美股代號（支援 `.US` 或 `-` 後綴），並透過 `/.netlify/functions/us-proxy` 以 FinMind `USStockPrice/USStockInfo` 為主來源抓取價格與名稱；若 FinMind 回應為空或出錯才會退回 Yahoo 備援。台股市場仍限定 4～6 碼數字並允許一碼英數後綴，避免代碼誤判市場造成資料錯置。

## 本地測試（使用 Netlify CLI - Windows PowerShell）

1. 安裝 Netlify CLI（若尚未安裝）：

```powershell
npm install -g netlify-cli
```

2. 在專案根目錄啟動本地開發伺服器（會包含 Functions）：

```powershell
netlify dev
```

3. 開啟瀏覽器並前往 http://localhost:8888 (或 CLI 顯示的 URL)，
  觸發前端 fetch `/api/tpex/...`，requests 會由本地的 Functions 代理並加上 CORS header。

若仍看到 CORS 或被重導到 `/errors` 的情形，請在 CLI 中觀察 Function 的 log（netlify dev 會顯示），並回報該 log。若需要，我可以協助把 Function 增加更進階的重試或錯誤分類邏輯。

---
如有問題，請回報。
