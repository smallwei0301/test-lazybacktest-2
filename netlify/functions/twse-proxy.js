// netlify/functions/twse-proxy.js (v10.3 - Yahoo raw price fix & Response return)
// Patch Tag: LB-YF-RAWFIX-20240921A
import { getStore } from '@netlify/blobs';
import fetch from 'node-fetch';

const FUNCTION_VERSION = 'LB-YF-RAWFIX-20240921A';
const TWSE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 小時
const DAY_MS = 24 * 60 * 60 * 1000;
const inMemoryCache = new Map(); // Map<cacheKey, { timestamp, data }>

function isQuotaError(error) {
    return error?.status === 402 || error?.status === 429;
}

function pad2(value) {
    return String(value).padStart(2, '0');
}

function isoFromDate(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
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

function buildMonthCacheKey(stockNo, monthKey, adjusted) {
    return `${stockNo}_${monthKey}${adjusted ? '_ADJ' : ''}`;
}

function safeRound(value) {
    return Number.isFinite(value) ? Number(value.toFixed(4)) : null;
}

function expandRange(startDate, endDate) {
    const fetchStart = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const fetchEnd = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0);
    return {
        fetchStart,
        fetchEnd,
        fetchStartISO: isoFromDate(fetchStart),
        fetchEndISO: isoFromDate(fetchEnd),
    };
}

function createJsonResponse(statusCode, payload, extraHeaders = {}) {
    return new Response(JSON.stringify(payload), {
        status: statusCode,
        headers: {
            'Content-Type': 'application/json',
            ...extraHeaders,
        },
    });
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
            console.warn(`[TWSE Proxy ${FUNCTION_VERSION}] Blobs 流量受限，改用記憶體快取。`);
        } else {
            console.error(`[TWSE Proxy ${FUNCTION_VERSION}] 讀取 Blobs 時發生錯誤:`, error);
        }
    }
    return null;
}

async function writeCache(store, cacheKey, payload) {
    inMemoryCache.set(cacheKey, { timestamp: Date.now(), data: payload });
    try {
        await store.setJSON(cacheKey, { timestamp: Date.now(), data: payload });
    } catch (error) {
        if (isQuotaError(error)) {
            console.warn(`[TWSE Proxy ${FUNCTION_VERSION}] Blobs 流量受限，僅寫入記憶體快取。`);
        } else {
            console.error(`[TWSE Proxy ${FUNCTION_VERSION}] 寫入 Blobs 失敗:`, error);
        }
    }
}
function parseTWSEPayload(raw, stockNo) {
    if (!raw || raw.stat !== 'OK' || !Array.isArray(raw.data)) {
        return { stockName: stockNo, aaData: [] };
    }
    const stockName = raw.title?.split(' ')?.[2] || stockNo;
    const aaData = raw.data.map(item => {
        const open = Number(String(item[3]).replace(/,/g, ''));
        const high = Number(String(item[4]).replace(/,/g, ''));
        const low = Number(String(item[5]).replace(/,/g, ''));
        const close = Number(String(item[6]).replace(/,/g, ''));
        const change = Number(String(item[8]).replace(/,/g, ''));
        const volume = Number(String(item[1]).replace(/,/g, ''));
        return [
            item[0],
            stockNo,
            stockName,
            Number.isFinite(open) ? open : null,
            Number.isFinite(high) ? high : null,
            Number.isFinite(low) ? low : null,
            Number.isFinite(close) ? close : null,
            Number.isFinite(change) ? change : null,
            Number.isFinite(volume) ? volume : 0,
        ];
    });
    return { stockName, aaData };
}

