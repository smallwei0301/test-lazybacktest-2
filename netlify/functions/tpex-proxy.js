// netlify/functions/tpex-proxy.js

// 為了在 Netlify Function 中使用 fetch，我們需要安裝 node-fetch
// 請在您的專案根目錄執行: npm install node-fetch
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    // 1. 從前端請求的 URL 中解析出股票代號和日期
    const { stockNo, date } = event.queryStringParameters || {};

    if (!stockNo || !date) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: '缺少股票代號 (stockNo) 或日期 (date) 參數' }),
        };
    }

    // 2. 組合目標 TPEX API 的 URL
    // date 格式應為 YYYY/MM/DD, e.g., "113/05/20"
    const targetUrl = `https://www.tpex.org.tw/web/stock/aftertrading/daily_trading_info/st43_result.php?l=zh-tw&d=${date}&stkno=${stockNo}`;

    try {
        // 3. 發出伺服器端的 fetch 請求
        const response = await fetch(targetUrl, {
            method: 'GET',
            headers: {
                // 模擬真實瀏覽器行為，這是最關鍵的一步！
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
                'Referer': 'https://www.tpex.org.tw/web/stock/aftertrading/daily_trading_info/st43.php',
            },
        });

        // 4. 檢查 TPEX 伺服器的回應狀態
        if (!response.ok) {
            // 如果 TPEX 回應 404, 500 等錯誤，我們在這裡就能捕捉到
            console.error(`TPEX API error: Status ${response.status} for URL: ${targetUrl}`);
            return {
                statusCode: response.status,
                body: JSON.stringify({ error: `上櫃中心伺服器錯誤，狀態碼: ${response.status}` }),
            };
        }

        // 5. 解析回應的 JSON 資料
        const data = await response.json();

        // TPEX 在查無資料時，會回傳一個特定的 JSON 結構，例如 { "aaData": [] }
        // 我們可以根據這個特性判斷是否有資料
        if (!data || !data.aaData || data.aaData.length === 0) {
             console.log(`TPEX API returned empty data for ${stockNo} on ${date}. URL: ${targetUrl}`);
             // 即使是空資料，也正常回傳，讓前端去判斷
        }

        // 6. 成功！將從 TPEX 獲取的資料回傳給前端
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*', // 允許所有來源的前端呼叫
            },
            body: JSON.stringify(data),
        };

    } catch (error) {
        // 7. 捕捉所有可能的執行錯誤 (網路問題、JSON 解析失敗等)
        console.error('Netlify Function 內部錯誤:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: `代理伺服器內部錯誤: ${error.message}` }),
        };
    }
};