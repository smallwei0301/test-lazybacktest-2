import { getStore } from '@netlify/blobs';
import crypto from 'crypto';

export const BLOB_MONITOR_VERSION = 'LB-BLOB-MONITOR-20250624A';

const MONITOR_STORE_NAME = 'blob_traffic_monitor_store_v1';
const EVENT_PREFIX = 'events/';
const SUMMARY_PREFIX = 'summary/';
const GLOBAL_SUMMARY_KEY = `${SUMMARY_PREFIX}global.json`;
const RECENT_EVENT_LIMIT = 50;
const CLIENT_LIMIT = 120;

const fallbackStores = new Map();
const monitorMemoryStore = createMemoryStore();

const OPERATION_DIRECTION = {
    get: 'read',
    getWithMetadata: 'read',
    head: 'read',
    list: 'read',
    set: 'write',
    setJSON: 'write',
    setMetadata: 'write',
    delete: 'write',
};

function createMemoryStore() {
    const memory = new Map();
    return {
        async get(key) {
            return memory.has(key) ? cloneJson(memory.get(key)) : null;
        },
        async set(key, value) {
            memory.set(key, cloneJson(value));
        },
        async setJSON(key, value) {
            memory.set(key, cloneJson(value));
        },
        async delete(key) {
            memory.delete(key);
        },
        async list(options = {}) {
            const prefix = typeof options.prefix === 'string' ? options.prefix : '';
            const blobs = [];
            for (const [key, value] of memory.entries()) {
                if (!prefix || key.startsWith(prefix)) {
                    blobs.push({ key, size: estimateBytes(value) });
                }
            }
            return { blobs, directories: [] };
        },
    };
}

function cloneJson(value) {
    if (value === null || value === undefined) return value;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (error) {
        return value;
    }
}

function estimateBytes(value) {
    if (value === null || value === undefined) return 0;
    try {
        if (typeof value === 'string') {
            return Buffer.byteLength(value, 'utf8');
        }
        if (Buffer.isBuffer(value)) {
            return value.length;
        }
        return Buffer.byteLength(JSON.stringify(value));
    } catch (error) {
        return 0;
    }
}

function getHeaderValue(headers, name) {
    if (!headers || !name) return undefined;
    if (typeof headers.get === 'function') {
        return headers.get(name);
    }
    const lower = name.toLowerCase();
    if (typeof headers === 'object') {
        for (const key of Object.keys(headers)) {
            if (key.toLowerCase() === lower) {
                return headers[key];
            }
        }
    }
    return undefined;
}

function maskIp(ip) {
    if (!ip) return 'unknown';
    if (ip.includes(':')) {
        const segments = ip.split(':').filter(Boolean);
        if (segments.length <= 2) {
            return `${segments.join(':')}::`; // short IPv6
        }
        return `${segments.slice(0, 3).join(':')}::`;
    }
    const parts = ip.split('.');
    if (parts.length !== 4) {
        return ip;
    }
    return `${parts[0]}.${parts[1]}.${parts[2]}.*`;
}

function hashClientIdentifier(ip, userAgent) {
    const hash = crypto.createHash('sha256');
    hash.update(`${ip || 'unknown'}|${userAgent || 'unknown'}`);
    return hash.digest('hex');
}

function normaliseDate(value) {
    if (!value) {
        const now = new Date();
        return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
    }
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) {
            return normaliseDate(null);
        }
        return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
    }
    const text = String(value).trim();
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
            return text;
        }
        return normaliseDate(null);
    }
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function resolveClientContext({ event, request, headers, meta }) {
    const headerSource = headers || event?.headers || request?.headers || meta?.headers;
    const forwarded = getHeaderValue(headerSource, 'x-forwarded-for');
    const clientIp = meta?.clientIp
        || getHeaderValue(headerSource, 'x-nf-client-connection-ip')
        || getHeaderValue(headerSource, 'client-ip')
        || (forwarded ? forwarded.split(',')[0].trim() : null)
        || 'unknown';
    const userAgent = meta?.userAgent || getHeaderValue(headerSource, 'user-agent') || 'unknown';
    const referer = meta?.referer || getHeaderValue(headerSource, 'referer') || null;
    const requestId = meta?.requestId
        || event?.requestContext?.requestId
        || getHeaderValue(headerSource, 'x-nf-request-id')
        || getHeaderValue(headerSource, 'x-request-id')
        || null;
    const maskedIp = maskIp(clientIp);
    const clientHash = hashClientIdentifier(clientIp, userAgent);
    return {
        clientHash,
        clientIp,
        maskedIp,
        userAgent,
        referer,
        requestId,
    };
}

