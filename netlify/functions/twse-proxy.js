// netlify/functions/twse-proxy.js (v10.7 - Fugle primary with TWSE fallback and adaptive retries)
// Patch Tag: LB-DATASOURCE-20241007A
// Patch Tag: LB-FINMIND-RETRY-20241012A
// Patch Tag: LB-BLOBS-LOCAL-20241007B
// Patch Tag: LB-TWSE-PROXY-20250320A
// Patch Tag: LB-FUGLE-PRIMARY-20251005A
import { getStore } from '@netlify/blobs';
import fetch from 'node-fetch';

const TWSE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 小時
const inMemoryCache = new Map(); // Map<cacheKey, { timestamp, data }>
const inMemoryBlobStores = new Map(); // Map<storeName, MemoryStore>
const DAY_SECONDS = 24 * 60 * 60;
const FINMIND_LEVEL_PATTERN = /your level is register/i;
const FUGLE_ENDPOINT = 'https://api.fugle.tw/marketdata/v0.3/stock/candles';
const FUGLE_REQUEST_TIMEOUT_MS = 15000;
const FUGLE_LABEL = 'Fugle (API)';

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

function formatISODateFromDate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
    const year = date.getUTCFullYear();
    const month = pad2(date.getUTCMonth() + 1);
    const day = pad2(date.getUTCDate());
    return `${year}-${month}-${day}`;
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

function resolveFugleToken() {
    const token = process.env.FUGLE_API_TOKEN;
    if (!token) return '';
    const trimmed = token.trim();
    return trimmed;
}

