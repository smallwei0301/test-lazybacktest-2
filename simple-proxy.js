const http = require('http');
const https = require('https');
const url = require('url');

// --- 設定 ---
// 您的 Netlify 網站網址，這是解決 CORS 問題的關鍵
const allowedOrigin = 'https://test-lazybacktest.netlify.app';
const PORT = process.env.PORT || 3000; // Heroku 會自動設定 PORT

function log(message) {
    console.log(`[Proxy] [${new Date().toISOString()}] ${message}`);
}

const server = http.createServer((req, res) => {
    // --- CORS 標頭設定 ---
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 處理瀏覽器發出的 OPTIONS 預檢請求
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    const parsedUrl = url.parse(req.url, true);
    const apiPath = parsedUrl.pathname;
    const params = url.parse(req.url).search || '';
    let targetHost, targetPath;

    // --- API 路由 ---
    if (apiPath.startsWith('/api/tpex/')) {
        targetHost = 'www.tpex.org.tw';
        targetPath = `/web/stock/aftertrading/daily_trading_info/${apiPath.replace('/api/tpex/', '')}${params}`;
    } else if (apiPath.startsWith('/api/twse/')) {
        targetHost = 'www.twse.com.tw';
        targetPath = `/exchangeReport/${apiPath.replace('/api/twse/', '')}${params}`;
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'API path not found' }));
        return;
    }

    const options = {
        hostname: targetHost,
        path: targetPath,
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': `https://${targetHost}/`
        }
    };

    log(`Forwarding to: https://${options.hostname}${options.path}`);

    const proxyReq = https.request(options, (proxyRes) => {
        // 將目標伺服器的標頭複製回來，同時確保我們的 CORS 標頭被保留
        const headers = { ...proxyRes.headers };
        headers['Access-Control-Allow-Origin'] = allowedOrigin;

        res.writeHead(proxyRes.statusCode, headers);
        proxyRes.pipe(res, { end: true });
    });

    proxyReq.on('error', (e) => {
        log(`Error: ${e.message}`);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Proxy request error' }));
    });

    req.pipe(proxyReq, { end: true });
});

server.listen(PORT, () => {
    log(`Server listening on port ${PORT}`);
});