function getBaseStore(name) {
    try {
        const store = getStore(name);
        if (store && typeof store === 'object') {
            store.__blobMonitorLayer = 'blob';
        }
        return store;
    } catch (error) {
        if (error?.name === 'MissingBlobsEnvironmentError') {
            if (!fallbackStores.has(name)) {
                console.warn(`[BlobMonitor] Netlify Blobs 未配置，對 ${name} 使用記憶體快取。`);
                fallbackStores.set(name, createMemoryStore());
            }
            const fallback = fallbackStores.get(name);
            fallback.__blobMonitorLayer = 'memory-fallback';
            return fallback;
        }
        throw error;
    }
}

function getMonitorStore() {
    try {
        return getStore(MONITOR_STORE_NAME);
    } catch (error) {
        if (error?.name === 'MissingBlobsEnvironmentError') {
            return monitorMemoryStore;
        }
        throw error;
    }
}

function createDefaultSummary(dateLabel) {
    return {
        version: BLOB_MONITOR_VERSION,
        date: dateLabel,
        totals: {
            events: 0,
            success: 0,
            error: 0,
            reads: 0,
            writes: 0,
            bytesRead: 0,
            bytesWrite: 0,
        },
        operations: {},
        stores: {},
        clients: {},
        recentEvents: [],
        updatedAt: null,
    };
}

function pruneClients(summary) {
    const clientEntries = Object.entries(summary.clients || {});
    if (clientEntries.length <= CLIENT_LIMIT) {
        return;
    }
    clientEntries.sort((a, b) => {
        const aTime = new Date(a[1]?.lastSeenIso || 0).getTime();
        const bTime = new Date(b[1]?.lastSeenIso || 0).getTime();
        return bTime - aTime;
    });
    const trimmed = clientEntries.slice(0, CLIENT_LIMIT);
    summary.clients = Object.fromEntries(trimmed);
}

