// netlify/functions/tpex-proxy.js (v9.5 - with Server-Side Date Filtering)
import { getStore } from '@netlify/blobs';
import fetch from 'node-fetch';

// Tier 2 快取: 記憶體快取 (保持不變)
const inMemoryCache = new Map();

// 檢查是否為流量超限錯誤的輔助函式 (保持不變)
function isQuotaError(error) {
    return error.status === 402 || error.status === 429;
}

// 升級版的 fetchFromYahoo 輔助函式
async function fetchFromYahoo(stockNo, symbol, startDate, endDate) {
    console.log(`[TPEX Proxy v9.5] 嘗試主力來源: Yahoo Finance`);
    
    // --- 關鍵升級：將日期轉換為 UNIX 時間戳 ---
    const period1 = Math.floor(new Date(startDate).getTime() / 1000);
    const period2 = Math.floor(new Date(endDate).getTime() / 1000);
    
    // 使用 period1 和 period2 參數，而不是固定的 range=20y
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${period1}&period2=${period2}&interval=1d`;
    console.log(`[TPEX Proxy v9.5] 請求精準範圍的 Yahoo URL: ${yahooUrl}`);
    // --- 升級結束 ---

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
    console.log(`[TPEX Proxy v9.5] 成功從 Yahoo 獲取 ${formatted.length} 筆精準資料`);
    return { stockName: result.meta.shortName || symbol, iTotalRecords: formatted.length, aaData: formatted, dataSource: 'Yahoo Finance' };
}

// 從 FinMind 獲取資料的輔助函式 (保持不變)
async function fetchFromFinMind(stockNo, symbol) {
    console.warn(`[TPEX Proxy v9.5] 嘗試備援來源: FinMind`);
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
    console.log(`[TPEX Proxy v9.5] 成功從 FinMind 獲取資料`);
    return { stockName: stockNo, iTotalRecords: formatted.length, aaData: formatted, dataSource: 'FinMind (備援)' };
}

export default async (req, context) => {
    const params = new URL(req.url).searchParams;
    const stockNo = params.get('stockNo');
    // --- 關鍵升級：接收 startDate 和 endDate ---
    const startDate = params.get('startDate');
    const endDate = params.get('endDate');

    if (!stockNo || !startDate || !endDate) {
        return new Response(JSON.stringify({ error: '缺少股票代號或日期範圍' }), { status: 400 });
    }
    // --- 升級結束 ---

    const symbol = `${stockNo}.TWO`;
    // --- 關鍵升級：快取單位現在也應該包含日期範圍 ---
    const cacheKey = `${symbol}_${startDate}_${endDate}`;
    // --- 升級結束 ---
    const store = getStore('tpex_cache_store');

    // --- Tier 1: 嘗試 Netlify Blobs (使用新的 cacheKey) ---
    try {
        const cached = await store.get(cacheKey, { type: 'json' });
        if (cached && (Date.now() - cached.timestamp < 12 * 60 * 60 * 1000)) {
            console.log(`[TPEX Proxy v9.5] 命中 Tier 1 快取 (Blobs) for ${cacheKey}`);
            cached.data.dataSource = `${cached.data.dataSource.split(' ')[0]} (快取)`;
            return new Response(JSON.stringify(cached.data), { headers: { 'Content-Type': 'application/json' } });
        }
    } catch (error) {
        if (isQuotaError(error)) {
            console.warn(`[TPEX Proxy v9.5] Tier 1 (Blobs) 流量超限，降級至 Tier 2 (記憶體快取)`);
            if (inMemoryCache.has(cacheKey) && (Date.now() - inMemoryCache.get(cacheKey).timestamp < 12 * 60 * 60 * 1000)) {
                console.log(`[TPEX Proxy v9.5] 命中 Tier 2 快取 (Memory) for ${cacheKey}`);
                const cachedData = inMemoryCache.get(cacheKey).data;
                cachedData.dataSource = `${cachedData.dataSource.split(' ')[0]} (記憶體快取)`;
                return new Response(JSON.stringify(cachedData), { headers: { 'Content-Type': 'application/json' } });
            }
        } else {
            console.error('[TPEX Proxy v9.5] Netlify Blobs 發生非預期錯誤:', error);
        }
    }
    
    // --- 快取未命中，請求遠端資料 ---
    try {
        // --- 關鍵升級：傳遞日期範圍 ---
        const result = await fetchFromYahoo(stockNo, symbol, startDate, endDate);
        // --- 升級結束 ---
        try { await store.setJSON(cacheKey, { timestamp: Date.now(), data: result }); } catch (e) { console.warn('寫入 Blobs 失敗，僅寫入記憶體快取'); }
        inMemoryCache.set(cacheKey, { timestamp: Date.now(), data: result });
        return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
    } catch (yahooError) {
        // --- 備援邏輯保持不變 ---
        try {
            const result = await fetchFromFinMind(stockNo, symbol);
            try { await store.setJSON(cacheKey, { timestamp: Date.now(), data: result }); } catch (e) { console.warn('寫入 Blobs 失敗，僅寫入記憶體快取'); }
            inMemoryCache.set(cacheKey, { timestamp: Date.now(), data: result });
            return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
        } catch (finmindError) {
            console.error('[TPEX Proxy v9.5] 主力與備援全數失敗:', finmindError);
            return new Response(JSON.stringify({ error: `所有資料來源均請求失敗: ${finmindError.message}` }), { status: 500 });
        }
    }
};
