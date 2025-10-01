// netlify/functions/index-proxy.js (v1.1 - FinMind/Fugle 指數來源整合與欄位調整)
// Patch Tag: LB-INDEX-SUPPORT-20250702A
// Patch Tag: LB-FUGLE-PRIMARY-20250702A
// Patch Tag: LB-INDEX-FIELD-20250703A
import { getStore } from '@netlify/blobs';
import fetch from 'node-fetch';

const INDEX_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 小時
const inMemoryCache = new Map();
const inMemoryBlobStores = new Map();
const DAY_SECONDS = 24 * 60 * 60;
const FINMIND_BASE_URL = 'https://api.finmindtrade.com/api/v4/data';
const FINMIND_DATASET = 'TaiwanIndexPrice';
const FINMIND_LEVEL_PATTERN = /your level is register/i;
const FUGLE_CANDLES_URL = 'https://api.fugle.tw/marketdata/v1.0/stock/candles';
const FUGLE_TIMEOUT_MS = 15000;
const FINMIND_LABEL = 'FinMind 指數 (主來源)';
const FUGLE_PRIMARY_LABEL = 'Fugle 指數 (備援)';
const FUGLE_FORCED_LABEL = 'Fugle 指數 (強制)';

function isQuotaError(error) {
    return error?.status === 402 || error?.status === 429;
}