function applyEventToSummary(summary, record) {
    if (!summary) {
        summary = createDefaultSummary(record.summaryDate || 'unknown');
    }
    const totals = summary.totals;
    totals.events += 1;
    if (record.status === 'success') {
        totals.success += 1;
    } else {
        totals.error += 1;
    }
    if (record.direction === 'read') {
        totals.reads += 1;
        totals.bytesRead += record.bytes || 0;
    } else if (record.direction === 'write') {
        totals.writes += 1;
        totals.bytesWrite += record.bytes || 0;
    }

    if (!summary.operations[record.operation]) {
        summary.operations[record.operation] = {
            total: 0,
            success: 0,
            error: 0,
            reads: 0,
            writes: 0,
            bytesRead: 0,
            bytesWrite: 0,
        };
    }
    const op = summary.operations[record.operation];
    op.total += 1;
    if (record.status === 'success') {
        op.success += 1;
    } else {
        op.error += 1;
    }
    if (record.direction === 'read') {
        op.reads += 1;
        op.bytesRead += record.bytes || 0;
    } else if (record.direction === 'write') {
        op.writes += 1;
        op.bytesWrite += record.bytes || 0;
    }

    if (!summary.stores[record.storeName]) {
        summary.stores[record.storeName] = {
            total: 0,
            success: 0,
            error: 0,
            reads: 0,
            writes: 0,
            bytesRead: 0,
            bytesWrite: 0,
            storageLayer: record.storageLayer,
            lastSeenIso: null,
        };
    }
    const storeStats = summary.stores[record.storeName];
    storeStats.total += 1;
    if (record.status === 'success') {
        storeStats.success += 1;
    } else {
        storeStats.error += 1;
    }
    if (record.direction === 'read') {
        storeStats.reads += 1;
        storeStats.bytesRead += record.bytes || 0;
    } else if (record.direction === 'write') {
        storeStats.writes += 1;
        storeStats.bytesWrite += record.bytes || 0;
    }
    storeStats.storageLayer = record.storageLayer;
    storeStats.lastSeenIso = record.timestamp;

    if (record.clientHash) {
        if (!summary.clients[record.clientHash]) {
            summary.clients[record.clientHash] = {
                clientHash: record.clientHash,
                maskedIp: record.maskedIp,
                userAgent: record.userAgent,
                total: 0,
                success: 0,
                error: 0,
                reads: 0,
                writes: 0,
                bytesRead: 0,
                bytesWrite: 0,
                firstSeenIso: record.timestamp,
                lastSeenIso: record.timestamp,
                lastSource: record.source,
            };
        }
        const clientStats = summary.clients[record.clientHash];
        clientStats.total += 1;
        if (record.status === 'success') {
            clientStats.success += 1;
        } else {
            clientStats.error += 1;
        }
        if (record.direction === 'read') {
            clientStats.reads += 1;
            clientStats.bytesRead += record.bytes || 0;
        } else if (record.direction === 'write') {
            clientStats.writes += 1;
            clientStats.bytesWrite += record.bytes || 0;
        }
        clientStats.lastSeenIso = record.timestamp;
        clientStats.lastSource = record.source;
        if (record.userAgent) {
            clientStats.userAgent = record.userAgent;
        }
        if (record.referer) {
            clientStats.lastReferer = record.referer;
        }
    }

    const eventSummary = {
        timestamp: record.timestamp,
        storeName: record.storeName,
        operation: record.operation,
        direction: record.direction,
        status: record.status,
        source: record.source,
        storageLayer: record.storageLayer,
        key: record.key,
        bytes: record.bytes,
        hitType: record.hitType,
        maskedIp: record.maskedIp,
        clientHash: record.clientHash,
        userAgent: record.userAgent,
        durationMs: record.durationMs,
        requestId: record.requestId,
        referer: record.referer,
        errorMessage: record.errorMessage || null,
    };
    summary.recentEvents = [eventSummary, ...(summary.recentEvents || [])].slice(0, RECENT_EVENT_LIMIT);
    summary.updatedAt = record.timestamp;
    pruneClients(summary);
    return summary;
}

async function updateSummaryDocument(store, key, record) {
    try {
        const existing = await store.get(key, { type: 'json' });
        const summaryDate = key === GLOBAL_SUMMARY_KEY ? 'global' : record.summaryDate;
        const next = applyEventToSummary(existing ?? createDefaultSummary(summaryDate), record);
        await store.setJSON(key, next);
    } catch (error) {
        console.warn('[BlobMonitor] 無法更新摘要:', error);
    }
}

export async function recordBlobUsage(details) {
    try {
        const direction = OPERATION_DIRECTION[details.operation] || 'other';
        const timestamp = new Date().toISOString();
        const summaryDate = normaliseDate(timestamp);
        const record = {
            timestamp,
            summaryDate,
            storeName: details.storeName,
            operation: details.operation,
            direction,
            status: details.status || 'success',
            key: details.key || null,
            bytes: Number.isFinite(details.bytes) ? Number(details.bytes) : 0,
            hitType: details.hitType || null,
            durationMs: Number.isFinite(details.durationMs) ? Number(details.durationMs) : null,
            source: details.source || 'unknown',
            storageLayer: details.storageLayer || 'blob',
            clientHash: details.clientContext?.clientHash || null,
            maskedIp: details.clientContext?.maskedIp || null,
            userAgent: details.clientContext?.userAgent || null,
            requestId: details.clientContext?.requestId || null,
            referer: details.clientContext?.referer || null,
            errorMessage: details.error ? String(details.error.message || details.error) : null,
        };

        const store = getMonitorStore();
        const dayKey = `${SUMMARY_PREFIX}${record.summaryDate}.json`;
        const safeTime = record.timestamp.replace(/[:.]/g, '-');
        const randomSuffix = Math.random().toString(36).slice(2, 8);
        const eventKey = `${EVENT_PREFIX}${record.summaryDate}/${safeTime}-${randomSuffix}.json`;

        await store.setJSON(eventKey, record);
        await updateSummaryDocument(store, dayKey, record);
        await updateSummaryDocument(store, GLOBAL_SUMMARY_KEY, record);
    } catch (error) {
        console.warn('[BlobMonitor] 記錄 Blob 使用量時發生錯誤:', error);
    }
}

