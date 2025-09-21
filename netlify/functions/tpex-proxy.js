// netlify/functions/tpex-proxy.js (v10.5 - FinMind primary with adaptive retries)
// Patch Tag: LB-DATASOURCE-20241007A
// Patch Tag: LB-FINMIND-RETRY-20241012A
// Patch Tag: LB-BLOBS-LOCAL-20241007B
import { getStore } from '@netlify/blobs';
import fetch from 'node-fetch';
import { fetchGoodinfoAdjustedSeries, GOODINFO_VERSION } from './lib/goodinfo.js';

const TPEX_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 小時
const inMemoryCache = new Map(); // Map<cacheKey, { timestamp, data }>
const inMemoryBlobStores = new Map(); // Map<storeName, MemoryStore>
const DAY_SECONDS = 24 * 60 * 60;
const FINMIND_LEVEL_PATTERN = /your level is register/i;

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
                console.warn('[TPEX Proxy v10.4] Netlify Blobs 未配置，使用記憶體快取模擬。');
                inMemoryBlobStores.set(name, createMemoryBlobStore());
            }
            return inMemoryBlobStores.get(name);
        }
        throw error;
    }
}

function normaliseFinMindErrorMessage(message) {
    if (!message) return 'FinMind 未預期錯誤';
    if (FINMIND_LEVEL_PATTERN.test(message)) {
        return 'FinMind 帳號等級為註冊 (Register)，請升級 Sponsor 方案後再使用此資料來源。';
    }
    return message;
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
    if (memoryHit && Date.now() - memoryHit.timestamp < TPEX_CACHE_TTL_MS) {
        return { ...memoryHit.data, source: 'memory' };
    }

    try {
        const blobHit = await store.get(cacheKey, { type: 'json' });
        if (blobHit && Date.now() - blobHit.timestamp < TPEX_CACHE_TTL_MS) {
            inMemoryCache.set(cacheKey, { timestamp: Date.now(), data: blobHit.data });
            return { ...blobHit.data, source: 'blob' };
        }
    } catch (error) {
        if (isQuotaError(error)) {
            console.warn('[TPEX Proxy v10.2] Blobs 流量受限，改用記憶體快取。');
        } else {
            console.error('[TPEX Proxy v10.2] 讀取 Blobs 時發生錯誤:', error);
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
            console.warn('[TPEX Proxy v10.2] Blobs 流量受限，僅寫入記憶體快取。');
        } else {
            console.error('[TPEX Proxy v10.2] 寫入 Blobs 失敗:', error);
        }
    }
}

