// netlify/functions/tpex-proxy.js (最終穩定版 v2.1 - 強韌的錯誤處理)
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    console.log('[Proxy v2.1] 函式啟動');
    
    const { stockNo, date } = event.queryStringParameters;
    console.log(`[Proxy v2.1] 解析參數: stockNo=${stockNo}, date=${date}`);

    if (!stockNo || !date) {
        return { statusCode: 400, body: JSON.stringify({ error: '缺少股票代號或日期參數' }) };
    }

    const parts = date.split('/');
    if (parts.length !== 3) {
        return { statusCode: 400, body: JSON.stringify({ error: '日期格式錯誤，應為 年/月/日' }) };
    }
    const year = parseInt(parts[0], 10) + 1911;
    const formattedDate = `${year}${parts[1]}${parts[2]}`;
    
    const targetUrl = `https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes/${formattedDate}`;
    console.log(`[Proxy v2.1] 準備請求 API URL: ${targetUrl}`);

    try {
        const response = await fetch(targetUrl, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        console.log(`[Proxy v2.1] 收到 API 回應，狀態碼: ${response.status}`);
        
        // --- 關鍵升級：先讀取純文字，再嘗試解析 ---
        const rawText = await response.text();

        let data;
        try {
            data = JSON.parse(rawText);
        } catch (e) {
            console.error(`[Proxy v2.1] JSON 解析失敗。API 可能回傳了 HTML。原始內容:`, rawText.substring(0, 500) + '...');
            // 即使解析失敗，我們也不崩潰，而是回傳一個「無資料」的正常結果
            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ aaData: [], error: 'no_data', diagnostics: 'API did not return valid JSON.' })
            };
        }
        // --- 升級結束 ---

        const stockData = data.find(item => item.SecuritiesCompanyCode === stockNo);

        if (!stockData) {
            console.warn(`[Proxy v2.1] 在 ${formattedDate} 的資料中找不到股票代號: ${stockNo}`);
            return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aaData: [] }) };
        }

        const formattedResult = {
            stockName: stockData.CompanyName,
            iTotalRecords: 1,
            aaData: [[
                date, stockData.SecuritiesCompanyCode, stockData.CompanyName,
                stockData.Open, stockData.High, stockData.Low, stockData.Close,
                stockData.Change, stockData.Transaction,
            ]]
        };

        console.log(`[Proxy v2.1] 成功找到資料並回傳`);
        return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formattedResult) };

    } catch (error) {
        console.error('[Proxy v2.1] 函式發生網路層級錯誤:', error);
        return { statusCode: 500, body: JSON.stringify({ error: `代理伺服器網路錯誤: ${error.message}` }) };
    }
};