function wrapStoreWithMonitor({ store, storeName, storageLayer, source, clientContext }) {
    if (!store || typeof store !== 'object') {
        return store;
    }
    if (storeName === MONITOR_STORE_NAME) {
        return store;
    }
    const target = store;
    const handler = {
        get(targetStore, prop, receiver) {
            const original = targetStore[prop];
            if (typeof original === 'function' && prop in OPERATION_DIRECTION) {
                return async function monitoredMethod(...args) {
                    const operation = prop;
                    const start = Date.now();
                    let status = 'success';
                    let result;
                    let error;
                    let key = null;
                    let bytes = 0;
                    try {
                        result = await original.apply(targetStore, args);
                        if (operation === 'get' || operation === 'getWithMetadata') {
                            key = args[0] || null;
                            bytes = estimateBytes(result);
                        } else if (operation === 'set' || operation === 'setJSON' || operation === 'setMetadata') {
                            key = args[0] || null;
                            bytes = estimateBytes(args[1]);
                        } else if (operation === 'delete') {
                            key = args[0] || null;
                        }
                        return result;
                    } catch (err) {
                        status = 'error';
                        error = err;
                        throw err;
                    } finally {
                        const durationMs = Date.now() - start;
                        const hitType = (operation === 'get' || operation === 'getWithMetadata')
                            ? (result ? 'hit' : 'miss')
                            : null;
                        try {
                            await recordBlobUsage({
                                storeName,
                                operation,
                                status,
                                key,
                                bytes,
                                durationMs,
                                hitType,
                                source,
                                storageLayer,
                                error,
                                clientContext,
                            });
                        } catch (monitorError) {
                            console.warn('[BlobMonitor] 監控記錄失敗:', monitorError);
                        }
                    }
                };
            }
            return Reflect.get(targetStore, prop, receiver);
        },
    };
    const proxy = new Proxy(target, handler);
    Object.defineProperty(proxy, '__blobMonitorLayer', {
        value: storageLayer,
        enumerable: false,
        configurable: true,
    });
    Object.defineProperty(proxy, '__blobMonitorSource', {
        value: source,
        enumerable: false,
        configurable: true,
    });
    return proxy;
}

export function obtainMonitoredStore({ name, source, event, request, headers, meta }) {
    const baseStore = getBaseStore(name) || createMemoryStore();
    const storageLayer = baseStore.__blobMonitorLayer || 'blob';
    const clientContext = resolveClientContext({ event, request, headers, meta });
    return wrapStoreWithMonitor({
        store: baseStore,
        storeName: name,
        storageLayer,
        source: source || 'unknown',
        clientContext,
    });
}

export async function loadBlobUsageSnapshot(options = {}) {
    const targetDate = normaliseDate(options.date);
    const limit = Number.isFinite(options.limit) ? options.limit : RECENT_EVENT_LIMIT;
    try {
        const store = getMonitorStore();
        const [daily, global] = await Promise.all([
            store.get(`${SUMMARY_PREFIX}${targetDate}.json`, { type: 'json' }).catch(() => null),
            store.get(GLOBAL_SUMMARY_KEY, { type: 'json' }).catch(() => null),
        ]);
        const dailySummary = daily ? { ...daily, recentEvents: (daily.recentEvents || []).slice(0, limit) } : null;
        return {
            version: BLOB_MONITOR_VERSION,
            date: targetDate,
            daily: dailySummary,
            global: global || null,
        };
    } catch (error) {
        console.error('[BlobMonitor] 無法載入使用量快照:', error);
        return {
            version: BLOB_MONITOR_VERSION,
            date: targetDate,
            daily: null,
            global: null,
            error: error.message || String(error),
        };
    }
}
