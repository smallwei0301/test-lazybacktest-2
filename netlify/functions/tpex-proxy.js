// netlify/functions/tpex-proxy.js (v9.4 - Tiered Cache with Blobs & In-Memory Fallback for TPEX)
import { getStore } from '@netlify/blobs';
import fetch from 'node-fetch';

// Tier 2 快取: 記憶體快取 (作為備援)
const inMemoryCache = new Map();

// 檢查是否為流量超限錯誤的輔助函式
function isQuotaError(error) {
    // Netlify Blobs 超限時的錯誤狀態碼通常是 402 Payment Required 或 429 Too Many Requests
    return error.status === 402 || error.status === 429;
}

// 從 Yahoo Finance 獲取資料的輔助函式
async function fetchFromYahoo(stockNo, symbol) {
    console.log(`[TPEX Proxy v9.4] 嘗試主力來源: Yahoo Finance`);
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=20y&interval=1d`;
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
        return [ fDate, stockNo, '', (result.indicators.quote[0].open[i] * adjFactor), (result.indicators.quote[0].high[i] * adjFactor), (result.indicators.quote[0].low[i] * adjFactor), adjclose[i], (adjclose[i] - adjclose[i-1]), result.indicators.quote[0].volume[i] ];
    }).filter(Boolean);
    console.log(`[TPEX Proxy v9.4] 成功從 Yahoo 獲取資料`);
    return { stockName: result.meta.shortName || symbol, iTotalRecords: formatted.length, aaData: formatted, dataSource: 'Yahoo Finance' };
}

// 從 FinMind 獲取資料的輔助函式
async function fetchFromFinMind(stockNo, symbol) {
    console.warn(`[TPEX Proxy v9.4] 嘗試備援來源: FinMind`);
    const finmindToken = process.env.FINMIND_TOKEN;
    if (!finmindToken) throw new Error('未設定 FinMind Token');
    const finmindUrl = `https://api.finmindtrade.com/api/v4/data?dataset=TaiwanStockPriceAdj&data_id=${stockNo}&token=${finmindToken}`;
    const response = await fetch(finmindUrl);
    const data = await response.json();
    if (data.status !== 200) throw new Error(`FinMind 回應錯誤: ${data.msg}`);
    const formatted = data.data.map(d => {
        const date = new Date(d.date);
        const rocYear = date.getFullYear() - 1911;
        const fDate = `${rocYear}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
        return [ fDate, d.stock_id, '', d.open, d.max, d.min, d.close, d.spread, d.Trading_Volume ];
    });
    console.log(`[TPEX Proxy v9.4] 成功從 FinMind 獲取資料`);
    return { stockName: stockNo, iTotalRecords: formatted.length, aaData: formatted, dataSource: 'FinMind (備援)' };
}


export default async (req, context) => {
    const params = new URL(req.url).searchParams;
    const stockNo = params.get('stockNo');
    if (!stockNo) return new Response(JSON.stringify({ error: '缺少股票代號' }), { status: 400 });

    const symbol = `${stockNo}.TWO`;
    const store = getStore('tpex_cache_store');

    // --- Tier 1: 嘗試 Netlify Blobs ---
    try {
        const cached = await store.get(symbol, { type: 'json' });
        if (cached && (Date.now() - cached.timestamp < 12 * 60 * 60 * 1000)) {
            // Check if cached data itself contains an error
            if (cached.data && cached.data.error && (typeof cached.data.error === 'string' && cached.data.error.includes('缺少參數'))) {
                console.warn(`[TPEX Proxy v9.4] 命中 Tier 1 快取 (Blobs) for ${symbol} 但快取數據包含錯誤: ${cached.data.error}，將嘗試重新獲取。`);
                // Fall through to re-fetch data
            } else if (cached.data && cached.data.error) { // Handle other types of errors in cached data
                console.warn(`[TPEX Proxy v9.4] 命中 Tier 1 快取 (Blobs) for ${symbol} 但快取數據包含非預期錯誤: ${cached.data.error}，將嘗試重新獲取。`);
                // Fall through to re-fetch data
            } else {
                console.log(`[TPEX Proxy v9.4] 命中 Tier 1 快取 (Blobs) for ${symbol}`);
                cached.data.dataSource = `${cached.data.dataSource.split(' ')[0]} (快取)`;
                return new Response(JSON.stringify(cached.data), { headers: { 'Content-Type': 'application/json' } });
            }
        }
    } catch (error) {
        if (isQuotaError(error)) {
            console.warn(`[TPEX Proxy v9.4] Tier 1 (Blobs) 流量超限，降級至 Tier 2 (記憶體快取)`);
            if (inMemoryCache.has(symbol) && (Date.now() - inMemoryCache.get(symbol).timestamp < 12 * 60 * 60 * 1000)) {
                console.log(`[TPEX Proxy v9.4] 命中 Tier 2 快取 (Memory) for ${symbol}`);
                const cachedData = inMemoryCache.get(symbol).data;
                cachedData.dataSource = `${cachedData.dataSource.split(' ')[0]} (記憶體快取)`;
                return new Response(JSON.stringify(cachedData), { headers: { 'Content-Type': 'application/json' } });
            }
        } else {
            console.error('[TPEX Proxy v9.4] Netlify Blobs 發生非預期錯誤:', error);
        }
    }
    
    // --- 快取未命中，請求遠端資料 ---
    try {
        const result = await fetchFromYahoo(stockNo, symbol);
        try { await store.setJSON(symbol, { timestamp: Date.now(), data: result }); } catch (e) { console.warn('寫入 Blobs 失敗，僅寫入記憶體快取'); }
        inMemoryCache.set(symbol, { timestamp: Date.now(), data: result });
        return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
    } catch (yahooError) {
        try {
            const result = await fetchFromFinMind(stockNo, symbol);
            try { await store.setJSON(symbol, { timestamp: Date.now(), data: result }); } catch (e) { console.warn('寫入 Blobs 失敗，僅寫入記憶體快取'); }
            inMemoryCache.set(symbol, { timestamp: Date.now(), data: result });
            return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
        } catch (finmindError) {
            console.error('[TPEX Proxy v9.4] 主力與備援全數失敗:', finmindError);
            return new Response(JSON.stringify({ error: `所有資料來源均請求失敗: ${finmindError.message}` }), { status: 500 });
        }
    }
};
