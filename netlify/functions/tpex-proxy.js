// netlify/functions/tpex-proxy.js (最終穩定版 v2.0 - 使用政府資料開放平台 API)
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    console.log('[Proxy v2.0] 函式啟動');
    
    const { stockNo, date } = event.queryStringParameters;
    console.log(`[Proxy v2.0] 解析參數: stockNo=${stockNo}, date=${date}`);

    if (!stockNo || !date) {
        return { statusCode: 400, body: JSON.stringify({ error: '缺少股票代號或日期參數' }) };
    }

    // 1. 將民國年日期 (e.g., 113/08/01) 轉換為 API 需要的格式
    // API 需要的格式是 YYYYMMDD, e.g., "20240801"
    const parts = date.split('/');
    if (parts.length !== 3) {
        return { statusCode: 400, body: JSON.stringify({ error: '日期格式錯誤，應為 年/月/日' }) };
    }
    const year = parseInt(parts[0], 10) + 1911;
    const formattedDate = `${year}${parts[1]}${parts[2]}`;
    
    // 2. 使用政府資料開放平台的穩定 API 端點
    const targetUrl = `https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes/${formattedDate}`;
    console.log(`[Proxy v2.0] 準備請求新 API URL: ${targetUrl}`);

    try {
        const response = await fetch(targetUrl, {
            method: 'GET',
            headers: {
                // 這個 API 不需要複雜的 User-Agent，更穩定
                'Content-Type': 'application/json'
            }
        });
        
        console.log(`[Proxy v2.0] 收到 API 回應，狀態碼: ${response.status}`);
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Proxy v2.0] API 伺服器錯誤:`, errorText);
            return { statusCode: response.status, body: JSON.stringify({ error: `資料來源伺服器錯誤`, diagnostics: { status: response.status, body: errorText } }) };
        }

        const data = await response.json();
        
        // 3. 從回傳的所有股票資料中，篩選出我們需要的那一檔
        const stockData = data.find(item => item.SecuritiesCompanyCode === stockNo);

        if (!stockData) {
            console.warn(`[Proxy v2.0] 在 ${formattedDate} 的資料中找不到股票代號: ${stockNo}`);
            // 如果當天找不到資料 (例如假日)，回傳一個空的成功結果，讓前端處理
            return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aaData: [] }) };
        }

        // 4. 將新 API 的資料格式，轉換為舊程式碼可以辨識的 aaData 格式
        const formattedResult = {
            stockName: stockData.CompanyName,
            iTotalRecords: 1,
            aaData: [[
                date, // 日期 (民國年)
                stockData.SecuritiesCompanyCode, // 股票代號
                stockData.CompanyName, // 名稱
                stockData.Open, // 開盤
                stockData.High, // 最高
                stockData.Low, // 最低
                stockData.Close, // 收盤
                stockData.Change, // 漲跌
                stockData.Transaction, // 成交量
            ]]
        };

        console.log(`[Proxy v2.0] 成功找到資料並轉換格式，準備回傳給前端`);
        return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formattedResult) };

    } catch (error) {
        console.error('[Proxy v2.0] 函式內部發生嚴重錯誤:', error);
        return { statusCode: 500, body: JSON.stringify({ error: `代理伺服器內部錯誤: ${error.message}` }) };
    }
};