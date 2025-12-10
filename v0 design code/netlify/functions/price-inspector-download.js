// netlify/functions/price-inspector-download.js (v1.1 - with GA4 tracking)
// Patch Tag: LB-GA4-PROXY-TRACKING-20251210B
import { getStore } from '@netlify/blobs';
import { sendToGA4 } from './utils/ga4.js';

const STORE_NAME = 'price_inspector_downloads';
const STATS_KEY = 'price-inspector-download-stats';
const MAX_EVENT_HISTORY = 12;
const HEADERS = {
    'Content-Type': 'application/json',
};

const inMemoryStores = new Map();

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

function obtainStore() {
    try {
        return getStore(STORE_NAME);
    } catch (error) {
        if (error?.name === 'MissingBlobsEnvironmentError') {
            if (!inMemoryStores.has(STORE_NAME)) {
                console.warn('[PriceInspector] Blobs environment missing, using memory fallback.');
                inMemoryStores.set(STORE_NAME, createMemoryBlobStore());
            }
            return inMemoryStores.get(STORE_NAME);
        }
        throw error;
    }
}

function ensureStatsShape(stats) {
    const normalized = stats && typeof stats === 'object' ? stats : {};
    const byFormat = {
        csv: Number.isFinite(normalized.byFormat?.csv) ? normalized.byFormat.csv : 0,
        json: Number.isFinite(normalized.byFormat?.json) ? normalized.byFormat.json : 0,
    };
    const lastEvents = Array.isArray(normalized.lastEvents)
        ? normalized.lastEvents.filter((event) => event && typeof event === 'object').slice(0, MAX_EVENT_HISTORY)
        : [];
    return {
        totalDownloads: Number.isFinite(normalized.totalDownloads) ? normalized.totalDownloads : 0,
        totalBytes: Number.isFinite(normalized.totalBytes) ? normalized.totalBytes : 0,
        byFormat,
        lastEvents,
        updatedAt: typeof normalized.updatedAt === 'string' ? normalized.updatedAt : null,
    };
}

async function readStats(store) {
    if (!store) return null;
    try {
        const payload = await store.get(STATS_KEY, { type: 'json' });
        if (payload && payload.data) {
            return payload.data;
        }
    } catch (error) {
        console.warn('[PriceInspector] 無法讀取下載統計:', error);
    }
    return null;
}

async function writeStats(store, stats) {
    if (!store) return;
    try {
        await store.setJSON(STATS_KEY, { timestamp: Date.now(), data: stats });
    } catch (error) {
        console.warn('[PriceInspector] 無法儲存下載統計:', error);
    }
}

function respondJson(body, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

function respondError(message, status = 400) {
    return respondJson({ error: message }, status);
}

function parseDownloadEvent(payload) {
    if (!payload || typeof payload !== 'object') {
        return null;
    }
    const format = String(payload.format || 'csv').trim().toLowerCase();
    const normalizedFormat = format === 'json' ? 'json' : 'csv';
    const bytes = Number(payload.sizeBytes);
    const sizeBytes = Number.isFinite(bytes) && bytes >= 0 ? Math.round(bytes) : 0;
    const timestamp = Number(payload.timestamp);
    const eventTime = Number.isFinite(timestamp) && timestamp > 0 ? timestamp : Date.now();
    const stockNo = payload.stockNo ? String(payload.stockNo).trim() : null;
    const market = payload.market ? String(payload.market).trim() : null;
    return {
        format: normalizedFormat,
        sizeBytes,
        timestamp: eventTime,
        stockNo: stockNo || null,
        market: market || null,
    };
}

function buildEventRecord(event) {
    return {
        format: event.format,
        stockNo: event.stockNo,
        market: event.market || 'TWSE',
        sizeBytes: event.sizeBytes,
        timestamp: event.timestamp,
    };
}

function recordEvent(stats, event) {
    const updated = ensureStatsShape(stats);
    updated.totalDownloads += 1;
    updated.totalBytes += event.sizeBytes;
    const counter = updated.byFormat[event.format] ?? 0;
    updated.byFormat[event.format] = counter + 1;
    const nextEvents = [buildEventRecord(event), ...updated.lastEvents].slice(0, MAX_EVENT_HISTORY);
    updated.lastEvents = nextEvents;
    updated.updatedAt = new Date().toISOString();
    return updated;
}

async function handleGet(store) {
    const existing = ensureStatsShape(await readStats(store));
    return respondJson({ stats: existing });
}

async function handlePost(store, request) {
    let payload;
    try {
        payload = await request.json();
    } catch (error) {
        return respondError('無效的下載事件資料', 400);
    }
    const event = parseDownloadEvent(payload);
    if (!event) {
        return respondError('缺少下載事件欄位', 400);
    }
    const previous = await readStats(store);
    const updated = recordEvent(previous, event);
    await writeStats(store, updated);

    // GA4 追蹤
    await sendToGA4('proxy_usage', {
        proxy_name: 'price_download',
        stock_no: event.stockNo || 'N/A',
        market: event.market || 'TWSE',
        format: event.format,
        source: 'backend_proxy'
    });

    return respondJson({ ok: true, stats: updated });
}

export default async (request) => {
    let store;
    try {
        store = obtainStore();
    } catch (error) {
        console.error('[PriceInspector] 初始化 Blob 儲存失敗:', error);
        return respondError('追蹤服務目前不可用', 503);
    }
    const method = (request?.method || 'GET').toUpperCase();
    if (method === 'GET') {
        return handleGet(store);
    }
    if (method === 'POST') {
        return handlePost(store, request);
    }
    return respondError('僅支援 GET 或 POST', 405);
};