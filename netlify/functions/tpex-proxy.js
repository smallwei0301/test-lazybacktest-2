// netlify/functions/tpex-proxy.js (v12.0 - Fugle primary with FinMind/Yahoo fallbacks + segmented diagnostics)
// Patch Tag: LB-DATASOURCE-20241007A
// Patch Tag: LB-FINMIND-RETRY-20241012A
// Patch Tag: LB-BLOBS-LOCAL-20241007B
// Patch Tag: LB-TPEX-PROXY-20241216A
// Patch Tag: LB-TPEX-PROXY-20250320A
// Patch Tag: LB-FUGLE-PRIMARY-20250702A
import { getStore } from '@netlify/blobs';
import fetch from 'node-fetch';

const TPEX_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 小時
const inMemoryCache = new Map(); // Map<cacheKey, { timestamp, data }>
const inMemoryBlobStores = new Map(); // Map<storeName, MemoryStore>
const DAY_SECONDS = 24 * 60 * 60;
const FINMIND_LEVEL_PATTERN = /your level is register/i;
const FINMIND_BASE_URL = 'https://api.finmindtrade.com/api/v4/data';
const FINMIND_PRICE_SPAN_DAYS = 120;
const FINMIND_MIN_SPAN_DAYS = 30;
const FINMIND_RETRY_ATTEMPTS = 3;
const FINMIND_RETRY_BASE_DELAY_MS = 350;
const FINMIND_SEGMENT_COOLDOWN_MS = 160;
const FINMIND_SPLITTABLE_STATUS = new Set([408, 429, 500, 502, 503, 504, 520, 522, 524, 598]);
const FUGLE_CANDLES_URL = 'https://api.fugle.tw/marketdata/v1.0/stock/candles';
const FUGLE_TIMEOUT_MS = 15000;
const FUGLE_PRIMARY_LABEL = 'Fugle (主來源)';
const FUGLE_FORCED_LABEL = 'Fugle (強制)';

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
                console.warn('[TPEX Proxy v12.0] Netlify Blobs 未配置，使用記憶體快取模擬。');
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

function enumerateDateSpans(startDate, endDate, maxSpanDays) {
    if (!(startDate instanceof Date) || Number.isNaN(startDate.getTime())) return [];
    if (!(endDate instanceof Date) || Number.isNaN(endDate.getTime())) return [];
    if (startDate > endDate) return [];
    const spanDays = Math.max(1, Math.floor(maxSpanDays));
    const spans = [];
    const cursor = new Date(Date.UTC(
        startDate.getUTCFullYear(),
        startDate.getUTCMonth(),
        startDate.getUTCDate(),
    ));
    const last = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));
    while (cursor <= last) {
        const spanStart = new Date(cursor.getTime());
        const spanEnd = new Date(cursor.getTime());
        spanEnd.setUTCDate(spanEnd.getUTCDate() + spanDays - 1);
        if (spanEnd > last) {
            spanEnd.setTime(last.getTime());
        }
        spans.push({
            startISO: formatISODateFromDate(spanStart),
            endISO: formatISODateFromDate(spanEnd),
        });
        cursor.setTime(spanEnd.getTime());
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return spans;
}

function countSpanDays(span) {
    if (!span?.startISO || !span?.endISO) return 0;
    const start = new Date(`${span.startISO}T00:00:00Z`);
    const end = new Date(`${span.endISO}T00:00:00Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
        return 0;
    }
    const diffMs = end.getTime() - start.getTime();
    return Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1;
}

function splitSpan(span) {
    if (!span?.startISO || !span?.endISO) return null;
    const start = new Date(`${span.startISO}T00:00:00Z`);
    const end = new Date(`${span.endISO}T00:00:00Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
        return null;
    }
    const midTime = start.getTime() + Math.floor((end.getTime() - start.getTime()) / 2);
    const firstEnd = new Date(midTime);
    const secondStart = new Date(midTime + 24 * 60 * 60 * 1000);
    return [
        {
            startISO: formatISODateFromDate(start),
            endISO: formatISODateFromDate(firstEnd),
        },
        {
            startISO: formatISODateFromDate(secondStart),
            endISO: formatISODateFromDate(end),
        },
    ];
}

