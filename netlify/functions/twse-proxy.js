// netlify/functions/twse-proxy.js (v9.7 - with Decoupled Name Lookup)
import { getStore } from '@netlify/blobs';
import fetch from 'node-fetch';

async function fetchTwseData(stockNo, date) {
    const targetUrl = `https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=${date}&stockNo=${stockNo}`;
    const response = await fetch(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!response.ok) {
        throw new Error(`TWSE API request failed with status ${response.status}`);
    }
    const data = await response.json();
    if (data.stat !== 'OK') {
        // Return a specific error if no data for that month
        if (data.stat === '很抱歉，沒有符合條件的資料!'){
             return { stockName: '', iTotalRecords: 0, aaData: [], dataSource: 'TWSE', error: 'no_data' };
        }
        throw new Error(`TWSE API responded with error: ${data.stat}`);
    }

    // Defensive parsing
    const titleParts = data.title ? data.title.split(' ') : [];
    const stockName = titleParts.length > 2 ? titleParts[2] : stockNo;
    
    if (!data.data || !Array.isArray(data.data)) {
        // No data array, return empty
        return { stockName, iTotalRecords: 0, aaData: [], dataSource: 'TWSE' };
    }

    const formattedAaData = data.data.map(item => {
        try {
            if (!Array.isArray(item) || item.length < 9) return null;
            return [ 
                item[0], 
                stockNo, 
                stockName, 
                parseFloat(item[3].replace(/,/g, '')), 
                parseFloat(item[4].replace(/,/g, '')), 
                parseFloat(item[5].replace(/,/g, '')), 
                parseFloat(item[6].replace(/,/g, '')), 
                parseFloat(item[8].replace(/,/g, '')), 
                parseInt(item[1].replace(/,/g, ''), 10) 
            ];
        } catch {
            return null; // Ignore rows that fail to parse
        }
    }).filter(Boolean); // Remove nulls

    return { stockName, iTotalRecords: formattedAaData.length, aaData: formattedAaData, dataSource: 'TWSE' };
}

export default async (req, context) => {
    const params = new URL(req.url).searchParams;
    const stockNo = params.get('stockNo');
    const date = params.get('date');
    const lookup = params.get('lookup');
    if (!stockNo || !date) return new Response(JSON.stringify({ error: '缺少股票代號或日期' }), { status: 400 });

    // --- 關鍵升級：處理專門的名稱查詢請求 ---
    if (lookup === 'name') {
        try {
            console.log(`[TWSE Proxy v9.7] 執行專門的名稱查詢 for ${stockNo}`);
            const result = await fetchTwseData(stockNo, date);
            return new Response(JSON.stringify({ stockName: result.stockName }), { headers: { 'Content-Type': 'application/json' } });
        } catch (error) {
            console.error(`[TWSE Proxy v9.7] 名稱查詢失敗 for ${stockNo}:`, error);
            return new Response(JSON.stringify({ error: '名稱查詢失敗' }), { status: 404 });
        }
    }
    // --- 升級結束 ---

    const store = getStore('twse_cache_store');
    const cacheKey = `${stockNo}_${date}`;
    
    try {
        const cached = await store.get(cacheKey, { type: 'json' });
        if (cached) return new Response(JSON.stringify(cached), { headers: { 'Content-Type': 'application/json' } });
    } catch(e) {}
    
    try {
        const result = await fetchTwseData(stockNo, date);
        await store.setJSON(cacheKey, result);
        return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};