async function hydrateFinMindDaily(store, stockNo, adjusted, startDateISO, endDateISO) {
    const token = process.env.FINMIND_TOKEN;
    if (!token) {
        throw new Error('未設定 FinMind Token');
    }
    const dataset = adjusted ? 'TaiwanStockPriceAdj' : 'TaiwanStockPrice';
    const todayISO = new Date().toISOString().split('T')[0];
    let startISO = (startDateISO || '').trim();
    let endISO = (endDateISO || '').trim();
    if (endISO && endISO > todayISO) {
        endISO = todayISO;
    }
    if (startISO && endISO && startISO > endISO) {
        startISO = endISO;
    }
    const requestFinMind = async (omitRange = false) => {
        const url = new URL('https://api.finmindtrade.com/api/v4/data');
        url.searchParams.set('dataset', dataset);
        url.searchParams.set('data_id', stockNo);
        url.searchParams.set('stock_id', stockNo);
        url.searchParams.set('token', token);
        if (!omitRange) {
            if (startISO) url.searchParams.set('start_date', startISO);
            if (endISO) url.searchParams.set('end_date', endISO);
        }

        console.log(`[TPEX Proxy v10.5] 呼叫 FinMind${omitRange ? ' (不帶日期)' : ''}: ${dataset} ${stockNo}`);
        const response = await fetch(url.toString());
        const rawText = await response.text();
        let payload = null;
        try {
            payload = rawText ? JSON.parse(rawText) : null;
        } catch (parseError) {
            console.warn('[TPEX Proxy v10.5] FinMind 回傳非 JSON 內容，保留原始訊息以供除錯。', parseError);
        }

        const responseStatus = response.status;
        const payloadStatus = payload?.status;
        const payloadMessage = payload?.msg || '';

        const isSuccessful = response.ok && payloadStatus === 200 && Array.isArray(payload?.data);
        if (isSuccessful) {
            return payload.data;
        }

        const combinedMessage = payloadMessage || `FinMind HTTP ${responseStatus}`;
        if (!omitRange && (responseStatus === 400 || payloadStatus === 400)) {
            console.warn(`[TPEX Proxy v10.5] FinMind 回應 400，嘗試移除日期參數後重試。原因: ${combinedMessage}`);
            return requestFinMind(true);
        }

        throw new Error(normaliseFinMindErrorMessage(combinedMessage));
    };

    const finmindRows = await requestFinMind(false);

    const rowsByMonth = new Map();
    let stockName = '';
    let prevClose = null;
    for (const item of finmindRows) {
        const isoDate = item.date;
        if (!isoDate) continue;
        const rocDate = isoToRoc(isoDate);
        if (!rocDate) continue;
        if (!stockName && item.stock_name) {
            stockName = item.stock_name;
        }
        const open = safeRound(Number(item.open ?? item.Open ?? item.Opening));
        const high = safeRound(Number(item.max ?? item.high ?? item.High));
        const low = safeRound(Number(item.min ?? item.low ?? item.Low));
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

    const label = adjusted ? 'FinMind (還原備援)' : 'FinMind (主來源)';
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
    const symbol = `${stockNo}.TWO`;
    console.log(`[TPEX Proxy v10.2] 嘗試 Yahoo Finance: ${symbol}`);
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
            continue;
        }
        const referenceClose = adjusted
            ? (Number.isFinite(baseClose)
                ? baseClose
                : Number.isFinite(adjCloseVal)
                    ? adjCloseVal
                    : Number.isFinite(baseOpen)
                        ? baseOpen
                        : null)
            : baseClose;
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
            const rawClose = referenceClose;
            finalClose = safeRound(rawClose);
            finalOpen = safeRound(Number.isFinite(baseOpen) ? baseOpen : rawClose);
            finalHigh = safeRound(Number.isFinite(baseHigh) ? baseHigh : Math.max(finalOpen ?? rawClose, rawClose));
            finalLow = safeRound(Number.isFinite(baseLow) ? baseLow : Math.min(finalOpen ?? rawClose, rawClose));
            const prev = Number.isFinite(prevRawClose) ? prevRawClose : null;
            change = prev !== null && finalClose !== null ? safeRound(finalClose - prev) : 0;
            prevRawClose = finalClose ?? prevRawClose;
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

async function hydrateGoodinfoAdjusted(store, stockNo, startDateISO, endDateISO) {
    console.log(`[TPEX Proxy ${GOODINFO_VERSION}] 嘗試 Goodinfo 還原資料: ${stockNo} (${startDateISO} ~ ${endDateISO})`);
    const result = await fetchGoodinfoAdjustedSeries(fetch, stockNo, {
        startISO: startDateISO,
        endISO: endDateISO,
    });
    if (!result || !Array.isArray(result.rows) || result.rows.length === 0) {
        throw new Error('Goodinfo 未回傳還原股價資料');
    }
    const buckets = new Map();
    const stockName = result.stockName || stockNo;
    for (const row of result.rows) {
        const isoDate = row.date;
        if (!isoDate) continue;
        const rocDate = isoToRoc(isoDate);
        if (!rocDate) continue;
        const monthKey = isoDate.slice(0, 7).replace('-', '');
        if (!buckets.has(monthKey)) buckets.set(monthKey, []);

        const adjClose = Number.isFinite(row.adjClose) ? row.adjClose : null;
        const adjOpen = Number.isFinite(row.adjOpen) ? row.adjOpen : null;
        const adjHigh = Number.isFinite(row.adjHigh) ? row.adjHigh : null;
        const adjLow = Number.isFinite(row.adjLow) ? row.adjLow : null;
        const rawClose = Number.isFinite(row.rawClose) ? row.rawClose : null;
        const rawOpen = Number.isFinite(row.rawOpen) ? row.rawOpen : null;
        const rawHigh = Number.isFinite(row.rawHigh) ? row.rawHigh : null;
        const rawLow = Number.isFinite(row.rawLow) ? row.rawLow : null;

        const baseClose = adjClose ?? rawClose;
        if (!Number.isFinite(baseClose)) {
            continue;
        }

        const open = safeRound(adjOpen ?? rawOpen ?? baseClose);
        const close = safeRound(adjClose ?? baseClose);
        const high = safeRound(
            adjHigh ?? rawHigh ?? Math.max(open ?? baseClose, close ?? baseClose),
        );
        const low = safeRound(
            adjLow ?? rawLow ?? Math.min(open ?? baseClose, close ?? baseClose),
        );
        const change = safeRound(row.change ?? 0) ?? 0;
        const volume = Number.isFinite(row.volume) ? Math.round(row.volume) : 0;

        if (close === null || close === undefined) continue;
        const finalOpen = open ?? close;
        const finalHigh = high ?? Math.max(finalOpen, close);
        const finalLow = low ?? Math.min(finalOpen, close);

        buckets.get(monthKey).push([
            rocDate,
            stockNo,
            stockName,
            finalOpen,
            finalHigh,
            finalLow,
            close,
            change,
            volume,
        ]);
    }

    if (buckets.size === 0) {
        throw new Error('Goodinfo 資料解析後無有效筆數');
    }

    for (const [monthKey, rows] of buckets.entries()) {
        rows.sort((a, b) => new Date(rocToISO(a[0])) - new Date(rocToISO(b[0])));
        await writeCache(store, buildMonthCacheKey(stockNo, monthKey, true), {
            stockName,
            aaData: rows,
            dataSource: 'Goodinfo (還原備援)',
            meta: { goodinfoVersion: GOODINFO_VERSION },
        });
    }

    return 'Goodinfo (還原備援)';
}

function summariseSources(flags, adjusted) {
    if (flags.size === 0) return adjusted ? 'Yahoo Finance' : 'FinMind';
    if (flags.size === 1) return Array.from(flags)[0];
    const labels = Array.from(flags);
    const hasCache = labels.some(label => /快取|cache|記憶體/i.test(label));
    const primaryYahoo = labels.find(label => /Yahoo Finance/i.test(label));
    const primaryFinMind = labels.find(label => /FinMind/i.test(label));
    const primaryGoodinfo = labels.find(label => /Goodinfo/i.test(label));
    const primary = primaryYahoo || primaryFinMind || primaryGoodinfo || (adjusted ? 'Yahoo Finance' : 'FinMind');
    if (hasCache) return `${primary} (快取)`;
    return primary;
}

function validateForceSource(adjusted, forceSource) {
    if (!forceSource) return null;
    const normalized = forceSource.toLowerCase();
    if (adjusted) {
        if (normalized === 'yahoo' || normalized === 'goodinfo') return normalized;
        throw new Error('還原模式僅支援 Yahoo 或 Goodinfo 測試來源');
    }
    if (normalized === 'finmind' || normalized === 'yahoo') return normalized;
    throw new Error('原始模式僅支援 FinMind 或 Yahoo 測試來源');
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
            return new Response(JSON.stringify({ stockName: stockNo, iTotalRecords: 0, aaData: [], dataSource: adjusted ? 'Yahoo Finance' : 'FinMind' }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        let forcedSource = null;
        try {
            forcedSource = validateForceSource(adjusted, forceSourceParam);
        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), { status: 400 });
        }

        const store = obtainStore('tpex_cache_store');
        const combinedRows = [];
        const sourceFlags = new Set();
        let stockName = '';
        let yahooHydrated = false;
        let yahooLabel = '';
        let finmindHydrated = false;
        let finmindLabel = '';
        let goodinfoHydrated = false;
        let goodinfoLabel = '';

        for (const month of months) {
            const cacheKey = buildMonthCacheKey(stockNo, month, adjusted);
            const monthStart = new Date(Number(month.slice(0, 4)), Number(month.slice(4)) - 1, 1);
            const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
            const rangeStart = startDate > monthStart ? startDate : monthStart;
            const rangeEnd = endDate < monthEnd ? endDate : monthEnd;

            let payload = null;
            if (forcedSource) {
                if (forcedSource === 'finmind') {
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
                        console.error('[TPEX Proxy v10.2] 強制 FinMind 失敗:', error);
                        return new Response(JSON.stringify({ error: `FinMind 來源取得失敗: ${error.message}` }), { status: 502 });
                    }
                } else if (forcedSource === 'yahoo') {
                    try {
                        yahooLabel = await persistYahooEntries(
                            store,
                            stockNo,
                            await fetchYahooDaily(stockNo, startDate, endDate),
                            adjusted,
                        );
                        payload = await readCache(store, cacheKey);
                        if (payload) sourceFlags.add(yahooLabel);
                        yahooHydrated = true;
                    } catch (error) {
                        console.error('[TPEX Proxy v10.2] 強制 Yahoo 失敗:', error);
                        return new Response(JSON.stringify({ error: `Yahoo 來源取得失敗: ${error.message}` }), { status: 502 });
                    }
                } else if (forcedSource === 'goodinfo') {
                    try {
                        goodinfoLabel = await hydrateGoodinfoAdjusted(
                            store,
                            stockNo,
                            startDate.toISOString().split('T')[0],
                            endDate.toISOString().split('T')[0],
                        );
                        payload = await readCache(store, cacheKey);
                        if (payload) sourceFlags.add(goodinfoLabel);
                        goodinfoHydrated = true;
                    } catch (error) {
                        console.error('[TPEX Proxy v10.2] 強制 Goodinfo 失敗:', error);
                        return new Response(JSON.stringify({ error: `Goodinfo 來源取得失敗: ${error.message}` }), { status: 502 });
                    }
                }
            } else {
                payload = await readCache(store, cacheKey);
                if (!payload) {
                    if (adjusted) {
                        let yahooError = null;
                        if (!yahooHydrated) {
                            try {
                                yahooLabel = await persistYahooEntries(
                                    store,
                                    stockNo,
                                    await fetchYahooDaily(stockNo, startDate, endDate),
                                    true,
                                );
                                yahooHydrated = true;
                            } catch (error) {
                                yahooError = error;
                                console.error('[TPEX Proxy v10.2] Yahoo 還原來源失敗:', error);
                            }
                        }
                        payload = await readCache(store, cacheKey);
                        if (!payload) {
                            if (!goodinfoHydrated) {
                                try {
                                    goodinfoLabel = await hydrateGoodinfoAdjusted(
                                        store,
                                        stockNo,
                                        startDate.toISOString().split('T')[0],
                                        endDate.toISOString().split('T')[0],
                                    );
                                    goodinfoHydrated = true;
                                } catch (error) {
                                    console.error('[TPEX Proxy v10.2] Goodinfo 還原來源失敗:', error);
                                    if (yahooError) {
                                        return new Response(
                                            JSON.stringify({
                                                error: `Yahoo 還原來源取得失敗: ${yahooError.message}; Goodinfo 備援亦失敗: ${error.message}`,
                                            }),
                                            { status: 502 },
                                        );
                                    }
                                    return new Response(
                                        JSON.stringify({ error: `Goodinfo 還原來源取得失敗: ${error.message}` }),
                                        { status: 502 },
                                    );
                                }
                            }
                            payload = await readCache(store, cacheKey);
                            if (payload) {
                                if (payload.dataSource) sourceFlags.add(payload.dataSource);
                                else if (goodinfoLabel) sourceFlags.add(goodinfoLabel);
                            } else if (yahooError) {
                                return new Response(
                                    JSON.stringify({ error: `Yahoo 還原來源取得失敗: ${yahooError.message}` }),
                                    { status: 502 },
                                );
                            } else {
                                return new Response(
                                    JSON.stringify({ error: 'Goodinfo 還原來源取得失敗: 未取得任何資料' }),
                                    { status: 502 },
                                );
                            }
                        } else {
                            if (payload.dataSource) sourceFlags.add(payload.dataSource);
                            else if (yahooLabel) sourceFlags.add(yahooLabel);
                        }
                    } else {
                        if (!finmindHydrated) {
                            try {
                                finmindLabel = await hydrateFinMindDaily(
                                    store,
                                    stockNo,
                                    false,
                                    startDate.toISOString().split('T')[0],
                                    endDate.toISOString().split('T')[0],
                                );
                            } catch (error) {
                                console.warn('[TPEX Proxy v10.2] FinMind 主來源失敗:', error.message);
                                try {
                                yahooLabel = await persistYahooEntries(
                                    store,
                                    stockNo,
                                    await fetchYahooDaily(stockNo, startDate, endDate),
                                    false,
                                );
                                } catch (yahooError) {
                                    console.error('[TPEX Proxy v10.2] Yahoo 備援失敗:', yahooError);
                                    return new Response(
                                        JSON.stringify({ error: `Yahoo 備援來源取得失敗: ${yahooError.message}` }),
                                        { status: 502 },
                                    );
                                }
                                yahooHydrated = true;
                            }
                            finmindHydrated = true;
                        }
                        payload = await readCache(store, cacheKey);
                        if (payload && payload.dataSource) {
                            sourceFlags.add(payload.dataSource);
                        } else if (payload && finmindLabel) {
                            sourceFlags.add(finmindLabel);
                        }
                    }
                } else {
                    if (payload.source === 'blob') {
                        sourceFlags.add('TPEX (快取)');
                    } else if (payload.source === 'memory') {
                        sourceFlags.add('TPEX (記憶體快取)');
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
            dataSource: summariseSources(sourceFlags, adjusted),
        };

        return new Response(JSON.stringify(body), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('[TPEX Proxy v10.2] 發生未預期錯誤:', error);
        return new Response(JSON.stringify({ error: error.message || 'TPEX Proxy error' }), { status: 500 });
    }
};