function ensureISODateFromFugle(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return null;
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
            return trimmed;
        }
        if (/^\d{4}\/\d{2}\/\d{2}$/.test(trimmed)) {
            const [year, month, day] = trimmed.split('/');
            return `${year}-${pad2(month)}-${pad2(day)}`;
        }
        if (/^\d{8}$/.test(trimmed)) {
            return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6)}`;
        }
    }
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
        const millis = numeric > 1e12 ? numeric : numeric * 1000;
        const date = new Date(millis);
        if (!Number.isNaN(date.getTime())) {
            return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
        }
    }
    return null;
}

function extractFugleCandles(payload) {
    if (!payload) return [];
    if (Array.isArray(payload?.data?.candles)) {
        return payload.data.candles;
    }
    const legacy = payload?.data?.candle || payload?.data?.Candles || null;
    if (legacy && Array.isArray(legacy.o) && Array.isArray(legacy.t)) {
        const length = Math.min(
            legacy.o.length,
            legacy.h?.length ?? legacy.o.length,
            legacy.l?.length ?? legacy.o.length,
            legacy.c?.length ?? legacy.o.length,
            legacy.v?.length ?? legacy.o.length,
            legacy.t.length,
        );
        const entries = [];
        for (let i = 0; i < length; i += 1) {
            entries.push({
                open: legacy.o[i],
                high: legacy.h?.[i],
                low: legacy.l?.[i],
                close: legacy.c?.[i],
                volume: legacy.v?.[i],
                date: legacy.t[i],
            });
        }
        return entries;
    }
    if (Array.isArray(payload?.data)) {
        return payload.data;
    }
    return [];
}

function normaliseFugleEntry(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const isoDate = ensureISODateFromFugle(raw.date ?? raw.time ?? raw.t ?? raw.timestamp ?? raw.ts);
    if (!isoDate) return null;
    const open = Number(raw.open ?? raw.o ?? raw.Open ?? raw.openPrice ?? raw.price?.open);
    const high = Number(raw.high ?? raw.h ?? raw.High ?? raw.price?.high);
    const low = Number(raw.low ?? raw.l ?? raw.Low ?? raw.price?.low);
    const close = Number(raw.close ?? raw.c ?? raw.Close ?? raw.price?.close ?? raw.adjClose ?? raw.adj_close);
    const volume = Number(raw.volume ?? raw.v ?? raw.Volume ?? raw.tradeVolume ?? raw.Trading_Volume ?? 0);
    return {
        isoDate,
        open: Number.isFinite(open) ? open : null,
        high: Number.isFinite(high) ? high : null,
        low: Number.isFinite(low) ? low : null,
        close: Number.isFinite(close) ? close : null,
        volume: Number.isFinite(volume) ? volume : 0,
    };
}

async function hydrateFugleDaily(store, stockNo, startDate, endDate) {
    const token = resolveFugleToken();
    if (!token) {
        throw new Error('未設定 Fugle API Token');
    }
    const fetchStartUtc = Date.UTC(startDate.getFullYear(), startDate.getMonth(), 1);
    const fetchEndUtc = Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() + 1);
    const fromSeconds = Math.floor(fetchStartUtc / 1000);
    const toSeconds = Math.max(fromSeconds + DAY_SECONDS, Math.floor(fetchEndUtc / 1000));

    const url = new URL(FUGLE_ENDPOINT);
    url.searchParams.set('symbol', stockNo);
    url.searchParams.set('resolution', 'D');
    url.searchParams.set('from', String(fromSeconds));
    url.searchParams.set('to', String(toSeconds));
    url.searchParams.set('apiToken', token);

    console.log('[TWSE Proxy v10.7] 呼叫 Fugle API', {
        stockNo,
        from: fromSeconds,
        to: toSeconds,
    });

    const response = await fetch(url.toString(), {
        headers: {
            'X-API-KEY': token,
            Accept: 'application/json',
        },
        timeout: FUGLE_REQUEST_TIMEOUT_MS,
    });
    const rawText = await response.text();
    if (!response.ok) {
        throw new Error(`Fugle HTTP ${response.status} ｜ ${rawText.slice(0, 200)}`);
    }

    let payload = null;
    if (rawText) {
        try {
            payload = JSON.parse(rawText);
        } catch (error) {
            throw new Error('Fugle 回傳非 JSON 內容');
        }
    }

    const info = payload?.data?.info || payload?.data?.Info || {};
    const stockName = (info.name || info.symbolName || info.stockName || info.securityName || '').toString().trim();
    const rawEntries = extractFugleCandles(payload);
    const entries = rawEntries
        .map((row) => normaliseFugleEntry(row))
        .filter((entry) => entry && entry.isoDate);

    if (entries.length === 0) {
        throw new Error('Fugle 回應缺少可用日資料');
    }

    entries.sort((a, b) => (a.isoDate < b.isoDate ? -1 : a.isoDate > b.isoDate ? 1 : 0));

    const monthlyBuckets = new Map();
    let prevClose = null;
    const fetchStartDate = new Date(fetchStartUtc);
    const fetchEndDateExclusive = new Date(fetchEndUtc);

    for (const entry of entries) {
        const iso = entry.isoDate;
        const isoDate = new Date(`${iso}T00:00:00Z`);
        if (Number.isNaN(isoDate.getTime())) continue;
        if (isoDate < fetchStartDate || isoDate >= fetchEndDateExclusive) continue;
        const rocDate = isoToRoc(iso);
        if (!rocDate) continue;
        const monthKey = iso.slice(0, 7).replace('-', '');
        if (!monthlyBuckets.has(monthKey)) {
            monthlyBuckets.set(monthKey, []);
        }

        const finalClose = entry.close ?? entry.open ?? entry.high ?? entry.low ?? null;
        const finalOpen = entry.open ?? finalClose;
        const finalHigh = entry.high ?? Math.max(finalOpen ?? finalClose ?? 0, finalClose ?? finalOpen ?? 0);
        const finalLow = entry.low ?? Math.min(finalOpen ?? finalClose ?? 0, finalClose ?? finalOpen ?? 0);
        const change = prevClose !== null && finalClose !== null ? safeRound(finalClose - prevClose) : 0;
        prevClose = finalClose ?? prevClose;

        if (
            finalOpen === null
            || finalHigh === null
            || finalLow === null
            || finalClose === null
        ) {
            continue;
        }

        monthlyBuckets.get(monthKey).push([
            rocDate,
            stockNo,
            stockName || stockNo,
            safeRound(finalOpen),
            safeRound(finalHigh),
            safeRound(finalLow),
            safeRound(finalClose),
            change || 0,
            Number.isFinite(entry.volume) ? Math.round(entry.volume) : 0,
        ]);
    }

    for (const [monthKey, rows] of monthlyBuckets.entries()) {
        rows.sort((a, b) => new Date(rocToISO(a[0])) - new Date(rocToISO(b[0])));
        await writeCache(store, buildMonthCacheKey(stockNo, monthKey, false), {
            stockName: stockName || stockNo,
            aaData: rows,
            dataSource: FUGLE_LABEL,
        });
    }

    return FUGLE_LABEL;
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

        console.log(`[TWSE Proxy v10.5] 呼叫 FinMind${omitRange ? ' (不帶日期)' : ''}: ${dataset} ${stockNo}`);
        const response = await fetch(url.toString());
        const rawText = await response.text();
        let payload = null;
        try {
            payload = rawText ? JSON.parse(rawText) : null;
        } catch (parseError) {
            console.warn('[TWSE Proxy v10.5] FinMind 回傳非 JSON 內容，保留原始訊息以供除錯。', parseError);
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
            console.warn(`[TWSE Proxy v10.5] FinMind 回應 400，嘗試移除日期參數後重試。原因: ${combinedMessage}`);
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

function parseSourceLabelDescriptor(label) {
    const original = (label || '').toString().trim();
    if (!original) return null;
    let base = original;
    let extra = null;
    const match = original.match(/\(([^)]+)\)\s*$/);
    if (match) {
        extra = match[1].trim();
        base = original.slice(0, match.index).trim() || base;
    }
    const normalizedAll = original.toLowerCase();
    const typeOrder = [
        { pattern: /(瀏覽器|browser|session|local|記憶體|memory)/, type: '本地快取' },
        { pattern: /(netlify|blob)/, type: 'Blob 快取' },
        { pattern: /(proxy)/, type: 'Proxy 快取' },
        { pattern: /(cache|快取)/, type: 'Proxy 快取' },
    ];
    let resolvedType = null;
    for (let i = 0; i < typeOrder.length && !resolvedType; i += 1) {
        if (typeOrder[i].pattern.test(normalizedAll)) {
            resolvedType = typeOrder[i].type;
        }
    }
    if (!resolvedType && extra && /(cache|快取)/i.test(extra)) {
        resolvedType = 'Proxy 快取';
    }
    return {
        base: base || original,
        extra,
        type: resolvedType,
        original,
    };
}

function decorateSourceBase(descriptor) {
    if (!descriptor) return '';
    const base = descriptor.base || descriptor.original || '';
    if (!base) return '';
    if (descriptor.extra && !/^(?:cache|快取)$/i.test(descriptor.extra)) {
        return `${base}｜${descriptor.extra}`;
    }
    return base;
}

function summariseSourceDescriptors(parsed) {
    if (!Array.isArray(parsed) || parsed.length === 0) return '';
    const baseOrder = [];
    const baseSeen = new Set();
    parsed.forEach((item) => {
        const decorated = decorateSourceBase(item);
        if (decorated && !baseSeen.has(decorated)) {
            baseSeen.add(decorated);
            baseOrder.push(decorated);
        }
    });

    const remoteOrder = [];
    const remoteSeen = new Set();
    parsed.forEach((item) => {
        const decorated = decorateSourceBase(item);
        if (!decorated || remoteSeen.has(decorated)) return;
        const normalizedBase = (item.base || '').toLowerCase();
        const isLocal = /(瀏覽器|browser|session|local|記憶體|memory)/.test(normalizedBase);
        const isBlob = /(netlify|blob)/.test(normalizedBase);
        const isProxy = item.type === 'Proxy 快取';
        if (!isLocal && (!item.type || isProxy) && !isBlob) {
            remoteSeen.add(decorated);
            remoteOrder.push(decorated);
        }
    });

    const suffixMap = new Map();
    parsed.forEach((item) => {
        if (!item.type) return;
        let descriptor = item.type;
        if (item.extra && !/^(?:cache|快取)$/i.test(item.extra)) {
            descriptor = `${descriptor}｜${item.extra}`;
        }
        if (!suffixMap.has(descriptor)) {
            suffixMap.set(descriptor, true);
        }
    });

    const primaryOrder = remoteOrder.length > 0 ? remoteOrder : baseOrder;
    if (primaryOrder.length === 0) return '';
    const suffixes = Array.from(suffixMap.keys());
    if (suffixes.length === 0) {
        return primaryOrder.join(' + ');
    }
    return `${primaryOrder.join(' + ')}（${suffixes.join('、')}）`;
}

function summariseSources(flags) {
    const entries =
        flags instanceof Set ? Array.from(flags) : Array.isArray(flags) ? flags : [];
    const parsed = entries
        .map((label) => parseSourceLabelDescriptor(label))
        .filter((item) => item && (item.base || item.original));
    const hasRemote = parsed.some((item) => {
        const normalizedBase = (item.base || '').toLowerCase();
        const isLocal = /(瀏覽器|browser|session|local|記憶體|memory)/.test(normalizedBase);
        const isBlob = /(netlify|blob)/.test(normalizedBase);
        const isProxy = item.type === 'Proxy 快取';
        return !isLocal && (!item.type || isProxy) && !isBlob;
    });
    const fallbackDescriptor = parseSourceLabelDescriptor(FUGLE_LABEL);
    const combined = parsed.slice();
    if (!hasRemote && fallbackDescriptor) {
        combined.push(fallbackDescriptor);
    }
    const summary = summariseSourceDescriptors(combined);
    return summary || (fallbackDescriptor ? summariseSourceDescriptors([fallbackDescriptor]) : '');
}

function validateForceSource(adjusted, forceSource) {
    if (!forceSource) return null;
    const normalized = forceSource.toLowerCase();
    if (adjusted) {
        if (normalized === 'yahoo') return normalized;
        throw new Error('還原模式目前僅支援 Yahoo Finance 測試來源');
    }
    if (normalized === 'twse' || normalized === 'finmind' || normalized === 'fugle') return normalized;
    throw new Error('原始模式僅支援 Fugle、TWSE 或 FinMind 測試來源');
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

        console.log('[TWSE Proxy v10.7] 入口參數', {
            stockNo,
            month: monthParam || null,
            start: startParam || legacyDate || null,
            end: endParam || legacyDate || null,
            adjusted,
            forceSource: forceSourceParam || null,
        });

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
        console.log('[TWSE Proxy v10.7] 月份分段', {
            stockNo,
            segmentCount: months.length,
            startISO: formatISODateFromDate(startDate),
            endISO: formatISODateFromDate(endDate),
        });
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
        let fugleHydrated = false;
        let fugleAttempted = false;
        let fugleLabel = '';
        const fugleTokenAvailable = Boolean(resolveFugleToken());

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
                } else if (forcedSource === 'fugle') {
                    try {
                        if (!fugleHydrated) {
                            fugleLabel = await hydrateFugleDaily(store, stockNo, startDate, endDate);
                            fugleHydrated = true;
                        }
                        payload = await readCache(store, cacheKey);
                        if (payload) sourceFlags.add(payload.dataSource || fugleLabel || FUGLE_LABEL);
                    } catch (error) {
                        console.error('[TWSE Proxy v10.7] 強制 Fugle 失敗:', error);
                        return new Response(JSON.stringify({ error: `Fugle 來源取得失敗: ${error.message}` }), { status: 502 });
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
                                yahooHydrated = true;
                            } catch (error) {
                                console.error('[TWSE Proxy v10.2] Yahoo 還原來源失敗:', error);
                                return new Response(
                                    JSON.stringify({ error: `Yahoo 還原來源取得失敗: ${error.message}` }),
                                    { status: 502 },
                                );
                            }
                        }
                        payload = await readCache(store, cacheKey);
                        if (payload) {
                            if (payload.dataSource) sourceFlags.add(payload.dataSource);
                            else if (yahooLabel) sourceFlags.add(yahooLabel);
                        }
                    } else {
                        if (fugleTokenAvailable && !fugleAttempted) {
                            fugleAttempted = true;
                            try {
                                fugleLabel = await hydrateFugleDaily(store, stockNo, startDate, endDate);
                                fugleHydrated = true;
                            } catch (error) {
                                console.warn(`[TWSE Proxy v10.7] Fugle 主來源失敗 (${month}):`, error.message);
                            }
                        }
                        if (!payload && fugleHydrated) {
                            payload = await readCache(store, cacheKey);
                            if (payload) {
                                if (payload.dataSource) {
                                    sourceFlags.add(payload.dataSource);
                                } else if (fugleLabel) {
                                    sourceFlags.add(fugleLabel);
                                }
                            }
                        }
                        if (!payload) {
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
                                        return new Response(
                                            JSON.stringify({ error: `FinMind 備援來源取得失敗: ${finmindError.message}` }),
                                            { status: 502 },
                                        );
                                    }
                                    finmindHydrated = true;
                                }
                                payload = await readCache(store, cacheKey);
                                if (payload && finmindLabel) sourceFlags.add(finmindLabel);
                            }
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