function normaliseFinMindErrorMessage(message) {
    if (!message) return 'FinMind 未預期錯誤';
    if (FINMIND_LEVEL_PATTERN.test(message)) {
        return 'FinMind 帳號等級為註冊 (Register)，請升級 Sponsor 方案後再使用此資料來源。';
    }
    return message;
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
                console.warn('[Index Proxy v1.0] Netlify Blobs 未配置，使用記憶體快取模擬。');
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

function formatISODateFromDate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
    const year = date.getUTCFullYear();
    const month = pad2(date.getUTCMonth() + 1);
    const day = pad2(date.getUTCDate());
    return `${year}-${month}-${day}`;
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

function isoToRoc(isoDate) {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return null;
    const rocYear = date.getFullYear() - 1911;
    return `${rocYear}/${pad2(date.getMonth() + 1)}/${pad2(date.getDate())}`;
}

function withinRange(rocDate, start, end) {
    const iso = rocToISO(rocDate);
    if (!iso) return false;
    const d = new Date(iso);
    return !(Number.isNaN(d.getTime()) || d < start || d > end);
}

function safeRound(value) {
    return Number.isFinite(value) ? Number(value.toFixed(4)) : null;
}

async function readCache(store, cacheKey) {
    const memoryHit = inMemoryCache.get(cacheKey);
    if (memoryHit && Date.now() - memoryHit.timestamp < INDEX_CACHE_TTL_MS) {
        return { ...memoryHit.data, source: 'memory' };
    }

    try {
        const blobHit = await store.get(cacheKey, { type: 'json' });
        if (blobHit && Date.now() - blobHit.timestamp < INDEX_CACHE_TTL_MS) {
            inMemoryCache.set(cacheKey, { timestamp: Date.now(), data: blobHit.data });
            return { ...blobHit.data, source: 'blob' };
        }
    } catch (error) {
        if (isQuotaError(error)) {
            console.warn('[Index Proxy v1.0] Blobs 流量受限，改用記憶體快取。');
        } else {
            console.error('[Index Proxy v1.0] 讀取 Blobs 時發生錯誤:', error);
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
            console.warn('[Index Proxy v1.0] Blobs 流量受限，僅寫入記憶體快取。');
        } else {
            console.error('[Index Proxy v1.0] 寫入 Blobs 失敗:', error);
        }
    }
}

function buildMonthCacheKey(stockNo, monthKey) {
    return `${stockNo}_${monthKey}`;
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

async function requestFugleCandles(symbol, startISO, endISO) {
    const token = process.env.FUGLE_API_TOKEN;
    if (!token) {
        const error = new Error('未設定 Fugle API Token');
        error.code = 'FUGLE_TOKEN_MISSING';
        throw error;
    }

    const url = new URL(FUGLE_CANDLES_URL);
    url.searchParams.set('symbol', symbol);
    if (startISO) url.searchParams.set('from', startISO);
    if (endISO) url.searchParams.set('to', endISO);
    url.searchParams.set('resolution', 'D');
    url.searchParams.set('market', 'INDEX');
    url.searchParams.set('apiToken', token);

    console.log('[Index Proxy v1.0] 呼叫 Fugle 指數:', { symbol, from: startISO, to: endISO });

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
            console.warn('[Index Proxy v1.0] Fugle 回傳非 JSON 內容，保留原始訊息供診斷。', parseError);
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

async function persistFugleIndexEntries(store, indexId, startDate, endDate, options = {}) {
    const startISO = formatISODateFromDate(startDate);
    const endISO = formatISODateFromDate(endDate);
    const label = resolveFugleLabel(options);

    const { candles, info } = await requestFugleCandles(indexId, startISO, endISO);
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

    for (const candle of sortedCandles) {
        const isoDate = candle.date;
        const rocDate = isoToRoc(isoDate);
        if (!rocDate) continue;

        const openVal = Number(candle.open ?? candle.Open ?? candle.openPrice);
        const highVal = Number(candle.high ?? candle.High ?? candle.highPrice);
        const lowVal = Number(candle.low ?? candle.Low ?? candle.lowPrice);
        const closeVal = Number(candle.close ?? candle.Close ?? candle.closePrice);
        const changeVal = Number(candle.change ?? candle.Change ?? candle.changePrice ?? candle.price_change ?? NaN);
        const volumeVal = Number(
            candle.volume ??
                candle.Volume ??
                candle.Trading_Volume ??
                candle.trading_volume ??
                candle.volumeTrade ??
                candle.turnoverVolume ??
                0,
        );

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
            indexId,
            resolvedName || indexId,
            finalOpen,
            finalHigh,
            finalLow,
            finalClose,
            resolvedChange ?? 0,
            volume,
        ]);
    }

    const stockName = resolvedName || indexId;
    if (monthlyBuckets.size === 0) {
        const baseISO = startISO || endISO || formatISODateFromDate(new Date());
        const monthKey = baseISO ? baseISO.slice(0, 7).replace('-', '') : `${new Date().getFullYear()}${pad2(new Date().getMonth() + 1)}`;
        await writeCache(store, buildMonthCacheKey(indexId, monthKey), {
            stockName,
            aaData: [],
            dataSource: label,
        });
    } else {
        for (const [monthKey, rows] of monthlyBuckets.entries()) {
            rows.sort((a, b) => new Date(rocToISO(a[0])) - new Date(rocToISO(b[0])));
            await writeCache(store, buildMonthCacheKey(indexId, monthKey), {
                stockName,
                aaData: rows,
                dataSource: label,
            });
        }
    }

    return { label, stockName };
}

async function persistFinMindIndexEntries(store, indexId, startISO, endISO) {
    const token = process.env.FINMIND_TOKEN;
    if (!token) {
        throw new Error('未設定 FinMind Token');
    }
    const url = new URL(FINMIND_BASE_URL);
    url.searchParams.set('dataset', FINMIND_DATASET);
    url.searchParams.set('index_id', indexId);
    url.searchParams.set('token', token);
    if (startISO) url.searchParams.set('start_date', startISO);
    if (endISO) url.searchParams.set('end_date', endISO);

    console.log('[Index Proxy v1.0] 呼叫 FinMind 指數:', { indexId, startISO, endISO });

    const response = await fetch(url.toString());
    const rawText = await response.text();
    let payload = null;
    try {
        payload = rawText ? JSON.parse(rawText) : null;
    } catch (error) {
        console.warn('[Index Proxy v1.0] FinMind 回傳非 JSON 內容，保留原始訊息供診斷。', error);
    }

    const normalizedStatus = Number(payload?.status);
    const statusOk = normalizedStatus === 200 || payload?.status === 200 || payload?.status === 'success' || payload?.msg === 'success';
    const message = payload?.msg || payload?.message || payload?.error;
    if (!response.ok) {
        const combinedMessage = message || `FinMind HTTP ${response.status}`;
        throw new Error(normaliseFinMindErrorMessage(combinedMessage));
    }
    if (!payload || !statusOk || !Array.isArray(payload.data)) {
        const fallbackMessage = message || 'FinMind 回應異常';
        throw new Error(normaliseFinMindErrorMessage(fallbackMessage));
    }

    const rows = payload.data;
    const monthlyBuckets = new Map();
    let stockName = '';
    let prevClose = null;

    for (const item of rows) {
        const isoDate = item.date;
        const rocDate = isoToRoc(isoDate);
        if (!rocDate) continue;
        if (!stockName && (item.index_name || item.indexName)) {
            stockName = String(item.index_name || item.indexName).trim();
        }
        const openVal = Number(item.open ?? item.Open ?? item.open_price ?? item.OpenPrice);
        const highVal = Number(item.high ?? item.High ?? item.max ?? item.Max ?? item.high_price ?? item.HighPrice);
        const lowVal = Number(item.low ?? item.Low ?? item.min ?? item.Min ?? item.low_price ?? item.LowPrice);
        const closeVal = Number(item.close ?? item.Close ?? item.price ?? item.Price);
        const volumeVal = Number(
            item.volume ??
                item.Volume ??
                item.Trading_Volume ??
                item.trading_volume ??
                item.trade_volume ??
                item.TradeVolume ??
                0,
        );
        const changeVal = Number(
            item.change ??
                item.Change ??
                item.change_point ??
                item.changePoint ??
                item.price_change ??
                item.priceChange ??
                NaN,
        );

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
        if (!monthlyBuckets.has(monthKey)) monthlyBuckets.set(monthKey, []);
        monthlyBuckets.get(monthKey).push([
            rocDate,
            indexId,
            stockName || indexId,
            finalOpen,
            finalHigh,
            finalLow,
            finalClose,
            resolvedChange ?? 0,
            volume,
        ]);
    }

    const resolvedName = stockName || indexId;
    if (monthlyBuckets.size === 0) {
        const baseISO = startISO || endISO || formatISODateFromDate(new Date());
        const monthKey = baseISO ? baseISO.slice(0, 7).replace('-', '') : `${new Date().getFullYear()}${pad2(new Date().getMonth() + 1)}`;
        await writeCache(store, buildMonthCacheKey(indexId, monthKey), {
            stockName: resolvedName,
            aaData: [],
            dataSource: FINMIND_LABEL,
        });
    } else {
        for (const [monthKey, rowsForMonth] of monthlyBuckets.entries()) {
            rowsForMonth.sort((a, b) => new Date(rocToISO(a[0])) - new Date(rocToISO(b[0])));
            await writeCache(store, buildMonthCacheKey(indexId, monthKey), {
                stockName: resolvedName,
                aaData: rowsForMonth,
                dataSource: FINMIND_LABEL,
            });
        }
    }

    return { label: FINMIND_LABEL, stockName: resolvedName };
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
    const fallbackDescriptor = parseSourceLabelDescriptor(FINMIND_LABEL);
    const combined = parsed.slice();
    if (!hasRemote && fallbackDescriptor) {
        combined.push(fallbackDescriptor);
    }
    const summary = summariseSourceDescriptors(combined);
    return summary || (fallbackDescriptor ? summariseSourceDescriptors([fallbackDescriptor]) : '');
}

function inferCacheSourceBase(payload, fallbackLabel) {
    const dataSource = (payload?.dataSource || '').toString();
    if (/Fugle/i.test(dataSource)) return 'Fugle';
    if (/FinMind/i.test(dataSource)) return 'FinMind';
    if (/Yahoo/i.test(dataSource)) return 'Yahoo Finance';
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

function validateForceSource(forceSource) {
    if (!forceSource) return null;
    const normalized = forceSource.toLowerCase();
    if (normalized === 'finmind' || normalized === 'fugle') return normalized;
    throw new Error('指數模式僅支援 FinMind 或 Fugle 測試來源');
}

export default async (req) => {
    try {
        const params = new URL(req.url).searchParams;
        const indexId = params.get('stockNo');
        if (!indexId) {
            return new Response(JSON.stringify({ error: '缺少指數代號' }), { status: 400 });
        }

        const monthParam = params.get('month');
        const startParam = params.get('start');
        const endParam = params.get('end');
        const legacyDate = params.get('date');
        const forceSourceParam = params.get('forceSource');

        console.log('[Index Proxy v1.0] 入口參數', {
            indexId,
            month: monthParam || null,
            start: startParam || legacyDate || null,
            end: endParam || legacyDate || null,
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
        console.log('[Index Proxy v1.0] 月份分段', {
            indexId,
            segmentCount: months.length,
            startISO: formatISODateFromDate(startDate),
            endISO: formatISODateFromDate(endDate),
        });
        if (months.length === 0) {
            return new Response(
                JSON.stringify({ stockName: indexId, iTotalRecords: 0, aaData: [], dataSource: FINMIND_LABEL }),
                { headers: { 'Content-Type': 'application/json' } },
            );
        }

        let forcedSource = null;
        try {
            forcedSource = validateForceSource(forceSourceParam);
        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), { status: 400 });
        }

        const store = obtainStore('index_cache_store');
        const combinedRows = [];
        const sourceFlags = new Set();
        let stockName = '';
        let finmindHydrated = false;
        let finmindLabel = FINMIND_LABEL;
        let fugleHydrated = false;
        let fugleLabel = FUGLE_PRIMARY_LABEL;
        let fallbackStockName = '';

        for (const month of months) {
            const cacheKey = buildMonthCacheKey(indexId, month);
            const monthStart = new Date(Number(month.slice(0, 4)), Number(month.slice(4)) - 1, 1);
            const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
            const rangeStart = startDate > monthStart ? startDate : monthStart;
            const rangeEnd = endDate < monthEnd ? endDate : monthEnd;

            let payload = await readCache(store, cacheKey);
            if (forcedSource === 'finmind') {
                try {
                    const result = await persistFinMindIndexEntries(
                        store,
                        indexId,
                        formatISODateFromDate(startDate),
                        formatISODateFromDate(endDate),
                    );
                    finmindLabel = result.label;
                    if (result.stockName) fallbackStockName = result.stockName;
                    payload = await readCache(store, cacheKey);
                    if (payload) {
                        sourceFlags.add(finmindLabel);
                        appendCacheSourceLabels(sourceFlags, payload, finmindLabel);
                    }
                    finmindHydrated = true;
                } catch (error) {
                    console.error('[Index Proxy v1.0] 強制 FinMind 失敗:', error);
                    return new Response(JSON.stringify({ error: `FinMind 指數來源取得失敗: ${error.message}` }), { status: 502 });
                }
            } else if (forcedSource === 'fugle') {
                try {
                    const result = await persistFugleIndexEntries(
                        store,
                        indexId,
                        startDate,
                        endDate,
                        { force: true },
                    );
                    fugleLabel = result.label;
                    if (result.stockName) fallbackStockName = result.stockName;
                    payload = await readCache(store, cacheKey);
                    if (payload) {
                        sourceFlags.add(fugleLabel);
                        appendCacheSourceLabels(sourceFlags, payload, fugleLabel);
                    }
                    fugleHydrated = true;
                } catch (error) {
                    console.error('[Index Proxy v1.0] 強制 Fugle 失敗:', error);
                    return new Response(JSON.stringify({ error: `Fugle 指數來源取得失敗: ${error.message}` }), { status: 502 });
                }
            } else if (!payload) {
                if (!finmindHydrated) {
                    try {
                        const result = await persistFinMindIndexEntries(
                            store,
                            indexId,
                            formatISODateFromDate(startDate),
                            formatISODateFromDate(endDate),
                        );
                        finmindLabel = result.label;
                        if (result.stockName) fallbackStockName = result.stockName;
                        finmindHydrated = true;
                    } catch (error) {
                        console.warn('[Index Proxy v1.0] FinMind 主來源失敗:', error.message);
                    }
                }
                payload = await readCache(store, cacheKey);
                if (payload) {
                    if (payload.dataSource) {
                        sourceFlags.add(payload.dataSource);
                        appendCacheSourceLabels(sourceFlags, payload, payload.dataSource);
                    } else {
                        sourceFlags.add(finmindLabel);
                        appendCacheSourceLabels(sourceFlags, payload, finmindLabel);
                    }
                } else if (!fugleHydrated) {
                    try {
                        const result = await persistFugleIndexEntries(
                            store,
                            indexId,
                            startDate,
                            endDate,
                            {},
                        );
                        fugleLabel = result.label;
                        if (result.stockName) fallbackStockName = result.stockName;
                        payload = await readCache(store, cacheKey);
                        if (payload) {
                            sourceFlags.add(fugleLabel);
                            appendCacheSourceLabels(sourceFlags, payload, fugleLabel);
                        }
                    } catch (error) {
                        console.warn('[Index Proxy v1.0] Fugle 備援失敗:', error.message);
                    } finally {
                        fugleHydrated = true;
                    }
                }
            } else {
                appendCacheSourceLabels(sourceFlags, payload, payload.dataSource || finmindLabel);
                if (payload.dataSource) {
                    sourceFlags.add(payload.dataSource);
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
            rows.forEach((row) => {
                if (withinRange(row[0], rangeStart, rangeEnd)) {
                    combinedRows.push(row.slice());
                }
            });
        }

        const uniqueMap = new Map();
        combinedRows.sort((a, b) => new Date(rocToISO(a[0])) - new Date(rocToISO(b[0])));
        combinedRows.forEach((row) => {
            uniqueMap.set(row[0], row);
        });

        const aaData = Array.from(uniqueMap.values());
        const resolvedName = stockName || fallbackStockName || indexId;
        const body = {
            stockName: resolvedName,
            iTotalRecords: aaData.length,
            aaData,
            dataSource: summariseSources(sourceFlags),
        };

        return new Response(JSON.stringify(body), {
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('[Index Proxy v1.0] 發生未預期錯誤:', error);
        return new Response(JSON.stringify({ error: error.message || 'Index Proxy error' }), { status: 500 });
    }
};
