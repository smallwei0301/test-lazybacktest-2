// netlify/functions/twse-proxy.js (v9.2 - TWSE Proxy with Smart Cache)
const fetch = require('node-fetch');

// 伺服器端簡易快取機制
const cache = new Map();

exports.handler = async function(event, context) {
    const { stockNo, date } = event.queryStringParameters; // date format: 20240801
    if (!stockNo || !date) return { statusCode: 400, body: JSON.stringify({ error: '缺少股票代號或日期' }) };

    const cacheKey = `${stockNo}_${date}`; // 快取鍵值：股票代號 + 月份

    // 1. 檢查快取
    if (cache.has(cacheKey) && (Date.now() - cache.get(cacheKey).timestamp < 24 * 60 * 60 * 1000)) { // 24小時快取
        console.log(`[Proxy v9.2] 命中 TWSE 快取 for ${cacheKey}`);
        const cachedData = cache.get(cacheKey).data;
        // 附加資料來源，並標示來自快取
        cachedData.dataSource = `TWSE (快取)`;
        return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cachedData) };
    }

    // 2. 快取未命中，向 TWSE 請求
    console.log(`[Proxy v9.2] 快取未命中，請求 TWSE for ${cacheKey}`);
    const targetUrl = `https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=${date}&stockNo=${stockNo}`;
    
    try {
        const response = await fetch(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const data = await response.json();

        if (data.stat !== 'OK') {
           // 即使查無資料，也快取這個「空結果」，避免重複查詢不存在的月份
           const emptyResult = { aaData: [], dataSource: 'TWSE' };
           cache.set(cacheKey, { timestamp: Date.now(), data: emptyResult });
           return { statusCode: 200, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(emptyResult) };
        }
        
        const stockName = data.title.split(' ')[2];
        const formattedAaData = data.data.map(item => [ item[0], stockNo, stockName, parseFloat(item[3].replace(/,/g, '')), parseFloat(item[4].replace(/,/g, '')), parseFloat(item[5].replace(/,/g, '')), parseFloat(item[6].replace(/,/g, '')), parseFloat(item[8].replace(/,/g, '')), parseInt(item[1].replace(/,/g, ''), 10) ]);

        const finalResult = {
            stockName: stockName,
            iTotalRecords: formattedAaData.length,
            aaData: formattedAaData,
            dataSource: 'TWSE'
        };
        
        // 3. 存入快取
        cache.set(cacheKey, { timestamp: Date.now(), data: finalResult });
        console.log(`[Proxy v9.2] 成功從 TWSE 獲取資料並存入快取`);

        return { statusCode: 200, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(finalResult) };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};