async function fetchTwseMonthEntries(stockNo, monthKey) {
    const url = `https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&date=${monthKey}01&stockNo=${stockNo}`;
    console.log(`[TWSE Proxy ${FUNCTION_VERSION}] 下載 ${stockNo} 的 ${monthKey} 月資料`);
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!response.ok) {
        throw new Error(`TWSE HTTP ${response.status}`);
    }
    const raw = await response.json();
    if (raw?.stat !== 'OK' || !Array.isArray(raw?.data)) {
        throw new Error(`TWSE 回應異常: ${raw?.stat || '未知錯誤'}`);
    }
    const parsed = parseTWSEPayload(raw, stockNo);
    const entries = [];
    for (const row of parsed.aaData) {
        const isoDate = rocToISO(row[0]);
        if (!isoDate) continue;
        const normalized = row.slice();
        normalized[1] = stockNo;
        normalized[2] = parsed.stockName || stockNo;
        entries.push({ isoDate, aaRow: normalized });
    }
    return { stockName: parsed.stockName || stockNo, entries, dataSource: 'TWSE', remoteRows: entries.length };
}

async function fetchYahooDaily(stockNo, fetchStart, fetchEnd) {
    const symbol = `${stockNo}.TW`;
    const baseUrl = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`);
    baseUrl.searchParams.set('interval', '1d');
    baseUrl.searchParams.set('includeAdjustedClose', 'true');

    if (fetchStart && fetchEnd) {
        const period1 = Math.floor((fetchStart.getTime() - DAY_MS * 2) / 1000);
        const period2 = Math.floor((fetchEnd.getTime() + DAY_MS * 2) / 1000);
        baseUrl.searchParams.set('period1', String(Math.max(period1, 0)));
        baseUrl.searchParams.set('period2', String(Math.max(period2, period1 + DAY_MS / 1000)));
    } else {
        baseUrl.searchParams.set('range', '20y');
    }

    console.log(`[TWSE Proxy ${FUNCTION_VERSION}] 嘗試 Yahoo Finance: ${symbol}`);
    const response = await fetch(baseUrl.toString(), { headers: { 'User-Agent': 'Mozilla/5.0' } });
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

    const quote = result.indicators?.quote?.[0] || {};
    const adj = result.indicators?.adjclose?.[0]?.adjclose || [];
    const stockName = result.meta?.shortName || stockNo;
    const rows = [];
    for (let i = 0; i < result.timestamp.length; i++) {
        const ts = result.timestamp[i];
        if (!Number.isFinite(ts)) continue;
        const date = new Date(ts * 1000);
        if (Number.isNaN(date.getTime())) continue;
        const isoDate = isoFromDate(date);
        if (!isoDate) continue;
        const open = Number(quote.open?.[i]);
        const high = Number(quote.high?.[i]);
        const low = Number(quote.low?.[i]);
        const close = Number(quote.close?.[i]);
        const adjClose = Number(adj?.[i]);
        const volume = Number(quote.volume?.[i]) || 0;
        rows.push({ isoDate, open, high, low, close, adjClose, volume });
    }
    return { stockName, rows, remoteRows: rows.length };
}

function buildYahooEntries(rows, stockNo, stockName, adjusted) {
    const entries = [];
    let prevRawClose = null;
    let prevAdjClose = null;
    for (const row of rows) {
        const rocDate = isoToRoc(row.isoDate);
        if (!rocDate) continue;
        const hasRawClose = Number.isFinite(row.close);
        const hasAdjClose = Number.isFinite(row.adjClose);
        if (!adjusted && !hasRawClose) {
            continue;
        }
        const baseClose = adjusted
            ? (hasAdjClose ? row.adjClose : hasRawClose ? row.close : Number.isFinite(row.open) ? row.open : null)
            : row.close;
        if (!Number.isFinite(baseClose)) continue;

        const baseOpen = Number.isFinite(row.open) ? row.open : baseClose;
        const baseHigh = Number.isFinite(row.high) ? row.high : Math.max(baseOpen, baseClose);
        const baseLow = Number.isFinite(row.low) ? row.low : Math.min(baseOpen, baseClose);

        let finalOpen;
        let finalHigh;
        let finalLow;
        let finalClose;
        let change;

        if (adjusted) {
            const adjClose = hasAdjClose ? row.adjClose : baseClose;
            const scale = baseClose ? adjClose / baseClose : 1;
            finalClose = safeRound(adjClose);
            finalOpen = safeRound(baseOpen * scale);
            finalHigh = safeRound(baseHigh * scale);
            finalLow = safeRound(baseLow * scale);
            const prev = Number.isFinite(prevAdjClose) ? prevAdjClose : null;
            change = prev !== null && finalClose !== null ? safeRound(finalClose - prev) : 0;
            prevAdjClose = finalClose !== null ? finalClose : prevAdjClose;
            if (hasRawClose) {
                prevRawClose = safeRound(row.close);
            }
        } else {
            finalClose = safeRound(baseClose);
            finalOpen = safeRound(baseOpen);
            finalHigh = safeRound(baseHigh);
            finalLow = safeRound(baseLow);
            const prev = Number.isFinite(prevRawClose) ? prevRawClose : null;
            change = prev !== null && finalClose !== null ? safeRound(finalClose - prev) : 0;
            prevRawClose = finalClose !== null ? finalClose : prevRawClose;
        }

        if (finalOpen === null || finalHigh === null || finalLow === null || finalClose === null) {
            continue;
        }

        const vol = Number.isFinite(row.volume) ? Math.round(row.volume) : 0;
        const aaRow = [rocDate, stockNo, stockName || stockNo, finalOpen, finalHigh, finalLow, finalClose, change || 0, vol];
        entries.push({ isoDate: row.isoDate, aaRow });
    }
    return entries;
}
async function fetchFinMindSeries(stockNo, adjusted, fetchStart, fetchEnd) {
    const token = process.env.FINMIND_TOKEN;
    if (!token) {
        throw new Error('未設定 FinMind Token');
    }
    const dataset = adjusted ? 'TaiwanStockPriceAdj' : 'TaiwanStockPrice';
    const params = new URLSearchParams({ dataset, data_id: stockNo, token });
    if (fetchStart) params.set('start_date', isoFromDate(fetchStart));
    if (fetchEnd) params.set('end_date', isoFromDate(fetchEnd));
    const url = `https://api.finmindtrade.com/api/v4/data?${params.toString()}`;
    console.log(`[TWSE Proxy ${FUNCTION_VERSION}] 呼叫 FinMind: ${dataset} ${stockNo}`);
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`FinMind HTTP ${response.status}`);
    }
    const json = await response.json();
    if (json?.status !== 200 || !Array.isArray(json?.data)) {
        throw new Error(`FinMind 回應錯誤: ${json?.msg || '未知錯誤'}`);
    }

    const entries = [];
    let stockName = '';
    for (const item of json.data) {
        const isoDate = item.date;
        const rocDate = isoToRoc(isoDate);
        if (!rocDate) continue;
        if (!stockName && item.stock_name) {
            stockName = item.stock_name;
        }
        const open = safeRound(Number(item.open ?? item.Open ?? item.Opening));
        const high = safeRound(Number(item.max ?? item.High ?? item.high));
        const low = safeRound(Number(item.min ?? item.Low ?? item.low));
        const closeValue = safeRound(Number(item.close ?? item.Close));
        const change = safeRound(Number(item.spread ?? item.change ?? item.Change ?? 0));
        const volumeSource = Number(item.Trading_Volume ?? item.volume ?? item.Volume);
        const volume = Number.isFinite(volumeSource) ? Math.round(volumeSource) : 0;

        const finalOpen = open ?? closeValue ?? 0;
        const finalHigh = high ?? Math.max(finalOpen, closeValue ?? finalOpen);
        const finalLow = low ?? Math.min(finalOpen, closeValue ?? finalOpen);
        const finalClose = closeValue ?? finalOpen;
        const finalChange = change ?? 0;

        const aaRow = [
            rocDate,
            stockNo,
            stockName || stockNo,
            safeRound(finalOpen),
            safeRound(finalHigh),
            safeRound(finalLow),
            safeRound(finalClose),
            safeRound(finalChange) ?? 0,
            volume,
        ];
        entries.push({ isoDate, aaRow });
    }
    const dataSource = adjusted ? 'FinMind (還原備援)' : 'FinMind (原始備援)';
    return { stockName: stockName || stockNo, entries, dataSource, remoteRows: entries.length };
}

