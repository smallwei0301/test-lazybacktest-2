# LazyBacktest Netlify 部署與 Proxy 說明

## 1. Proxy 設定（Netlify）

已在專案根目錄建立 `netlify.toml`，內容如下：

```toml
[[redirects]]
  from = "/api/tpex/*"
  to = "https://www.tpex.org.tw/web/stock/aftertrading/daily_trading_info/:splat"
  status = 200
  force = true
```

這樣所有 `/api/tpex/*` 的請求都會自動轉發到 tpex 官網，解決 CORS 問題。

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
3. 部署後，所有 `/api/tpex/*` 請求會自動 proxy 到 tpex 官網。

## 4. 前端如何呼叫

直接 fetch `/api/tpex/st43_result.php?...`，不用寫死 localhost。

---
如有問題，請回報。
