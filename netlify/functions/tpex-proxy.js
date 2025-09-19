// netlify/functions/tpex-proxy.js (v9.7 - with Decoupled Name Lookup)
import { getStore } from '@netlify/blobs';
import fetch from 'node-fetch';

const inMemoryCache = new Map();

async function fetchYahooName(symbol) {
    const yahooUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`;
    const response = await fetch(yahooUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!response.ok) throw new Error('Yahoo Quote API request failed');
    const data = await response.json();
    const result = data.quoteResponse.result[0];
    if (!result || !result.shortName) throw new Error('Stock not found on Yahoo Finance');
    return result.shortName;
}

async function fetchFromYahoo(stockNo, symbol, startDate, endDate) {
    // ... (This function remains the same as in v9.5/v9.6)
    const period1 = Math.floor(new Date(startDate).getTime() / 1000);
    const period2 = Math.floor(new Date(endDate).getTime() / 1000);
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${period1}&period2=${period2}&interval=1d`;
    const response = await fetch(yahooUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!response.ok) throw new Error(`Yahoo HTTP 狀態 ${response.status}`);
    const data = await response.json();
    if (data.chart.error) throw new Error(`Yahoo 回應錯誤: ${data.chart.error.description}`);
    const result = data.chart.result[0];
    const adjclose = result.indicators.adjclose[0].adjclose;
    const formatted = result.timestamp.map((ts, i) => {
        if (result.indicators.quote[0].open[i] === null || adjclose[i] === null) return null;
        const date = new Date(ts * 1000);
        const rocYear = date.getFullYear() - 1911;
        const fDate = `${rocYear}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
        const adjFactor = adjclose[i] / result.indicators.quote[0].close[i];
        return [ fDate, stockNo, '', (result.indicators.quote[0].open[i] * adjFactor), (result.indicators.quote[0].high[i] * adjFactor), (result.indicators.quote[0].low[i] * adjFactor), adjclose[i], (adjclose[i] - (adjclose[i-1] || adjclose[i])), result.indicators.quote[0].volume[i] ];
    }).filter(Boolean);
    return { stockName: result.meta.shortName || symbol, iTotalRecords: formatted.length, aaData: formatted, dataSource: 'Yahoo Finance' };
}

export default async (req, context) => {
    const params = new URL(req.url).searchParams;
    const stockNo = params.get('stockNo');
    const lookup = params.get('lookup');
    if (!stockNo) return new Response(JSON.stringify({ error: '缺少股票代號' }), { status: 400 });

    const symbol = `${stockNo}.TWO`;

    // --- 關鍵升級：處理專門的名稱查詢請求 ---
    if (lookup === 'name') {
        try {
            console.log(`[TPEX Proxy v9.7] 執行專門的名稱查詢 for ${symbol}`);
            const stockName = await fetchYahooName(symbol);
            return new Response(JSON.stringify({ stockName }), { headers: { 'Content-Type': 'application/json' } });
        } catch (error) {
            console.error(`[TPEX Proxy v9.7] 名稱查詢失敗 for ${symbol}:`, error);
            return new Response(JSON.stringify({ error: '名稱查詢失敗' }), { status: 404 });
        }
    }
    // --- 升級結束 ---

    const startDate = params.get('startDate');
    const endDate = params.get('endDate');
    if (!startDate || !endDate) return new Response(JSON.stringify({ error: '缺少日期範圍' }), { status: 400 });
    
    const cacheKey = `${symbol}_${startDate}_${endDate}`;
    const store = getStore('tpex_cache_store');

    // ... (與 v9.5/v9.6 完全相同的多級快取檢查與回測數據獲取邏輯) ...
    try {
        const cached = await store.get(cacheKey, { type: 'json' });
        if (cached) return new Response(JSON.stringify(cached), { headers: { 'Content-Type': 'application/json' } });
    } catch(e) {}

    try {
        const result = await fetchFromYahoo(stockNo, symbol, startDate, endDate);
        await store.setJSON(cacheKey, result);
        return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
        // FinMind 備援邏輯可在此處添加
        return new Response(JSON.stringify({ error: `主力資料來源請求失敗: ${error.message}` }), { status: 500 });
    }
};