async function persistEntries(store, stockNo, entries, stockName, dataSource, adjusted) {
    const buckets = new Map();
    for (const entry of entries) {
        const monthKey = entry.isoDate.slice(0, 7).replace('-', '');
        if (!buckets.has(monthKey)) buckets.set(monthKey, []);
        const row = entry.aaRow.slice();
        row[1] = stockNo;
        row[2] = stockName || stockNo;
        buckets.get(monthKey).push(row);
    }

    for (const [monthKey, rows] of buckets.entries()) {
        rows.sort((a, b) => new Date(rocToISO(a[0])) - new Date(rocToISO(b[0])));
        const payload = {
            stockName: stockName || stockNo,
            aaData: rows,
            dataSource,
            summary: {
                version: FUNCTION_VERSION,
                source: dataSource,
                month: monthKey,
                count: rows.length,
            },
        };
        await writeCache(store, buildMonthCacheKey(stockNo, monthKey, adjusted), payload);
    }
    return buckets.size;
}

function formatEntriesForRange(entries, stockNo, stockName, startDate, endDate) {
    const uniqueMap = new Map();
    for (const entry of entries || []) {
        if (!entry?.isoDate || !Array.isArray(entry.aaRow)) continue;
        const iso = new Date(entry.isoDate);
        if (Number.isNaN(iso.getTime()) || iso < startDate || iso > endDate) continue;
        const row = entry.aaRow.slice();
        row[1] = stockNo;
        row[2] = stockName || stockNo;
        uniqueMap.set(row[0], row);
    }
    const aaData = Array.from(uniqueMap.values());
    aaData.sort((a, b) => new Date(rocToISO(a[0])) - new Date(rocToISO(b[0])));
    return aaData;
}

