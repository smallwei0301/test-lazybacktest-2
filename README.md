# LazyBacktest Netlify 部署與 Proxy 說明

## 1. Proxy 設定（Netlify Function）

此專案使用多支 Netlify Function 作為 proxy，負責在伺服端整合台灣與美國市場的行情來源：

- `netlify/functions/tpex-proxy.js`：連線上櫃（TPEX）官網並加入 `Access-Control-Allow-Origin: *` 避免瀏覽器 CORS 限制。
- `netlify/functions/twse-proxy.js`：整合上市（TWSE）官網與 FinMind 備援資料，提供原始/還原股價與快取治理。
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

> **FinMind Token**：TWSE 與 US proxy 皆依賴 FinMind API，請在 Netlify 專案設定 `FINMIND_TOKEN` 環境變數（Sponsor 等級）後再部署。即使 US proxy 具備 Yahoo 備援，若沒有 Token 將僅能取得 Yahoo 價格且無法取得 FinMind 股票名稱。

注意：如果你在 Functions 中使用了第三方套件（例如 `node-fetch` 或其他），請確保專案根目錄有 `package.json` 並把相依套件列入 `dependencies`。Netlify 在部署時會自動安裝這些相依套件；在本機測試前也可以先執行 `npm install`。

## 4. 前端如何呼叫

直接 fetch `/api/tpex/st43_result.php?...`、`/api/twse/...` 或 `/api/us/?stockNo=AAPL`，不用寫死 localhost。

> **前端名稱查詢**：股票代碼若以數字開頭，會等到輸入滿四碼才啟動名稱辨識；純英文字母則採 800ms 防抖即可查詢，確保美股代號能即時比對。數字開頭且前四碼為數字的代號一律限縮在上市／上櫃資料源間查詢，避免誤用美股名稱。頁面載入時會先呼叫 `/.netlify/functions/taiwan-directory` 載入台股官方清單並寫入記憶體／`localStorage` 雙層快取，之後查詢結果沿用清單資訊或遠端回應並依代碼判斷上市／上櫃／美股／ETF（ETF 辨識支援 4~6 位數、末碼帶字母的 00 系列代號）。若使用者手動切換市場，系統會暫停自動辨識與市場切換，直到重新輸入代碼為止；名稱顯示僅呈現股票名稱及市場分類，不再附帶來源或清單版本資訊，減少畫面干擾。

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

## 5. Walk-Forward 評分公式（LB-ROLLING-TEST-20251028A）

滾動測試評分仍採「OOS 品質 × 統計可信度 × 穩健度」乘積流程，並依據最新回饋進一步優化資訊呈現：

- **OOS 品質**：各指標達門檻即獲滿分，未達門檻依差距線性遞減至 0；年化報酬門檻改採測試期間買入持有的年化報酬率，其餘指標沿用使用者設定或預設門檻，並在儀表卡提供可展開的分數明細，列出每個指標的中位值、門檻與 0～1 分數。
- **統計可信度**：持續以 Web Worker 回傳的 OOS 報酬序列計算 PSR95 與 DSR、推算 MinTRL，同步於卡片明細揭露各視窗的 PSR / DSR / 樣本數，協助判斷樣本是否足夠。
- **穩健度調整**：Walk-Forward Efficiency 取中位數並截斷於 0.8～1.2，卡片提供每個視窗的 WFE 百分比，方便檢視穩健度落差。
- **總分顯示**：跨窗中位 `WindowScore` 乘上 WFE 調整後依然截斷於 0～1，再換算成 0～100 分；頂部新增僅顯示評級的「判定等級」卡片，原本的總結文字改收納在可展開的說明區。
- **資料表**：逐窗明細改為指標列 × 視窗欄的轉置表格，指標與理由集中於列，易於比較各視窗的差異。
- **設定調整**：取消「測試至少成交筆數」門檻，保留樣本資訊於報表明細，不再影響通過率計算。

若要於文件或 UI 提及此版本，請註記補丁代碼 `LB-ROLLING-TEST-20251028A`，以利對照 `log.md` 追蹤更新內容。

---
如有問題，請回報。