function extractStatusCode(error) {
    if (!error) return undefined;
    const statusLike = error.statusCode ?? error.status ?? error.code;
    if (statusLike !== undefined && statusLike !== null) {
        const numeric = Number(statusLike);
        if (Number.isFinite(numeric)) {
            return numeric;
        }
    }
    if (error.original) {
        const originalStatus = extractStatusCode(error.original);
        if (Number.isFinite(originalStatus)) {
            return originalStatus;
        }
    }
    return undefined;
}

function shouldSplitSpan(error, spanDays, minSpanDays) {
    if (!Number.isFinite(spanDays) || spanDays <= minSpanDays) return false;
    const statusCode = extractStatusCode(error);
    if (statusCode && FINMIND_SPLITTABLE_STATUS.has(statusCode)) {
        return true;
    }
    const message = String(error?.message || '').toLowerCase();
    if (!statusCode && message) {
        if (message.includes('timeout') || message.includes('timed out')) return true;
        if (message.includes('network') || message.includes('fetch failed')) return true;
        if (message.includes('socket hang up') || message.includes('aborted')) return true;
    }
    return false;
}

function delay(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return Promise.resolve();
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

async function executeFinMindQuery(params, options = {}) {
    const attempts = Math.max(1, Number(options.attempts ?? FINMIND_RETRY_ATTEMPTS));
    const baseDelay = Math.max(0, Number(options.baseDelayMs ?? FINMIND_RETRY_BASE_DELAY_MS));
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            const url = new URL(FINMIND_BASE_URL);
            Object.entries(params || {}).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    url.searchParams.set(key, String(value));
                }
            });
            const response = await fetch(url.toString());
            if (!response.ok) {
                const error = new Error(`FinMind HTTP ${response.status}`);
                error.statusCode = response.status;
                throw error;
            }
            return await response.json();
        } catch (error) {
            lastError = error;
            if (attempt >= attempts) {
                break;
            }
            const waitMs = Math.min(1800, baseDelay * (attempt + 1) + Math.random() * 400);
            await delay(waitMs);
        }
    }
    throw lastError || new Error('FinMind 查詢失敗');
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
            console.warn('[TPEX Proxy v12.0] Blobs 流量受限，改用記憶體快取。');
        } else {
            console.error('[TPEX Proxy v12.0] 讀取 Blobs 時發生錯誤:', error);
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
            console.warn('[TPEX Proxy v12.0] Blobs 流量受限，僅寫入記憶體快取。');
        } else {
            console.error('[TPEX Proxy v12.0] 寫入 Blobs 失敗:', error);
        }
    }
}

function resolveFugleLabel(options = {}) {
    if (options.force) return FUGLE_FORCED_LABEL;
    if (typeof options.label === 'string' && options.label.trim()) {
        return options.label.trim();
    }
    return FUGLE_PRIMARY_LABEL;
}

function extractFugleDate(value) {
    if (!value) return null;
    if (typeof value === 'string') return value.slice(0, 10);
    if (typeof value === 'number') {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
    }
    return null;
}