async function hydrateFinMindDaily(store, stockNo, adjusted, fetchStart, fetchEnd) {
    const finmindResult = await fetchFinMindSeries(stockNo, adjusted, fetchStart, fetchEnd);
    await persistEntries(store, stockNo, finmindResult.entries, finmindResult.stockName, finmindResult.dataSource, adjusted);
    return finmindResult.dataSource;
}

function selectDataSourceLabel(flags) {
    if (flags.size === 0) return 'TWSE';
    const labels = Array.from(flags);
    const cacheLabels = labels.filter(label => /快取|cache|記憶體/i.test(label));
    const remoteLabels = labels.filter(label => !/快取|cache|記憶體/i.test(label));
    if (remoteLabels.length === 0) {
        return cacheLabels.length > 0 ? cacheLabels[0] : 'TWSE (快取)';
    }
    if (remoteLabels.length === 1) {
        return cacheLabels.length > 0 ? `${remoteLabels[0]} (部分快取)` : remoteLabels[0];
    }
    return remoteLabels.join(' / ');
}

async function handleForcedSource({ stockNo, startDate, endDate, adjusted, forcedSource }) {
    const { fetchStart, fetchEnd } = expandRange(startDate, endDate);
    if (forcedSource === 'twse') {
        if (adjusted) {
            return createJsonResponse(400, { error: 'TWSE 來源僅支援原始股價', version: FUNCTION_VERSION });
        }
        const months = ensureMonthList(startDate, endDate);
        const combinedEntries = [];
        for (const monthKey of months) {
            const twseResult = await fetchTwseMonthEntries(stockNo, monthKey);
            combinedEntries.push(...twseResult.entries);
        }
        const aaData = formatEntriesForRange(combinedEntries, stockNo, combinedEntries[0]?.aaRow?.[2] || stockNo, startDate, endDate);
        const body = {
            stockName: aaData.length > 0 ? aaData[0][2] : stockNo,
            iTotalRecords: aaData.length,
            aaData,
            dataSource: 'TWSE (測試)',
            summary: {
                version: FUNCTION_VERSION,
                mode: 'raw',
                forcedSource,
                fetchRange: {
                    start: isoFromDate(fetchStart),
                    end: isoFromDate(fetchEnd),
                },
                requestedRange: {
                    start: isoFromDate(startDate),
                    end: isoFromDate(endDate),
                },
                remoteRows: combinedEntries.length,
                finalRows: aaData.length,
            },
        };
        return createJsonResponse(200, body, { 'Cache-Control': 'no-store' });
    }

    let result;
    if (forcedSource === 'yahoo') {
        const yahooData = await fetchYahooDaily(stockNo, fetchStart, fetchEnd);
        const yahooEntries = buildYahooEntries(yahooData.rows, stockNo, yahooData.stockName, adjusted);
        result = {
            stockName: yahooData.stockName || stockNo,
            entries: yahooEntries,
            dataSource: adjusted ? 'Yahoo Finance (還原)' : 'Yahoo Finance (原始)',
            remoteRows: yahooData.remoteRows,
        };
    } else if (forcedSource === 'finmind') {
        result = await fetchFinMindSeries(stockNo, adjusted, fetchStart, fetchEnd);
    } else {
        return createJsonResponse(400, { error: '不支援的資料來源', version: FUNCTION_VERSION });
    }

    const aaData = formatEntriesForRange(result.entries, stockNo, result.stockName, startDate, endDate);
    const body = {
        stockName: result.stockName || stockNo,
        iTotalRecords: aaData.length,
        aaData,
        dataSource: `${result.dataSource} (測試)`,
        summary: {
            version: FUNCTION_VERSION,
            mode: adjusted ? 'adjusted' : 'raw',
            forcedSource,
            fetchRange: {
                start: isoFromDate(fetchStart),
                end: isoFromDate(fetchEnd),
            },
            requestedRange: {
                start: isoFromDate(startDate),
                end: isoFromDate(endDate),
            },
            remoteRows: result.remoteRows ?? aaData.length,
            finalRows: aaData.length,
        },
    };
    return createJsonResponse(200, body, { 'Cache-Control': 'no-store' });
}
export default async (req) => {
    try {
        const url = new URL(req.url, 'https://lazybacktest.test');
        const params = url.searchParams;
        const stockNo = params.get('stockNo');
        if (!stockNo) {
            return createJsonResponse(400, { error: '缺少股票代號', version: FUNCTION_VERSION });
        }

        const monthParam = params.get('month');
        const startParam = params.get('start');
        const endParam = params.get('end');
        const legacyDate = params.get('date');
        const adjusted = params.get('adjusted') === '1' || params.get('adjusted') === 'true';
        const forcedSource = (params.get('forceSource') || params.get('source') || '').trim().toLowerCase();

        let startDate = parseDate(startParam);
        let endDate = parseDate(endParam);
        if (!startDate || !endDate) {
            const monthSeed = parseDate(monthParam || legacyDate);
            if (!monthSeed) {
                return createJsonResponse(400, { error: '缺少日期範圍', version: FUNCTION_VERSION });
            }
            const monthStart = new Date(monthSeed.getFullYear(), monthSeed.getMonth(), 1);
            const monthEnd = new Date(monthSeed.getFullYear(), monthSeed.getMonth() + 1, 0);
            startDate = monthStart;
            endDate = monthEnd;
        }

        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) {
            return createJsonResponse(400, { error: '日期範圍無效', version: FUNCTION_VERSION });
        }

        if (forcedSource) {
            return handleForcedSource({ stockNo, startDate, endDate, adjusted, forcedSource });
        }

        const months = ensureMonthList(startDate, endDate);
        if (months.length === 0) {
            return createJsonResponse(200, {
                stockName: stockNo,
                iTotalRecords: 0,
                aaData: [],
                dataSource: 'TWSE',
                summary: {
                    version: FUNCTION_VERSION,
                    requestedRange: {
                        start: isoFromDate(startDate),
                        end: isoFromDate(endDate),
                    },
                    months: 0,
                    sources: [],
                },
            });
        }

        const { fetchStart, fetchEnd } = expandRange(startDate, endDate);
        const store = getStore('twse_cache_store');
        const combinedRows = [];
        const sourceFlags = new Set();
        let stockName = '';
        let yahooHydrated = false;
        let yahooSourceLabel = '';
        let finmindHydrated = false;
        let finmindSourceLabel = '';

        for (const month of months) {
            const cacheKey = buildMonthCacheKey(stockNo, month, adjusted);
            const monthStart = new Date(Number(month.slice(0, 4)), Number(month.slice(4)) - 1, 1);
            const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
            const rangeStart = startDate > monthStart ? startDate : monthStart;
            const rangeEnd = endDate < monthEnd ? endDate : monthEnd;

            let payload = await readCache(store, cacheKey);
            if (!payload) {
                if (adjusted) {
                    if (!yahooHydrated) {
                        try {
                            const yahooData = await fetchYahooDaily(stockNo, fetchStart, fetchEnd);
                            const yahooEntries = buildYahooEntries(yahooData.rows, stockNo, yahooData.stockName, true);
                            yahooSourceLabel = 'Yahoo Finance (還原)';
                            await persistEntries(store, stockNo, yahooEntries, yahooData.stockName, yahooSourceLabel, true);
                        } catch (yahooError) {
                            console.error(`[TWSE Proxy ${FUNCTION_VERSION}] Yahoo 抓取失敗:`, yahooError);
                            yahooSourceLabel = '';
                            if (!finmindHydrated) {
                                try {
                                    finmindSourceLabel = await hydrateFinMindDaily(store, stockNo, true, fetchStart, fetchEnd);
                                } catch (finmindError) {
                                    console.error(`[TWSE Proxy ${FUNCTION_VERSION}] FinMind 還原備援失敗:`, finmindError);
                                    finmindSourceLabel = '';
                                }
                                finmindHydrated = true;
                            }
                        }
                        yahooHydrated = true;
                    }
                    payload = await readCache(store, cacheKey);
                    if (payload) {
                        if (yahooSourceLabel) {
                            sourceFlags.add(yahooSourceLabel);
                        } else if (finmindSourceLabel) {
                            sourceFlags.add(finmindSourceLabel);
                        }
                    }
                } else {
                    try {
                        const twseResult = await fetchTwseMonthEntries(stockNo, month);
                        await persistEntries(store, stockNo, twseResult.entries, twseResult.stockName, twseResult.dataSource, false);
                        sourceFlags.add(twseResult.dataSource);
                        payload = await readCache(store, cacheKey);
                    } catch (twseError) {
                        console.warn(`[TWSE Proxy ${FUNCTION_VERSION}] TWSE 主來源失敗 (${month}):`, twseError.message || twseError);
                        if (!finmindHydrated) {
                            try {
                                finmindSourceLabel = await hydrateFinMindDaily(store, stockNo, false, fetchStart, fetchEnd);
                            } catch (finmindError) {
                                console.error(`[TWSE Proxy ${FUNCTION_VERSION}] FinMind 備援失敗:`, finmindError);
                                finmindSourceLabel = '';
                            }
                            finmindHydrated = true;
                        }
                        payload = await readCache(store, cacheKey);
                        if (payload && finmindSourceLabel) {
                            sourceFlags.add(finmindSourceLabel);
                        }
                    }
                }
            } else {
                if (payload.source === 'blob') {
                    sourceFlags.add('TWSE (快取)');
                } else if (payload.source === 'memory') {
                    sourceFlags.add('TWSE (記憶體快取)');
                } else {
                    sourceFlags.add('TWSE (快取)');
                }
            }

            if (!payload) continue;
            if (!stockName && payload.stockName) {
                stockName = payload.stockName;
            }
            if (payload?.dataSource && /Yahoo|FinMind|TWSE/i.test(payload.dataSource)) {
                sourceFlags.add(payload.dataSource);
            }

            const monthRows = Array.isArray(payload.aaData) ? payload.aaData : [];
            monthRows.forEach(row => {
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
            dataSource: selectDataSourceLabel(sourceFlags),
            summary: {
                version: FUNCTION_VERSION,
                requestedRange: {
                    start: isoFromDate(startDate),
                    end: isoFromDate(endDate),
                },
                fetchRange: {
                    start: isoFromDate(fetchStart),
                    end: isoFromDate(fetchEnd),
                },
                months: months.length,
                sources: Array.from(sourceFlags),
            },
        };

        return createJsonResponse(200, body);
    } catch (error) {
        console.error(`[TWSE Proxy ${FUNCTION_VERSION}] 發生未預期錯誤:`, error);
        return createJsonResponse(500, { error: error.message || 'TWSE Proxy error', version: FUNCTION_VERSION });
    }
};
