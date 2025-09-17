// netlify/functions/tpex-proxy.js (v9.1 - Final Yahoo + FinMind Fallback)
const fetch = require('node-fetch');
const cache = new Map();

exports.handler = async function(event, context) {
    const { stockNo } = event.queryStringParameters;
    if (!stockNo) return { statusCode: 400, body: JSON.stringify({ error: '缺少股票代號' }) };

    const symbol = `${stockNo}.TWO`;
    console.log(`[Proxy v9.1] 啟動對 ${symbol} 的數據請求`);

    // 1. 檢查快取
    if (cache.has(symbol) && (Date.now() - cache.get(symbol).timestamp < 12 * 60 * 60 * 1000)) { // 12小時快取
        console.log(`[Proxy v9.1] 命中快取 for ${symbol}`);
        const cachedData = cache.get(symbol).data;
        cachedData.dataSource = `${cachedData.dataSource.split(' ')[0]} (快取)`;
        return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cachedData) };
    }

    // 2. 主力來源：Yahoo Finance
    try {
        console.log(`[Proxy v9.1] 嘗試主力來源: Yahoo Finance`);
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

        const finalResult = { stockName: result.meta.shortName || symbol, iTotalRecords: formatted.length, aaData: formatted, dataSource: 'Yahoo Finance' };
        cache.set(symbol, { timestamp: Date.now(), data: finalResult });
        console.log(`[Proxy v9.1] 成功從 Yahoo 獲取資料`);
        return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(finalResult) };

    } catch (yahooError) {
        console.warn(`[Proxy v9.1] Yahoo 失敗: ${yahooError.message}. 嘗試備援: FinMind...`);
        
        // 3. 備援來源：FinMind
        const finmindToken = process.env.FINMIND_TOKEN;
        if (!finmindToken) {
            console.error('[Proxy v9.1] Yahoo 請求失敗且未設定 FinMind 備援金鑰');
            return { statusCode: 500, body: JSON.stringify({ error: '主力資料來源請求失敗，且未設定備援 API 金鑰' }) };
        }
        
        try {
            // 使用還原權值資料集
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
            
            const finalResult = { stockName: stockNo, iTotalRecords: formatted.length, aaData: formatted, dataSource: 'FinMind (備援)' };
            cache.set(symbol, { timestamp: Date.now(), data: finalResult });
            console.log(`[Proxy v9.1] 成功從 FinMind 獲取資料`);
            return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(finalResult) };

        } catch (finmindError) {
            console.error('[Proxy v9.1] 主力 (Yahoo) 與備援 (FinMind) 全數失敗:', finmindError);
            return { statusCode: 500, body: JSON.stringify({ error: `所有資料來源均請求失敗: ${finmindError.message}` }) };
        }
    }
};