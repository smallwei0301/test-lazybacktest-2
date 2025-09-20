// netlify/functions/twse-proxy.js (v10.4 - TWSE primary with range-limited Yahoo/FinMind fallbacks)
// Patch Tag: LB-DATASOURCE-20241007A
// Patch Tag: LB-BLOBS-LOCAL-20241007B
import { getStore } from '@netlify/blobs';
import fetch from 'node-fetch';

const TWSE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 小時
const inMemoryCache = new Map(); // Map<cacheKey, { timestamp, data }>
const inMemoryBlobStores = new Map(); // Map<storeName, MemoryStore>
const DAY_SECONDS = 24 * 60 * 60;

function isQuotaError(error) {
    return error?.status === 402 || error?.status === 429;
}

function createMemoryBlobStore() {
    const memory = new Map();
    return {
        async get(key) {
            return memory.get(key) || null;
        },
        async setJSON(key, value) {
            memory.set(key, value);
        },
    };
}

function obtainStore(name) {
    try {
        return getStore(name);
    } catch (error) {
        if (error?.name === 'MissingBlobsEnvironmentError') {
            if (!inMemoryBlobStores.has(name)) {
                console.warn('[TWSE Proxy v10.4] Netlify Blobs 未配置，使用記憶體快取模擬。');
                inMemoryBlobStores.set(name, createMemoryBlobStore());
            }
            return inMemoryBlobStores.get(name);
        }
        throw error;
    }
}

function pad2(value) {
    return String(value).padStart(2, '0');
}

