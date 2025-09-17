// netlify/functions/tpex-proxy.js (v3.0 - The Final Solution)
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    console.log('[Proxy v3.0] 函式啟動');
    
    const { stockNo, date } = event.queryStringParameters; // date format: 113/08/01
    console.log(`[Proxy v3.0] 解析參數: stockNo=${stockNo}, date=${date}`);

    if (!stockNo || !date) {
        return { statusCode: 400, body: JSON.stringify({ error: '缺少股票代號或日期參數' }) };
    }

    // 這個備用 API 端點只需要 年/月 格式
    const parts = date.split('/');
    if (parts.length < 2) {
         return { statusCode: 400, body: JSON.stringify({ error: '日期格式錯誤' }) };
    }
    const queryDate = `${parts[0]}/${parts[1]}`; // e.g., "113/08"

    // **關鍵：切換至 TPEX 網站內部使用的、穩定可靠的 API 端點**
    const targetUrl = `https://www.tpex.org.tw/web/stock/aftertrading/daily_trading_info/st43_result.php?l=zh-tw&d=${queryDate}&stkno=${stockNo}`;
    console.log(`[Proxy v3.0] 準備請求業界備用 API: ${targetUrl}`);

    try {
        const response = await fetch(targetUrl, {
            method: 'GET',
            headers: {
                // 為了模擬真實瀏覽器，這個 Header 至關重要
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36'
            },
        });

        console.log(`[Proxy v3.0] 收到 API 回應，狀態碼: ${response.status}`);
        
        const data = await response.json();

        // 檢查回傳的 JSON 是否真的沒有資料
        if (!data || !data.aaData || data.aaData.length === 0) {
            console.warn(`[Proxy v3.0] API 回傳無資料 for ${stockNo} on ${queryDate}.`);
            return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aaData: [] }) };
        }

        console.log(`[Proxy v3.0] 成功獲取 ${data.aaData.length} 筆資料，回傳給前端`);
        return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) };

    } catch (error) {
        console.error('[Proxy v3.0] 函式內部發生錯誤:', error);
        return { statusCode: 500, body: JSON.stringify({ error: `代理伺服器錯誤: ${error.message}` }) };
    }
};