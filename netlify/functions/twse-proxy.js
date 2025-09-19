// netlify/functions/twse-proxy.js (v9.7 - with Decoupled Name Lookup)
import { getStore } from '@netlify/blobs';
import fetch from 'node-fetch';

async function fetchTwseData(stockNo, date) {
    const targetUrl = `https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=${date}&stockNo=${stockNo}`;
    const response = await fetch(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await response.json();
    if (data.stat !== 'OK') throw new Error(`TWSE API 回應錯誤: ${data.stat}`);
    
    const stockName = data.title.split(' ')[2];
    const formattedAaData = data.data.map(item => [ item[0], stockNo, stockName, parseFloat(item[3].replace(/,/g, '')), parseFloat(item[4].replace(/,/g, '')), parseFloat(item[5].replace(/,/g, '')), parseFloat(item[6].replace(/,/g, '')), parseFloat(item[8].replace(/,/g, '')), parseInt(item[1].replace(/,/g, ''), 10) ]);
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

export const config = {
  path: "/.netlify/functions/twse-proxy",
  prefer_static: true
};