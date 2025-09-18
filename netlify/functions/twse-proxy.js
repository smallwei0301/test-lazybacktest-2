// netlify/functions/twse-proxy.js (v9.4 - Tiered Cache with Blobs & In-Memory Fallback for TWSE)
import { getStore } from '@netlify/blobs';
import fetch from 'node-fetch';

const inMemoryCache = new Map();

function isQuotaError(error) {
    return error.status === 402 || error.status === 429;
}

export default async (req, context) => {
    const params = new URL(req.url).searchParams;
    const stockNo = params.get('stockNo');
    const date = params.get('date');
    if (!stockNo || !date) return new Response(JSON.stringify({ error: '缺少參數' }), { status: 400 });

    const cacheKey = `${stockNo}_${date}`;

    // --- Tier 1: 嘗試 Netlify Blobs ---
    try {
        const store = getStore('twse_cache_store');
        const cached = await store.get(cacheKey, { type: 'json' });
        if (cached && (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000)) {
            console.log(`[TWSE Proxy v9.4] 命中 Tier 1 快取 (Blobs) for ${cacheKey}`);
            cached.data.dataSource = 'TWSE (快取)';
            return new Response(JSON.stringify(cached.data), { headers: { 'Content-Type': 'application/json' } });
        }
    } catch (error) {
        if (isQuotaError(error)) {
            console.warn(`[TWSE Proxy v9.4] Tier 1 (Blobs) 流量超限，降級至 Tier 2 (記憶體快取)`);
            if (inMemoryCache.has(cacheKey) && (Date.now() - inMemoryCache.get(cacheKey).timestamp < 24 * 60 * 60 * 1000)) {
                console.log(`[TWSE Proxy v9.4] 命中 Tier 2 快取 (Memory) for ${cacheKey}`);
                const cachedData = inMemoryCache.get(cacheKey).data;
                cachedData.dataSource = 'TWSE (記憶體快取)';
                return new Response(JSON.stringify(cachedData), { headers: { 'Content-Type': 'application/json' } });
            }
        } else {
            console.error('[TWSE Proxy v9.4] Netlify Blobs 發生非預期錯誤:', error);
        }
    }

    // --- 快取未命中，請求遠端資料 ---
    console.log(`[TWSE Proxy v9.4] 快取未命中，請求 TWSE for ${cacheKey}`);
    const targetUrl = `https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=${date}&stockNo=${stockNo}`;
    try {
        const response = await fetch(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const data = await response.json();
        let finalResult;

        if (data.stat !== 'OK') {
           finalResult = { stockName: stockNo, iTotalRecords: 0, aaData: [], dataSource: 'TWSE' };
        } else {
            const stockName = data.title.split(' ')[2];
            const formattedAaData = data.data.map(item => [ item[0], stockNo, stockName, parseFloat(item[3].replace(/,/g, '')), parseFloat(item[4].replace(/,/g, '')), parseFloat(item[5].replace(/,/g, '')), parseFloat(item[6].replace(/,/g, '')), parseFloat(item[8].replace(/,/g, '')), parseInt(item[1].replace(/,/g, ''), 10) ]);
            finalResult = { stockName, iTotalRecords: formattedAaData.length, aaData: formattedAaData, dataSource: 'TWSE' };
        }
        
        try {
            const store = getStore('twse_cache_store');
            await store.setJSON(cacheKey, { timestamp: Date.now(), data: finalResult });
            console.log(`[TWSE Proxy v9.4] 成功從 TWSE 獲取資料並存入 Blobs`);
        } catch (e) {
            console.warn('[TWSE Proxy v9.4] 寫入 Tier 1 (Blobs) 失敗，僅寫入記憶體快取');
        }
        
        inMemoryCache.set(cacheKey, { timestamp: Date.now(), data: finalResult });
        return new Response(JSON.stringify(finalResult), { headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};

export const config = {
  prefer_static: true
};