async function requestFugleCandles(stockNo, startISO, endISO, options = {}) {
    const token = process.env.FUGLE_API_TOKEN;
    if (!token) {
        const error = new Error('未設定 Fugle API Token');
        error.code = 'FUGLE_TOKEN_MISSING';
        throw error;
    }
    if (!stockNo) {
        throw new Error('缺少股票代號');
    }

    const url = new URL(FUGLE_CANDLES_URL);
    url.searchParams.set('symbol', stockNo);
    if (startISO) url.searchParams.set('from', startISO);
    if (endISO) url.searchParams.set('to', endISO);
    url.searchParams.set('resolution', 'D');
    if (options.market) {
        url.searchParams.set('market', options.market);
    }
    url.searchParams.set('apiToken', token);

    console.log('[TPEX Proxy v12.0] 呼叫 Fugle:', {
        symbol: stockNo,
        from: startISO,
        to: endISO,
        market: options.market || 'default',
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FUGLE_TIMEOUT_MS);
    let rawText = '';
    try {
        const response = await fetch(url.toString(), { signal: controller.signal });
        rawText = await response.text();
        let payload = null;
        try {
            payload = rawText ? JSON.parse(rawText) : null;
        } catch (parseError) {
            console.warn('[TPEX Proxy v12.0] Fugle 回傳非 JSON 內容，保留原始訊息供診斷。', parseError);
        }

        if (!response.ok) {
            const message =
                payload?.error?.message ||
                payload?.message ||
                payload?.msg ||
                `Fugle HTTP ${response.status}`;
            throw new Error(message);
        }

        if (!payload || !payload.data) {
            throw new Error('Fugle 回應缺少資料');
        }

        const candles = Array.isArray(payload.data.candles) ? payload.data.candles : [];
        const info = payload.data.info || {};
        return { candles, info };
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Fugle 請求逾時');
        }
        if (rawText) {
            error.message = `${error.message || 'Fugle 來源錯誤'} ｜ ${rawText.slice(0, 120)}`;
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}

async function persistFugleEntries(store, stockNo, startDate, endDate, options = {}) {
    const startISO = formatISODateFromDate(startDate);
    const endISO = formatISODateFromDate(endDate);
    const label = resolveFugleLabel(options);

    const { candles, info } = await requestFugleCandles(stockNo, startISO, endISO, options);
    const monthlyBuckets = new Map();
    const sortedCandles = candles
        .map((item) => ({
            ...item,
            date: extractFugleDate(item.date || item.Date || item.time || item.timestamp),
        }))
        .filter((item) => item.date && (!startISO || item.date >= startISO) && (!endISO || item.date <= endISO))
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    let resolvedName = (info.name || info.symbolName || info.symbol || '').toString().trim();
    let prevClose = null;
    let totalRows = 0;

    for (const candle of sortedCandles) {
        const isoDate = candle.date;
        const rocDate = isoToRoc(isoDate);
        if (!rocDate) continue;

        const openVal = Number(candle.open ?? candle.Open ?? candle.openPrice);
        const highVal = Number(candle.high ?? candle.High ?? candle.highPrice);
        const lowVal = Number(candle.low ?? candle.Low ?? candle.lowPrice);
        const closeVal = Number(candle.close ?? candle.Close ?? candle.closePrice);
        const volumeVal = Number(
            candle.volume ??
                candle.Volume ??
                candle.Trading_Volume ??
                candle.trading_volume ??
                candle.volumeTrade ??
                candle.turnoverVolume ??
                0,
        );
        const changeVal = Number(candle.change ?? candle.Change ?? candle.changePrice ?? candle.price_change ?? NaN);

        const finalClose = Number.isFinite(closeVal) ? safeRound(closeVal) : null;
        const finalOpen = Number.isFinite(openVal) ? safeRound(openVal) : finalClose;
        const finalHigh = Number.isFinite(highVal)
            ? safeRound(highVal)
            : Math.max(finalOpen ?? 0, finalClose ?? finalOpen ?? 0);
        const finalLow = Number.isFinite(lowVal)
            ? safeRound(lowVal)
            : Math.min(finalOpen ?? 0, finalClose ?? finalOpen ?? 0);

        let resolvedChange = Number.isFinite(changeVal) ? safeRound(changeVal) : null;
        if (!Number.isFinite(resolvedChange) && prevClose !== null && finalClose !== null) {
            resolvedChange = safeRound(finalClose - prevClose);
        }
        if (finalClose !== null) {
            prevClose = finalClose;
        }

        const volume = Number.isFinite(volumeVal) ? Math.round(volumeVal) : 0;
        const monthKey = isoDate.slice(0, 7).replace('-', '');
        if (!monthlyBuckets.has(monthKey)) {
            monthlyBuckets.set(monthKey, []);
        }
        monthlyBuckets.get(monthKey).push([
            rocDate,
            stockNo,
            resolvedName || stockNo,
            finalOpen,
            finalHigh,
            finalLow,
            finalClose,
            resolvedChange ?? 0,
            volume,
        ]);
        totalRows += 1;
    }

    const stockName = resolvedName || stockNo;
    if (monthlyBuckets.size === 0) {
        const baseISO = startISO || endISO || formatISODateFromDate(new Date());
        const monthKey = baseISO ? baseISO.slice(0, 7).replace('-', '') : `${new Date().getFullYear()}${pad2(new Date().getMonth() + 1)}`;
        await writeCache(store, buildMonthCacheKey(stockNo, monthKey, false), {
            stockName,
            aaData: [],
            dataSource: label,
        });
    } else {
        for (const [monthKey, rows] of monthlyBuckets.entries()) {
            rows.sort((a, b) => new Date(rocToISO(a[0])) - new Date(rocToISO(b[0])));
            await writeCache(store, buildMonthCacheKey(stockNo, monthKey, false), {
                stockName,
                aaData: rows,
                dataSource: label,
            });
        }
    }

    return { label, stockName, rowCount: totalRows };
}

function inferCacheSourceBase(payload, fallbackLabel) {
    const dataSource = (payload?.dataSource || '').toString();
    if (/Fugle/i.test(dataSource)) return 'Fugle';
    if (/Yahoo/i.test(dataSource)) return 'Yahoo Finance';
    if (/FinMind/i.test(dataSource)) return 'FinMind';
    if (/TPEX/i.test(dataSource)) return 'TPEX';
    if (/TWSE/i.test(dataSource)) return 'TWSE';
    if (/Proxy/i.test(dataSource)) return 'Proxy';
    if (fallbackLabel && /Fugle/i.test(fallbackLabel)) return 'Fugle';
    if (fallbackLabel && /FinMind/i.test(fallbackLabel)) return 'FinMind';
    return fallbackLabel || '';
}

function appendCacheSourceLabels(sourceFlags, payload, fallbackLabel) {
    if (!payload || !payload.source) return;
    const base = inferCacheSourceBase(payload, fallbackLabel);
    if (!base) return;
    if (payload.source === 'blob') {
        sourceFlags.add(`${base} (快取)`);
    } else if (payload.source === 'memory') {
        sourceFlags.add(`${base} (記憶體快取)`);
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

    const toUtcDate = (iso) => {
        if (!iso) return null;
        const parsed = new Date(`${iso}T00:00:00Z`);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const startDate = toUtcDate(startISO);
    const endDate = toUtcDate(endISO);
    const spans = startDate && endDate ? enumerateDateSpans(startDate, endDate, FINMIND_PRICE_SPAN_DAYS) : [];

    const rowsMap = new Map(); // Map<isoDate, Row>
    let stockName = '';

    if (spans.length === 0) {
        const params = {
            dataset,
            data_id: stockNo,
            stock_id: stockNo,
            token,
        };
        const json = await executeFinMindQuery(params);
        if (json?.status !== 200 || !Array.isArray(json?.data)) {
            throw new Error(
                normaliseFinMindErrorMessage(json?.msg || 'FinMind 回應異常'),
            );
        }
        json.data.forEach((item) => {
            const isoDate = item.date;
            if (!isoDate) return;
            const rocDate = isoToRoc(isoDate);
            if (!rocDate) return;
            if (!stockName && item.stock_name) {
                stockName = item.stock_name;
            }
            rowsMap.set(isoDate, {
                isoDate,
                rocDate,
                open: safeRound(Number(item.open ?? item.Open ?? item.Opening)),
                high: safeRound(Number(item.max ?? item.high ?? item.High)),
                low: safeRound(Number(item.min ?? item.low ?? item.Low)),
                close: safeRound(Number(item.close ?? item.Close)),
                volume: Number(item.Trading_Volume ?? item.volume ?? item.Volume ?? 0),
                change: Number(item.spread ?? item.change ?? item.Change ?? null),
            });
        });
    } else {
        const queue = [...spans];
        while (queue.length > 0) {
            const span = queue.shift();
            const spanDays = countSpanDays(span);
            const params = {
                dataset,
                data_id: stockNo,
                stock_id: stockNo,
                start_date: span.startISO,
                end_date: span.endISO,
                token,
            };
            let json;
            try {
                json = await executeFinMindQuery(params);
            } catch (error) {
                if (shouldSplitSpan(error, spanDays, FINMIND_MIN_SPAN_DAYS)) {
                    const split = splitSpan(span);
                    if (split && split.length === 2) {
                        console.warn(
                            `[TPEX Proxy v11.0] FinMind 段拆分 ${stockNo} ${span.startISO}~${span.endISO} (${spanDays}d): ${error.message || error}`,
                        );
                        queue.unshift(...split);
                        await delay(FINMIND_SEGMENT_COOLDOWN_MS + 140);
                        continue;
                    }
                }
                const enriched = new Error(
                    `[TPEX Proxy v11.0] FinMind 段錯誤 ${stockNo} ${span.startISO}~${span.endISO}: ${error.message || error}`,
                );
                enriched.original = error;
                throw enriched;
            }
            if (json?.status !== 200 || !Array.isArray(json?.data)) {
                const payloadError = new Error(
                    normaliseFinMindErrorMessage(json?.msg || 'FinMind 回應異常'),
                );
                payloadError.statusCode = json?.status;
                if (shouldSplitSpan(payloadError, spanDays, FINMIND_MIN_SPAN_DAYS)) {
                    const split = splitSpan(span);
                    if (split && split.length === 2) {
                        console.warn(
                            `[TPEX Proxy v11.0] FinMind 段拆分 ${stockNo} ${span.startISO}~${span.endISO} (${spanDays}d): ${payloadError.message}`,
                        );
                        queue.unshift(...split);
                        await delay(FINMIND_SEGMENT_COOLDOWN_MS + 140);
                        continue;
                    }
                }
                throw payloadError;
            }
            json.data.forEach((item) => {
                const isoDate = item.date;
                if (!isoDate) return;
                const rocDate = isoToRoc(isoDate);
                if (!rocDate) return;
                if (!stockName && item.stock_name) {
                    stockName = item.stock_name;
                }
                rowsMap.set(isoDate, {
                    isoDate,
                    rocDate,
                    open: safeRound(Number(item.open ?? item.Open ?? item.Opening)),
                    high: safeRound(Number(item.max ?? item.high ?? item.High)),
                    low: safeRound(Number(item.min ?? item.low ?? item.Low)),
                    close: safeRound(Number(item.close ?? item.Close)),
                    volume: Number(item.Trading_Volume ?? item.volume ?? item.Volume ?? 0),
                    change: Number(item.spread ?? item.change ?? item.Change ?? null),
                });
            });
            if (queue.length > 0) {
                await delay(FINMIND_SEGMENT_COOLDOWN_MS);
            }
        }
    }

    const sortedRows = Array.from(rowsMap.values()).sort(
        (a, b) => new Date(a.isoDate) - new Date(b.isoDate),
    );

    const monthlyBuckets = new Map();
    let prevClose = null;
    sortedRows.forEach((row) => {
        const monthKey = row.isoDate.slice(0, 7).replace('-', '');
        if (!monthlyBuckets.has(monthKey)) monthlyBuckets.set(monthKey, []);
        const open = row.open ?? row.close ?? null;
        const close = row.close ?? open;
        const high = row.high ?? Math.max(open ?? close ?? 0, close ?? open ?? 0);
        const low = row.low ?? Math.min(open ?? close ?? 0, close ?? open ?? 0);
        let change = 0;
        if (Number.isFinite(row.change)) {
            change = safeRound(row.change) ?? 0;
        } else if (prevClose !== null && Number.isFinite(close)) {
            change = safeRound(close - prevClose) ?? 0;
        }
        if (Number.isFinite(close)) {
            prevClose = close;
        }
        const volume = Number.isFinite(row.volume) ? Math.round(row.volume) : 0;
        monthlyBuckets.get(monthKey).push([
            row.rocDate,
            stockNo,
            stockName || stockNo,
            safeRound(open ?? close ?? 0),
            safeRound(high ?? close ?? open ?? 0),
            safeRound(low ?? open ?? close ?? 0),
            safeRound(close ?? open ?? 0),
            change,
            volume,
        ]);
    });

    const label = adjusted ? 'FinMind (還原備援)' : 'FinMind (主來源)';
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
    console.log(`[TPEX Proxy v12.0] 嘗試 Yahoo Finance: ${symbol}`);
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

function summariseSources(flags, adjusted) {
    const entries =
        flags instanceof Set
            ? Array.from(flags)
            : Array.isArray(flags)
                ? flags
                : [];
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
    const fallbackLabel = adjusted ? 'Yahoo Finance (還原)' : FUGLE_PRIMARY_LABEL;
    const fallbackDescriptor = parseSourceLabelDescriptor(fallbackLabel);
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
    if (normalized === 'fugle' || normalized === 'finmind' || normalized === 'yahoo') return normalized;
    throw new Error('原始模式僅支援 Fugle、FinMind 或 Yahoo 測試來源');
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

        console.log('[TPEX Proxy v12.0] 入口參數', {
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
        console.log('[TPEX Proxy v12.0] 月份分段', {
            stockNo,
            segmentCount: months.length,
            startISO: formatISODateFromDate(startDate),
            endISO: formatISODateFromDate(endDate),
        });
        if (months.length === 0) {
            return new Response(JSON.stringify({ stockName: stockNo, iTotalRecords: 0, aaData: [], dataSource: adjusted ? 'Yahoo Finance' : FUGLE_PRIMARY_LABEL }), {
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
        let fugleHydrated = false;
        let fugleLabel = FUGLE_PRIMARY_LABEL;
        let fugleStockName = '';

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
                        if (payload) {
                            sourceFlags.add(finmindLabel);
                            appendCacheSourceLabels(sourceFlags, payload, finmindLabel);
                        }
                        finmindHydrated = true;
                    } catch (error) {
                        console.error('[TPEX Proxy v12.0] 強制 FinMind 失敗:', error);
                        return new Response(JSON.stringify({ error: `FinMind 來源取得失敗: ${error.message}` }), { status: 502 });
                    }
                } else if (forcedSource === 'fugle') {
                    try {
                        const result = await persistFugleEntries(
                            store,
                            stockNo,
                            startDate,
                            endDate,
                            { market: 'OTC', force: true },
                        );
                        fugleHydrated = true;
                        fugleLabel = result.label || FUGLE_PRIMARY_LABEL;
                        if (result.stockName) fugleStockName = result.stockName;
                        payload = await readCache(store, cacheKey);
                        if (payload) {
                            sourceFlags.add(fugleLabel);
                            appendCacheSourceLabels(sourceFlags, payload, fugleLabel);
                        }
                    } catch (error) {
                        console.error('[TPEX Proxy v12.0] 強制 Fugle 失敗:', error);
                        return new Response(JSON.stringify({ error: `Fugle 來源取得失敗: ${error.message}` }), { status: 502 });
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
                        if (payload) {
                            sourceFlags.add(yahooLabel);
                            appendCacheSourceLabels(sourceFlags, payload, yahooLabel);
                        }
                        yahooHydrated = true;
                    } catch (error) {
                        console.error('[TPEX Proxy v12.0] 強制 Yahoo 失敗:', error);
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
                                console.error('[TPEX Proxy v12.0] Yahoo 還原來源失敗:', error);
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
                            appendCacheSourceLabels(sourceFlags, payload, yahooLabel);
                        }
                    } else {
                        if (!fugleHydrated) {
                            try {
                                const result = await persistFugleEntries(
                                    store,
                                    stockNo,
                                    startDate,
                                    endDate,
                                    { market: 'OTC' },
                                );
                                fugleLabel = result.label || FUGLE_PRIMARY_LABEL;
                                if (result.stockName) fugleStockName = result.stockName;
                            } catch (error) {
                                console.warn(`[TPEX Proxy v12.0] Fugle 主來源失敗 (${month}):`, error.message);
                            } finally {
                                fugleHydrated = true;
                            }
                        }
                        if (!payload) {
                            payload = await readCache(store, cacheKey);
                        }
                        if (payload) {
                            if (payload.dataSource) {
                                sourceFlags.add(payload.dataSource);
                                appendCacheSourceLabels(sourceFlags, payload, payload.dataSource);
                            } else {
                                sourceFlags.add(fugleLabel);
                                appendCacheSourceLabels(sourceFlags, payload, fugleLabel);
                            }
                        }
                        if (!payload) {
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
                                    console.warn('[TPEX Proxy v12.0] FinMind 主來源失敗:', error.message);
                                    try {
                                        yahooLabel = await persistYahooEntries(
                                            store,
                                            stockNo,
                                            await fetchYahooDaily(stockNo, startDate, endDate),
                                            false,
                                        );
                                    } catch (yahooError) {
                                        console.error('[TPEX Proxy v12.0] Yahoo 備援失敗:', yahooError);
                                        return new Response(
                                            JSON.stringify({ error: `Yahoo 備援來源取得失敗: ${yahooError.message}` }),
                                            { status: 502 },
                                        );
                                    }
                                    yahooHydrated = true;
                                }
                                finmindHydrated = true;
                            }
                            if (!payload) {
                                payload = await readCache(store, cacheKey);
                            }
                            if (payload) {
                                if (payload.dataSource) {
                                    sourceFlags.add(payload.dataSource);
                                    appendCacheSourceLabels(sourceFlags, payload, payload.dataSource);
                                } else if (finmindLabel) {
                                    sourceFlags.add(finmindLabel);
                                    appendCacheSourceLabels(sourceFlags, payload, finmindLabel);
                                }
                            }
                        }
                        if (!payload && !yahooHydrated) {
                            try {
                                yahooLabel = await persistYahooEntries(
                                    store,
                                    stockNo,
                                    await fetchYahooDaily(stockNo, startDate, endDate),
                                    false,
                                );
                                yahooHydrated = true;
                            } catch (yahooError) {
                                console.error('[TPEX Proxy v12.0] Yahoo 備援失敗:', yahooError);
                                return new Response(
                                    JSON.stringify({ error: `Yahoo 備援來源取得失敗: ${yahooError.message}` }),
                                    { status: 502 },
                                );
                            }
                            payload = await readCache(store, cacheKey);
                            if (payload) {
                                sourceFlags.add(yahooLabel);
                                appendCacheSourceLabels(sourceFlags, payload, yahooLabel);
                            }
                        }
                    }
                } else {
                    appendCacheSourceLabels(sourceFlags, payload, payload.dataSource || fugleLabel);
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
        const resolvedStockName = stockName || fugleStockName || stockNo;
        const body = {
            stockName: resolvedStockName,
            iTotalRecords: aaData.length,
            aaData,
            dataSource: summariseSources(sourceFlags, adjusted),
        };

        return new Response(JSON.stringify(body), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('[TPEX Proxy v12.0] 發生未預期錯誤:', error);
        return new Response(JSON.stringify({ error: error.message || 'TPEX Proxy error' }), { status: 500 });
    }
};
