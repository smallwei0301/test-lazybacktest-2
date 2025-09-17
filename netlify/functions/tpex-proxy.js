// netlify/functions/tpex-proxy.js (v3.1 - The Final, Definitive Solution)
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    console.log('[Proxy v3.1] 函式啟動');
    
    const { stockNo, date } = event.queryStringParameters;
    console.log(`[Proxy v3.1] 解析參數: stockNo=${stockNo}, date=${date}`);

    if (!stockNo || !date) {
        return { statusCode: 400, body: JSON.stringify({ error: '缺少股票代號或日期參數' }) };
    }

    const parts = date.split('/');
    if (parts.length < 2) {
         return { statusCode: 400, body: JSON.stringify({ error: '日期格式錯誤' }) };
    }
    const queryDate = `${parts[0]}/${parts[1]}`;

    const targetUrl = `https://www.tpex.org.tw/web/stock/aftertrading/daily_trading_info/st43_result.php?l=zh-tw&d=${queryDate}&stkno=${stockNo}`;
    console.log(`[Proxy v3.1] 準備請求業界備用 API: ${targetUrl}`);

    try {
        const response = await fetch(targetUrl, {
            method: 'GET',
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36' },
        });

        console.log(`[Proxy v3.1] 收到 API 回應，狀態碼: ${response.status}`);
        
        // --- 關鍵安全裝置：先讀取純文字，再安全地嘗試解析 ---
        const rawText = await response.text();
        let data;
        try {
            data = JSON.parse(rawText);
        } catch (e) {
            console.error(`[Proxy v3.1] JSON 解析失敗。API 回傳了 HTML。原始內容:`, rawText.substring(0, 500) + '...');
            // 即使解析失敗，也回傳「無資料」的正常結果，絕不崩潰
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ aaData: [], error: 'no_data', diagnostics: 'API did not return valid JSON.' })
            };
        }
        // --- 安全裝置結束 ---

        if (!data || !data.aaData || data.aaData.length === 0) {
            console.warn(`[Proxy v3.1] API 回傳無資料 for ${stockNo} on ${queryDate}.`);
            return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aaData: [] }) };
        }

        console.log(`[Proxy v3.1] 成功獲取 ${data.aaData.length} 筆資料`);
        return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) };

    } catch (error) {
        console.error('[Proxy v3.1] 函式發生網路層級錯誤:', error);
        return { statusCode: 500, body: JSON.stringify({ error: `代理伺服器網路錯誤: ${error.message}` }) };
    }
};