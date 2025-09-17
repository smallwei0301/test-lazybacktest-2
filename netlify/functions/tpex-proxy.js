// netlify/functions/tpex-proxy.js (v4.0 - The Professional Solution)
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    console.log('[Proxy v4.0] 函式啟動');
    
    const { stockNo, date } = event.queryStringParameters; // date format: 113/08/01
    const apiKey = process.env.FINNHUB_API_KEY;

    if (!apiKey) {
        console.error('[Proxy v4.0] 錯誤：找不到 FINNHUB_API_KEY 環境變數');
        return { statusCode: 500, body: JSON.stringify({ error: '伺服器缺少 API 金鑰設定' }) };
    }
    if (!stockNo || !date) {
        return { statusCode: 400, body: JSON.stringify({ error: '缺少股票代號或日期參數' }) };
    }

    // --- 日期格式轉換 ---
    const parts = date.split('/');
    const year = parseInt(parts[0], 10) + 1911;
    const month = parts[1];
    const day = parts[2];
    
    // Finnhub 需要 UNIX 時間戳
    const fromDate = new Date(`${year}-${month}-${day} 00:00:00 GMT+0800`).getTime() / 1000;
    const toDate = new Date(`${year}-${month}-${day} 23:59:59 GMT+0800`).getTime() / 1000;

    // Finnhub API 的股票代號格式是 3260.TWO
    const symbol = `${stockNo}.TWO`;

    // **關鍵：使用專業的 Finnhub API 端點**
    const targetUrl = `https://finnhub.io/api/v1/stock/candle?symbol=${symbol}&resolution=D&from=${fromDate}&to=${toDate}&token=${apiKey}`;
    console.log(`[Proxy v4.0] 準備請求 Finnhub API`);

    try {
        const response = await fetch(targetUrl);
        const data = await response.json();

        // 檢查 Finnhub 是否回傳無資料
        if (data.s !== 'ok' || !data.c) {
            console.warn(`[Proxy v4.0] Finnhub 無資料 for ${symbol} on ${date}. Response:`, data);
            return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aaData: [] }) };
        }

        // --- 將 Finnhub 格式轉換為我們前端需要的 aaData 格式 ---
        const formattedResult = {
            iTotalRecords: data.c.length,
            aaData: data.c.map((price, index) => [
                date,                   // 日期 (民國)
                stockNo,                // 股票代號
                '',                     // 名稱 (Finnhub Candle API 不直接提供，可留空)
                data.o[index],          // 開盤
                data.h[index],          // 最高
                data.l[index],          // 最低
                price,                  // 收盤
                (price - data.pc[index]).toFixed(2), // 漲跌 (當日收盤 - 前日收盤)
                data.v[index],          // 成交量
            ])
        };

        console.log(`[Proxy v4.0] 成功從 Finnhub 獲取資料並轉換格式`);
        return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formattedResult) };

    } catch (error) {
        console.error('[Proxy v4.0] 函式內部發生錯誤:', error);
        return { statusCode: 500, body: JSON.stringify({ error: `代理伺服器錯誤: ${error.message}` }) };
    }
};