function parseDate(value) {
    if (!value) return null;
    const isoCandidate = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoCandidate)) {
        const iso = new Date(isoCandidate);
        return Number.isNaN(iso.getTime()) ? null : iso;
    }
    if (/^\d{6}$/.test(isoCandidate)) {
        const year = Number(isoCandidate.slice(0, 4));
        const month = Number(isoCandidate.slice(4)) - 1;
        const date = new Date(year, month, 1);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    if (/^\d{8}$/.test(isoCandidate)) {
        const year = Number(isoCandidate.slice(0, 4));
        const month = Number(isoCandidate.slice(4, 6)) - 1;
        const day = Number(isoCandidate.slice(6));
        const date = new Date(year, month, day);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    if (/^\d{2,3}\/\d{1,2}\/\d{1,2}$/.test(isoCandidate)) {
        const [rocYear, month, day] = isoCandidate.split('/').map(Number);
        const date = new Date(rocYear + 1911, month - 1, day);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    return null;
}

function cloneDate(value) {
    if (!value) return null;
    if (value instanceof Date) {
        const cloned = new Date(value.getTime());
        return Number.isNaN(cloned.getTime()) ? null : cloned;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function ensureMonthList(startDate, endDate) {
    const months = [];
    const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const last = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    while (cursor <= last) {
        months.push(`${cursor.getFullYear()}${pad2(cursor.getMonth() + 1)}`);
        cursor.setMonth(cursor.getMonth() + 1);
    }
    return months;
}

function isoToRoc(isoDate) {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return null;
    const rocYear = date.getFullYear() - 1911;
    return `${rocYear}/${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}`;
}

function rocToISO(rocDate) {
    if (!rocDate) return null;
    const parts = String(rocDate).trim().split('/');
    if (parts.length !== 3) return null;
    const [rocYear, month, day] = parts.map(Number);
    if (!rocYear || !month || !day) return null;
    const year = rocYear + 1911;
    return `${year}-${pad2(month)}-${pad2(day)}`;
}

function withinRange(rocDate, start, end) {
    const iso = rocToISO(rocDate);
    if (!iso) return false;
    const d = new Date(iso);
    return !(Number.isNaN(d.getTime()) || d < start || d > end);
}

function buildMonthCacheKey(stockNo, monthKey, adjusted) {
    return `${stockNo}_${monthKey}${adjusted ? '_ADJ' : ''}`;
}

function safeRound(value) {
    return Number.isFinite(value) ? Number(value.toFixed(4)) : null;
}

async function readCache(store, cacheKey) {
    const memoryHit = inMemoryCache.get(cacheKey);
    if (memoryHit && Date.now() - memoryHit.timestamp < TWSE_CACHE_TTL_MS) {
        return { ...memoryHit.data, source: 'memory' };
    }

    try {
        const blobHit = await store.get(cacheKey, { type: 'json' });
        if (blobHit && Date.now() - blobHit.timestamp < TWSE_CACHE_TTL_MS) {
            inMemoryCache.set(cacheKey, { timestamp: Date.now(), data: blobHit.data });
            return { ...blobHit.data, source: 'blob' };
        }
    } catch (error) {
        if (isQuotaError(error)) {
            console.warn('[TWSE Proxy v10.2] Blobs 流量受限，改用記憶體快取。');
        } else {
            console.error('[TWSE Proxy v10.2] 讀取 Blobs 時發生錯誤:', error);
        }
    }
    return null;
}

async function writeCache(store, cacheKey, payload) {
    const record = { timestamp: Date.now(), data: payload };
    inMemoryCache.set(cacheKey, record);
    try {
        await store.setJSON(cacheKey, record);
    } catch (error) {
        if (isQuotaError(error)) {
            console.warn('[TWSE Proxy v10.2] Blobs 流量受限，僅寫入記憶體快取。');
        } else {
            console.error('[TWSE Proxy v10.2] 寫入 Blobs 失敗:', error);
        }
    }
}

function parseTWSEPayload(raw, stockNo) {
    if (!raw || raw.stat !== 'OK' || !Array.isArray(raw.data)) {
        return { stockName: stockNo, aaData: [] };
    }
    const stockName = raw.title?.split(' ')?.[2] || stockNo;
    const aaData = raw.data.map(item => {
        const parseNumber = (val) => {
            const num = Number(String(val).replace(/,/g, ''));
            return Number.isFinite(num) ? num : null;
        };
        const open = parseNumber(item[3]);
        const high = parseNumber(item[4]);
        const low = parseNumber(item[5]);
        const close = parseNumber(item[6]);
        const change = parseNumber(item[8]);
        const volume = parseNumber(item[1]) || 0;
        return [
            item[0],
            stockNo,
            stockName,
            open,
            high,
            low,
            close,
            change,
            volume,
        ];
    });
    return { stockName, aaData };
}

async function fetchTwseMonth(stockNo, monthKey) {
    const url = `https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=${monthKey}01&stockNo=${stockNo}`;
    console.log(`[TWSE Proxy v10.2] 下載 ${stockNo} 的 ${monthKey} 月資料`);
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!response.ok) {
        throw new Error(`TWSE HTTP ${response.status}`);
    }
    const json = await response.json();
    if (json?.stat !== 'OK') {
        throw new Error(`TWSE 回應異常: ${json?.stat || '未知錯誤'}`);
    }
    return { ...parseTWSEPayload(json, stockNo), dataSource: 'TWSE' };
}

async function hydrateFinMindDaily(store, stockNo, adjusted, startDateISO, endDateISO) {
    const token = process.env.FINMIND_TOKEN;
    if (!token) {
        throw new Error('未設定 FinMind Token');
    }
    const dataset = adjusted ? 'TaiwanStockPriceAdj' : 'TaiwanStockPrice';
    const todayISO = new Date().toISOString().split('T')[0];
    let startISO = startDateISO || '';
    let endISO = endDateISO || '';
    if (endISO && endISO > todayISO) {
        endISO = todayISO;
    }
    if (startISO && endISO && startISO > endISO) {
        startISO = endISO;
    }
    const url = new URL('https://api.finmindtrade.com/api/v4/data');
    url.searchParams.set('dataset', dataset);
    url.searchParams.set('data_id', stockNo);
    url.searchParams.set('token', token);
    if (startISO) url.searchParams.set('start_date', startISO);
    if (endISO) url.searchParams.set('end_date', endISO);

    console.log(`[TWSE Proxy v10.2] 呼叫 FinMind: ${dataset} ${stockNo}`);
    const response = await fetch(url.toString());
    if (!response.ok) {
        throw new Error(`FinMind HTTP ${response.status}`);
    }
    const json = await response.json();
    if (json?.status !== 200 || !Array.isArray(json?.data)) {
        throw new Error(`FinMind 回應錯誤: ${json?.msg || '未知錯誤'}`);
    }

    const rowsByMonth = new Map();
    let stockName = '';
    let prevClose = null;
    for (const item of json.data) {
        const isoDate = item.date;
        if (!isoDate) continue;
        const rocDate = isoToRoc(isoDate);
        if (!rocDate) continue;
        if (!stockName && item.stock_name) {
            stockName = item.stock_name;
        }
        const open = safeRound(Number(item.open ?? item.Open ?? item.Opening));
        const high = safeRound(Number(item.max ?? item.High ?? item.high));
        const low = safeRound(Number(item.min ?? item.Low ?? item.low));
        const closeValue = safeRound(Number(item.close ?? item.Close));
        const volumeValue = Number(item.Trading_Volume ?? item.volume ?? item.Volume ?? 0);
        const changeValue = Number(item.spread ?? item.change ?? item.Change ?? null);
        const finalOpen = open ?? closeValue ?? 0;
        const finalHigh = high ?? Math.max(finalOpen, closeValue ?? finalOpen);
        const finalLow = low ?? Math.min(finalOpen, closeValue ?? finalOpen);
        const finalClose = closeValue ?? finalOpen;
        const finalChange = Number.isFinite(changeValue)
            ? safeRound(changeValue)
            : (prevClose !== null && finalClose !== null
                ? safeRound(finalClose - prevClose)
                : 0);
        prevClose = finalClose ?? prevClose;
        const volume = Number.isFinite(volumeValue) ? Math.round(volumeValue) : 0;
        const monthKey = isoDate.slice(0, 7).replace('-', '');
        if (!rowsByMonth.has(monthKey)) rowsByMonth.set(monthKey, []);
        rowsByMonth.get(monthKey).push([
            rocDate,
            stockNo,
            stockName || stockNo,
            safeRound(finalOpen),
            safeRound(finalHigh),
            safeRound(finalLow),
            safeRound(finalClose),
            finalChange ?? 0,
            volume,
        ]);
    }

    const label = adjusted ? 'FinMind (還原備援)' : 'FinMind (原始備援)';
    for (const [monthKey, rows] of rowsByMonth.entries()) {
        rows.sort((a, b) => new Date(rocToISO(a[0])) - new Date(rocToISO(b[0])));
        await writeCache(store, buildMonthCacheKey(stockNo, monthKey, adjusted), {
            stockName: stockName || stockNo,
            aaData: rows,
            dataSource: label,
        });
    }
    return label;
}

function buildYahooPeriodRange(startDate, endDate) {
    const now = new Date();
    let from = cloneDate(startDate);
    let to = cloneDate(endDate);
    if (!from) {
        from = new Date(now);
        from.setFullYear(from.getFullYear() - 10);
    } else {
        from.setMonth(from.getMonth() - 2);
    }
    if (!to) {
        to = new Date(now);
    } else {
        to.setMonth(to.getMonth() + 2);
    }
    if (to > now) {
        to = new Date(now);
    }
    if (to <= from) {
        to = new Date(from.getTime() + DAY_SECONDS * 1000);
    }
    const period1 = Math.max(0, Math.floor(from.getTime() / 1000));
    const period2 = Math.max(period1 + DAY_SECONDS, Math.floor(to.getTime() / 1000) + DAY_SECONDS);
    return { period1, period2 };
}

async function fetchYahooDaily(stockNo, startDate, endDate) {
    const symbol = `${stockNo}.TW`;
    console.log(`[TWSE Proxy v10.2] 嘗試 Yahoo Finance: ${symbol}`);
    const { period1, period2 } = buildYahooPeriodRange(startDate, endDate);
    const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`);
    url.searchParams.set('interval', '1d');
    url.searchParams.set('includeAdjustedClose', 'true');
    if (Number.isFinite(period1)) url.searchParams.set('period1', String(period1));
    if (Number.isFinite(period2)) url.searchParams.set('period2', String(period2));
    const response = await fetch(url.toString(), { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!response.ok) {
        throw new Error(`Yahoo HTTP ${response.status}`);
    }
    const json = await response.json();
    if (json?.chart?.error) {
        throw new Error(`Yahoo 回應錯誤: ${json.chart.error.description}`);
    }
    const result = json?.chart?.result?.[0];
    if (!result || !Array.isArray(result.timestamp)) {
        throw new Error('Yahoo 回傳資料格式異常');
    }
    return {
        stockName: result.meta?.shortName || stockNo,
        quote: result.indicators?.quote?.[0] || {},
        adjclose: result.indicators?.adjclose?.[0]?.adjclose || [],
        timestamps: result.timestamp,
    };
}

async function persistYahooEntries(store, stockNo, yahooData, adjusted) {
    const { stockName, quote, adjclose, timestamps } = yahooData;
    const monthlyBuckets = new Map();
    let prevRawClose = null;
    let prevAdjClose = null;
    for (let i = 0; i < timestamps.length; i += 1) {
        const ts = timestamps[i];
        if (!Number.isFinite(ts)) continue;
        const date = new Date(ts * 1000);
        if (Number.isNaN(date.getTime())) continue;
        const isoDate = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
        const rocDate = isoToRoc(isoDate);
        if (!rocDate) continue;
        const baseClose = Number(quote.close?.[i]);
        const baseOpen = Number(quote.open?.[i]);
        const baseHigh = Number(quote.high?.[i]);
        const baseLow = Number(quote.low?.[i]);
        const adjCloseVal = Number(adjclose?.[i]);
        const volumeVal = Number(quote.volume?.[i]) || 0;
        if (!adjusted && !Number.isFinite(baseClose)) {
            // 原始價模式需要有效的 raw close
            continue;
        }
        const referenceClose = Number.isFinite(baseClose)
            ? baseClose
            : Number.isFinite(adjCloseVal)
                ? adjCloseVal
                : Number.isFinite(baseOpen)
                    ? baseOpen
                    : null;
        if (!Number.isFinite(referenceClose)) continue;
        const monthKey = isoDate.slice(0, 7).replace('-', '');
        if (!monthlyBuckets.has(monthKey)) monthlyBuckets.set(monthKey, []);

        let finalOpen;
        let finalHigh;
        let finalLow;
        let finalClose;
        let change;
        if (adjusted) {
            const finalAdjClose = Number.isFinite(adjCloseVal) ? adjCloseVal : referenceClose;
            const scale = referenceClose ? finalAdjClose / referenceClose : 1;
            finalClose = safeRound(finalAdjClose);
            finalOpen = safeRound((Number.isFinite(baseOpen) ? baseOpen : referenceClose) * scale);
            finalHigh = safeRound((Number.isFinite(baseHigh) ? baseHigh : Math.max(referenceClose, finalAdjClose)) * scale);
            finalLow = safeRound((Number.isFinite(baseLow) ? baseLow : Math.min(referenceClose, finalAdjClose)) * scale);
            const prev = Number.isFinite(prevAdjClose) ? prevAdjClose : null;
            change = prev !== null && finalClose !== null ? safeRound(finalClose - prev) : 0;
            prevAdjClose = finalClose ?? prevAdjClose;
            if (Number.isFinite(referenceClose)) {
                prevRawClose = safeRound(referenceClose);
            }
        } else {
            const rawClose = Number.isFinite(baseClose) ? baseClose : referenceClose;
            finalClose = safeRound(rawClose);
            finalOpen = safeRound(Number.isFinite(baseOpen) ? baseOpen : rawClose);
            finalHigh = safeRound(Number.isFinite(baseHigh) ? baseHigh : Math.max(finalOpen ?? rawClose, rawClose));
            finalLow = safeRound(Number.isFinite(baseLow) ? baseLow : Math.min(finalOpen ?? rawClose, rawClose));
            const prev = Number.isFinite(prevRawClose) ? prevRawClose : null;
            change = prev !== null && finalClose !== null ? safeRound(finalClose - prev) : 0;
            prevRawClose = finalClose ?? prevRawClose;
            if (Number.isFinite(adjCloseVal)) {
                prevAdjClose = safeRound(adjCloseVal);
            }
        }

        if (finalOpen === null || finalHigh === null || finalLow === null || finalClose === null) {
            continue;
        }
        const volume = Number.isFinite(volumeVal) ? Math.round(volumeVal) : 0;
        monthlyBuckets.get(monthKey).push([
            rocDate,
            stockNo,
            stockName || stockNo,
            finalOpen,
            finalHigh,
            finalLow,
            finalClose,
            change || 0,
            volume,
        ]);
    }

    const label = adjusted ? 'Yahoo Finance (還原)' : 'Yahoo Finance (原始備援)';
    for (const [monthKey, rows] of monthlyBuckets.entries()) {
        rows.sort((a, b) => new Date(rocToISO(a[0])) - new Date(rocToISO(b[0])));
        await writeCache(store, buildMonthCacheKey(stockNo, monthKey, adjusted), {
            stockName: stockName || stockNo,
            aaData: rows,
            dataSource: label,
        });
    }
    return label;
}

function summariseSources(flags) {
    if (flags.size === 0) return 'TWSE';
    if (flags.size === 1) return Array.from(flags)[0];
    const labels = Array.from(flags);
    const hasCache = labels.some(label => /快取|cache|記憶體/i.test(label));
    const hasRemote = labels.some(label => /TWSE|FinMind|Yahoo/i.test(label));
    const primaryYahoo = labels.find(label => /Yahoo Finance/i.test(label));
    const primaryTwse = labels.find(label => /^TWSE( |$)/i.test(label));
    const primaryFinMind = labels.find(label => /FinMind/i.test(label));
    const primary = primaryYahoo || primaryTwse || primaryFinMind || 'TWSE';
    if (hasRemote && hasCache) return `${primary} (部分快取)`;
    if (hasCache) return `${primary} (快取)`;
    return primary;
}

function validateForceSource(adjusted, forceSource) {
    if (!forceSource) return null;
    const normalized = forceSource.toLowerCase();
    if (adjusted) {
        if (normalized === 'yahoo' || normalized === 'finmind') return normalized;
        throw new Error('還原模式僅支援 Yahoo 或 FinMind 測試來源');
    }
    if (normalized === 'twse' || normalized === 'finmind') return normalized;
    throw new Error('原始模式僅支援 TWSE 或 FinMind 測試來源');
}

export default async (req) => {
    try {
        const params = new URL(req.url).searchParams;
        const stockNo = params.get('stockNo');
        if (!stockNo) {
            return new Response(JSON.stringify({ error: '缺少股票代號' }), { status: 400 });
        }

        const monthParam = params.get('month');
        const startParam = params.get('start');
        const endParam = params.get('end');
        const legacyDate = params.get('date');
        const adjusted = params.get('adjusted') === '1' || params.get('adjusted') === 'true';
        const forceSourceParam = params.get('forceSource');

        let startDate = parseDate(startParam);
        let endDate = parseDate(endParam);

        if (!startDate || !endDate) {
            const monthSeed = parseDate(monthParam || legacyDate);
            if (!monthSeed) {
                return new Response(JSON.stringify({ error: '缺少日期範圍' }), { status: 400 });
            }
            const monthStart = new Date(monthSeed.getFullYear(), monthSeed.getMonth(), 1);
            const monthEnd = new Date(monthSeed.getFullYear(), monthSeed.getMonth() + 1, 0);
            startDate = monthStart;
            endDate = monthEnd;
        }

        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
            return new Response(JSON.stringify({ error: '日期範圍無效' }), { status: 400 });
        }

        const months = ensureMonthList(startDate, endDate);
        if (months.length === 0) {
            return new Response(JSON.stringify({ stockName: stockNo, iTotalRecords: 0, aaData: [], dataSource: 'TWSE' }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        let forcedSource = null;
        try {
            forcedSource = validateForceSource(adjusted, forceSourceParam);
        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), { status: 400 });
        }

        const store = obtainStore('twse_cache_store');
        const combinedRows = [];
        const sourceFlags = new Set();
        let stockName = '';
        let yahooHydrated = false;
        let yahooLabel = '';
        let finmindHydrated = false;
        let finmindLabel = '';

        for (const month of months) {
            const cacheKey = buildMonthCacheKey(stockNo, month, adjusted);
            const monthStart = new Date(Number(month.slice(0, 4)), Number(month.slice(4)) - 1, 1);
            const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
            const rangeStart = startDate > monthStart ? startDate : monthStart;
            const rangeEnd = endDate < monthEnd ? endDate : monthEnd;

            let payload = null;
            if (forcedSource) {
                if (forcedSource === 'twse') {
                    try {
                        const fresh = await fetchTwseMonth(stockNo, month);
                        await writeCache(store, cacheKey, { stockName: fresh.stockName, aaData: fresh.aaData, dataSource: 'TWSE (強制)' });
                        payload = await readCache(store, cacheKey);
                        sourceFlags.add('TWSE (強制)');
                    } catch (error) {
                        console.error('[TWSE Proxy v10.2] 強制 TWSE 失敗:', error);
                        return new Response(JSON.stringify({ error: `TWSE 來源取得失敗: ${error.message}` }), { status: 502 });
                    }
                } else if (forcedSource === 'finmind') {
                    try {
                        finmindLabel = await hydrateFinMindDaily(
                            store,
                            stockNo,
                            adjusted,
                            startDate.toISOString().split('T')[0],
                            endDate.toISOString().split('T')[0],
                        );
                        payload = await readCache(store, cacheKey);
                        if (payload) sourceFlags.add(finmindLabel);
                        finmindHydrated = true;
                    } catch (error) {
                        console.error('[TWSE Proxy v10.2] 強制 FinMind 失敗:', error);
                        return new Response(JSON.stringify({ error: `FinMind 來源取得失敗: ${error.message}` }), { status: 502 });
                    }
                } else if (forcedSource === 'yahoo') {
                    try {
                        yahooLabel = await persistYahooEntries(
                            store,
                            stockNo,
                            await fetchYahooDaily(stockNo, startDate, endDate),
                            true,
                        );
                        payload = await readCache(store, cacheKey);
                        if (payload) sourceFlags.add(yahooLabel);
                        yahooHydrated = true;
                    } catch (error) {
                        console.error('[TWSE Proxy v10.2] 強制 Yahoo 失敗:', error);
                        return new Response(JSON.stringify({ error: `Yahoo 來源取得失敗: ${error.message}` }), { status: 502 });
                    }
                }
            } else {
                payload = await readCache(store, cacheKey);
                if (!payload) {
                    if (adjusted) {
                        if (!yahooHydrated) {
                            try {
                                yahooLabel = await persistYahooEntries(
                                    store,
                                    stockNo,
                                    await fetchYahooDaily(stockNo, startDate, endDate),
                                    true,
                                );
                            } catch (error) {
                                console.warn('[TWSE Proxy v10.2] Yahoo 還原來源失敗:', error.message);
                                try {
                                    finmindLabel = await hydrateFinMindDaily(
                                        store,
                                        stockNo,
                                        true,
                                        startDate.toISOString().split('T')[0],
                                        endDate.toISOString().split('T')[0],
                                    );
                                } catch (finmindError) {
                                    console.error('[TWSE Proxy v10.2] FinMind 還原備援失敗:', finmindError);
                                    return new Response(JSON.stringify({ error: '無法取得還原股價資料' }), { status: 502 });
                                }
                                finmindHydrated = true;
                            }
                            yahooHydrated = true;
                        }
                        payload = await readCache(store, cacheKey);
                        if (payload) {
                            if (payload.dataSource) sourceFlags.add(payload.dataSource);
                            else if (yahooLabel) sourceFlags.add(yahooLabel);
                            else if (finmindLabel) sourceFlags.add(finmindLabel);
                        }
                    } else {
                        try {
                            const fresh = await fetchTwseMonth(stockNo, month);
                            await writeCache(store, cacheKey, { stockName: fresh.stockName, aaData: fresh.aaData, dataSource: 'TWSE' });
                            payload = await readCache(store, cacheKey);
                            sourceFlags.add('TWSE');
                        } catch (error) {
                            console.warn(`[TWSE Proxy v10.2] TWSE 主來源失敗 (${month}):`, error.message);
                            if (!finmindHydrated) {
                                try {
                                    finmindLabel = await hydrateFinMindDaily(
                                        store,
                                        stockNo,
                                        false,
                                        startDate.toISOString().split('T')[0],
                                        endDate.toISOString().split('T')[0],
                                    );
                                } catch (finmindError) {
                                    console.error('[TWSE Proxy v10.2] FinMind 備援失敗:', finmindError);
                                    return new Response(JSON.stringify({ error: '無法取得原始股價資料' }), { status: 502 });
                                }
                                finmindHydrated = true;
                            }
                            payload = await readCache(store, cacheKey);
                            if (payload && finmindLabel) sourceFlags.add(finmindLabel);
                        }
                    }
                } else {
                    if (payload.source === 'blob') {
                        sourceFlags.add('TWSE (快取)');
                    } else if (payload.source === 'memory') {
                        sourceFlags.add('TWSE (記憶體快取)');
                    }
                    if (payload.dataSource) {
                        sourceFlags.add(payload.dataSource);
                    }
                }
            }

            if (!payload) continue;
            if (!stockName && payload.stockName) {
                stockName = payload.stockName;
            }
            if (payload.dataSource) {
                sourceFlags.add(payload.dataSource);
            }
            const rows = Array.isArray(payload.aaData) ? payload.aaData : [];
            rows.forEach(row => {
                if (withinRange(row[0], rangeStart, rangeEnd)) {
                    combinedRows.push(row.slice());
                }
            });
        }

        const uniqueMap = new Map();
        combinedRows.sort((a, b) => new Date(rocToISO(a[0])) - new Date(rocToISO(b[0])));
        combinedRows.forEach(row => {
            uniqueMap.set(row[0], row);
        });

        const aaData = Array.from(uniqueMap.values());
        const body = {
            stockName: stockName || stockNo,
            iTotalRecords: aaData.length,
            aaData,
            dataSource: summariseSources(sourceFlags),
        };

        return new Response(JSON.stringify(body), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('[TWSE Proxy v10.2] 發生未預期錯誤:', error);
        return new Response(JSON.stringify({ error: error.message || 'TWSE Proxy error' }), { status: 500 });
    }
};
