// netlify/functions/tpex-proxy.js (偵錯強化版)
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    console.log('[Proxy] 函式啟動，接收到請求');
    const params = event.queryStringParameters || {};
    const stockNo = params.stockNo;
    const date = params.date;
    console.log(`[Proxy] 解析參數: stockNo=${stockNo}, date=${date}`);

    if (!stockNo || !date) {
        console.error('[Proxy] 錯誤: 缺少必要參數');
        return { statusCode: 400, body: JSON.stringify({ error: '缺少股票代號或日期參數' }) };
    }

    const targetUrl = `https://www.tpex.org.tw/web/stock/aftertrading/daily_trading_info/st43_result.php?l=zh-tw&d=${date}&stkno=${stockNo}`;
    console.log(`[Proxy] 準備請求 TPEX URL: ${targetUrl}`);

    try {
        const response = await fetch(targetUrl, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
                'Referer': 'https://www.tpex.org.tw/web/stock/aftertrading/daily_trading_info/st43.php',
            },
        });

        console.log(`[Proxy] 收到 TPEX 回應，狀態碼: ${response.status}`);

        // 非常重要的一步：無論回應是否成功，都先讀取原始文字內容
        const rawText = await response.text();
        console.log('[Proxy] 收到 TPEX 原始回應內容:', rawText);

        if (!response.ok) {
            console.error(`[Proxy] TPEX 伺服器回傳錯誤狀態`);
            return { statusCode: response.status, body: JSON.stringify({ error: `TPEX 伺服器錯誤`, diagnostics: { status: response.status, body: rawText } }) };
        }

        // 嘗試解析 JSON
        try {
            const data = JSON.parse(rawText);
            if (!data || !data.aaData || data.aaData.length === 0) {
                console.warn(`[Proxy] TPEX 回傳 JSON，但查無資料 (aaData 為空)`);
                return { statusCode: 200, body: JSON.stringify({ error: 'no_data', diagnostics: { message: 'TPEX returned JSON with empty aaData.' } }) };
            }
            console.log(`[Proxy] 成功解析資料並找到 ${data.aaData.length} 筆數據，準備回傳給前端`);
            return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) };

        } catch (jsonError) {
            console.error('[Proxy] JSON 解析失敗:', jsonError);
            // 如果 TPEX 回傳的不是 JSON (例如 HTML 錯誤頁)，就會在這裡捕捉到
            return { statusCode: 500, body: JSON.stringify({ error: 'json_parse_error', diagnostics: { message: 'Failed to parse TPEX response as JSON.', body: rawText } }) };
        }

    } catch (error) {
        console.error('[Proxy] 請求 TPEX 過程中發生網路層級錯誤:', error);
        return { statusCode: 500, body: JSON.stringify({ error: `代理伺服器內部網路錯誤: ${error.message}` }) };
    }
};