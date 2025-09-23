
// Patch Tag: LB-TW-DIRECTORY-20250620A
// Patch Tag: LB-COVERAGE-STREAM-20250705A
// 確保 zoom 插件正確註冊
document.addEventListener('DOMContentLoaded', function() {
    console.log('Chart object:', typeof Chart);
    console.log('Available Chart plugins:', Chart.registry ? Object.keys(Chart.registry.plugins.items) : 'No registry');
});

document.addEventListener('DOMContentLoaded', () => {
    const shouldForceRefresh = !taiwanDirectoryState.cachedAt
        || (Date.now() - taiwanDirectoryState.cachedAt) > TAIWAN_DIRECTORY_CACHE_TTL_MS;
    ensureTaiwanDirectoryReady({ forceRefresh: shouldForceRefresh }).catch((error) => {
        console.warn('[Taiwan Directory] 預載入失敗:', error);
    });
});

document.addEventListener('DOMContentLoaded', () => {
    renderBlobUsageCard();
});

let lastPriceDebug = {
    steps: [],
    summary: null,
    adjustments: [],
    fallbackApplied: false,
    priceSource: null,
    dataSource: null,
    dataSources: [],
    priceMode: null,
    splitDiagnostics: null,
    finmindStatus: null,
};

let visibleStockData = [];
let lastIndicatorSeries = null;
let lastPositionStates = [];
let lastDatasetDiagnostics = null;

const BACKTEST_DAY_MS = 24 * 60 * 60 * 1000;
const START_GAP_TOLERANCE_DAYS = 7;
const START_GAP_RETRY_MS = 6 * 60 * 60 * 1000; // 六小時後再嘗試重新抓取
const DATA_CACHE_INDEX_KEY = 'LB_DATA_CACHE_INDEX_V20250723A';
const DATA_CACHE_VERSION = 'LB-SUPERSET-CACHE-20250723A';
const TW_DATA_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const US_DATA_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 3;
const DEFAULT_DATA_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;

const SESSION_DATA_CACHE_VERSION = 'LB-SUPERSET-CACHE-20250723A';
const SESSION_DATA_CACHE_INDEX_KEY = 'LB_SESSION_DATA_CACHE_INDEX_V20250723A';
const SESSION_DATA_CACHE_ENTRY_PREFIX = 'LB_SESSION_DATA_CACHE_ENTRY_V20250723A::';
const SESSION_DATA_CACHE_LIMIT = 24;

const YEAR_STORAGE_VERSION = 'LB-BLOB-QUIN-20250830A';
const YEAR_STORAGE_PREFIX = 'LB_YEAR_DATA_CACHE_V20250830A';
const YEAR_STORAGE_TW_TTL_MS = 1000 * 60 * 60 * 24 * 3;
const YEAR_STORAGE_US_TTL_MS = 1000 * 60 * 60 * 24 * 1;
const YEAR_STORAGE_DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 2;

const BLOB_LEDGER_STORAGE_KEY = 'LB_BLOB_LEDGER_V20250830A';
const BLOB_LEDGER_VERSION = 'LB-BLOB-QUIN-20250830A';
const BLOB_LEDGER_MAX_EVENTS = 36;

function cloneArrayOfRanges(ranges) {
    if (!Array.isArray(ranges)) return undefined;
    return ranges
        .map((range) => {
            if (!range || typeof range !== 'object') return null;
            return {
                start: range.start || null,
                end: range.end || null,
            };
        })
        .filter((range) => range !== null);
}

function normaliseFetchDiagnosticsForCacheReplay(diagnostics, options = {}) {
    const base = diagnostics && typeof diagnostics === 'object' ? diagnostics : {};
    const requestedRange = options.requestedRange || base.requested || null;
    const requestedStart = requestedRange?.start || null;
    const requestedEnd = requestedRange?.end || null;
    const coverageRanges = options.coverage || base.coverage || null;
    const sourceLabel = options.source || base.replaySource || base.source || 'cache-replay';
    const sanitized = {
        ...base,
        source: sourceLabel,
        replaySource: sourceLabel,
        cacheReplay: true,
        usedCache: true,
        replayedAt: Date.now(),
    };
    sanitized.requested = {
        start: requestedStart,
        end: requestedEnd,
    };
    if (coverageRanges) {
        sanitized.coverage = cloneArrayOfRanges(coverageRanges);
    }
    if (sanitized.rangeFetch && typeof sanitized.rangeFetch === 'object') {
        const rangeFetch = { ...sanitized.rangeFetch };
        rangeFetch.cacheReplay = true;
        rangeFetch.readOps = 0;
        rangeFetch.writeOps = 0;
        if (Array.isArray(rangeFetch.operations)) {
            rangeFetch.operations = [];
        }
        if (typeof rangeFetch.status === 'string' && !/cache/i.test(rangeFetch.status)) {
            rangeFetch.status = `${rangeFetch.status}-cache`;
        }
        sanitized.rangeFetch = rangeFetch;
    }
    const blobInfo = base.blob && typeof base.blob === 'object' ? { ...base.blob } : {};
    blobInfo.operations = [];
    blobInfo.readOps = 0;
    blobInfo.writeOps = 0;
    blobInfo.cacheReplay = true;
    if (!blobInfo.provider && sourceLabel) {
        blobInfo.provider = sourceLabel;
    }
    sanitized.blob = blobInfo;
    if (Array.isArray(base.months)) {
        sanitized.months = base.months.map((month) => ({
            ...(typeof month === 'object' ? month : {}),
            operations: [],
            cacheReplay: true,
            readOps: 0,
            writeOps: 0,
        }));
    }
    if (Array.isArray(sanitized.operations)) {
        sanitized.operations = [];
    }
    return sanitized;
}

function normalizeMarketKeyForCache(market) {
    const normalized = (market || 'TWSE').toString().toUpperCase();
    if (normalized === 'NASDAQ' || normalized === 'NYSE') return 'US';
    return normalized;
}

function getDatasetCacheTTLMs(market) {
    const normalized = normalizeMarketKeyForCache(market);
    if (normalized === 'US') return US_DATA_CACHE_TTL_MS;
    if (normalized === 'TPEX' || normalized === 'TWSE') return TW_DATA_CACHE_TTL_MS;
    return DEFAULT_DATA_CACHE_TTL_MS;
}

function getYearStorageTtlMs(market) {
    const normalized = normalizeMarketKeyForCache(market);
    if (normalized === 'US') return YEAR_STORAGE_US_TTL_MS;
    if (normalized === 'TPEX' || normalized === 'TWSE') return YEAR_STORAGE_TW_TTL_MS;
    return YEAR_STORAGE_DEFAULT_TTL_MS;
}

function buildSessionStorageEntryKey(cacheKey) {
    return `${SESSION_DATA_CACHE_ENTRY_PREFIX}${cacheKey}`;
}

function loadSessionDataCacheIndex() {
    if (typeof window === 'undefined' || !window.sessionStorage) {
        return new Map();
    }
    try {
        const raw = window.sessionStorage.getItem(SESSION_DATA_CACHE_INDEX_KEY);
        if (!raw) return new Map();
        const parsed = JSON.parse(raw);
        const records = Array.isArray(parsed?.records)
            ? parsed.records
            : Array.isArray(parsed)
                ? parsed
                : [];
        const map = new Map();
        records.forEach((record) => {
            if (!record || typeof record !== 'object') return;
            const key = record.key || record.cacheKey;
            const cachedAt = Number(record.cachedAt);
            const market = record.market || record.marketType || null;
            const priceMode = record.priceMode || null;
            const split = Boolean(record.splitAdjustment);
            if (!key || !Number.isFinite(cachedAt)) return;
            map.set(key, {
                cachedAt,
                market,
                priceMode,
                splitAdjustment: split,
            });
        });
        return map;
    } catch (error) {
        console.warn('[Main] 無法載入 Session 回測快取索引:', error);
        return new Map();
    }
}

function saveSessionDataCacheIndex() {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    if (!(sessionDataCacheIndex instanceof Map)) return;
    try {
        const records = Array.from(sessionDataCacheIndex.entries()).map(([key, entry]) => ({
            key,
            cachedAt: Number.isFinite(entry?.cachedAt) ? entry.cachedAt : Date.now(),
            market: entry?.market || null,
            priceMode: entry?.priceMode || null,
            splitAdjustment: entry?.splitAdjustment ? 1 : 0,
        }));
        const payload = { version: SESSION_DATA_CACHE_VERSION, records };
        window.sessionStorage.setItem(SESSION_DATA_CACHE_INDEX_KEY, JSON.stringify(payload));
    } catch (error) {
        console.warn('[Main] 無法寫入 Session 回測快取索引:', error);
    }
}

function pruneSessionDataCacheEntries(options = {}) {
    if (!(sessionDataCacheIndex instanceof Map)) return;
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    const now = Date.now();
    const removedKeys = [];
    const ttlMs = YEAR_STORAGE_DEFAULT_TTL_MS;
    for (const [key, entry] of sessionDataCacheIndex.entries()) {
        const cachedAt = Number(entry?.cachedAt);
        if (!Number.isFinite(cachedAt)) {
            sessionDataCacheIndex.delete(key);
            removedKeys.push(key);
            continue;
        }
        const ttl = getYearStorageTtlMs(entry?.market || null) || ttlMs;
        if (ttl > 0 && now - cachedAt > ttl) {
            sessionDataCacheIndex.delete(key);
            removedKeys.push(key);
        }
    }
    const limit = Number.isFinite(options?.limit) ? options.limit : SESSION_DATA_CACHE_LIMIT;
    if (limit > 0 && sessionDataCacheIndex.size > limit) {
        const sorted = Array.from(sessionDataCacheIndex.entries()).sort((a, b) => a[1].cachedAt - b[1].cachedAt);
        while (sorted.length > limit) {
            const [key] = sorted.shift();
            sessionDataCacheIndex.delete(key);
            removedKeys.push(key);
        }
    }
    if (removedKeys.length > 0) {
        removedKeys.forEach((key) => {
            try {
                window.sessionStorage.removeItem(buildSessionStorageEntryKey(key));
            } catch (error) {
                console.warn('[Main] 無法移除 Session 回測快取項目:', error);
            }
        });
    }
    if (options?.save !== false) {
        saveSessionDataCacheIndex();
    }
}

function getSessionDataCacheEntry(cacheKey) {
    if (!cacheKey) return null;
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    try {
        const raw = window.sessionStorage.getItem(buildSessionStorageEntryKey(cacheKey));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.version !== SESSION_DATA_CACHE_VERSION) return null;
        if (!Array.isArray(parsed.data) || parsed.data.length === 0) return null;
        return parsed;
    } catch (error) {
        console.warn('[Main] 解析 Session 回測快取失敗:', error);
        return null;
    }
}

function persistSessionDataCacheEntry(cacheKey, cacheEntry, options = {}) {
    if (!cacheKey || !cacheEntry) return;
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    const payload = {
        version: SESSION_DATA_CACHE_VERSION,
        cachedAt: Date.now(),
        data: Array.isArray(cacheEntry.data) ? cacheEntry.data : [],
        coverage: Array.isArray(cacheEntry.coverage) ? cacheEntry.coverage : [],
        meta: {
            stockName: cacheEntry.stockName || null,
            stockNo: cacheEntry.stockNo || null,
            market: options.market || null,
            dataSource: cacheEntry.dataSource || null,
            dataSources: Array.isArray(cacheEntry.dataSources) ? cacheEntry.dataSources : [],
            priceMode: cacheEntry.priceMode || null,
            splitAdjustment: Boolean(cacheEntry.splitAdjustment),
            dataStartDate: cacheEntry.dataStartDate || null,
            effectiveStartDate: cacheEntry.effectiveStartDate || null,
            lookbackDays: cacheEntry.lookbackDays || null,
            summary: cacheEntry.summary || null,
            adjustments: Array.isArray(cacheEntry.adjustments) ? cacheEntry.adjustments : [],
            debugSteps: Array.isArray(cacheEntry.debugSteps) ? cacheEntry.debugSteps : [],
            priceSource: cacheEntry.priceSource || null,
            fetchRange: cacheEntry.fetchRange || null,
            fetchDiagnostics: cacheEntry.fetchDiagnostics || null,
            coverageFingerprint: cacheEntry.coverageFingerprint || null,
        },
    };
    try {
        window.sessionStorage.setItem(buildSessionStorageEntryKey(cacheKey), JSON.stringify(payload));
        sessionDataCacheIndex.set(cacheKey, {
            cachedAt: payload.cachedAt,
            market: options.market || null,
            priceMode: cacheEntry.priceMode || null,
            splitAdjustment: Boolean(cacheEntry.splitAdjustment),
        });
        pruneSessionDataCacheEntries({ save: true });
    } catch (error) {
        console.warn('[Main] 寫入 Session 回測快取失敗:', error);
    }
}

function removeSessionDataCacheEntry(cacheKey) {
    if (!cacheKey) return;
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    try {
        window.sessionStorage.removeItem(buildSessionStorageEntryKey(cacheKey));
    } catch (error) {
        console.warn('[Main] 移除 Session 回測快取失敗:', error);
    }
    if (sessionDataCacheIndex instanceof Map) {
        sessionDataCacheIndex.delete(cacheKey);
        saveSessionDataCacheIndex();
    }
}

function buildYearStorageKey(context, year) {
    if (!context || !context.stockNo) return null;
    const market = normalizeMarketKeyForCache(context.market || context.marketType || currentMarket || 'TWSE');
    const stockNo = (context.stockNo || '').toString().toUpperCase();
    const priceMode = (context.priceMode || (context.adjustedPrice ? 'adjusted' : 'raw') || 'raw').toString().toLowerCase();
    const priceModeKey = priceMode === 'adjusted' ? 'ADJ' : 'RAW';
    const splitFlag = context.splitAdjustment ? 'SPLIT' : 'NOSPLIT';
    return `${YEAR_STORAGE_PREFIX}::${market}|${stockNo}|${priceModeKey}|${splitFlag}|${year}`;
}

function loadYearStorageSlice(context, year) {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const key = buildYearStorageKey(context, year);
    if (!key) return null;
    try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.version !== YEAR_STORAGE_VERSION) return null;
        const cachedAt = Number(parsed.cachedAt);
        if (!Number.isFinite(cachedAt)) return null;
        const ttl = getYearStorageTtlMs(parsed.market || context.market || null);
        if (ttl > 0 && Date.now() - cachedAt > ttl) {
            window.localStorage.removeItem(key);
            return null;
        }
        if (!Array.isArray(parsed.data) || parsed.data.length === 0) return null;
        return parsed;
    } catch (error) {
        console.warn('[Main] 解析年度快取失敗:', error);
        return null;
    }
}

function computeCoverageFromRows(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return [];
    const sorted = rows
        .map((row) => (row && row.date ? parseISODateToUTC(row.date) : NaN))
        .filter((ms) => Number.isFinite(ms))
        .sort((a, b) => a - b);
    if (sorted.length === 0) return [];
    const tolerance = MAIN_DAY_MS * 6;
    const segments = [];
    let segStart = sorted[0];
    let segEnd = segStart + MAIN_DAY_MS;
    for (let i = 1; i < sorted.length; i += 1) {
        const current = sorted[i];
        if (!Number.isFinite(current)) continue;
        if (current <= segEnd + tolerance) {
            if (current + MAIN_DAY_MS > segEnd) {
                segEnd = current + MAIN_DAY_MS;
            }
        } else {
            segments.push({ start: utcToISODate(segStart), end: utcToISODate(segEnd - MAIN_DAY_MS) });
            segStart = current;
            segEnd = current + MAIN_DAY_MS;
        }
    }
    segments.push({ start: utcToISODate(segStart), end: utcToISODate(segEnd - MAIN_DAY_MS) });
    return segments;
}

function computeCoverageFingerprint(coverage) {
    if (!Array.isArray(coverage) || coverage.length === 0) return null;
    const parts = coverage
        .map((range) => {
            if (!range || (!range.start && !range.end)) return null;
            const start = range.start || '';
            const end = range.end || '';
            return `${start}~${end}`;
        })
        .filter(Boolean);
    if (parts.length === 0) return null;
    return parts.join('|');
}

function persistYearStorageSlices(context, dataset, options = {}) {
    if (!context || !Array.isArray(dataset) || dataset.length === 0) return;
    if (typeof window === 'undefined' || !window.localStorage) return;
    const grouped = new Map();
    dataset.forEach((row) => {
        if (!row || typeof row.date !== 'string') return;
        const year = parseInt(row.date.slice(0, 4), 10);
        if (!Number.isFinite(year)) return;
        if (!grouped.has(year)) grouped.set(year, []);
        grouped.get(year).push(row);
    });
    const now = Date.now();
    grouped.forEach((rows, year) => {
        const key = buildYearStorageKey(context, year);
        if (!key) return;
        const payload = {
            version: YEAR_STORAGE_VERSION,
            cachedAt: now,
            market: context.market || null,
            stockNo: context.stockNo || null,
            priceMode: context.priceMode || null,
            splitAdjustment: Boolean(context.splitAdjustment),
            data: rows,
            coverage: computeCoverageFromRows(rows),
        };
        try {
            window.localStorage.setItem(key, JSON.stringify(payload));
        } catch (error) {
            console.warn('[Main] 寫入年度快取失敗:', error);
        }
    });
    if (options?.prune !== false) {
        pruneYearStorageEntries();
    }
}

function pruneYearStorageEntries() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const now = Date.now();
    const toRemove = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
        const key = window.localStorage.key(i);
        if (!key || !key.startsWith(`${YEAR_STORAGE_PREFIX}::`)) continue;
        try {
            const raw = window.localStorage.getItem(key);
            if (!raw) {
                toRemove.push(key);
                continue;
            }
            const parsed = JSON.parse(raw);
            if (!parsed || parsed.version !== YEAR_STORAGE_VERSION) {
                toRemove.push(key);
                continue;
            }
            const ttl = getYearStorageTtlMs(parsed.market || null);
            const cachedAt = Number(parsed.cachedAt);
            if (!Number.isFinite(cachedAt) || (ttl > 0 && now - cachedAt > ttl)) {
                toRemove.push(key);
            }
        } catch (error) {
            console.warn('[Main] 檢查年度快取時失敗:', error);
            toRemove.push(key);
        }
    }
    toRemove.forEach((key) => {
        try {
            window.localStorage.removeItem(key);
        } catch (error) {
            console.warn('[Main] 移除年度快取失敗:', error);
        }
    });
}

const sessionDataCacheIndex = loadSessionDataCacheIndex();
pruneSessionDataCacheEntries({ save: false });

const persistentDataCacheIndex = loadPersistentDataCacheIndex();
prunePersistentDataCacheIndex();

pruneYearStorageEntries();

function loadBlobUsageLedger() {
    const base = { version: BLOB_LEDGER_VERSION, updatedAt: null, months: {} };
    if (typeof window === 'undefined' || !window.localStorage) {
        return base;
    }
    try {
        const raw = window.localStorage.getItem(BLOB_LEDGER_STORAGE_KEY);
        if (!raw) return base;
        const parsed = JSON.parse(raw);
        const months = parsed && typeof parsed.months === 'object' ? parsed.months : {};
        const ledger = { version: BLOB_LEDGER_VERSION, updatedAt: parsed?.updatedAt || null, months: {} };
        const now = new Date();
        const limit = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        Object.entries(months).forEach(([monthKey, stats]) => {
            if (!monthKey || typeof stats !== 'object') return;
            const [yearStr, monthStr] = monthKey.split('-');
            const year = parseInt(yearStr, 10);
            const month = parseInt(monthStr, 10) - 1;
            if (!Number.isFinite(year) || !Number.isFinite(month)) return;
            const monthDate = new Date(year, month, 1);
            if (monthDate < limit) return;
            ledger.months[monthKey] = {
                readOps: Number(stats.readOps) || 0,
                writeOps: Number(stats.writeOps) || 0,
                cacheHits: Number(stats.cacheHits) || 0,
                cacheMisses: Number(stats.cacheMisses) || 0,
                stocks: stats.stocks && typeof stats.stocks === 'object' ? stats.stocks : {},
                events: Array.isArray(stats.events) ? stats.events.slice(0, BLOB_LEDGER_MAX_EVENTS) : [],
            };
        });
        return ledger;
    } catch (error) {
        console.warn('[Main] 載入 Blob 用量紀錄失敗:', error);
        return base;
    }
}

const blobUsageLedger = loadBlobUsageLedger();
const blobUsageAccordionState = { overrides: {} };

function isBlobUsageGroupExpanded(dateKey, defaultExpanded) {
    if (!dateKey) return defaultExpanded;
    if (Object.prototype.hasOwnProperty.call(blobUsageAccordionState.overrides, dateKey)) {
        return Boolean(blobUsageAccordionState.overrides[dateKey]);
    }
    return defaultExpanded;
}

function setBlobUsageGroupExpanded(dateKey, expanded) {
    if (!dateKey) return;
    blobUsageAccordionState.overrides[dateKey] = Boolean(expanded);
}

function recordTaiwanDirectoryBlobUsage(cacheMeta) {
    if (!cacheMeta || cacheMeta.store !== 'blob') return;
    const operations = [
        {
            action: 'read',
            cacheHit: Boolean(cacheMeta.hit),
            key: 'taiwan-directory',
            source: 'taiwan-directory',
            count: 1,
        },
    ];
    if (!cacheMeta.hit) {
        operations.push({
            action: 'write',
            cacheHit: false,
            key: 'taiwan-directory',
            source: 'taiwan-directory',
            count: 1,
        });
    }
    recordBlobUsageEvents(operations, { source: 'taiwan-directory' });
    renderBlobUsageCard();
}

function saveBlobUsageLedger() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
        window.localStorage.setItem(BLOB_LEDGER_STORAGE_KEY, JSON.stringify(blobUsageLedger));
    } catch (error) {
        console.warn('[Main] 寫入 Blob 用量紀錄失敗:', error);
    }
}

function recordBlobUsageEvents(operations, options = {}) {
    if (!Array.isArray(operations) || operations.length === 0) return;
    if (!blobUsageLedger || typeof blobUsageLedger !== 'object') return;
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (!blobUsageLedger.months[monthKey]) {
        blobUsageLedger.months[monthKey] = {
            readOps: 0,
            writeOps: 0,
            cacheHits: 0,
            cacheMisses: 0,
            stocks: {},
            events: [],
        };
    }
    const monthRecord = blobUsageLedger.months[monthKey];
    operations.forEach((op) => {
        if (!op || typeof op !== 'object') return;
        const action = op.action || op.type || 'read';
        const stockNo = op.stockNo || options.stockNo || null;
        const market = op.market || options.market || null;
        const cacheHit = Boolean(op.cacheHit);
        const opCount = Number(op.count) || 1;
        if (action === 'write') {
            monthRecord.writeOps += opCount;
        } else {
            monthRecord.readOps += opCount;
        }
        if (cacheHit) {
            monthRecord.cacheHits += opCount;
        } else {
            monthRecord.cacheMisses += opCount;
        }
        if (stockNo) {
            if (!monthRecord.stocks[stockNo]) {
                monthRecord.stocks[stockNo] = { count: 0, market: market || null };
            }
            monthRecord.stocks[stockNo].count += opCount;
            monthRecord.stocks[stockNo].market = market || monthRecord.stocks[stockNo].market || null;
        }
        const event = {
            timestamp: Date.now(),
            action,
            cacheHit,
            key: op.key || op.yearKey || null,
            stockNo,
            market,
            source: op.source || options.source || null,
            count: opCount,
        };
        monthRecord.events.unshift(event);
        if (monthRecord.events.length > BLOB_LEDGER_MAX_EVENTS) {
            monthRecord.events.length = BLOB_LEDGER_MAX_EVENTS;
        }
    });
    blobUsageLedger.updatedAt = Date.now();
    saveBlobUsageLedger();
}

function resolvePriceMode(settings) {
    if (!settings) return 'raw';
    const mode = settings.priceMode || (settings.adjustedPrice ? 'adjusted' : 'raw');
    return mode === 'adjusted' ? 'adjusted' : 'raw';
}

function enumerateYearsBetween(startISO, endISO) {
    if (!startISO || !endISO) return [];
    const startYear = parseInt(startISO.slice(0, 4), 10);
    const endYear = parseInt(endISO.slice(0, 4), 10);
    if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) return [];
    const years = [];
    const step = startYear <= endYear ? 1 : -1;
    for (let year = startYear; step > 0 ? year <= endYear : year >= endYear; year += step) {
        years.push(year);
    }
    return years;
}

function rebuildCacheEntryFromSessionPayload(payload, context = {}) {
    if (!payload || !Array.isArray(payload.data) || payload.data.length === 0) return null;
    const meta = payload.meta || {};
    const dataSourceLabel = meta.dataSource || '瀏覽器 Session 快取';
    const sourceLabels = Array.isArray(meta.dataSources) && meta.dataSources.length > 0
        ? meta.dataSources
        : [dataSourceLabel];
    const requestedRange = meta.fetchRange && typeof meta.fetchRange === 'object'
        ? { start: meta.fetchRange.start || null, end: meta.fetchRange.end || null }
        : {
            start: context.startDate || meta.dataStartDate || null,
            end: context.endDate || null,
        };
    const replayDiagnostics = normaliseFetchDiagnosticsForCacheReplay(meta.fetchDiagnostics || null, {
        source: 'session-storage-cache',
        requestedRange,
        coverage: payload.coverage,
    });
    return {
        data: payload.data,
        coverage: Array.isArray(payload.coverage) ? payload.coverage : [],
        coverageFingerprint: computeCoverageFingerprint(payload.coverage),
        stockName: meta.stockName || context.stockNo || null,
        stockNo: meta.stockNo || context.stockNo || null,
        market: meta.market || context.market || null,
        dataSources: sourceLabels,
        dataSource: summariseSourceLabels(sourceLabels),
        fetchedAt: payload.cachedAt || Date.now(),
        adjustedPrice: meta.priceMode === 'adjusted' || meta.adjustedPrice,
        splitAdjustment: Boolean(meta.splitAdjustment),
        priceMode: meta.priceMode || (meta.adjustedPrice ? 'adjusted' : 'raw'),
        dataStartDate: meta.dataStartDate || null,
        effectiveStartDate: meta.effectiveStartDate || null,
        lookbackDays: meta.lookbackDays || null,
        summary: meta.summary || null,
        adjustments: Array.isArray(meta.adjustments) ? meta.adjustments : [],
        debugSteps: Array.isArray(meta.debugSteps) ? meta.debugSteps : [],
        priceSource: meta.priceSource || null,
        fetchRange: meta.fetchRange || null,
        fetchDiagnostics: replayDiagnostics,
    };
}

function loadYearDatasetForRange(context, startISO, endISO) {
    const years = enumerateYearsBetween(startISO, endISO);
    if (years.length === 0) return null;
    const slices = [];
    for (let i = 0; i < years.length; i += 1) {
        const slice = loadYearStorageSlice(context, years[i]);
        if (!slice) return null;
        slices.push(slice);
    }
    const merged = new Map();
    slices.forEach((slice) => {
        if (!slice || !Array.isArray(slice.data)) return;
        slice.data.forEach((row) => {
            if (row && row.date) {
                merged.set(row.date, row);
            }
        });
    });
    if (merged.size === 0) return null;
    const combined = Array.from(merged.values()).sort((a, b) => a.date.localeCompare(b.date));
    const coverage = computeCoverageFromRows(combined);
    if (!coverageCoversRange(coverage, { start: startISO, end: endISO })) {
        return null;
    }
    const fetchedAt = Math.max(...slices.map((slice) => Number(slice.cachedAt) || 0));
    return {
        data: combined,
        coverage,
        coverageFingerprint: computeCoverageFingerprint(coverage),
        fetchedAt: Number.isFinite(fetchedAt) ? fetchedAt : Date.now(),
        stockName: slices.find((slice) => slice.stockNo)?.stockNo || context.stockNo || null,
        stockNo: context.stockNo || null,
        market: context.market || null,
        dataSource: '瀏覽器年度快取',
        dataSources: ['瀏覽器年度快取'],
    };
}

function hydrateDatasetFromStorage(cacheKey, curSettings) {
    if (!cacheKey || !curSettings) return null;
    if (!(cachedDataStore instanceof Map)) return null;
    const existing = cachedDataStore.get(cacheKey);
    if (existing && Array.isArray(existing.data) && existing.data.length > 0) {
        return existing;
    }
    const normalizedMarket = normalizeMarketKeyForCache(curSettings.market || curSettings.marketType || currentMarket || 'TWSE');
    const sessionPayload = getSessionDataCacheEntry(cacheKey);
    if (sessionPayload) {
        const sessionEntry = rebuildCacheEntryFromSessionPayload(sessionPayload, {
            stockNo: curSettings.stockNo,
            startDate: curSettings.dataStartDate || curSettings.startDate,
            endDate: curSettings.endDate,
            market: normalizedMarket,
        });
        if (sessionEntry) {
            sessionEntry.stockNo = sessionEntry.stockNo || curSettings.stockNo;
            sessionEntry.market = sessionEntry.market || normalizedMarket;
            sessionEntry.coverageFingerprint = sessionEntry.coverageFingerprint
                || computeCoverageFingerprint(sessionEntry.coverage);
            applyCacheStartMetadata(cacheKey, sessionEntry, curSettings.effectiveStartDate || curSettings.startDate, {
                toleranceDays: START_GAP_TOLERANCE_DAYS,
                acknowledgeExcessGap: true,
            });
            cachedDataStore.set(cacheKey, sessionEntry);
            persistDataCacheIndexEntry(cacheKey, {
                market: normalizedMarket,
                fetchedAt: sessionEntry.fetchedAt,
                priceMode: sessionEntry.priceMode || resolvePriceMode(curSettings),
                splitAdjustment: curSettings.splitAdjustment,
                dataStartDate: sessionEntry.dataStartDate || curSettings.dataStartDate || curSettings.startDate,
                coverageFingerprint: sessionEntry.coverageFingerprint || computeCoverageFingerprint(sessionEntry.coverage),
            });
            return sessionEntry;
        }
    }
    const priceMode = resolvePriceMode(curSettings);
    const yearDataset = loadYearDatasetForRange({
        market: normalizedMarket,
        stockNo: curSettings.stockNo,
        priceMode,
        splitAdjustment: curSettings.splitAdjustment,
    }, curSettings.dataStartDate || curSettings.startDate, curSettings.endDate);
    if (yearDataset) {
        const entry = {
            data: yearDataset.data,
            coverage: yearDataset.coverage,
            coverageFingerprint: yearDataset.coverageFingerprint,
            stockName: yearDataset.stockName || curSettings.stockNo,
            stockNo: curSettings.stockNo,
            market: normalizedMarket,
            dataSources: yearDataset.dataSources || [yearDataset.dataSource],
            dataSource: summariseSourceLabels(yearDataset.dataSources || [yearDataset.dataSource]),
            fetchedAt: yearDataset.fetchedAt,
            adjustedPrice: priceMode === 'adjusted',
            splitAdjustment: Boolean(curSettings.splitAdjustment),
            priceMode,
            dataStartDate: curSettings.dataStartDate || curSettings.startDate,
            effectiveStartDate: curSettings.effectiveStartDate || curSettings.startDate,
            lookbackDays: curSettings.lookbackDays || null,
            fetchRange: { start: curSettings.dataStartDate || curSettings.startDate, end: curSettings.endDate },
            fetchDiagnostics: normaliseFetchDiagnosticsForCacheReplay(null, {
                source: 'browser-year-cache',
                requestedRange: { start: curSettings.dataStartDate || curSettings.startDate, end: curSettings.endDate },
                coverage: yearDataset.coverage,
            }),
        };
        applyCacheStartMetadata(cacheKey, entry, curSettings.effectiveStartDate || curSettings.startDate, {
            toleranceDays: START_GAP_TOLERANCE_DAYS,
            acknowledgeExcessGap: true,
        });
        cachedDataStore.set(cacheKey, entry);
        persistDataCacheIndexEntry(cacheKey, {
            market: normalizedMarket,
            fetchedAt: entry.fetchedAt,
            priceMode,
            splitAdjustment: curSettings.splitAdjustment,
            dataStartDate: entry.dataStartDate,
            coverageFingerprint: entry.coverageFingerprint || computeCoverageFingerprint(entry.coverage),
        });
        persistSessionDataCacheEntry(cacheKey, entry, { market: normalizedMarket });
        return entry;
    }
    return null;
}

function findSupersetDatasetCandidate(curSettings, options = {}) {
    if (!curSettings || !(cachedDataStore instanceof Map)) return null;
    const normalizedMarket = normalizeMarketKeyForCache(
        curSettings.market || curSettings.marketType || currentMarket || 'TWSE',
    );
    const targetStockNo = (curSettings.stockNo || '').toUpperCase();
    const targetRange = {
        start: curSettings.dataStartDate || curSettings.startDate,
        end: curSettings.endDate,
    };
    const priceMode = resolvePriceMode(curSettings);
    const splitFlag = Boolean(curSettings.splitAdjustment);
    let best = null;
    cachedDataStore.forEach((entry, key) => {
        if (!entry || !Array.isArray(entry.data) || entry.data.length === 0) return;
        const entryStock = (entry.stockNo || '').toUpperCase();
        if (entryStock !== targetStockNo) return;
        const entryMarket = normalizeMarketKeyForCache(entry.market || normalizedMarket);
        if (entryMarket !== normalizedMarket) return;
        const entryMode = resolvePriceMode(entry);
        if ((entryMode === 'adjusted') !== (priceMode === 'adjusted')) return;
        if (Boolean(entry.splitAdjustment) !== splitFlag) return;
        if (!Array.isArray(entry.coverage) || entry.coverage.length === 0) return;
        if (!coverageCoversRange(entry.coverage, targetRange)) return;
        if (options.excludeKey && options.excludeKey === key) return;
        if (!best || (Number(entry.fetchedAt) || 0) > (Number(best.entry.fetchedAt) || 0)) {
            best = { key, entry };
        }
    });
    return best;
}

function materializeSupersetCacheEntry(cacheKey, curSettings) {
    if (!cacheKey || !curSettings || !(cachedDataStore instanceof Map)) return null;
    const normalizedMarket = normalizeMarketKeyForCache(
        curSettings.market || curSettings.marketType || currentMarket || 'TWSE',
    );
    const existing = cachedDataStore.get(cacheKey);
    const targetRange = {
        start: curSettings.dataStartDate || curSettings.startDate,
        end: curSettings.endDate,
    };
    if (
        existing &&
        Array.isArray(existing.data) &&
        existing.data.length > 0 &&
        coverageCoversRange(existing.coverage, targetRange)
    ) {
        existing.stockNo = existing.stockNo || curSettings.stockNo;
        existing.market = existing.market || normalizedMarket;
        existing.coverageFingerprint = existing.coverageFingerprint
            || computeCoverageFingerprint(existing.coverage);
        return existing;
    }
    const candidate = findSupersetDatasetCandidate(curSettings, { excludeKey: cacheKey });
    if (!candidate) return null;
    const priceMode = resolvePriceMode(curSettings);
    const sliceStart = curSettings.dataStartDate || curSettings.startDate;
    const sliceEnd = curSettings.endDate;
    const sliceRows = candidate.entry.data.filter((row) =>
        row && row.date >= sliceStart && row.date <= sliceEnd,
    );
    if (sliceRows.length === 0) return null;
    const coverage = computeCoverageFromRows(sliceRows);
    if (!coverageCoversRange(coverage, targetRange)) return null;
    const coverageFingerprint = computeCoverageFingerprint(coverage);
    const sourceLabels = Array.isArray(candidate.entry.dataSources)
        ? candidate.entry.dataSources.slice()
        : candidate.entry.dataSource
            ? [candidate.entry.dataSource]
            : [];
    const supersetEntry = {
        data: sliceRows,
        coverage,
        coverageFingerprint,
        stockName: candidate.entry.stockName || curSettings.stockNo,
        stockNo: curSettings.stockNo,
        market: normalizedMarket,
        dataSources: sourceLabels,
        dataSource: summariseSourceLabels(sourceLabels),
        fetchedAt: Number.isFinite(candidate.entry.fetchedAt)
            ? candidate.entry.fetchedAt
            : Date.now(),
        adjustedPrice: priceMode === 'adjusted',
        splitAdjustment: Boolean(curSettings.splitAdjustment),
        priceMode,
        dataStartDate: sliceStart,
        effectiveStartDate: curSettings.effectiveStartDate || curSettings.startDate,
        lookbackDays: curSettings.lookbackDays || candidate.entry.lookbackDays || null,
        fetchRange: { start: sliceStart, end: sliceEnd },
        summary: candidate.entry.summary || null,
        adjustments: Array.isArray(candidate.entry.adjustments)
            ? candidate.entry.adjustments
            : [],
        debugSteps: Array.isArray(candidate.entry.debugSteps)
            ? candidate.entry.debugSteps
            : [],
        priceSource: candidate.entry.priceSource || null,
        splitDiagnostics: candidate.entry.splitDiagnostics || null,
        finmindStatus: candidate.entry.finmindStatus || null,
        adjustmentFallbackApplied: Boolean(candidate.entry.adjustmentFallbackApplied),
        adjustmentDebugLog: Array.isArray(candidate.entry.adjustmentDebugLog)
            ? candidate.entry.adjustmentDebugLog
            : [],
        adjustmentChecks: Array.isArray(candidate.entry.adjustmentChecks)
            ? candidate.entry.adjustmentChecks
            : [],
        datasetDiagnostics: candidate.entry.datasetDiagnostics || null,
        fetchDiagnostics: normaliseFetchDiagnosticsForCacheReplay(
            candidate.entry.fetchDiagnostics || null,
            {
                source: 'main-superset-cache',
                requestedRange: { start: sliceStart, end: sliceEnd },
                coverage,
            },
        ),
    };
    applyCacheStartMetadata(cacheKey, supersetEntry, supersetEntry.effectiveStartDate, {
        toleranceDays: START_GAP_TOLERANCE_DAYS,
        acknowledgeExcessGap: true,
    });
    cachedDataStore.set(cacheKey, supersetEntry);
    persistDataCacheIndexEntry(cacheKey, {
        market: normalizedMarket,
        fetchedAt: supersetEntry.fetchedAt,
        priceMode,
        splitAdjustment: curSettings.splitAdjustment,
        dataStartDate: supersetEntry.dataStartDate,
        coverageFingerprint,
    });
    persistSessionDataCacheEntry(cacheKey, supersetEntry, { market: normalizedMarket });
    persistYearStorageSlices({
        market: normalizedMarket,
        stockNo: curSettings.stockNo,
        priceMode,
        splitAdjustment: curSettings.splitAdjustment,
    }, supersetEntry.data);
    console.log(
        `[Main] 使用年度 Superset 快取回填 ${curSettings.stockNo} (${sliceStart} ~ ${sliceEnd})。`,
    );
    return supersetEntry;
}

function parseISODateToUTC(iso) {
    if (!iso || typeof iso !== 'string') return NaN;
    const [y, m, d] = iso.split('-').map((val) => parseInt(val, 10));
    if ([y, m, d].some((num) => Number.isNaN(num))) return NaN;
    return Date.UTC(y, (m || 1) - 1, d || 1);
}

function formatNumberWithComma(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return '0';
    return num.toLocaleString('zh-TW');
}

function computeEffectiveStartGap(data, effectiveStartISO) {
    if (!Array.isArray(data) || data.length === 0 || !effectiveStartISO) return null;
    const startUTC = parseISODateToUTC(effectiveStartISO);
    if (!Number.isFinite(startUTC)) return null;
    for (let i = 0; i < data.length; i += 1) {
        const row = data[i];
        if (!row || typeof row.date !== 'string') continue;
        if (row.date < effectiveStartISO) continue;
        const rowUTC = parseISODateToUTC(row.date);
        if (!Number.isFinite(rowUTC)) continue;
        const diffDays = Math.floor((rowUTC - startUTC) / BACKTEST_DAY_MS);
        return {
            firstEffectiveDate: row.date,
            gapDays: diffDays,
        };
    }
    return {
        firstEffectiveDate: null,
        gapDays: Number.POSITIVE_INFINITY,
    };
}

function applyCacheStartMetadata(cacheKey, cacheEntry, effectiveStartISO, options = {}) {
    if (!cacheEntry || !Array.isArray(cacheEntry.data) || !effectiveStartISO) return { gapDays: null, firstEffectiveDate: null };
    const { toleranceDays = START_GAP_TOLERANCE_DAYS, acknowledgeExcessGap = false } = options;
    const info = computeEffectiveStartGap(cacheEntry.data, effectiveStartISO) || { gapDays: null, firstEffectiveDate: null };
    const gapDays = Number.isFinite(info.gapDays) ? info.gapDays : null;
    cacheEntry.firstEffectiveRowDate = info.firstEffectiveDate || null;
    cacheEntry.startGapEffectiveStart = effectiveStartISO;
    cacheEntry.startGapDays = gapDays;
    if (gapDays !== null && gapDays > toleranceDays) {
        if (acknowledgeExcessGap) {
            cacheEntry.startGapAcknowledgedAt = Date.now();
        } else {
            cacheEntry.startGapAcknowledgedAt = cacheEntry.startGapAcknowledgedAt || null;
        }
    } else {
        cacheEntry.startGapAcknowledgedAt = null;
    }
    if (cacheKey) {
        cachedDataStore.set(cacheKey, cacheEntry);
    }
    return {
        gapDays,
        firstEffectiveDate: info.firstEffectiveDate || null,
    };
}

function evaluateCacheStartGap(cacheKey, cacheEntry, effectiveStartISO, options = {}) {
    const { toleranceDays = START_GAP_TOLERANCE_DAYS, retryMs = START_GAP_RETRY_MS } = options;
    if (!cacheEntry || !Array.isArray(cacheEntry.data) || !effectiveStartISO) {
        return { shouldForce: true, reason: 'missingCache' };
    }
    const { gapDays, firstEffectiveDate } = applyCacheStartMetadata(cacheKey, cacheEntry, effectiveStartISO, { toleranceDays });
    if (gapDays === null) {
        return { shouldForce: false, reason: 'noGapInfo', firstEffectiveDate: firstEffectiveDate || null };
    }
    if (gapDays <= toleranceDays) {
        return { shouldForce: false, gapDays, firstEffectiveDate };
    }
    const ackStart = cacheEntry.startGapEffectiveStart || null;
    const ackGap = Number.isFinite(cacheEntry.startGapDays) ? cacheEntry.startGapDays : null;
    const ackAt = Number.isFinite(cacheEntry.startGapAcknowledgedAt) ? cacheEntry.startGapAcknowledgedAt : null;
    const sameContext = ackStart === effectiveStartISO && ackGap === gapDays && ackAt;
    const now = Date.now();
    if (!sameContext) {
        cacheEntry.startGapAcknowledgedAt = null;
        if (cacheKey) cachedDataStore.set(cacheKey, cacheEntry);
        return { shouldForce: true, gapDays, firstEffectiveDate, reason: 'unacknowledged' };
    }
    if (retryMs && ackAt && now - ackAt > retryMs) {
        cacheEntry.startGapAcknowledgedAt = null;
        if (cacheKey) cachedDataStore.set(cacheKey, cacheEntry);
        return { shouldForce: true, gapDays, firstEffectiveDate, reason: 'retryWindowElapsed' };
    }
    cacheEntry.startGapAcknowledgedAt = ackAt || now;
    if (cacheKey) cachedDataStore.set(cacheKey, cacheEntry);
    return { shouldForce: false, gapDays, firstEffectiveDate, acknowledged: true };
}

function loadPersistentDataCacheIndex() {
    if (typeof window === 'undefined' || !window.localStorage) {
        return new Map();
    }
    try {
        const raw = window.localStorage.getItem(DATA_CACHE_INDEX_KEY);
        if (!raw) return new Map();
        const parsed = JSON.parse(raw);
        const records = Array.isArray(parsed?.records)
            ? parsed.records
            : Array.isArray(parsed)
                ? parsed
                : [];
        const now = Date.now();
        const map = new Map();
        records.forEach((record) => {
            if (!record || typeof record !== 'object') return;
            const key = record.key || record.cacheKey;
            const fetchedAt = Number(record.fetchedAt);
            if (!key || !Number.isFinite(fetchedAt)) return;
            const normalizedMarket = normalizeMarketKeyForCache(record.market);
            const ttl = getDatasetCacheTTLMs(normalizedMarket);
            if (ttl > 0 && now - fetchedAt > ttl) return;
            map.set(key, {
                market: normalizedMarket,
                fetchedAt,
                priceMode: record.priceMode || null,
                splitAdjustment: Boolean(record.splitAdjustment),
                dataStartDate: record.dataStartDate || null,
                coverageFingerprint: record.coverageFingerprint || null,
            });
        });
        return map;
    } catch (error) {
        console.warn('[Main] 無法載入資料快取索引:', error);
        return new Map();
    }
}

function savePersistentDataCacheIndex() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (!(persistentDataCacheIndex instanceof Map)) return;
    try {
        const records = Array.from(persistentDataCacheIndex.entries()).map(([key, entry]) => ({
            key,
            market: entry.market,
            fetchedAt: entry.fetchedAt,
            priceMode: entry.priceMode || null,
            splitAdjustment: entry.splitAdjustment ? 1 : 0,
            dataStartDate: entry.dataStartDate || null,
            coverageFingerprint: entry.coverageFingerprint || null,
        }));
        const payload = { version: DATA_CACHE_VERSION, records };
        window.localStorage.setItem(DATA_CACHE_INDEX_KEY, JSON.stringify(payload));
    } catch (error) {
        console.warn('[Main] 無法寫入資料快取索引:', error);
    }
}

function persistDataCacheIndexEntry(cacheKey, meta) {
    if (!(persistentDataCacheIndex instanceof Map)) return;
    if (!cacheKey || !meta) return;
    const normalizedMarket = normalizeMarketKeyForCache(meta.market);
    const record = {
        market: normalizedMarket,
        fetchedAt: Number.isFinite(meta.fetchedAt) ? meta.fetchedAt : Date.now(),
        priceMode: meta.priceMode || null,
        splitAdjustment: Boolean(meta.splitAdjustment),
        dataStartDate: meta.dataStartDate || null,
        coverageFingerprint: meta.coverageFingerprint || null,
    };
    persistentDataCacheIndex.set(cacheKey, record);
    prunePersistentDataCacheIndex({ save: false });
    savePersistentDataCacheIndex();
}

function removePersistentDataCacheEntry(cacheKey) {
    if (!(persistentDataCacheIndex instanceof Map)) return;
    if (!cacheKey) return;
    const removed = persistentDataCacheIndex.delete(cacheKey);
    if (removed) {
        savePersistentDataCacheIndex();
    }
    if (cachedDataStore instanceof Map) {
        cachedDataStore.delete(cacheKey);
    }
}

function clearPersistentDataCacheIndex() {
    if (persistentDataCacheIndex instanceof Map) {
        persistentDataCacheIndex.clear();
    }
    if (typeof window !== 'undefined' && window.localStorage) {
        try {
            window.localStorage.removeItem(DATA_CACHE_INDEX_KEY);
        } catch (error) {
            console.warn('[Main] 無法清除資料快取索引:', error);
        }
    }
}

function prunePersistentDataCacheIndex(options = {}) {
    if (!(persistentDataCacheIndex instanceof Map)) return false;
    const now = Date.now();
    let mutated = false;
    for (const [key, entry] of persistentDataCacheIndex.entries()) {
        if (!entry || !Number.isFinite(entry.fetchedAt)) continue;
        const ttl = getDatasetCacheTTLMs(entry.market);
        if (ttl > 0 && now - entry.fetchedAt > ttl) {
            persistentDataCacheIndex.delete(key);
            mutated = true;
            if (cachedDataStore instanceof Map) {
                cachedDataStore.delete(key);
            }
        }
    }
    if (mutated && options.save !== false) {
        savePersistentDataCacheIndex();
    }
    return mutated;
}

function ensureDatasetCacheEntryFresh(cacheKey, entry, market) {
    const normalizedMarket = normalizeMarketKeyForCache(market || 'TWSE');
    const ttl = getDatasetCacheTTLMs(normalizedMarket);
    const meta = persistentDataCacheIndex instanceof Map ? persistentDataCacheIndex.get(cacheKey) : null;
    const fetchedAtCandidate = Number.isFinite(entry?.fetchedAt)
        ? entry.fetchedAt
        : Number.isFinite(meta?.fetchedAt)
            ? meta.fetchedAt
            : null;
    if (
        ttl > 0 &&
        Number.isFinite(fetchedAtCandidate) &&
        Date.now() - fetchedAtCandidate > ttl
    ) {
        if (cachedDataStore instanceof Map && cachedDataStore.has(cacheKey)) {
            cachedDataStore.delete(cacheKey);
        }
        if (persistentDataCacheIndex instanceof Map && persistentDataCacheIndex.has(cacheKey)) {
            persistentDataCacheIndex.delete(cacheKey);
            savePersistentDataCacheIndex();
        }
        return null;
    }
    if (entry && persistentDataCacheIndex instanceof Map) {
        const needsUpdate =
            !meta ||
            meta.market !== normalizedMarket ||
            !Number.isFinite(meta.fetchedAt) ||
            (Number.isFinite(entry.fetchedAt) && entry.fetchedAt !== meta.fetchedAt);
        if (needsUpdate) {
            persistentDataCacheIndex.set(cacheKey, {
                market: normalizedMarket,
                fetchedAt: Number.isFinite(entry.fetchedAt) ? entry.fetchedAt : Date.now(),
                priceMode: entry.priceMode || null,
                splitAdjustment: Boolean(entry.splitAdjustment),
                dataStartDate: entry.dataStartDate || null,
                coverageFingerprint: entry.coverageFingerprint || null,
            });
            savePersistentDataCacheIndex();
        }
    }
    return entry || null;
}

// --- 主回測函數 ---
function runBacktestInternal() {
    console.log("[Main] runBacktestInternal called");
    if (!workerUrl) { showError("背景計算引擎尚未準備就緒，請稍候再試或重新載入頁面。"); hideLoading(); return; }
    try {
        const params=getBacktestParams();
        console.log("[Main] Params:", params);
        const isValid = validateBacktestParams(params);
        console.log("[Main] Validation:", isValid);
        if(!isValid) return;

        const sharedUtils = (typeof lazybacktestShared === 'object' && lazybacktestShared) ? lazybacktestShared : null;
        const windowOptions = {
            minBars: 90,
            multiplier: 2,
            marginTradingDays: 12,
            extraCalendarDays: 7,
            minDate: sharedUtils?.MIN_DATA_DATE,
            defaultStartDate: params.startDate,
        };
        let windowDecision = null;
        if (sharedUtils && typeof sharedUtils.resolveDataWindow === 'function') {
            windowDecision = sharedUtils.resolveDataWindow(params, windowOptions);
        }
        const fallbackMaxPeriod = sharedUtils && typeof sharedUtils.getMaxIndicatorPeriod === 'function'
            ? sharedUtils.getMaxIndicatorPeriod(params)
            : 0;
        const maxIndicatorPeriod = Number.isFinite(windowDecision?.maxIndicatorPeriod)
            ? windowDecision.maxIndicatorPeriod
            : fallbackMaxPeriod;
        let lookbackDays = Number.isFinite(windowDecision?.lookbackDays)
            ? windowDecision.lookbackDays
            : null;
        if (!Number.isFinite(lookbackDays) || lookbackDays <= 0) {
            if (sharedUtils && typeof sharedUtils.resolveLookbackDays === 'function') {
                const fallbackDecision = sharedUtils.resolveLookbackDays(params, windowOptions);
                if (Number.isFinite(fallbackDecision?.lookbackDays) && fallbackDecision.lookbackDays > 0) {
                    lookbackDays = fallbackDecision.lookbackDays;
                }
                if (!Number.isFinite(windowDecision?.maxIndicatorPeriod) && Number.isFinite(fallbackDecision?.maxIndicatorPeriod)) {
                    windowDecision = { ...(windowDecision || {}), maxIndicatorPeriod: fallbackDecision.maxIndicatorPeriod };
                }
            }
        }
        if (!Number.isFinite(lookbackDays) || lookbackDays <= 0) {
            lookbackDays = sharedUtils && typeof sharedUtils.estimateLookbackBars === 'function'
                ? sharedUtils.estimateLookbackBars(maxIndicatorPeriod, { minBars: 90, multiplier: 2 })
                : Math.max(90, maxIndicatorPeriod * 2);
        }
        let effectiveStartDate = windowDecision?.effectiveStartDate || params.startDate || windowDecision?.minDataDate || windowOptions.defaultStartDate;
        const bufferTradingDays = Number.isFinite(windowDecision?.bufferTradingDays)
            ? windowDecision.bufferTradingDays
            : windowOptions.marginTradingDays;
        const extraCalendarDays = Number.isFinite(windowDecision?.extraCalendarDays)
            ? windowDecision.extraCalendarDays
            : windowOptions.extraCalendarDays;
        let dataStartDate = windowDecision?.dataStartDate || null;
        if (!dataStartDate && effectiveStartDate) {
            if (sharedUtils && typeof sharedUtils.computeBufferedStartDate === 'function') {
                dataStartDate = sharedUtils.computeBufferedStartDate(effectiveStartDate, lookbackDays, {
                    minDate: sharedUtils?.MIN_DATA_DATE,
                    marginTradingDays: bufferTradingDays,
                    extraCalendarDays,
                }) || effectiveStartDate;
            } else {
                dataStartDate = effectiveStartDate;
            }
        }
        if (!dataStartDate) {
            dataStartDate = effectiveStartDate || sharedUtils?.MIN_DATA_DATE || windowOptions.minDate || params.startDate;
        }
        params.effectiveStartDate = effectiveStartDate;
        params.dataStartDate = dataStartDate;
        params.lookbackDays = lookbackDays;

        const marketKey = (params.marketType || params.market || currentMarket || 'TWSE').toUpperCase();
        const priceMode = params.adjustedPrice ? 'adjusted' : 'raw';
        const curSettings={
            stockNo:params.stockNo,
            startDate:dataStartDate,
            dataStartDate:dataStartDate,
            endDate:params.endDate,
            effectiveStartDate,
            market:marketKey,
            adjustedPrice: params.adjustedPrice,
            splitAdjustment: params.splitAdjustment,
            priceMode: priceMode,
            lookbackDays,
        };
        const cacheKey = buildCacheKey(curSettings);
        hydrateDatasetFromStorage(cacheKey, curSettings);
        materializeSupersetCacheEntry(cacheKey, curSettings);
        let useCache=!needsDataFetch(curSettings);
        let cachedEntry = null;
        if (useCache) {
            cachedEntry = ensureDatasetCacheEntryFresh(cacheKey, cachedDataStore.get(cacheKey), curSettings.market);
            if (cachedEntry && Array.isArray(cachedEntry.data)) {
                const startCheck = evaluateCacheStartGap(cacheKey, cachedEntry, effectiveStartDate);
                if (startCheck.shouldForce) {
                    const gapText = Number.isFinite(startCheck.gapDays)
                        ? `${startCheck.gapDays} 天`
                        : '未知天數';
                    const firstDateText = startCheck.firstEffectiveDate || '無';
                    console.warn(`[Main] 快取首筆有效日期 (${firstDateText}) 較設定起點落後 ${gapText}，改為重新抓取。 start=${effectiveStartDate}`);
                    useCache = false;
                    cachedEntry = null;
                } else if (startCheck.acknowledged && Number.isFinite(startCheck.gapDays) && startCheck.gapDays > START_GAP_TOLERANCE_DAYS) {
                    console.warn(`[Main] 快取首筆有效日期已落後 ${startCheck.gapDays} 天，已在近期確認資料缺口，暫時沿用快取資料。`);
                }
            } else {
                console.warn('[Main] 快取內容不存在或結構異常，改為重新抓取。');
                useCache = false;
                cachedEntry = null;
            }
        }
        const msg=useCache?"⌛ 使用快取執行回測...":"⌛ 獲取數據並回測...";
        showLoading(msg);
        if (useCache && cachedEntry && Array.isArray(cachedEntry.data)) {
            const cacheDiagnostics = normaliseFetchDiagnosticsForCacheReplay(
                cachedEntry.fetchDiagnostics || null,
                {
                    source: 'main-memory-cache',
                    requestedRange: {
                        start: curSettings.dataStartDate || curSettings.startDate,
                        end: curSettings.endDate,
                    },
                    coverage: cachedEntry.coverage,
                }
            );
            cachedEntry.fetchDiagnostics = cacheDiagnostics;
            const sliceStart = curSettings.effectiveStartDate || effectiveStartDate;
            visibleStockData = extractRangeData(cachedEntry.data, sliceStart, curSettings.endDate);
            cachedStockData = cachedEntry.data;
            lastFetchSettings = { ...curSettings };
            refreshPriceInspectorControls();
            updatePriceDebug(cachedEntry);
            console.log(`[Main] 從快取命中 ${cacheKey}，範圍 ${curSettings.startDate} ~ ${curSettings.endDate}`);
        }
        clearPreviousResults(); // Clear previous results including suggestion

        if(backtestWorker) { // Ensure previous worker is terminated
            backtestWorker.terminate();
            backtestWorker = null;
            console.log("[Main] Terminated previous worker.");
        }
        console.log("[Main] WorkerUrl:", workerUrl);
        console.log("[Main] Creating worker...");
        backtestWorker=new Worker(workerUrl);

        // Unified Worker Message Handler
        backtestWorker.onmessage=e=>{
            const{type,data,progress,message, stockName, dataSource}=e.data;
            console.log("[Main] Received message from worker:", type, data); // Debug log

            if(type==='progress'){
                updateProgress(progress);
                if(message)document.getElementById('loadingText').textContent=`⌛ ${message}`;
            } else if(type==='marketError'){
                // 處理市場查詢錯誤，顯示智慧錯誤處理對話框
                hideLoading();
                if (window.showMarketSwitchModal) {
                    window.showMarketSwitchModal(message, marketType, stockNo);
                } else {
                    console.error('[Main] showMarketSwitchModal function not found');
                    showError(message);
                }
            } else if(type==='stockNameInfo'){
                // 處理股票名稱資訊，顯示在UI上
                if (window.showStockName) {
                    window.showStockName(e.data.stockName, e.data.stockNo, e.data.marketType);
                }
            } else if(type==='result'){
                if(!useCache&&data?.rawData){
                     const existingEntry = ensureDatasetCacheEntryFresh(cacheKey, cachedDataStore.get(cacheKey), curSettings.market);
                     const mergedDataMap = new Map(Array.isArray(existingEntry?.data) ? existingEntry.data.map(row => [row.date, row]) : []);
                     if (Array.isArray(data.rawData)) {
                         data.rawData.forEach(row => {
                             if (row && row.date) {
                                 mergedDataMap.set(row.date, row);
                             }
                         });
                     }
                     const mergedData = Array.from(mergedDataMap.values()).sort((a,b)=>a.date.localeCompare(b.date));
                     const fetchedRange = (data?.rawMeta && data.rawMeta.fetchRange && data.rawMeta.fetchRange.start && data.rawMeta.fetchRange.end)
                        ? data.rawMeta.fetchRange
                        : { start: curSettings.startDate, end: curSettings.endDate };
                     const mergedCoverage = mergeIsoCoverage(
                        existingEntry?.coverage || [],
                        fetchedRange && fetchedRange.start && fetchedRange.end
                            ? { start: fetchedRange.start, end: fetchedRange.end }
                            : null
                     );
                     const sourceSet = new Set(Array.isArray(existingEntry?.dataSources) ? existingEntry.dataSources : []);
                     if (dataSource) sourceSet.add(dataSource);
                     const sourceArray = Array.from(sourceSet);
                     const rawMeta = data.rawMeta || {};
                     const debugSteps = Array.isArray(rawMeta.debugSteps)
                         ? rawMeta.debugSteps
                         : (Array.isArray(data?.dataDebug?.debugSteps) ? data.dataDebug.debugSteps : []);
                     const summaryMeta = rawMeta.summary || data?.dataDebug?.summary || null;
                     const adjustmentsMeta = Array.isArray(rawMeta.adjustments)
                         ? rawMeta.adjustments
                         : (Array.isArray(data?.dataDebug?.adjustments) ? data.dataDebug.adjustments : []);
                     const fallbackFlag = typeof rawMeta.adjustmentFallbackApplied === 'boolean'
                         ? rawMeta.adjustmentFallbackApplied
                         : Boolean(data?.dataDebug?.adjustmentFallbackApplied);
                    const priceSourceMeta = rawMeta.priceSource || data?.dataDebug?.priceSource || null;
                    const splitDiagnosticsMeta = rawMeta.splitDiagnostics
                        || data?.dataDebug?.splitDiagnostics
                        || existingEntry?.splitDiagnostics
                        || null;
                    const finmindStatusMeta = rawMeta.finmindStatus
                        || data?.dataDebug?.finmindStatus
                        || existingEntry?.finmindStatus
                        || null;
                    const adjustmentDebugLogMeta = Array.isArray(rawMeta.adjustmentDebugLog)
                        ? rawMeta.adjustmentDebugLog
                        : (Array.isArray(data?.dataDebug?.adjustmentDebugLog) ? data.dataDebug.adjustmentDebugLog : []);
                    const adjustmentChecksMeta = Array.isArray(rawMeta.adjustmentChecks)
                        ? rawMeta.adjustmentChecks
                        : (Array.isArray(data?.dataDebug?.adjustmentChecks) ? data.dataDebug.adjustmentChecks : []);
                    const rawEffectiveStart = data?.rawMeta?.effectiveStartDate || effectiveStartDate;
                    const resolvedLookback = Number.isFinite(data?.rawMeta?.lookbackDays)
                        ? data.rawMeta.lookbackDays
                        : lookbackDays;
                    const rawFetchDiagnostics = data?.datasetDiagnostics?.fetch || existingEntry?.fetchDiagnostics || null;
                    const cacheDiagnostics = normaliseFetchDiagnosticsForCacheReplay(rawFetchDiagnostics, {
                        source: 'main-memory-cache',
                        requestedRange: fetchedRange,
                        coverage: mergedCoverage,
                    });
                    const cacheEntry = {
                        data: mergedData,
                        stockName: stockName || existingEntry?.stockName || params.stockNo,
                        stockNo: curSettings.stockNo,
                        market: curSettings.market,
                        dataSources: sourceArray,
                        dataSource: summariseSourceLabels(sourceArray.length > 0 ? sourceArray : [dataSource || '']),
                        coverage: mergedCoverage,
                        coverageFingerprint: computeCoverageFingerprint(mergedCoverage),
                        fetchedAt: Date.now(),
                        adjustedPrice: params.adjustedPrice,
                        splitAdjustment: params.splitAdjustment,
                        priceMode: priceMode,
                        dataStartDate: curSettings.dataStartDate || curSettings.startDate,
                        adjustmentFallbackApplied: fallbackFlag,
                        summary: summaryMeta,
                        adjustments: adjustmentsMeta,
                        debugSteps,
                        priceSource: priceSourceMeta,
                        splitDiagnostics: splitDiagnosticsMeta,
                        finmindStatus: finmindStatusMeta,
                        adjustmentDebugLog: adjustmentDebugLogMeta,
                        adjustmentChecks: adjustmentChecksMeta,
                        fetchRange: fetchedRange,
                        effectiveStartDate: rawEffectiveStart,
                        lookbackDays: resolvedLookback,
                        datasetDiagnostics: data?.datasetDiagnostics || existingEntry?.datasetDiagnostics || null,
                        fetchDiagnostics: cacheDiagnostics,
                        lastRemoteFetchDiagnostics: rawFetchDiagnostics,
                    };
                     applyCacheStartMetadata(cacheKey, cacheEntry, rawEffectiveStart || effectiveStartDate, {
                        toleranceDays: START_GAP_TOLERANCE_DAYS,
                        acknowledgeExcessGap: true,
                    });
                     cachedDataStore.set(cacheKey, cacheEntry);
                    persistDataCacheIndexEntry(cacheKey, {
                        market: curSettings.market,
                        fetchedAt: cacheEntry.fetchedAt || Date.now(),
                        priceMode,
                        splitAdjustment: params.splitAdjustment,
                        dataStartDate: cacheEntry.dataStartDate || curSettings.startDate,
                        coverageFingerprint: cacheEntry.coverageFingerprint || null,
                     });
                     persistSessionDataCacheEntry(cacheKey, cacheEntry, { market: curSettings.market });
                     persistYearStorageSlices({
                        market: curSettings.market,
                        stockNo: curSettings.stockNo,
                        priceMode,
                        splitAdjustment: params.splitAdjustment,
                     }, cacheEntry.data);
                     visibleStockData = extractRangeData(mergedData, rawEffectiveStart || effectiveStartDate, curSettings.endDate);
                     cachedStockData = mergedData;
                     lastFetchSettings = { ...curSettings };
                     refreshPriceInspectorControls();
                     updatePriceDebug(cacheEntry);
                     console.log(`[Main] Data cached/merged for ${cacheKey}.`);
                     cachedEntry = cacheEntry;
                } else if (useCache && cachedEntry && Array.isArray(cachedEntry.data) ) {
                     const updatedSources = new Set(Array.isArray(cachedEntry.dataSources) ? cachedEntry.dataSources : []);
                     if (dataSource) updatedSources.add(dataSource);
                     const updatedArray = Array.from(updatedSources);
                     const debugSteps = Array.isArray(data?.dataDebug?.debugSteps)
                         ? data.dataDebug.debugSteps
                         : Array.isArray(cachedEntry.debugSteps) ? cachedEntry.debugSteps : [];
                     const summaryMeta = data?.dataDebug?.summary || cachedEntry.summary || null;
                     const adjustmentsMeta = Array.isArray(data?.dataDebug?.adjustments)
                         ? data.dataDebug.adjustments
                         : Array.isArray(cachedEntry.adjustments) ? cachedEntry.adjustments : [];
                     const fallbackFlag = typeof data?.dataDebug?.adjustmentFallbackApplied === 'boolean'
                         ? data.dataDebug.adjustmentFallbackApplied
                         : Boolean(cachedEntry.adjustmentFallbackApplied);
                    const priceSourceMeta = data?.dataDebug?.priceSource || cachedEntry.priceSource || null;
                    const splitDiagnosticsMeta = data?.dataDebug?.splitDiagnostics
                        || cachedEntry.splitDiagnostics
                        || null;
                    const finmindStatusMeta = data?.dataDebug?.finmindStatus
                        || cachedEntry.finmindStatus
                        || null;
                    const adjustmentDebugLogMeta = Array.isArray(data?.dataDebug?.adjustmentDebugLog)
                        ? data.dataDebug.adjustmentDebugLog
                        : Array.isArray(cachedEntry.adjustmentDebugLog) ? cachedEntry.adjustmentDebugLog : [];
                    const adjustmentChecksMeta = Array.isArray(data?.dataDebug?.adjustmentChecks)
                        ? data.dataDebug.adjustmentChecks
                        : Array.isArray(cachedEntry.adjustmentChecks) ? cachedEntry.adjustmentChecks : [];
                    const rawFetchDiagnostics = data?.datasetDiagnostics?.fetch || cachedEntry.fetchDiagnostics || null;
                    const updatedCoverage = cachedEntry.coverage || [];
                    const updatedDiagnostics = normaliseFetchDiagnosticsForCacheReplay(rawFetchDiagnostics, {
                        source: 'main-memory-cache',
                        requestedRange: cachedEntry.fetchRange || { start: curSettings.startDate, end: curSettings.endDate },
                        coverage: updatedCoverage,
                    });
                    const updatedEntry = {
                        ...cachedEntry,
                        stockName: stockName || cachedEntry.stockName || params.stockNo,
                        stockNo: curSettings.stockNo,
                        market: curSettings.market,
                        dataSources: updatedArray,
                        dataSource: summariseSourceLabels(updatedArray),
                        fetchedAt: cachedEntry.fetchedAt || Date.now(),
                        adjustedPrice: params.adjustedPrice,
                        splitAdjustment: params.splitAdjustment,
                        priceMode: priceMode,
                        adjustmentFallbackApplied: fallbackFlag,
                        summary: summaryMeta,
                        adjustments: adjustmentsMeta,
                        debugSteps,
                        priceSource: priceSourceMeta,
                        splitDiagnostics: splitDiagnosticsMeta,
                        finmindStatus: finmindStatusMeta,
                        adjustmentDebugLog: adjustmentDebugLogMeta,
                        adjustmentChecks: adjustmentChecksMeta,
                        fetchRange: cachedEntry.fetchRange || { start: curSettings.startDate, end: curSettings.endDate },
                        effectiveStartDate: cachedEntry.effectiveStartDate || effectiveStartDate,
                        dataStartDate: curSettings.dataStartDate || curSettings.startDate,
                        lookbackDays: cachedEntry.lookbackDays || lookbackDays,
                        datasetDiagnostics: data?.datasetDiagnostics || cachedEntry.datasetDiagnostics || null,
                        fetchDiagnostics: updatedDiagnostics,
                        lastRemoteFetchDiagnostics: rawFetchDiagnostics,
                        coverageFingerprint: computeCoverageFingerprint(updatedCoverage),
                    };
                    applyCacheStartMetadata(cacheKey, updatedEntry, curSettings.effectiveStartDate || effectiveStartDate, {
                        toleranceDays: START_GAP_TOLERANCE_DAYS,
                        acknowledgeExcessGap: false,
                    });
                    cachedDataStore.set(cacheKey, updatedEntry);
                    persistDataCacheIndexEntry(cacheKey, {
                        market: curSettings.market,
                        fetchedAt: updatedEntry.fetchedAt || Date.now(),
                        priceMode,
                        splitAdjustment: params.splitAdjustment,
                        dataStartDate: updatedEntry.dataStartDate || curSettings.startDate,
                        coverageFingerprint: updatedEntry.coverageFingerprint || null,
                    });
                    persistSessionDataCacheEntry(cacheKey, updatedEntry, { market: curSettings.market });
                    persistYearStorageSlices({
                        market: curSettings.market,
                        stockNo: curSettings.stockNo,
                        priceMode,
                        splitAdjustment: params.splitAdjustment,
                    }, updatedEntry.data);
                    visibleStockData = extractRangeData(updatedEntry.data, curSettings.effectiveStartDate || effectiveStartDate, curSettings.endDate);
                    cachedStockData = updatedEntry.data;
                    lastFetchSettings = { ...curSettings };
                    refreshPriceInspectorControls();
                    updatePriceDebug(updatedEntry);
                     cachedEntry = updatedEntry;
                     console.log("[Main] 使用主執行緒快取資料執行回測。");

                } else if(!useCache) {
                     console.warn("[Main] No rawData to cache from backtest.");
                }
                if (data?.datasetDiagnostics) {
                    const enrichedDiagnostics = { ...data.datasetDiagnostics };
                    const existingMeta = (data.datasetDiagnostics && data.datasetDiagnostics.meta) || {};
                    const nameInfo = resolveCachedStockNameInfo(params?.stockNo, params?.marketType || params?.market);
                    enrichedDiagnostics.meta = {
                        ...existingMeta,
                        stockNo: params?.stockNo || existingMeta.stockNo || null,
                        stockName: nameInfo?.info?.name || existingMeta.stockName || stockName || null,
                        nameSource: nameInfo?.info?.sourceLabel || existingMeta.nameSource || null,
                        nameMarket: nameInfo?.market || existingMeta.nameMarket || null,
                        directoryVersion: taiwanDirectoryState.version || existingMeta.directoryVersion || null,
                        directoryUpdatedAt: taiwanDirectoryState.updatedAt || existingMeta.directoryUpdatedAt || null,
                        directorySource: taiwanDirectoryState.source || existingMeta.directorySource || null,
                    };
                    lastDatasetDiagnostics = enrichedDiagnostics;
                    const runtimeDataset = data.datasetDiagnostics.runtime?.dataset || null;
                    const warmupDiag = data.datasetDiagnostics.runtime?.warmup || null;
                    const fetchDiag = data.datasetDiagnostics.fetch || null;
                    if (typeof console.groupCollapsed === 'function') {
                        console.groupCollapsed('[Main] Dataset diagnostics', params?.stockNo || '');
                        console.log('[Main] Runtime dataset summary', runtimeDataset);
                        console.log('[Main] Warmup summary', warmupDiag);
                        console.log('[Main] Fetch diagnostics', fetchDiag);
                        console.groupEnd();
                    } else {
                        console.log('[Main] Runtime dataset summary', runtimeDataset);
                        console.log('[Main] Warmup summary', warmupDiag);
                        console.log('[Main] Fetch diagnostics', fetchDiag);
                    }
                    if (runtimeDataset && Number.isFinite(runtimeDataset.firstValidCloseGapFromEffective) && runtimeDataset.firstValidCloseGapFromEffective > 1) {
                        console.warn(`[Main] ${params?.stockNo || ''} 第一筆有效收盤價落後暖身起點 ${runtimeDataset.firstValidCloseGapFromEffective} 天。`);
                    }
                    if (runtimeDataset?.invalidRowsInRange?.count > 0) {
                        const reasonSummary = formatDiagnosticsReasonCounts(runtimeDataset.invalidRowsInRange.reasons);
                        console.warn(`[Main] ${params?.stockNo || ''} 區間內偵測到 ${runtimeDataset.invalidRowsInRange.count} 筆無效資料，原因統計: ${reasonSummary}`);
                    }
                    if (fetchDiag?.overview?.invalidRowsInRange?.count > 0) {
                        const fetchReason = formatDiagnosticsReasonCounts(fetchDiag.overview.invalidRowsInRange.reasons);
                        console.warn(`[Main] ${params?.stockNo || ''} 遠端回應包含 ${fetchDiag.overview.invalidRowsInRange.count} 筆無效欄位，原因統計: ${fetchReason}`);
                    }
                } else {
                    lastDatasetDiagnostics = null;
                }
                refreshDataDiagnosticsPanel(lastDatasetDiagnostics);
                const fetchDiagnostics = data?.datasetDiagnostics?.fetch || null;
                const blobOps = Array.isArray(fetchDiagnostics?.blob?.operations)
                    ? fetchDiagnostics.blob.operations
                    : [];
                const shouldRecordBlob =
                    !fetchDiagnostics?.cacheReplay &&
                    blobOps.length > 0;
                if (shouldRecordBlob) {
                    recordBlobUsageEvents(blobOps, {
                        stockNo: params?.stockNo || curSettings.stockNo,
                        market: params?.marketType || params?.market || curSettings.market,
                        source: fetchDiagnostics?.blob?.source || fetchDiagnostics?.blob?.provider || null,
                    });
                    renderBlobUsageCard();
                }
                handleBacktestResult(data, stockName, dataSource); // Process and display main results

                getSuggestion();

            } else if(type==='suggestionResult'){
                const suggestionArea = document.getElementById('today-suggestion-area');
                const suggestionText = document.getElementById('suggestion-text');
                if(suggestionArea && suggestionText){
                    suggestionText.textContent = data.suggestion || '無法取得建議';
                    suggestionArea.classList.remove('hidden', 'loading');
                     suggestionArea.className = 'my-4 p-4 border-l-4 rounded-md text-center'; // Base classes
                    if (data.suggestion === '做多買入' || data.suggestion === '持有 (多)') { suggestionArea.classList.add('bg-green-50', 'border-green-500', 'text-green-800'); }
                    else if (data.suggestion === '做空賣出' || data.suggestion === '持有 (空)') { suggestionArea.classList.add('bg-red-50', 'border-red-500', 'text-red-800'); }
                    else if (data.suggestion === '做多賣出' || data.suggestion === '做空回補') { suggestionArea.classList.add('bg-yellow-50', 'border-yellow-500', 'text-yellow-800'); }
                    else if (data.suggestion === '等待') { suggestionArea.classList.add('bg-gray-100', 'border-gray-400', 'text-gray-600'); }
                     else { suggestionArea.classList.add('bg-gray-100', 'border-gray-400', 'text-gray-600'); }

                    hideLoading();
                    showSuccess("回測完成！");
                    if(backtestWorker) backtestWorker.terminate(); backtestWorker = null;
                }
            } else if(type==='suggestionError'){
                const suggestionArea = document.getElementById('today-suggestion-area');
                const suggestionText = document.getElementById('suggestion-text');
                if(suggestionArea && suggestionText){
                    suggestionText.textContent = data.message || '計算建議時發生錯誤';
                    suggestionArea.classList.remove('hidden', 'loading');
                    suggestionArea.className = 'my-4 p-4 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-md text-center';
                }
                 hideLoading();
                 showError("回測完成，但計算建議時發生錯誤。");
                 if(backtestWorker) backtestWorker.terminate(); backtestWorker = null;
            } else if(type==='error'){
                showError(data?.message||'回測過程錯誤');
                if(backtestWorker)backtestWorker.terminate(); backtestWorker=null;
                hideLoading();
                const suggestionArea = document.getElementById('today-suggestion-area');
                 if (suggestionArea) suggestionArea.classList.add('hidden');
            }
        };

        backtestWorker.onerror=e=>{
             showError(`Worker錯誤: ${e.message}`); console.error("[Main] Worker Error:",e);
             if(backtestWorker)backtestWorker.terminate(); backtestWorker=null;
             hideLoading();
             const suggestionArea = document.getElementById('today-suggestion-area');
              if (suggestionArea) suggestionArea.classList.add('hidden');
        };

        const workerMsg={
            type:'runBacktest',
            params:params,
            useCachedData:useCache,
            dataStartDate:dataStartDate,
            effectiveStartDate:effectiveStartDate,
            lookbackDays:lookbackDays,
        };
        if(useCache) {
            const cachePayload = cachedEntry?.data || cachedStockData;
            if (Array.isArray(cachePayload)) {
                workerMsg.cachedData = cachePayload; // Prefer完整快取資料
            }
            if (cachedEntry) {
                workerMsg.cachedMeta = {
                    summary: cachedEntry.summary || null,
                    adjustments: Array.isArray(cachedEntry.adjustments) ? cachedEntry.adjustments : [],
                    debugSteps: Array.isArray(cachedEntry.debugSteps) ? cachedEntry.debugSteps : [],
                    adjustmentFallbackApplied: Boolean(cachedEntry.adjustmentFallbackApplied),
                    priceSource: cachedEntry.priceSource || null,
                    dataSource: cachedEntry.dataSource || null,
                    splitAdjustment: Boolean(cachedEntry.splitAdjustment),
                    fetchRange: cachedEntry.fetchRange || null,
                    effectiveStartDate: cachedEntry.effectiveStartDate || effectiveStartDate,
                    lookbackDays: cachedEntry.lookbackDays || lookbackDays,
                    diagnostics: cachedEntry.fetchDiagnostics || cachedEntry.datasetDiagnostics || null,
                };
            }
            console.log("[Main] Sending cached data to worker for backtest.");
        } else {
            console.log("[Main] Fetching new data for backtest.");
        }
        backtestWorker.postMessage(workerMsg);

    } catch (error) {
        console.error("[Main] Error in runBacktestInternal:", error);
        showError(`執行回測時發生錯誤: ${error.message}`);
        hideLoading();
        const suggestionArea = document.getElementById('today-suggestion-area');
        if (suggestionArea) suggestionArea.classList.add('hidden');
        if(backtestWorker)backtestWorker.terminate(); backtestWorker = null;
    }
}

function clearPreviousResults() {
    document.getElementById("backtest-result").innerHTML=`<p class="text-gray-500">請執行回測</p>`;
    document.getElementById("trade-results").innerHTML=`<p class="text-gray-500">請執行回測</p>`;
    document.getElementById("optimization-results").innerHTML=`<p class="text-gray-500">請執行優化</p>`;
    document.getElementById("performance-table-container").innerHTML=`<p class="text-gray-500">請先執行回測以生成期間績效數據。</p>`;
    if(stockChart){
        stockChart.destroy(); 
        stockChart=null; 
        const chartContainer = document.getElementById('chart-container');
        if (chartContainer) {
            chartContainer.innerHTML = '<canvas id="chart" class="w-full h-full absolute inset-0"></canvas><div class="text-muted text-center" style="color: var(--muted-foreground);"><i data-lucide="bar-chart-3" class="lucide w-12 h-12 mx-auto mb-2 opacity-50"></i><p>執行回測後將顯示淨值曲線</p></div>';
            if (typeof lucide !== 'undefined' && lucide.createIcons) {
                lucide.createIcons();
            }
        }
    }
    const resEl=document.getElementById("result");
    resEl.className = 'my-6 p-4 bg-blue-100 border-l-4 border-blue-500 text-blue-700 rounded-md';
    resEl.innerHTML = `<i class="fas fa-info-circle mr-2"></i> 請設定參數並執行。`;
    lastOverallResult = null; lastSubPeriodResults = null;
    lastIndicatorSeries = null;
    lastPositionStates = [];
    lastDatasetDiagnostics = null;

    const suggestionArea = document.getElementById('today-suggestion-area');
    const suggestionText = document.getElementById('suggestion-text');
    if (suggestionArea && suggestionText) {
        suggestionArea.classList.add('hidden');
        suggestionArea.className = 'my-4 p-4 bg-yellow-50 border-l-4 border-yellow-500 text-yellow-800 rounded-md text-center hidden';
        suggestionText.textContent = "-";
    }
    visibleStockData = [];
    renderPricePipelineSteps();
    renderPriceInspectorDebug();
    refreshDataDiagnosticsPanel();
}

const adjustmentReasonLabels = {
    missingPriceRow: '缺少對應價格',
    invalidBaseClose: '無效基準價',
    ratioOutOfRange: '調整比例異常',
};

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatSkipReasons(skipReasons) {
    if (!skipReasons || typeof skipReasons !== 'object') return '';
    const entries = Object.entries(skipReasons);
    if (entries.length === 0) return '';
    return entries
        .map(([reason, count]) => {
            const label = adjustmentReasonLabels[reason] || reason;
            return `${label}: ${count}`;
        })
        .join('、');
}

function updatePriceDebug(meta = {}) {
    const steps = Array.isArray(meta.debugSteps) ? meta.debugSteps : Array.isArray(meta.steps) ? meta.steps : [];
    const summary = meta.summary || null;
    const adjustments = Array.isArray(meta.adjustments) ? meta.adjustments : [];
    const fallbackApplied = typeof meta.adjustmentFallbackApplied === 'boolean'
        ? meta.adjustmentFallbackApplied
        : Boolean(meta.fallbackApplied);
    const priceSourceLabel = meta.priceSource || (summary && summary.priceSource) || null;
    const aggregateSource = meta.dataSource || null;
    const sourceList = Array.isArray(meta.dataSources) ? meta.dataSources : [];
    const priceMode = meta.priceMode || (typeof meta.adjustedPrice === 'boolean' ? (meta.adjustedPrice ? 'adjusted' : 'raw') : null);
    const splitDiagnostics = meta.splitDiagnostics || null;
    const finmindStatus = meta.finmindStatus || null;
    const adjustmentDebugLog = Array.isArray(meta.adjustmentDebugLog) ? meta.adjustmentDebugLog : [];
    const adjustmentChecks = Array.isArray(meta.adjustmentChecks) ? meta.adjustmentChecks : [];
    lastPriceDebug = {
        steps,
        summary,
        adjustments,
        fallbackApplied,
        priceSource: priceSourceLabel,
        dataSource: aggregateSource,
        dataSources: sourceList,
        priceMode,
        splitDiagnostics,
        finmindStatus,
        adjustmentDebugLog,
        adjustmentChecks,
    };
    renderPricePipelineSteps();
    renderPriceInspectorDebug();
}

function renderPricePipelineSteps() {
    const container = document.getElementById('pricePipelineSteps');
    if (!container) return;
    const hasData = Array.isArray(visibleStockData) && visibleStockData.length > 0;
    const hasSteps = Array.isArray(lastPriceDebug.steps) && lastPriceDebug.steps.length > 0;
    if (!hasData || !hasSteps) {
        container.classList.add('hidden');
        container.innerHTML = '';
        return;
    }
    const rows = lastPriceDebug.steps.map((step) => {
        const status = step.status === 'success' ? 'text-emerald-600'
            : step.status === 'warning' ? 'text-amber-600' : 'text-rose-600';
        let detailText = step.detail ? ` ・ ${escapeHtml(step.detail)}` : '';
        if (step.key === 'adjustmentApply' && lastPriceDebug.fallbackApplied) {
            detailText += ' ・ 已啟用備援縮放';
        }
        const reasonFormatted = step.skipReasons ? formatSkipReasons(step.skipReasons) : '';
        const reasonText = reasonFormatted ? ` ・ ${escapeHtml(reasonFormatted)}` : '';
        return `<div class="flex items-center gap-2 text-[11px]">
            <span class="${status}">●</span>
            <span style="color: var(--foreground);">${escapeHtml(step.label)}${detailText}${reasonText}</span>
        </div>`;
    }).join('');
    container.innerHTML = rows;
    container.classList.remove('hidden');
}

function renderPriceInspectorDebug() {
    const panel = document.getElementById('priceInspectorDebugPanel');
    if (!panel) return;
    const hasData = Array.isArray(visibleStockData) && visibleStockData.length > 0;
    const hasSteps = Array.isArray(lastPriceDebug.steps) && lastPriceDebug.steps.length > 0;
    if (!hasData || !hasSteps) {
        panel.classList.add('hidden');
        panel.innerHTML = '';
        return;
    }
    const summaryItems = [];
    if (lastPriceDebug.summary && typeof lastPriceDebug.summary === 'object') {
        const applied = Number(lastPriceDebug.summary.adjustmentEvents || 0);
        const skipped = Number(lastPriceDebug.summary.skippedEvents || 0);
        summaryItems.push(`成功 ${applied} 件`);
        summaryItems.push(`略過 ${skipped} 件`);
    }
    if (lastPriceDebug.fallbackApplied) {
        summaryItems.push('備援縮放已啟用');
    }
    const summaryLine = summaryItems.length > 0
        ? `<div class="text-[11px] font-medium" style="color: var(--foreground);">${escapeHtml(summaryItems.join(' ・ '))}</div>`
        : '';
    const stepsHtml = lastPriceDebug.steps.map((step) => {
        const status = step.status === 'success' ? 'text-emerald-600'
            : step.status === 'warning' ? 'text-amber-600' : 'text-rose-600';
        let detailText = step.detail ? ` ・ ${escapeHtml(step.detail)}` : '';
        if (step.key === 'adjustmentApply' && lastPriceDebug.fallbackApplied) {
            detailText += ' ・ 已啟用備援縮放';
        }
        const reasonFormatted = step.skipReasons ? formatSkipReasons(step.skipReasons) : '';
        const reasonText = reasonFormatted ? ` ・ ${escapeHtml(reasonFormatted)}` : '';
        return `<div class="flex items-start gap-2 text-[11px]">
            <span class="${status}">●</span>
            <span style="color: var(--foreground);">${escapeHtml(step.label)}${detailText}${reasonText}</span>
        </div>`;
    }).join('');
    panel.innerHTML = `<div class="space-y-2">${summaryLine}${stepsHtml}</div>`;
    panel.classList.remove('hidden');
}

const dataDiagnosticsState = { open: false };

function formatDiagnosticsValue(value) {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'number') {
        if (Number.isNaN(value)) return '—';
        return value.toString();
    }
    return String(value);
}

function formatDiagnosticsRange(start, end) {
    if (!start && !end) return '—';
    if (start && end) return `${start} ~ ${end}`;
    return start || end || '—';
}

function formatDiagnosticsIndex(entry) {
    if (!entry || typeof entry !== 'object') return '—';
    const date = entry.date || '—';
    const index = Number.isFinite(entry.index) ? `#${entry.index}` : '#—';
    return `${date} (${index})`;
}

function formatDiagnosticsGap(days) {
    if (!Number.isFinite(days)) return '—';
    if (days === 0) return '0 天';
    return `${days > 0 ? '+' : ''}${days} 天`;
}

function formatDiagnosticsReasonCounts(reasons) {
    if (!reasons || typeof reasons !== 'object') return '—';
    const entries = Object.entries(reasons)
        .map(([reason, count]) => [reason, Number(count)])
        .filter(([, count]) => Number.isFinite(count) && count > 0)
        .sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) return '—';
    return entries.map(([reason, count]) => `${reason}×${count}`).join('、');
}

function renderDiagnosticsEntries(containerId, entries) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!Array.isArray(entries) || entries.length === 0) {
        container.innerHTML = `<p class="text-[11px]" style="color: var(--muted-foreground);">無資料</p>`;
        return;
    }
    container.innerHTML = entries
        .map((entry) => {
            const label = escapeHtml(entry.label || '');
            const value = escapeHtml(formatDiagnosticsValue(entry.value));
            const valueClass = entry.emphasis ? 'font-semibold' : '';
            return `<div class="flex justify-between gap-2 text-[11px]">
                <span class="text-muted-foreground" style="color: var(--muted-foreground);">${label}</span>
                <span class="${valueClass}" style="color: var(--foreground);">${value}</span>
            </div>`;
        })
        .join('');
}

function renderDiagnosticsSamples(containerId, samples, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!Array.isArray(samples) || samples.length === 0) {
        container.innerHTML = `<p class="text-[11px]" style="color: var(--muted-foreground);">${options.emptyText || '無異常樣本'}</p>`;
        return;
    }
    container.innerHTML = samples
        .map((sample) => {
            const date = escapeHtml(sample.date || '');
            const index = Number.isFinite(sample.index) ? `#${sample.index}` : '#—';
            const reasons = Array.isArray(sample.reasons)
                ? escapeHtml(sample.reasons.join('、'))
                : '—';
            const close = sample.close !== undefined && sample.close !== null
                ? escapeHtml(sample.close.toString())
                : '—';
            const volume = sample.volume !== undefined && sample.volume !== null
                ? escapeHtml(sample.volume.toString())
                : '—';
            return `<div class="border rounded px-2 py-1 text-[11px]" style="border-color: var(--border);">
                <div style="color: var(--foreground);">${date} (${index})</div>
                <div class="text-muted-foreground" style="color: var(--muted-foreground);">原因: ${reasons}</div>
                <div class="text-muted-foreground" style="color: var(--muted-foreground);">收盤: ${close} ｜ 量: ${volume}</div>
            </div>`;
        })
        .join('');
}

function renderDiagnosticsPreview(containerId, rows) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!Array.isArray(rows) || rows.length === 0) {
        container.innerHTML = `<p class="text-[11px]" style="color: var(--muted-foreground);">尚未取得鄰近樣本。</p>`;
        return;
    }
    container.innerHTML = rows
        .map((row) => {
            const index = Number.isFinite(row.index) ? `#${row.index}` : '#—';
            const date = escapeHtml(row.date || '');
            const close = row.close !== undefined && row.close !== null
                ? escapeHtml(row.close.toString())
                : '—';
            const open = row.open !== undefined && row.open !== null
                ? escapeHtml(row.open.toString())
                : '—';
            const high = row.high !== undefined && row.high !== null
                ? escapeHtml(row.high.toString())
                : '—';
            const low = row.low !== undefined && row.low !== null
                ? escapeHtml(row.low.toString())
                : '—';
            const volume = row.volume !== undefined && row.volume !== null
                ? escapeHtml(row.volume.toString())
                : '—';
            return `<div class="border rounded px-2 py-1 text-[11px]" style="border-color: var(--border);">
                <div style="color: var(--foreground);">${date} (${index})</div>
                <div class="text-muted-foreground" style="color: var(--muted-foreground);">開:${open} 高:${high} 低:${low}</div>
                <div class="text-muted-foreground" style="color: var(--muted-foreground);">收:${close} ｜ 量:${volume}</div>
            </div>`;
        })
        .join('');
}

function renderDiagnosticsTestingGuidance(diag) {
    const container = document.getElementById('dataDiagnosticsTesting');
    if (!container) return;
    if (!diag) {
        container.innerHTML = `<p class="text-[11px]" style="color: var(--muted-foreground);">執行回測後會在此提供建議的手動測試步驟。</p>`;
        return;
    }
    const dataset = diag.runtime?.dataset || {};
    const buyHold = diag.runtime?.buyHold || {};
    const fetchOverview = diag.fetch?.overview || {};
    const reasonSummary = formatDiagnosticsReasonCounts(dataset.invalidRowsInRange?.reasons);
    const buyHoldFirst = buyHold.firstValidPriceDate || '—';
    const fetchRange = formatDiagnosticsRange(fetchOverview.firstDate, fetchOverview.lastDate);
    container.innerHTML = `<ol class="list-decimal pl-4 space-y-1">
        <li style="color: var(--foreground);">請比對圖表起點（${escapeHtml(dataset.requestedStart || '—')}）與買入持有首日（${escapeHtml(buyHoldFirst)}），並於回報時附上此卡片截圖。</li>
        <li style="color: var(--foreground);">若「無效欄位統計」顯示 ${escapeHtml(reasonSummary)}，請擷取 console 中 [Worker] dataset/fetch summary 的表格輸出。</li>
        <li style="color: var(--foreground);">確認遠端資料範圍 ${escapeHtml(fetchRange)} 是否覆蓋暖身期，如仍缺資料請於回報時註記。</li>
    </ol>`;
}

function renderDiagnosticsFetch(fetchDiag) {
    const summaryContainer = document.getElementById('dataDiagnosticsFetchSummary');
    const monthsContainer = document.getElementById('dataDiagnosticsFetchMonths');
    if (!summaryContainer || !monthsContainer) return;
    if (!fetchDiag) {
        summaryContainer.innerHTML = `<p class="text-[11px]" style="color: var(--muted-foreground);">尚未擷取遠端資料。</p>`;
        monthsContainer.innerHTML = '';
        return;
    }
    const overview = fetchDiag.overview || {};
    renderDiagnosticsEntries('dataDiagnosticsFetchSummary', [
        { label: '抓取起點', value: fetchDiag.dataStartDate || fetchDiag.requested?.start || '—' },
        { label: '遠端資料範圍', value: formatDiagnosticsRange(overview.firstDate, overview.lastDate) },
        { label: '暖身起點', value: overview.warmupStartDate || fetchDiag.dataStartDate || fetchDiag.requested?.start || '—' },
        { label: '第一筆有效收盤', value: formatDiagnosticsIndex(overview.firstValidCloseOnOrAfterWarmupStart || overview.firstValidCloseOnOrAfterEffectiveStart) },
        { label: '距暖身起點天數', value: formatDiagnosticsGap(overview.firstValidCloseGapFromWarmup ?? overview.firstValidCloseGapFromEffective) },
        { label: '遠端無效筆數', value: overview.invalidRowsInRange?.count ?? 0 },
        { label: '遠端無效欄位', value: formatDiagnosticsReasonCounts(overview.invalidRowsInRange?.reasons) },
        { label: '月度分段', value: Array.isArray(fetchDiag.months) ? fetchDiag.months.length : 0 },
    ]);
    if (!Array.isArray(fetchDiag.months) || fetchDiag.months.length === 0) {
        monthsContainer.innerHTML = `<p class="text-[11px]" style="color: var(--muted-foreground);">沒有月度快取紀錄。</p>`;
        return;
    }
    const recentMonths = fetchDiag.months.slice(-6);
    monthsContainer.innerHTML = recentMonths
        .map((month) => {
            const monthLabel = escapeHtml(month.label || month.monthKey || '—');
            const rows = formatDiagnosticsValue(month.rowsReturned);
            const missing = formatDiagnosticsValue(month.missingSegments);
            const forced = formatDiagnosticsValue(month.forcedRepairs);
            const firstDate = escapeHtml(month.firstRowDate || '—');
            const cacheUsed = month.usedCache ? '是' : '否';
            return `<div class="border rounded px-2 py-1 text-[11px]" style="border-color: var(--border);">
                <div class="font-medium" style="color: var(--foreground);">${monthLabel}</div>
                <div class="flex flex-wrap gap-2 text-muted-foreground" style="color: var(--muted-foreground);">
                    <span>筆數 ${rows}</span>
                    <span>缺口 ${missing}</span>
                    <span>強制補抓 ${forced}</span>
                    <span>首筆 ${firstDate}</span>
                    <span>使用快取 ${cacheUsed}</span>
                </div>
            </div>`;
        })
        .join('');
}

function refreshDataDiagnosticsPanel(diag = lastDatasetDiagnostics) {
    const hintEl = document.getElementById('dataDiagnosticsHint');
    const contentEl = document.getElementById('dataDiagnosticsContent');
    const titleEl = document.getElementById('dataDiagnosticsTitle');
    if (!hintEl || !contentEl || !titleEl) return;
    if (!diag) {
        hintEl.textContent = '請先執行回測後，再查看暖身與快取診斷資訊。';
        contentEl.classList.add('hidden');
        titleEl.textContent = '資料暖身診斷';
        renderDiagnosticsEntries('dataDiagnosticsSummary', []);
        renderDiagnosticsEntries('dataDiagnosticsName', []);
        renderDiagnosticsEntries('dataDiagnosticsWarmup', []);
        const warmupNoteEl = document.getElementById('dataDiagnosticsWarmupNote');
        if (warmupNoteEl) {
            warmupNoteEl.textContent = '';
        }
        renderDiagnosticsEntries('dataDiagnosticsBuyHold', []);
        renderDiagnosticsSamples('dataDiagnosticsInvalidSamples', []);
        renderDiagnosticsSamples('dataDiagnosticsBuyHoldSamples', []);
        renderDiagnosticsFetch(null);
        renderDiagnosticsPreview('dataDiagnosticsPreview', []);
        renderDiagnosticsTestingGuidance(null);
        return;
    }
    hintEl.textContent = '若需回報問題，請一併提供此卡片內容與 console 診斷資訊。';
    contentEl.classList.remove('hidden');
    const meta = diag.meta || {};
    const dataset = diag.runtime?.dataset || {};
    const warmup = diag.runtime?.warmup || {};
    const buyHold = diag.runtime?.buyHold || {};
    titleEl.textContent = `資料暖身診斷：${dataset.requestedStart || warmup.requestedStart || '—'} → ${dataset.endDate || diag.fetch?.requested?.end || '—'}`;
    renderDiagnosticsEntries('dataDiagnosticsName', [
        { label: '股票代碼', value: meta.stockNo || dataset.stockNo || '—' },
        { label: '股票名稱', value: meta.stockName || '—' },
        { label: '名稱來源', value: meta.nameSource || '—' },
        { label: '名稱市場', value: meta.nameMarket ? getMarketDisplayName(meta.nameMarket) : '—' },
        { label: '台股清單來源', value: meta.directorySource || '—' },
        { label: '清單版本', value: meta.directoryVersion || '—' },
        { label: '清單更新時間', value: meta.directoryUpdatedAt || '—' },
    ]);
    renderDiagnosticsEntries('dataDiagnosticsSummary', [
        { label: '資料總筆數', value: dataset.totalRows },
        { label: '資料範圍', value: formatDiagnosticsRange(dataset.firstDate, dataset.lastDate) },
        { label: '使用者起點', value: dataset.requestedStart || warmup.requestedStart || '—' },
        { label: '暖身起點', value: dataset.warmupStartDate || warmup.warmupStartDate || dataset.dataStartDate || warmup.dataStartDate || '—' },
        { label: '暖身筆數', value: dataset.warmupRows },
        { label: '區間筆數', value: dataset.rowsWithinRange },
        { label: '第一筆>=使用者起點', value: formatDiagnosticsIndex(dataset.firstRowOnOrAfterRequestedStart) },
        { label: '第一筆有效收盤', value: formatDiagnosticsIndex(dataset.firstValidCloseOnOrAfterRequestedStart) },
        { label: '距暖身起點天數', value: formatDiagnosticsGap(dataset.firstValidCloseGapFromWarmup ?? dataset.firstValidCloseGapFromEffective) },
        { label: '距使用者起點天數', value: formatDiagnosticsGap(dataset.firstValidCloseGapFromRequested) },
        { label: '區間內無效筆數', value: dataset.invalidRowsInRange?.count ?? 0 },
        { label: '第一筆無效資料', value: dataset.firstInvalidRowOnOrAfterEffectiveStart ? formatDiagnosticsIndex(dataset.firstInvalidRowOnOrAfterEffectiveStart) : '—' },
        { label: '無效欄位統計', value: formatDiagnosticsReasonCounts(dataset.invalidRowsInRange?.reasons) },
    ]);
    renderDiagnosticsSamples(
        'dataDiagnosticsInvalidSamples',
        dataset.invalidRowsInRange?.samples || [],
        { emptyText: '區間內尚未觀察到無效筆數。' }
    );
    renderDiagnosticsEntries('dataDiagnosticsWarmup', [
        { label: '暖身起點', value: warmup.warmupStartDate || warmup.dataStartDate || dataset.warmupStartDate || '—' },
        { label: 'Longest 指標窗', value: warmup.longestLookback },
        { label: 'KD 需求 (多/空)', value: `${formatDiagnosticsValue(warmup.kdNeedLong)} / ${formatDiagnosticsValue(warmup.kdNeedShort)}` },
        { label: 'MACD 需求 (多/空)', value: `${formatDiagnosticsValue(warmup.macdNeedLong)} / ${formatDiagnosticsValue(warmup.macdNeedShort)}` },
        { label: '模擬起始索引', value: warmup.computedStartIndex },
        { label: '有效起始索引', value: warmup.effectiveStartIndex },
        { label: '暖身耗用筆數', value: warmup.barsBeforeFirstTrade },
        { label: '設定 Lookback 天數', value: warmup.lookbackDays },
        { label: '距暖身起點天數', value: formatDiagnosticsGap(warmup.firstValidCloseGapFromWarmup ?? dataset.firstValidCloseGapFromWarmup) },
    ]);
    const warmupNoteEl = document.getElementById('dataDiagnosticsWarmupNote');
    if (warmupNoteEl) {
        const warmupStart = warmup.warmupStartDate || warmup.dataStartDate || dataset.warmupStartDate || null;
        const userStart = dataset.requestedStart || warmup.requestedStart || diag.fetch?.requested?.start || null;
        const longest = Number.isFinite(warmup.longestLookback) && warmup.longestLookback > 0
            ? warmup.longestLookback
            : null;
        const lookbackDays = Number.isFinite(warmup.lookbackDays) && warmup.lookbackDays > 0
            ? warmup.lookbackDays
            : null;
        const factors = [];
        if (longest) {
            factors.push(`最長指標需求 ${longest} 筆`);
        }
        if (lookbackDays) {
            factors.push(`額外緩衝 ${lookbackDays} 天`);
        }
        const baseExplanation = factors.length > 0
            ? `shared-lookback 會依 ${factors.join(' + ')} 回推暖身範圍`
            : 'shared-lookback 會根據策略指標需求與緩衝設定回推暖身範圍';
        let gapExplanation = '';
        if (warmupStart && userStart) {
            const warmupUtc = parseISODateToUTC(warmupStart);
            const userUtc = parseISODateToUTC(userStart);
            if (Number.isFinite(warmupUtc) && Number.isFinite(userUtc) && warmupUtc < userUtc) {
                const diffDays = Math.round((userUtc - warmupUtc) / BACKTEST_DAY_MS);
                if (diffDays > 0) {
                    gapExplanation = `，與使用者起點相差約 ${diffDays} 天`;
                }
            }
        }
        const resolvedWarmupStart = warmupStart || '暖身起點未定';
        warmupNoteEl.textContent = `${baseExplanation}，因此本次暖身起點落在 ${resolvedWarmupStart}${gapExplanation}。系統會先確認暖身區間內的有效收盤價後才交付回測計算。`;
    }
    renderDiagnosticsEntries('dataDiagnosticsBuyHold', [
        { label: '首筆有效收盤索引', value: buyHold.firstValidPriceIdx },
        { label: '首筆有效收盤日期', value: buyHold.firstValidPriceDate || '—' },
        { label: '距暖身起點天數', value: formatDiagnosticsGap(buyHold.firstValidPriceGapFromEffective) },
        { label: '距使用者起點天數', value: formatDiagnosticsGap(buyHold.firstValidPriceGapFromRequested) },
        { label: '暖身後無效收盤筆數', value: buyHold.invalidBarsBeforeFirstValid?.count ?? 0 },
    ]);
    renderDiagnosticsSamples(
        'dataDiagnosticsBuyHoldSamples',
        buyHold.invalidBarsBeforeFirstValid?.samples || [],
        { emptyText: '暖身後未觀察到收盤價缺失。' }
    );
    renderDiagnosticsPreview('dataDiagnosticsPreview', warmup.previewRows || []);
    renderDiagnosticsFetch(diag.fetch || null);
    renderDiagnosticsTestingGuidance(diag);
}

function renderBlobUsageCard() {
    const container = document.getElementById('blobUsageContent');
    const updatedAtEl = document.getElementById('blobUsageUpdatedAt');
    if (!container) return;
    if (!blobUsageLedger || typeof blobUsageLedger !== 'object') {
        container.innerHTML = `<div class="rounded-md border border-dashed px-3 py-2" style="border-color: var(--border); color: var(--muted-foreground);">尚未累積 Blob 用量統計，執行回測後將在此顯示本月操作數與熱門查詢。</div>`;
        if (updatedAtEl) updatedAtEl.textContent = '';
        return;
    }
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthRecord = blobUsageLedger.months?.[monthKey] || null;
    if (!monthRecord) {
        container.innerHTML = `<div class="rounded-md border border-dashed px-3 py-2" style="border-color: var(--border); color: var(--muted-foreground);">本月尚未觸發任何 Blob 操作。</div>`;
        if (updatedAtEl) updatedAtEl.textContent = '';
        return;
    }
    const totalOps = Number(monthRecord.readOps || 0) + Number(monthRecord.writeOps || 0);
    const hit = Number(monthRecord.cacheHits || 0);
    const miss = Number(monthRecord.cacheMisses || 0);
    const hitRate = totalOps > 0 ? `${((hit / totalOps) * 100).toFixed(1)}%` : '—';
    const topStocks = Object.entries(monthRecord.stocks || {})
        .map(([stock, info]) => ({
            stock,
            count: Number(info?.count) || 0,
            market: info?.market || null,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    const topStocksHtml = topStocks.length > 0
        ? topStocks
            .map((item) => `<div class="flex items-center justify-between"><span>${escapeHtml(item.stock)}</span><span style="color: var(--muted-foreground);">${item.count} 次${item.market ? `・${escapeHtml(item.market)}` : ''}</span></div>`)
            .join('')
        : '<div style="color: var(--muted-foreground);">尚無熱門查詢</div>';

    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const events = Array.isArray(monthRecord.events) ? monthRecord.events : [];
    const grouped = [];
    const groupMap = new Map();
    events.forEach((event) => {
        const when = new Date(Number(event.timestamp) || Date.now());
        const dateKey = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}-${String(when.getDate()).padStart(2, '0')}`;
        if (!groupMap.has(dateKey)) {
            groupMap.set(dateKey, {
                key: dateKey,
                label: `${when.getFullYear()}/${String(when.getMonth() + 1).padStart(2, '0')}/${String(when.getDate()).padStart(2, '0')}`,
                rows: [],
            });
            grouped.push(groupMap.get(dateKey));
        }
        groupMap.get(dateKey).rows.push({ raw: event, when });
    });

    const eventsHtml = grouped.length > 0
        ? grouped.map((group) => {
            const defaultExpanded = group.key === todayKey;
            const expanded = isBlobUsageGroupExpanded(group.key, defaultExpanded);
            const indicator = expanded ? '－' : '＋';
            const rowsHtml = group.rows.map((item) => {
                const actionLabel = item.raw.action === 'write' ? '寫入' : '讀取';
                const badgeClass = item.raw.action === 'write'
                    ? 'bg-amber-100 text-amber-700 border-amber-200'
                    : 'bg-emerald-100 text-emerald-700 border-emerald-200';
                const statusLabel = item.raw.cacheHit ? '命中' : '補抓';
                const timeLabel = `${String(item.when.getHours()).padStart(2, '0')}:${String(item.when.getMinutes()).padStart(2, '0')}`;
                const infoParts = [];
                if (item.raw.stockNo) infoParts.push(`<span>${escapeHtml(item.raw.stockNo)}</span>`);
                if (item.raw.market) infoParts.push(`<span style="color: var(--muted-foreground);">${escapeHtml(item.raw.market)}</span>`);
                if (item.raw.key) infoParts.push(`<span style="color: var(--muted-foreground);">${escapeHtml(item.raw.key)}</span>`);
                if (item.raw.source) infoParts.push(`<span style="color: var(--muted-foreground);">${escapeHtml(item.raw.source)}</span>`);
                infoParts.push(`<span style="color: var(--muted-foreground);">${statusLabel}</span>`);
                infoParts.push(`<span style="color: var(--muted-foreground);">${timeLabel}</span>`);
                return `<div class="border rounded px-3 py-2 text-[11px]" style="border-color: var(--border);">
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${badgeClass}">${actionLabel}</span>
                        ${infoParts.join(' ')}
                    </div>
                </div>`;
            }).join('');
            return `<div class="border rounded-md" data-blob-group="${group.key}" style="border-color: var(--border); background-color: color-mix(in srgb, var(--background) 96%, transparent);">
                <button type="button" class="w-full flex items-center justify-between px-3 py-2 text-left text-[11px] font-medium" data-blob-group-toggle="${group.key}" aria-expanded="${expanded ? 'true' : 'false'}" style="color: var(--foreground);">
                    <span>${group.label}</span>
                    <span class="flex items-center gap-2" style="color: var(--muted-foreground);">
                        <span>${group.rows.length} 筆</span>
                        <span data-blob-group-indicator="${group.key}" aria-hidden="true">${indicator}</span>
                    </span>
                </button>
                <div class="space-y-2 px-3 pb-3 ${expanded ? '' : 'hidden'}" data-blob-group-body="${group.key}">
                    ${rowsHtml}
                </div>
            </div>`;
        }).join('')
        : '<div style="color: var(--muted-foreground);">尚未記錄近期操作</div>';

    container.innerHTML = `
        <div class="grid grid-cols-2 gap-3 text-[11px]">
            <div class="rounded-md border px-3 py-2" style="border-color: var(--border);">
                <div class="font-medium" style="color: var(--foreground);">本月操作數</div>
                <div class="mt-1 text-lg font-semibold" style="color: var(--foreground);">${formatNumberWithComma(totalOps)}</div>
                <div class="mt-1 text-xs" style="color: var(--muted-foreground);">讀取 ${formatNumberWithComma(monthRecord.readOps || 0)}・寫入 ${formatNumberWithComma(monthRecord.writeOps || 0)}</div>
            </div>
            <div class="rounded-md border px-3 py-2" style="border-color: var(--border);">
                <div class="font-medium" style="color: var(--foreground);">命中率</div>
                <div class="mt-1 text-lg font-semibold" style="color: var(--foreground);">${hitRate}</div>
                <div class="mt-1 text-xs" style="color: var(--muted-foreground);">命中 ${formatNumberWithComma(hit)}・補抓 ${formatNumberWithComma(miss)}</div>
            </div>
        </div>
        <div class="rounded-md border px-3 py-2" style="border-color: var(--border);">
            <div class="font-medium mb-1" style="color: var(--foreground);">熱門股票</div>
            <div class="space-y-1">${topStocksHtml}</div>
        </div>
        <div class="rounded-md border px-3 py-2" style="border-color: var(--border);">
            <div class="font-medium mb-1" style="color: var(--foreground);">近期操作</div>
            <div class="space-y-2" style="max-height: 16rem; overflow-y: auto; padding-right: 0.25rem;">${eventsHtml}</div>
        </div>
    `;

    if (grouped.length > 0) {
        const toggles = container.querySelectorAll('[data-blob-group-toggle]');
        toggles.forEach((btn) => {
            btn.addEventListener('click', () => {
                const dateKey = btn.getAttribute('data-blob-group-toggle');
                const body = container.querySelector(`[data-blob-group-body="${dateKey}"]`);
                const indicator = container.querySelector(`[data-blob-group-indicator="${dateKey}"]`);
                if (!body) return;
                const currentlyExpanded = !body.classList.contains('hidden');
                const nextState = !currentlyExpanded;
                body.classList.toggle('hidden', !nextState);
                btn.setAttribute('aria-expanded', nextState ? 'true' : 'false');
                if (indicator) indicator.textContent = nextState ? '－' : '＋';
                setBlobUsageGroupExpanded(dateKey, nextState);
            });
        });
    }

    if (updatedAtEl) {
        updatedAtEl.textContent = blobUsageLedger.updatedAt
            ? `更新於 ${new Date(blobUsageLedger.updatedAt).toLocaleString('zh-TW')}`
            : '';
    }
}

function toggleDataDiagnostics(forceOpen) {
    const panel = document.getElementById('dataDiagnosticsPanel');
    const toggleBtn = document.getElementById('toggleDataDiagnostics');
    if (!panel || !toggleBtn) return;
    const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : !dataDiagnosticsState.open;
    dataDiagnosticsState.open = shouldOpen;
    if (shouldOpen) {
        panel.classList.remove('hidden');
        toggleBtn.setAttribute('aria-expanded', 'true');
        refreshDataDiagnosticsPanel();
    } else {
        panel.classList.add('hidden');
        toggleBtn.setAttribute('aria-expanded', 'false');
    }
}

function initDataDiagnosticsPanel() {
    const toggleBtn = document.getElementById('toggleDataDiagnostics');
    const closeBtn = document.getElementById('closeDataDiagnostics');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => toggleDataDiagnostics());
    }
    if (closeBtn) {
        closeBtn.addEventListener('click', () => toggleDataDiagnostics(false));
    }
    refreshDataDiagnosticsPanel();
    window.refreshDataDiagnosticsPanel = refreshDataDiagnosticsPanel;
}

function updateDataSourceDisplay(dataSource, stockName) {
    const displayEl = document.getElementById('dataSourceDisplay');
    if (!displayEl) return;

    if (dataSource) {
        let sourceText = `數據來源: ${dataSource}`;
        displayEl.textContent = sourceText;
        displayEl.classList.remove('hidden');
        if (typeof window.refreshDataSourceTester === 'function') {
            try {
                window.refreshDataSourceTester();
            } catch (error) {
                console.warn('[Main] 更新資料來源測試面板時發生例外:', error);
            }
        }
    } else {
        displayEl.classList.add('hidden');
    }
}

// Patch Tag: LB-PRICE-INSPECTOR-20250518A
function resolvePriceInspectorSourceLabel() {
    const summarySources = Array.isArray(lastPriceDebug?.summary?.sources)
        ? lastPriceDebug.summary.sources.filter((item) => typeof item === 'string' && item.trim().length > 0)
        : [];
    const candidates = [
        lastPriceDebug?.priceSource,
        lastPriceDebug?.summary?.priceSource,
        lastPriceDebug?.dataSource,
        summarySources.length > 0 ? summarySources.join(' + ') : null,
        Array.isArray(lastPriceDebug?.dataSources) && lastPriceDebug.dataSources.length > 0
            ? lastPriceDebug.dataSources.join(' + ')
            : null,
    ];
    const resolved = candidates.find((value) => typeof value === 'string' && value.trim().length > 0);
    return resolved || '';
}

// Patch Tag: LB-PRICE-INSPECTOR-20250302A
function refreshPriceInspectorControls() {
    const controls = document.getElementById('priceInspectorControls');
    const openBtn = document.getElementById('openPriceInspector');
    const summaryEl = document.getElementById('priceInspectorSummary');
    if (!controls || !openBtn) return;

    const hasData = Array.isArray(visibleStockData) && visibleStockData.length > 0;
    if (!hasData) {
        controls.classList.add('hidden');
        openBtn.disabled = true;
        if (summaryEl) summaryEl.textContent = '';
        return;
    }

    const modeKey = (lastFetchSettings?.priceMode || (lastFetchSettings?.adjustedPrice ? 'adjusted' : 'raw') || 'raw').toString().toLowerCase();
    const modeLabel = modeKey === 'adjusted' ? '還原價格' : '原始收盤價';
    const sourceLabel = resolvePriceInspectorSourceLabel();
    const lastStartFallback = lastFetchSettings?.effectiveStartDate || lastFetchSettings?.startDate || '';
    const displayData = visibleStockData.length > 0 ? visibleStockData : [];
    const firstDate = displayData[0]?.date || lastStartFallback;
    const lastDate = displayData[displayData.length - 1]?.date || lastFetchSettings?.endDate || '';

    controls.classList.remove('hidden');
    openBtn.disabled = false;
    if (summaryEl) {
        const summaryParts = [`${firstDate} ~ ${lastDate}`, `${displayData.length} 筆 (${modeLabel})`];
        if (sourceLabel) {
            summaryParts.push(sourceLabel);
        }
        summaryEl.textContent = summaryParts.join(' ・ ');
    }
    renderPricePipelineSteps();
}

function resolveStrategyDisplayName(key) {
    if (!key) return '';
    const direct = strategyDescriptions?.[key];
    if (direct?.name) return direct.name;
    const exitVariant = strategyDescriptions?.[`${key}_exit`];
    if (exitVariant?.name) return exitVariant.name;
    return key;
}

function collectPriceInspectorIndicatorColumns() {
    if (!lastOverallResult) return [];
    const series = lastIndicatorSeries || {};
    const columns = [];
    const pushColumn = (seriesKey, headerLabel) => {
        const entry = series?.[seriesKey];
        if (entry && Array.isArray(entry.columns) && entry.columns.length > 0) {
            columns.push({ key: seriesKey, header: headerLabel, series: entry });
        }
    };

    pushColumn('longEntry', `多單進場｜${resolveStrategyDisplayName(lastOverallResult.entryStrategy)}`);
    pushColumn('longExit', `多單出場｜${resolveStrategyDisplayName(lastOverallResult.exitStrategy)}`);
    if (lastOverallResult.enableShorting) {
        pushColumn('shortEntry', `做空進場｜${resolveStrategyDisplayName(lastOverallResult.shortEntryStrategy)}`);
        pushColumn('shortExit', `做空出場｜${resolveStrategyDisplayName(lastOverallResult.shortExitStrategy)}`);
    }
    return columns;
}

function formatIndicatorNumericValue(value, column) {
    if (!Number.isFinite(value)) return '不足';
    if (column?.format === 'integer') {
        return Math.round(value).toLocaleString('zh-TW');
    }
    const digits = typeof column?.decimals === 'number' ? column.decimals : 2;
    return Number(value).toFixed(digits);
}

function renderIndicatorCell(columnGroup, rowIndex) {
    if (!columnGroup || !Array.isArray(columnGroup.columns) || columnGroup.columns.length === 0) {
        return '—';
    }
    const lines = [];
    columnGroup.columns.forEach((col) => {
        const values = Array.isArray(col.values) ? col.values : [];
        const rawValue = values[rowIndex];
        if (col.format === 'text') {
            const textValue = rawValue !== null && rawValue !== undefined && rawValue !== ''
                ? String(rawValue)
                : '—';
            lines.push(`${escapeHtml(col.label)}: ${escapeHtml(textValue)}`);
        } else {
            const formatted = formatIndicatorNumericValue(rawValue, col);
            lines.push(`${escapeHtml(col.label)}: ${formatted}`);
        }
    });
    return lines.length > 0 ? lines.join('<br>') : '—';
}

function openPriceInspectorModal() {
    if (!Array.isArray(visibleStockData) || visibleStockData.length === 0) {
        showError('尚未取得價格資料，請先執行回測。');
        return;
    }
    const modal = document.getElementById('priceInspectorModal');
    const tbody = document.getElementById('priceInspectorTableBody');
    const subtitle = document.getElementById('priceInspectorSubtitle');
    if (!modal || !tbody) return;

    const modeKey = (lastFetchSettings?.priceMode || (lastFetchSettings?.adjustedPrice ? 'adjusted' : 'raw') || 'raw').toString().toLowerCase();
    const modeLabel = modeKey === 'adjusted' ? '顯示還原後價格' : '顯示原始收盤價';
    const sourceLabel = resolvePriceInspectorSourceLabel();
    if (subtitle) {
        const marketLabel = (lastFetchSettings?.market || lastFetchSettings?.marketType || currentMarket || 'TWSE').toUpperCase();
        const subtitleParts = [`${modeLabel}`, marketLabel, `${visibleStockData.length} 筆`];
        if (sourceLabel) {
            subtitleParts.push(sourceLabel);
        }
        subtitle.textContent = subtitleParts.join(' ・ ');
    }
    renderPriceInspectorDebug();

    // Patch Tag: LB-PRICE-INSPECTOR-20250512A
    const headerRow = document.getElementById('priceInspectorHeaderRow');
    const indicatorColumns = collectPriceInspectorIndicatorColumns();
    const baseHeaderConfig = [
        { key: 'date', label: '日期', align: 'left' },
        { key: 'open', label: '開盤', align: 'right' },
        { key: 'high', label: '最高', align: 'right' },
        { key: 'low', label: '最低', align: 'right' },
        { key: 'rawClose', label: '原始收盤', align: 'right' },
        { key: 'close', label: '還原收盤', align: 'right' },
        { key: 'factor', label: '還原因子', align: 'right' },
    ];
    indicatorColumns.forEach((col) => {
        baseHeaderConfig.push({ key: col.key, label: col.header, align: 'left', isIndicator: true, series: col.series });
    });
    baseHeaderConfig.push(
        { key: 'position', label: '倉位狀態', align: 'left' },
        { key: 'formula', label: '計算公式', align: 'left' },
        { key: 'volume', label: '(千股)量', align: 'right' },
        { key: 'source', label: '價格來源', align: 'left' },
    );

    if (headerRow) {
        headerRow.innerHTML = baseHeaderConfig
            .map((cfg) => `<th class="px-3 py-2 text-${cfg.align} font-medium">${escapeHtml(cfg.label)}</th>`)
            .join('');
    }

    const totalColumns = baseHeaderConfig.length;

    const formatNumber = (value, digits = 2) => (Number.isFinite(value) ? Number(value).toFixed(digits) : '—');
    const formatFactor = (value) => (Number.isFinite(value) && value !== 0 ? Number(value).toFixed(6) : '—');
    const computeRawClose = (row) => {
        if (!row) return null;
        const rawCandidates = [
            row.rawClose,
            row.raw_close,
            row.baseClose,
            row.base_close,
        ]
            .map((candidate) => (candidate !== null && candidate !== undefined ? Number(candidate) : null))
            .filter((candidate) => Number.isFinite(candidate));
        if (rawCandidates.length > 0) {
            return rawCandidates[0];
        }
        if (!Number.isFinite(row.close)) return null;
        const factor = Number(row.adjustedFactor);
        if (!Number.isFinite(factor) || Math.abs(factor) < 1e-8) {
            return Number(row.close);
        }
        const raw = Number(row.close) / factor;
        return Number.isFinite(raw) ? raw : Number(row.close);
    };
    const rowsHtml = visibleStockData
        .map((row, rowIndex) => {
            const volumeLabel = Number.isFinite(row?.volume)
                ? Number(row.volume).toLocaleString('zh-TW')
                : '—';
            const factor = Number(row?.adjustedFactor);
            const closeValue = Number(row?.close);
            const rawCloseValue = computeRawClose(row);
            const rawCloseText = formatNumber(rawCloseValue);
            const closeText = formatNumber(closeValue);
            const factorText = formatFactor(factor);
            const hasFactor = Number.isFinite(factor) && Math.abs(factor) > 0;
            let formulaText = '—';
            if (closeText !== '—') {
                if (hasFactor && rawCloseText !== '—' && factorText !== '—') {
                    formulaText = `${rawCloseText} × ${factorText} = ${closeText}`;
                } else {
                    formulaText = `${closeText}（未調整）`;
                }
            }
            const rowSource =
                typeof row?.priceSource === 'string' && row.priceSource.trim().length > 0
                    ? row.priceSource.trim()
                    : sourceLabel || '—';
            const indicatorCells = indicatorColumns
                .map((col) =>
                    `<td class="px-3 py-2 text-left" style="color: var(--muted-foreground);">${renderIndicatorCell(col.series, rowIndex)}</td>`
                )
                .join('');
            const positionLabel = lastPositionStates[rowIndex] || '空手';
            return `
                <tr>
                    <td class="px-3 py-2 whitespace-nowrap" style="color: var(--foreground);">${row?.date || ''}</td>
                    <td class="px-3 py-2 text-right" style="color: var(--foreground);">${formatNumber(row?.open)}</td>
                    <td class="px-3 py-2 text-right" style="color: var(--foreground);">${formatNumber(row?.high)}</td>
                    <td class="px-3 py-2 text-right" style="color: var(--foreground);">${formatNumber(row?.low)}</td>
                    <td class="px-3 py-2 text-right" style="color: var(--foreground);">${rawCloseText}</td>
                    <td class="px-3 py-2 text-right font-medium" style="color: var(--foreground);">${closeText}</td>
                    <td class="px-3 py-2 text-right" style="color: var(--muted-foreground);">${factorText}</td>
                    ${indicatorCells}
                    <td class="px-3 py-2 text-left" style="color: var(--foreground);">${escapeHtml(positionLabel)}</td>
                    <td class="px-3 py-2 text-left" style="color: var(--muted-foreground);">${escapeHtml(formulaText)}</td>
                    <td class="px-3 py-2 text-right" style="color: var(--muted-foreground);">${volumeLabel}</td>
                    <td class="px-3 py-2 text-left" style="color: var(--muted-foreground);">${escapeHtml(rowSource)}</td>
                </tr>`;
        })
        .join('');

    tbody.innerHTML =
        rowsHtml ||
        `<tr><td class="px-3 py-4 text-center" colspan="${totalColumns}" style="color: var(--muted-foreground);">無資料</td></tr>`;

    const scroller = modal.querySelector('.overflow-auto');
    if (scroller) scroller.scrollTop = 0;

    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
}

function closePriceInspectorModal() {
    const modal = document.getElementById('priceInspectorModal');
    if (!modal) return;
    modal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
}

document.addEventListener('DOMContentLoaded', () => {
    const openBtn = document.getElementById('openPriceInspector');
    const closeBtn = document.getElementById('closePriceInspector');
    const modal = document.getElementById('priceInspectorModal');

    openBtn?.addEventListener('click', openPriceInspectorModal);
    closeBtn?.addEventListener('click', closePriceInspectorModal);
    modal?.addEventListener('click', (event) => {
        if (event.target === modal) {
            closePriceInspectorModal();
        }
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closePriceInspectorModal();
        }
    });

    refreshPriceInspectorControls();
});

document.addEventListener('DOMContentLoaded', initDataDiagnosticsPanel);

function handleBacktestResult(result, stockName, dataSource) {
    console.log("[Main] Executing latest version of handleBacktestResult (v2).");
    const suggestionArea = document.getElementById('today-suggestion-area');
    if(!result||!result.dates||result.dates.length===0){
        showError("回測結果無效或無數據");
        lastOverallResult = null; lastSubPeriodResults = null;
         if (suggestionArea) suggestionArea.classList.add('hidden');
         hideLoading();
        return;
    }
    try {
        lastOverallResult = result;
        lastSubPeriodResults = result.subPeriodResults;
        lastIndicatorSeries = result.priceIndicatorSeries || null;
        lastPositionStates = Array.isArray(result.positionStates) ? result.positionStates : [];

        updateDataSourceDisplay(dataSource, stockName);
        displayBacktestResult(result);
        displayTradeResults(result);
        renderChart(result);
        activateTab('summary');

        setTimeout(() => {
            const chartContainer = document.getElementById('chart-container');
            if (chartContainer) {
                chartContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 500);

    } catch (error) {
         console.error("[Main] Error processing backtest result:", error);
         showError(`處理回測結果時發生錯誤: ${error.message}`);
         if (suggestionArea) suggestionArea.classList.add('hidden');
         hideLoading();
         if(backtestWorker) backtestWorker.terminate(); backtestWorker = null;
    }
}
function displayBacktestResult(result) { 
    console.log("[Main] displayBacktestResult called."); 
    const el = document.getElementById("backtest-result");
    if (!el) {
        console.error("[Main] Element 'backtest-result' not found");
        return;
    }
    
    if (!result) { 
        el.innerHTML = `<p class="text-gray-500">無效結果</p>`; 
        return; 
    } 
    const entryKey = result.entryStrategy; const exitKeyRaw = result.exitStrategy; const exitInternalKey = (['ma_cross','macd_cross','k_d_cross','ema_cross'].includes(exitKeyRaw)) ? `${exitKeyRaw}_exit` : exitKeyRaw; const entryDesc = strategyDescriptions[entryKey] || { name: result.entryStrategy || 'N/A', desc: 'N/A' }; const exitDesc = strategyDescriptions[exitInternalKey] || { name: result.exitStrategy || 'N/A', desc: 'N/A' }; let shortEntryDesc = null, shortExitDesc = null; if (result.enableShorting && result.shortEntryStrategy && result.shortExitStrategy) { shortEntryDesc = strategyDescriptions[result.shortEntryStrategy] || { name: result.shortEntryStrategy, desc: 'N/A' }; shortExitDesc = strategyDescriptions[result.shortExitStrategy] || { name: result.shortExitStrategy, desc: 'N/A' }; } const avgP = result.completedTrades?.length > 0 ? result.completedTrades.reduce((s, t) => s + (t.profit||0), 0) / result.completedTrades.length : 0; const maxCL = result.maxConsecutiveLosses || 0; const bhR = parseFloat(result.buyHoldReturns?.[result.buyHoldReturns.length - 1] ?? 0); const bhAnnR = result.buyHoldAnnualizedReturn ?? 0; const sharpe = result.sharpeRatio?.toFixed(2) ?? 'N/A'; const sortino = result.sortinoRatio ? (isFinite(result.sortinoRatio) ? result.sortinoRatio.toFixed(2) : '∞') : 'N/A'; const maxDD = result.maxDrawdown?.toFixed(2) ?? 0; const totalTrades = result.tradesCount ?? 0; const winTrades = result.winTrades ?? 0; const winR = totalTrades > 0 ? (winTrades / totalTrades * 100).toFixed(1) : 0; const totalProfit = result.totalProfit ?? 0; const returnRate = result.returnRate ?? 0; const annualizedReturn = result.annualizedReturn ?? 0; const finalValue = result.finalValue ?? result.initialCapital; let annReturnRatioStr = 'N/A'; let sharpeRatioStr = 'N/A'; if (result.annReturnHalf1 !== null && result.annReturnHalf2 !== null && result.annReturnHalf1 !== 0) { annReturnRatioStr = (result.annReturnHalf2 / result.annReturnHalf1).toFixed(2); } if (result.sharpeHalf1 !== null && result.sharpeHalf2 !== null && result.sharpeHalf1 !== 0) { sharpeRatioStr = (result.sharpeHalf2 / result.sharpeHalf1).toFixed(2); } const overfittingTooltip = "將回測期間前後對半分，計算兩段各自的總報酬率與夏普值，再計算其比值 (後段/前段)。比值接近 1 較佳，代表策略績效在不同時期較穩定。一般認為 > 0.5 可接受。"; let performanceHtml = `
        <div class="mb-8">
            <h4 class="text-lg font-semibold mb-6" style="color: var(--foreground);">績效指標</h4>
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: linear-gradient(135deg, color-mix(in srgb, var(--primary) 8%, var(--background)) 0%, color-mix(in srgb, var(--primary) 4%, var(--background)) 100%); border-color: color-mix(in srgb, var(--primary) 25%, transparent);">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm font-medium" style="color: var(--primary);">年化報酬率</p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                <span class="tooltiptext">將總報酬率根據實際回測期間（從第一個有效數據點到最後一個數據點）轉換為年平均複利報酬率。<br>公式：((最終價值 / 初始本金)^(1 / 年數) - 1) * 100%<br>注意：此數值對回測時間長度敏感，短期高報酬可能導致極高的年化報酬率。</span>
                            </span>
                        </div>
                        <p class="text-2xl font-bold ${annualizedReturn>=0?'text-emerald-600':'text-rose-600'}">${annualizedReturn>=0?'+':''}${annualizedReturn.toFixed(2)}%</p>
                    </div>
                </div>                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: color-mix(in srgb, var(--muted) 15%, var(--background)); border-color: color-mix(in srgb, var(--border) 80%, transparent);">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm font-medium" style="color: var(--muted-foreground);">買入持有年化</p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                <span class="tooltiptext">在相同實際回測期間內，單純買入並持有該股票的年化報酬率。公式同上，但使用股價計算。</span>
                            </span>
                        </div>
                        <p class="text-2xl font-bold ${bhAnnR>=0?'text-emerald-600':'text-rose-600'}">${bhAnnR>=0?'+':''}${bhAnnR.toFixed(2)}%</p>
                    </div>
                </div>                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: linear-gradient(135deg, color-mix(in srgb, #10b981 8%, var(--background)) 0%, color-mix(in srgb, #10b981 4%, var(--background)) 100%); border-color: color-mix(in srgb, #10b981 25%, transparent);">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm font-medium text-emerald-600">總報酬率</p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                <span class="tooltiptext">策略最終總資產相對於初始本金的報酬率。<br>公式：(最終價值 - 初始本金) / 初始本金 * 100%<br>此為線性報酬率，不考慮時間因素。</span>
                            </span>
                        </div>
                        <p class="text-2xl font-bold ${returnRate>=0?'text-emerald-600':'text-rose-600'}">${returnRate>=0?'+':''}${returnRate.toFixed(2)}%</p>
                    </div>
                </div>
                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 8%, var(--background)) 0%, color-mix(in srgb, var(--accent) 4%, var(--background)) 100%); border-color: color-mix(in srgb, var(--accent) 25%, transparent);">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm font-medium" style="color: var(--accent);">Buy & Hold</p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                <span class="tooltiptext">買入持有總報酬率</span>
                            </span>
                        </div>
                        <p class="text-2xl font-bold ${bhR>=0?'text-emerald-600':'text-rose-600'}">${bhR>=0?'+':''}${bhR.toFixed(2)}%</p>
                    </div>
                </div>
            </div>
        </div>`;
    let riskHtml = `
        <div class="mb-8">
            <h4 class="text-lg font-semibold mb-6" style="color: var(--foreground);">風險指標</h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: linear-gradient(135deg, color-mix(in srgb, #ef4444 8%, var(--background)) 0%, color-mix(in srgb, #ef4444 4%, var(--background)) 100%); border-color: color-mix(in srgb, #ef4444 25%, transparent);">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm font-medium text-rose-600">最大回撤</p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                <span class="tooltiptext">策略**總資金**曲線從歷史最高點回落到最低點的最大百分比跌幅。公式：(峰值 - 谷值) / 峰值 * 100%</span>
                            </span>
                        </div>
                        <p class="text-2xl font-bold text-rose-600">${maxDD}%</p>
                    </div>
                </div>                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: linear-gradient(135deg, color-mix(in srgb, var(--primary) 8%, var(--background)) 0%, color-mix(in srgb, var(--primary) 4%, var(--background)) 100%); border-color: color-mix(in srgb, var(--primary) 25%, transparent);">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm font-medium" style="color: var(--primary);">夏普值</p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                <span class="tooltiptext">衡量每單位總風險(標準差)所獲得的超額報酬。通常 > 1 表示不錯，> 2 相當好，> 3 非常優秀 (相對於無風險利率)。</span>
                            </span>
                        </div>
                        <p class="text-2xl font-bold" style="color: var(--primary);">${sharpe}</p>
                    </div>
                </div>                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background:  color-mix(in srgb, var(--muted) 12%, var(--background)); border-color: color-mix(in srgb, var(--border) 60%, transparent);">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm font-medium" style="color: var(--muted-foreground);">索提諾比率</p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                <span class="tooltiptext">衡量每單位 '下檔風險' 所獲得的超額報酬 (只考慮虧損的波動)。越高越好，通常用於比較不同策略承受虧損風險的能力。</span>
                            </span>
                        </div>
                        <p class="text-2xl font-bold" style="color: var(--muted-foreground);">${sortino}</p>
                    </div>
                </div>                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 8%, var(--background)) 0%, color-mix(in srgb, var(--accent) 4%, var(--background)) 100%); border-color: color-mix(in srgb, var(--accent) 25%, transparent);">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm font-medium" style="color: var(--accent);">過擬合(報酬率比)</p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                <span class="tooltiptext">${overfittingTooltip}</span>
                            </span>
                        </div>
                        <p class="text-2xl font-bold" style="color: var(--accent);">${annReturnRatioStr}</p>
                    </div>
                </div>
                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: color-mix(in srgb, var(--secondary) 6%, var(--background)); border-color: color-mix(in srgb, var(--secondary) 20%, transparent);">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm font-medium" style="color: var(--secondary);">過擬合(夏普值比)</p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                <span class="tooltiptext">${overfittingTooltip}</span>
                            </span>
                        </div>
                        <p class="text-2xl font-bold" style="color: var(--secondary);">${sharpeRatioStr}</p>
                    </div>
                </div>
            </div>
        </div>`;
    let tradeStatsHtml = `
        <div class="mb-8">
            <h4 class="text-lg font-semibold mb-6" style="color: var(--foreground);">交易統計</h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: color-mix(in srgb, var(--muted) 12%, var(--background)); border-color: color-mix(in srgb, var(--border) 60%, transparent);">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm font-medium" style="color: var(--muted-foreground);">勝率</p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                <span class="tooltiptext">包含做多與做空交易</span>
                            </span>
                        </div>
                        <p class="text-2xl font-bold" style="color: var(--foreground);">${winR}%</p>
                        <p class="text-sm mt-1" style="color: var(--muted-foreground);">(${winTrades}/${totalTrades})</p>
                    </div>
                </div>                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: color-mix(in srgb, var(--muted) 12%, var(--background)); border-color: color-mix(in srgb, var(--border) 60%, transparent);">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm font-medium" style="color: var(--muted-foreground);">總交易次數</p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                <span class="tooltiptext">包含做多與做空交易</span>
                            </span>
                        </div>
                        <p class="text-2xl font-bold" style="color: var(--foreground);">${totalTrades}</p>
                        <p class="text-sm mt-1" style="color: var(--muted-foreground);">次</p>
                    </div>
                </div>                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: color-mix(in srgb, var(--muted) 12%, var(--background)); border-color: color-mix(in srgb, var(--border) 60%, transparent);">
                    <div class="text-center">
                        <p class="text-sm font-medium mb-3" style="color: var(--muted-foreground);">平均交易盈虧</p>
                        <p class="text-2xl font-bold ${avgP>=0?'text-emerald-600':'text-rose-600'}">${avgP>=0?'+':''}${Math.round(avgP).toLocaleString()}</p>
                        <p class="text-sm mt-1" style="color: var(--muted-foreground);">元</p>
                    </div>
                </div>                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: color-mix(in srgb, var(--muted) 12%, var(--background)); border-color: color-mix(in srgb, var(--border) 60%, transparent);">
                    <div class="text-center">
                        <p class="text-sm font-medium mb-3" style="color: var(--muted-foreground);">最大連虧次數</p>
                        <p class="text-2xl font-bold" style="color: var(--foreground);">${maxCL}</p>
                        <p class="text-sm mt-1" style="color: var(--muted-foreground);">次</p>
                    </div>
                </div>
            </div>
        </div>`;
    let strategySettingsHtml = `
        <div>
            <h4 class="text-lg font-semibold mb-6" style="color: var(--foreground);">策略設定</h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: linear-gradient(135deg, color-mix(in srgb, #10b981 8%, var(--background)) 0%, color-mix(in srgb, #10b981 4%, var(--background)) 100%); border-color: color-mix(in srgb, #10b981 25%, transparent);">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm font-medium text-emerald-600">📈 進場策略</p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                <span class="tooltiptext">${entryDesc.desc.replace(/\n/g,'<br>')}</span>
                            </span>
                        </div>
                        <p class="text-base font-semibold" style="color: var(--foreground);">${entryDesc.name}</p>
                    </div>
                </div>                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: linear-gradient(135deg, color-mix(in srgb, #ef4444 8%, var(--background)) 0%, color-mix(in srgb, #ef4444 4%, var(--background)) 100%); border-color: color-mix(in srgb, #ef4444 25%, transparent);">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm font-medium text-rose-600">📉 出場策略</p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                <span class="tooltiptext">${exitDesc.desc.replace(/\n/g,'<br>')}</span>
                            </span>
                        </div>
                        <p class="text-base font-semibold" style="color: var(--foreground);">${exitDesc.name}</p>
                    </div>
                </div> ${ result.enableShorting && shortEntryDesc && shortExitDesc ? `                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 8%, var(--background)) 0%, color-mix(in srgb, var(--accent) 4%, var(--background)) 100%); border-color: color-mix(in srgb, var(--accent) 25%, transparent);">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm font-medium" style="color: var(--accent);">📉 做空策略</p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                <span class="tooltiptext">${shortEntryDesc.desc.replace(/\n/g,'<br>')}</span>
                            </span>
                        </div>
                        <p class="text-base font-semibold" style="color: var(--foreground);">${shortEntryDesc.name}</p>
                    </div>
                </div>
                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: linear-gradient(135deg, color-mix(in srgb, var(--primary) 8%, var(--background)) 0%, color-mix(in srgb, var(--primary) 4%, var(--background)) 100%); border-color: color-mix(in srgb, var(--primary) 25%, transparent);">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm font-medium" style="color: var(--primary);">📈 回補策略</p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                <span class="tooltiptext">${shortExitDesc.desc.replace(/\n/g,'<br>')}</span>
                            </span>
                        </div>
                        <p class="text-base font-semibold" style="color: var(--foreground);">${shortExitDesc.name}</p>
                    </div>
                </div>` : `                <div class="p-6 rounded-xl border shadow-sm" style="background: color-mix(in srgb, var(--muted) 15%, var(--background)); border-color: color-mix(in srgb, var(--border) 80%, transparent);">
                    <div class="text-center">
                        <p class="text-sm font-medium" style="color: var(--muted-foreground);">📉 做空策略未啟用</p>
                    </div>
                </div>
                <div class="bg-gray-100 p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div class="text-center">
                        <p class="text-sm text-gray-500 font-medium">📈 回補策略未啟用</p>
                    </div>
                </div> `}                <div class="bg-orange-50 p-6 rounded-xl border border-orange-200 shadow-sm">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm text-orange-600 font-medium">⚠️ 全局風控</p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs bg-blue-600 text-white rounded-full cursor-help">?</span>
                                <span class="tooltiptext">停損/停利設定 (多空共用)</span>
                            </span>
                        </div>
                        <p class="text-base font-semibold text-gray-800">損:${result.stopLoss>0?result.stopLoss+'%':'N/A'} / 利:${result.takeProfit>0?result.takeProfit+'%':'N/A'}</p>
                    </div>
                </div>
                <div class="bg-indigo-50 p-6 rounded-xl border border-indigo-200 shadow-sm">
                    <div class="text-center">
                        <p class="text-sm text-indigo-600 font-medium mb-3">⏰ 買賣時間點</p>
                        <p class="text-base font-semibold text-gray-800">${result.tradeTiming==='open'?'隔日開盤':'當日收盤'}</p>
                    </div>
                </div>
                <div class="bg-blue-50 p-6 rounded-xl border border-blue-200 shadow-sm">
                    <div class="text-center">
                        <p class="text-sm text-blue-600 font-medium mb-3">💰 初始本金</p>
                        <p class="text-base font-semibold text-gray-800">${result.initialCapital.toLocaleString()}元</p>
                    </div>
                </div>
                <div class="bg-yellow-50 p-6 rounded-xl border border-yellow-200 shadow-sm">
                    <div class="text-center">
                        <p class="text-sm text-yellow-600 font-medium mb-3">🏆 最終資產</p>
                        <p class="text-base font-semibold text-gray-800">${Math.round(finalValue).toLocaleString()}元</p>
                    </div>
                </div> </div> </div>`;

        // 將四個區塊垂直排列，並添加適當的間距
        el.innerHTML = `
            <div class="space-y-8">
                ${performanceHtml}
                ${riskHtml}
                ${tradeStatsHtml}
                ${strategySettingsHtml}
            </div>
        `;
        
        console.log("[Main] displayBacktestResult finished."); 
    }
const checkDisplay = (v) => v !== null && v !== undefined && !isNaN(v); 

const formatIndicatorValues = (indicatorValues) => { 
    try { 
        if (!indicatorValues || typeof indicatorValues !== 'object' || Object.keys(indicatorValues).length === 0) return ''; 
        const formatV = (v) => checkDisplay(v) ? v.toFixed(2) : '--'; 
        const parts = Object.entries(indicatorValues).map(([label, values]) => { 
            if (Array.isArray(values) && values.length === 3) { 
                return `<span class="mr-2 whitespace-nowrap text-xs" style="color: var(--muted-foreground);">${label}: ${formatV(values[0])} / ${formatV(values[1])} / ${formatV(values[2])}</span>`; 
            } else if (checkDisplay(values)) { 
                return `<span class="mr-2 whitespace-nowrap text-xs" style="color: var(--muted-foreground);">${label}: ${formatV(values)}</span>`; 
            } else if (Array.isArray(values) && values.length === 2){ 
                return `<span class="mr-2 whitespace-nowrap text-xs" style="color: var(--muted-foreground);">${label}: ${formatV(values[0])} / ${formatV(values[1])}</span>`; 
            } 
            return `<span class="mr-2 whitespace-nowrap text-xs" style="color: var(--muted-foreground);">${label}: ?</span>`; 
        }).filter(part => part !== null); 
        return parts.length > 0 ? '<div class="mt-1 text-xs" style="color: var(--muted-foreground);">(' + parts.join(' ') + ')</div>' : ''; 
    } catch (e) { 
        console.error("[Main] Error in formatIndicatorValues:", e, indicatorValues); 
        return '<div class="mt-1 text-xs" style="color: #dc2626;">(指標值格式錯誤)</div>'; 
    } 
}; 

const formatKDParams = (kdVals) => { 
    try { 
        if (!kdVals || typeof kdVals !== 'object') { 
            console.warn("[Main] Invalid kdValues passed to formatKDParams:", kdVals); 
            return ''; 
        } 
        const formatV = (v) => checkDisplay(v) ? v.toFixed(2) : '--'; 
        const kPrev = kdVals?.kPrev; 
        const dPrev = kdVals?.dPrev; 
        const kNow = kdVals?.kNow; 
        const dNow = kdVals?.dNow; 
        const kNext = kdVals?.kNext; 
        const dNext = kdVals?.dNext; 
        return `<div class="mt-1 text-xs" style="color: var(--muted-foreground);">(K/D 前:${formatV(kPrev)}/${formatV(dPrev)}, 當:${formatV(kNow)}/${formatV(dNow)}, 次:${formatV(kNext)}/${formatV(dNext)})</div>`; 
    } catch (e) { 
        console.error("[Main] Error in formatKDParams:", e, kdVals); 
        return '<div class="mt-1 text-xs" style="color: #dc2626;">(KD值格式錯誤)</div>'; 
    } 
}; 

const formatMACDParams = (macdValues) => { 
    try { 
        if (!macdValues || typeof macdValues !== 'object') { 
            console.warn("[Main] Invalid macdValues passed to formatMACDParams:", macdValues); 
            return ''; 
        } 
        const formatV = (v) => checkDisplay(v) ? v.toFixed(2) : '--'; 
        const difPrev = macdValues?.difPrev; 
        const deaPrev = macdValues?.deaPrev; 
        const difNow = macdValues?.difNow; 
        const deaNow = macdValues?.deaNow; 
        const difNext = macdValues?.difNext; 
        const deaNext = macdValues?.deaNext; 
        return `<div class="mt-1 text-xs" style="color: var(--muted-foreground);">(DIF/DEA 前:${formatV(difPrev)}/${formatV(deaPrev)}, 當:${formatV(difNow)}/${formatV(deaNow)}, 次:${formatV(difNext)}/${formatV(deaNext)})</div>`; 
    } catch (e) { 
        console.error("[Main] Error in formatMACDParams:", e, macdValues); 
        return '<div class="mt-1 text-xs" style="color: #dc2626;">(MACD值格式錯誤)</div>'; 
    } 
};
function displayTradeResults(result) { 
    console.log("[Main] displayTradeResults called"); 
    const tradeResultsEl = document.getElementById("trade-results");
    
    if (!tradeResultsEl) {
        console.error("[Main] Element 'trade-results' not found");
        return;
    }
    
    const tradeTiming = result?.tradeTiming;
    
    // 提示區域已被移除，無需更新
    
    // 檢查數據有效性
    if (!result || !result.completedTrades || !Array.isArray(result.completedTrades)) { 
        tradeResultsEl.innerHTML = `<p class="text-xs text-muted-foreground text-center py-8" style="color: var(--muted-foreground);">交易記錄數據無效或缺失</p>`; 
        console.error("[Main] Invalid completedTrades data:", result); 
        return; 
    }
    
    // 沒有交易記錄
    if (result.completedTrades.length === 0) { 
        tradeResultsEl.innerHTML = `<p class="text-xs text-muted-foreground text-center py-8" style="color: var(--muted-foreground);">沒有交易記錄</p>`; 
        return; 
    }
    
    try { 
        let tradeHtml = result.completedTrades.map((tradePair, index) => { 
            if (!tradePair || !tradePair.entry || !tradePair.exit || !tradePair.entry.type || !tradePair.exit.type) { 
                console.warn(`[Main] Invalid trade pair structure at index ${index}:`, tradePair); 
                return `<div class="trade-signal p-3 border-b last:border-b-0" style="border-color: var(--border);"><p class="text-xs text-red-600">錯誤：此筆交易對數據結構不完整 (Index: ${index})</p></div>`; 
            }
            
            try { 
                const entryTrade = tradePair.entry; 
                const exitTrade = tradePair.exit; 
                const profit = tradePair.profit; 
                const profitPercent = tradePair.profitPercent; 
                const isShortTrade = entryTrade.type === 'short'; 
                
                let entryParamsDisplay = ''; 
                try { 
                    if (entryTrade?.kdValues) entryParamsDisplay = formatKDParams(entryTrade.kdValues); 
                    else if (entryTrade?.macdValues) entryParamsDisplay = formatMACDParams(entryTrade.macdValues); 
                    else if (entryTrade?.indicatorValues) entryParamsDisplay = formatIndicatorValues(entryTrade.indicatorValues); 
                } catch (entryFormatError) { 
                    console.error(`[Main] Error formatting entry display for trade index ${index}:`, entryFormatError, entryTrade); 
                    entryParamsDisplay = '<span class="block text-xs text-red-500 mt-1">(進場信息格式錯誤)</span>'; 
                }
                
                let exitParamsDisplay = ''; 
                const sl = exitTrade?.triggeredByStopLoss || false; 
                const tp = exitTrade?.triggeredByTakeProfit || false; 
                let trigger = ''; 
                if(sl) trigger='<span class="ml-2 text-xs font-medium px-2 py-0.5 rounded" style="background-color: #fee2e2; color: #dc2626;">🛑停損</span>'; 
                else if(tp) trigger='<span class="ml-2 text-xs font-medium px-2 py-0.5 rounded" style="background-color: #dcfce7; color: #16a34a;">✅停利</span>'; 
                
                try { 
                    if (exitTrade?.kdValues) exitParamsDisplay = formatKDParams(exitTrade.kdValues); 
                    else if (exitTrade?.macdValues) exitParamsDisplay = formatMACDParams(exitTrade.macdValues); 
                    else if (exitTrade?.indicatorValues) exitParamsDisplay = formatIndicatorValues(exitTrade.indicatorValues); 
                } catch (exitFormatError) { 
                    console.error(`[Main] Error formatting exit display for trade index ${index}:`, exitFormatError, exitTrade); 
                    exitParamsDisplay = '<span class="block text-xs text-red-500 mt-1">(出場信息格式錯誤)</span>'; 
                }
                
                const entryDate = entryTrade.date || 'N/A'; 
                const entryPrice = typeof entryTrade.price === 'number' ? entryTrade.price.toFixed(2) : 'N/A'; 
                const entryShares = entryTrade.shares || 'N/A'; 
                const entryActionText = isShortTrade ? '做空' : '買入'; 
                const entryActionClass = isShortTrade ? 'short-signal' : 'buy-signal'; 
                const entryActionStyle = isShortTrade ? 'background-color: #fef3c7; color: #d97706;' : 'background-color: #fee2e2; color: #dc2626;';
                
                const exitDate = exitTrade.date || 'N/A'; 
                const exitPrice = typeof exitTrade.price === 'number' ? exitTrade.price.toFixed(2) : 'N/A'; 
                const exitActionText = isShortTrade ? '回補' : '賣出'; 
                const exitActionClass = isShortTrade ? 'cover-signal' : 'sell-signal'; 
                const exitActionStyle = isShortTrade ? 'background-color: #e0e7ff; color: #7c3aed;' : 'background-color: #dcfce7; color: #16a34a;';
                
                const profitValue = typeof profit === 'number' ? Math.round(profit) : 'N/A'; 
                const profitColor = typeof profit === 'number' ? (profit >= 0 ? '#16a34a' : '#dc2626') : 'var(--foreground)'; 
                const profitSign = typeof profit === 'number' ? (profit >= 0 ? '+' : '') : ''; 
                
                return `
                    <div class="trade-signal py-3 px-4 border-b last:border-b-0 hover:bg-opacity-50 transition duration-150" 
                         style="border-color: var(--border); background-color: var(--background);"
                         onmouseover="this.style.backgroundColor='var(--muted)'" 
                         onmouseout="this.style.backgroundColor='var(--background)'">
                        
                        <div class="mb-2">
                            <div class="flex justify-between items-center flex-wrap gap-2">
                                <div class="flex items-center gap-2">
                                    <span class="text-xs" style="color: var(--muted-foreground);">${entryDate}</span>
                                    <span class="trade-action text-xs font-medium px-2 py-1 rounded ${entryActionClass}" style="${entryActionStyle}">${entryActionText}</span>
                                    <span class="text-sm font-semibold" style="color: var(--foreground);">${entryPrice}</span>
                                    <span class="text-xs" style="color: var(--muted-foreground);">${entryShares} 股</span>
                                </div>
                            </div>
                            ${entryParamsDisplay}
                        </div>
                        
                        <div>
                            <div class="flex justify-between items-center flex-wrap gap-2">
                                <div class="flex items-center gap-2">
                                    <span class="text-xs" style="color: var(--muted-foreground);">${exitDate}</span>
                                    <span class="trade-action text-xs font-medium px-2 py-1 rounded ${exitActionClass}" style="${exitActionStyle}">${exitActionText}</span>
                                    <span class="text-sm font-semibold" style="color: var(--foreground);">${exitPrice}</span>
                                </div>
                                <div class="flex items-center">
                                    <span class="text-sm font-bold" style="color: ${profitColor};">${profitSign}${profitValue}元</span>
                                    ${trigger}
                                </div>
                            </div>
                            ${exitParamsDisplay}
                        </div>
                    </div>
                `; 
            } catch (mapError) { 
                console.error(`[Main] Error formatting trade pair at index ${index}:`, mapError); 
                console.error("[Main] Problematic trade pair object:", tradePair); 
                return `<div class="trade-signal p-3 border-b" style="border-color: var(--border);"><p class="text-xs text-red-600">錯誤：格式化此筆交易對時出錯 (Index: ${index})</p></div>`; 
            } 
        }).join(''); 
        
        tradeResultsEl.innerHTML = `<div class="trade-list rounded-md max-h-80 overflow-y-auto" style="border: 1px solid var(--border);">${tradeHtml}</div>`; 
    } catch (error) { 
        console.error("[Main] Error rendering trade results list:", error); 
        tradeResultsEl.innerHTML = `<p class="text-xs text-red-600 text-center py-8">顯示交易記錄列表時發生錯誤。</p>`; 
        showError("顯示交易記錄時出錯，請檢查控制台。"); 
    } 
}
function renderChart(result) {
    const chartContainer = document.getElementById('chart-container');
    if (!chartContainer) {
        console.error("[Main] Chart container not found");
        return;
    }
    
    if (!result || !result.dates || result.dates.length === 0) {
        chartContainer.innerHTML = `<div class="text-center text-muted py-8" style="color: var(--muted-foreground);"><i data-lucide="bar-chart-3" class="lucide w-12 h-12 mx-auto mb-2 opacity-50"></i><p>無法渲染圖表：數據不足。</p></div>`;
        // Re-initialize Lucide icons
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
        }
        return;
    }
    
    // Clear the container and add canvas
    chartContainer.innerHTML = '<canvas id="chart" class="w-full h-full absolute inset-0"></canvas>';
    const chartElement = document.getElementById('chart');
    if (!chartElement) {
        console.error("[Main] Failed to create chart canvas element");
        return;
    }
    const ctx = chartElement.getContext('2d');
    
    if (stockChart) {
        stockChart.destroy();
        stockChart = null;
    }
    
    const dates = result.dates;
    const check = (v) => v !== null && !isNaN(v) && isFinite(v);
    const validReturns = result.strategyReturns.map((v, i) => ({ index: i, value: check(v) ? parseFloat(v) : null })).filter(item => item.value !== null);
    
    if (validReturns.length === 0) {
        console.warn("[Main] No valid strategy return data points to render chart.");
        return;
    }
    
    const firstValidReturnIndex = validReturns[0].index;
    const lastValidReturnIndex = validReturns[validReturns.length - 1].index;
    
    const filterSignals = (signals) => {
        return (signals || []).filter(s => s.index >= firstValidReturnIndex && s.index <= lastValidReturnIndex && check(result.strategyReturns[s.index])).map(s => ({ x: dates[s.index], y: result.strategyReturns[s.index] }));
    };
    
    const buySigs = filterSignals(result.chartBuySignals);
    const sellSigs = filterSignals(result.chartSellSignals);
    const shortSigs = filterSignals(result.chartShortSignals);
    const coverSigs = filterSignals(result.chartCoverSignals);
    const stratData = result.strategyReturns.map(v => check(v) ? parseFloat(v) : null);
    const bhData = result.buyHoldReturns.map(v => check(v) ? parseFloat(v) : null);
    
    const datasets = [
        { label: '買入並持有 %', data: bhData, borderColor: '#6b7280', borderWidth: 1.5, tension: 0.1, pointRadius: 0, yAxisID: 'y', spanGaps: true },
        { label: '策略 %', data: stratData, borderColor: '#3b82f6', borderWidth: 2, tension: 0.1, pointRadius: 0, yAxisID: 'y', spanGaps: true }
    ];
    
    if (buySigs.length > 0) {
        datasets.push({ type:'scatter', label:'買入', data:buySigs, backgroundColor:'#ef4444', radius:6, pointStyle:'triangle', rotation:0, yAxisID:'y' });
    }
    if (sellSigs.length > 0) {
        datasets.push({ type:'scatter', label:'賣出', data:sellSigs, backgroundColor:'#22c55e', radius:6, pointStyle:'triangle', rotation:180, yAxisID:'y' });
    }
    if (result.enableShorting) {
        if (shortSigs.length > 0) {
            datasets.push({ type:'scatter', label:'做空', data:shortSigs, backgroundColor:'#f59e0b', radius:7, pointStyle:'rectRot', yAxisID:'y' });
        }
        if (coverSigs.length > 0) {
            datasets.push({ type:'scatter', label:'回補', data:coverSigs, backgroundColor:'#8b5cf6', radius:7, pointStyle:'rect', yAxisID:'y' });
        }
    }
    
    // 確保插件已註冊
    console.log('Creating chart with plugins:', Chart.registry.plugins.items);
    
    stockChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            onHover: (event, activeElements) => {
                event.native.target.style.cursor = activeElements.length > 0 ? 'pointer' : 'grab';
            },
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: { usePointStyle: true }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                },
                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'x'
                    },
                    zoom: {
                        wheel: {
                            enabled: true
                        },
                        pinch: {
                            enabled: true
                        },
                        mode: 'x'
                    }
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: '收益率 (%)'
                    },
                    ticks: {
                        callback: v => v + '%'
                    },
                    grid: {
                        color: '#e5e7eb'
                    }
                },
                x: {
                    type: 'category',
                    grid: {
                        display: false
                    },
                    ticks: {
                        autoSkip: true,
                        maxTicksLimit: 15,
                        maxRotation: 40,
                        minRotation: 0
                    }
                }
            }
        }
    });
    
    // 自定義拖曳事件處理，支援左鍵和右鍵
    const canvas = stockChart.canvas;
    let isPanning = false;
    let lastX = 0;
    
    canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0 || e.button === 2) { // 左鍵或右鍵
            isPanning = true;
            lastX = e.clientX;
            canvas.style.cursor = 'grabbing';
            e.preventDefault();
        }
    });
    
    canvas.addEventListener('mousemove', (e) => {
        if (isPanning) {
            const deltaX = e.clientX - lastX;
            const scale = stockChart.scales.x;
            const canvasPosition = Chart.helpers.getRelativePosition(e, stockChart);
            const dataX = scale.getValueForPixel(canvasPosition.x);
            
            // 計算平移量
            const range = scale.max - scale.min;
            const panAmount = (deltaX / canvas.width) * range;
            
            // 更新縮放
            stockChart.zoomScale('x', {min: scale.min - panAmount, max: scale.max - panAmount}, 'none');
            
            lastX = e.clientX;
            e.preventDefault();
        }
    });
    
    canvas.addEventListener('mouseup', (e) => {
        isPanning = false;
        canvas.style.cursor = 'grab';
    });
    
    canvas.addEventListener('mouseleave', (e) => {
        isPanning = false;
        canvas.style.cursor = 'default';
    });
    
    // 禁用右鍵選單
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
}
// 優化專用進度顯示函數
function showOptimizationProgress(message) {
    console.log('[Main] showOptimizationProgress 被調用:', message);
    const progressSection = document.getElementById('optimization-progress-section');
    const statusText = document.getElementById('optimization-status-text');
    const progressBar = document.getElementById('optimization-progress-bar');
    const progressText = document.getElementById('optimization-progress-text');
    
    console.log('[Main] 進度元素檢查:', {
        progressSection: !!progressSection,
        statusText: !!statusText,
        progressBar: !!progressBar,
        progressText: !!progressText
    });
    
    if (progressSection && statusText) {
        progressSection.classList.remove('hidden');
        statusText.textContent = message || '⌛ 優化進行中...';
        
        // 重置進度條
        if (progressBar) progressBar.style.width = '0%';
        if (progressText) progressText.textContent = '0%';
        
        console.log('[Main] 顯示優化進度:', message);
        console.log('[Main] 進度區域 class list:', progressSection.classList.toString());
    } else {
        console.error('[Main] 無法找到優化進度顯示元素!');
    }
}

function updateOptimizationProgress(progress, message) {
    const progressBar = document.getElementById('optimization-progress-bar');
    const progressText = document.getElementById('optimization-progress-text');
    const statusText = document.getElementById('optimization-status-text');
    
    const safeProgress = Math.max(0, Math.min(100, progress || 0));
    
    if (progressBar) {
        progressBar.style.width = `${safeProgress}%`;
    }
    if (progressText) {
        progressText.textContent = `${Math.round(safeProgress)}%`;
    }
    if (statusText && message) {
        statusText.textContent = message;
    }
    
    console.log(`[Main] 更新優化進度: ${safeProgress}%`, message);
}

function hideOptimizationProgress() {
    console.log('[Main] hideOptimizationProgress 被調用');
    const progressSection = document.getElementById('optimization-progress-section');
    if (progressSection) {
        progressSection.classList.add('hidden');
        console.log('[Main] 隱藏優化進度顯示');
        console.log('[Main] 進度區域 class list:', progressSection.classList.toString());
    } else {
        console.error('[Main] 找不到 optimization-progress-section 元素');
    }
}

function runOptimizationInternal(optimizeType) { 
    if (!workerUrl) { 
        showError("背景計算引擎尚未準備就緒，請稍候再試或重新載入頁面。"); 
        return; 
    } 
    
    console.log(`[Main] runOptimizationInternal called for ${optimizeType}`); 
    
    // 立即切換到優化頁面
    activateTab('optimization');
    console.log('[Main] 已切換到優化頁面');
    
    // 儲存優化前的結果用於對比顯示（包含索提諾比率與交易次數）
    if (lastOverallResult) {
        preOptimizationResult = {
            annualizedReturn: lastOverallResult.annualizedReturn,
            maxDrawdown: lastOverallResult.maxDrawdown,
            winRate: lastOverallResult.winRate,
            sharpeRatio: lastOverallResult.sharpeRatio,
            sortinoRatio: lastOverallResult.sortinoRatio,
            totalTrades: lastOverallResult.totalTrades ?? lastOverallResult.tradesCount ?? lastOverallResult.tradeCount ?? null
        };
        console.log('[Main] 已儲存優化前結果用於對比:', preOptimizationResult);
    } else {
        preOptimizationResult = null;
        console.log('[Main] 無可用的優化前結果');
    }
    
    // 顯示初始準備狀態
    showOptimizationProgress('⌛ 正在驗證參數...');
    
    const params=getBacktestParams(); 
    let targetStratKey, paramSelectId, selectedParamName, optLabel, optRange, msgAction, configKey, config; 
    const isShortOpt = optimizeType === 'shortEntry' || optimizeType === 'shortExit'; 
    const isRiskOpt = optimizeType === 'risk'; 
    
    if (isShortOpt && !params.enableShorting) { 
        hideOptimizationProgress();
        showError("請先啟用做空策略才能進行做空相關優化。"); 
        return; 
    } 
    
    if (!validateBacktestParams(params)) {
        hideOptimizationProgress();
        return;
    }
    
    const msgActionMap = {'entry': '多單進場', 'exit': '多單出場', 'shortEntry': '做空進場', 'shortExit': '回補出場', 'risk': '風險控制'}; 
    msgAction = msgActionMap[optimizeType] || '未知'; 
    
    if (isRiskOpt) { 
        paramSelectId = 'optimizeRiskParamSelect'; 
        selectedParamName = document.getElementById(paramSelectId)?.value; 
        config = globalOptimizeTargets[selectedParamName]; 
        if (!config) { 
            hideOptimizationProgress();
            showError(`找不到風險參數 ${selectedParamName} 的優化配置。`); 
            return; 
        } 
        msgAction = config.label; 
    } else { 
        if (optimizeType === 'entry') { 
            targetStratKey = params.entryStrategy; 
            paramSelectId = 'optimizeEntryParamSelect'; 
            configKey = targetStratKey; 
        } else if (optimizeType === 'exit') { 
            targetStratKey = params.exitStrategy; 
            paramSelectId = 'optimizeExitParamSelect'; 
            configKey = (['ma_cross','macd_cross','k_d_cross','ema_cross'].includes(targetStratKey)) ? `${targetStratKey}_exit` : targetStratKey; 
        } else if (optimizeType === 'shortEntry') { 
            targetStratKey = params.shortEntryStrategy; 
            paramSelectId = 'optimizeShortEntryParamSelect'; 
            configKey = targetStratKey; 
            params.enableShorting = true; 
        } else if (optimizeType === 'shortExit') { 
            targetStratKey = params.shortExitStrategy; 
            paramSelectId = 'optimizeShortExitParamSelect'; 
            configKey = targetStratKey; 
            params.enableShorting = true; 
        } else { 
            hideOptimizationProgress();
            showError("未知的優化類型。"); 
            return; 
        } 
        
        selectedParamName = document.getElementById(paramSelectId)?.value; 
        if (!selectedParamName || selectedParamName === 'null') { 
            hideOptimizationProgress();
            showError(`請為 ${msgAction} 策略選擇有效參數進行優化。`); 
            return; 
        } 
        
        config = strategyDescriptions[configKey]; 
        const optTarget = config?.optimizeTargets?.find(t => t.name === selectedParamName); 
        if (!optTarget) { 
            hideOptimizationProgress();
            showError(`找不到參數 "${selectedParamName}" (${configKey}) 的優化配置。`); 
            console.error(`Optimization config not found for key: ${configKey}, param: ${selectedParamName}`); 
            return; 
        } 
        config = optTarget; 
    } 
    
    optLabel = config.label; 
    optRange = config.range; 
    console.log(`[Main] Optimizing ${optimizeType}: Param=${selectedParamName}, Label=${optLabel}, Range:`, optRange); 
    
    const curSettings={
        stockNo: params.stockNo,
        startDate: params.startDate,
        endDate: params.endDate,
        market: (params.market || params.marketType || currentMarket || 'TWSE').toUpperCase(),
        adjustedPrice: Boolean(params.adjustedPrice),
        priceMode: (params.priceMode || (params.adjustedPrice ? 'adjusted' : 'raw') || 'raw').toLowerCase(),
    };
    const useCache=!needsDataFetch(curSettings); 
    const msg=`⌛ 開始優化 ${msgAction} (${optLabel}) (${useCache?'使用快取':'載入新數據'})...`; 
    
    // 先清除之前的結果，但不隱藏優化進度
    clearPreviousResults(); 
    console.log('[Main] 已清除之前的結果');
    
    // 然後更新進度顯示為實際的優化信息
    showOptimizationProgress(msg);
    console.log('[Main] 已更新進度顯示為:', msg);
    
    // 禁用優化按鈕，防止重複點擊
    const optimizeButtons = ['optimizeEntryBtn', 'optimizeExitBtn', 'optimizeShortEntryBtn', 'optimizeShortExitBtn', 'optimizeRiskBtn'];
    optimizeButtons.forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) btn.disabled = true;
    }); 
    
    if(optimizationWorker) optimizationWorker.terminate(); 
    console.log("[Main] Creating opt worker..."); 
    
    try { 
        optimizationWorker=new Worker(workerUrl); 
        const workerMsg={ 
            type:'runOptimization', 
            params, 
            optimizeTargetStrategy: optimizeType, 
            optimizeParamName:selectedParamName, 
            optimizeRange:optRange, 
            useCachedData:useCache 
        }; 
        
        if(useCache && cachedStockData) {
            workerMsg.cachedData=cachedStockData;
            const cacheEntry = ensureDatasetCacheEntryFresh(
                buildCacheKey(curSettings),
                cachedDataStore.get(buildCacheKey(curSettings)),
                curSettings.market,
            );
                if (cacheEntry) {
                    workerMsg.cachedMeta = {
                        summary: cacheEntry.summary || null,
                        adjustments: Array.isArray(cacheEntry.adjustments) ? cacheEntry.adjustments : [],
                        debugSteps: Array.isArray(cacheEntry.debugSteps) ? cacheEntry.debugSteps : [],
                        adjustmentFallbackApplied: Boolean(cacheEntry.adjustmentFallbackApplied),
                        priceSource: cacheEntry.priceSource || null,
                        dataSource: cacheEntry.dataSource || null,
                        splitAdjustment: Boolean(cacheEntry.splitAdjustment),
                        splitDiagnostics: cacheEntry.splitDiagnostics || null,
                        finmindStatus: cacheEntry.finmindStatus || null,
                    };
                }
        } else console.log(`[Main] Fetching data for ${optimizeType} opt.`);
        
        optimizationWorker.postMessage(workerMsg); 
        
        optimizationWorker.onmessage=e=>{ 
            const{type,data,progress,message}=e.data; 
            
            if(type==='progress'){
                // 使用優化專用的進度更新
                updateOptimizationProgress(progress, message);
            } else if(type==='result'){ 
                if(!useCache&&data?.rawDataUsed){
                    cachedStockData=data.rawDataUsed;
                    if (Array.isArray(data.rawDataUsed)) {
                        visibleStockData = data.rawDataUsed;
                    }
                    lastFetchSettings={ ...curSettings };
                    console.log(`[Main] Data cached after ${optimizeType} opt.`);
                } else if(!useCache&&data&&!data.rawDataUsed) {
                    console.warn("[Main] Opt worker no rawData returned.");
                }
                
                document.getElementById('optimization-title').textContent=`${msgAction}優化 (${optLabel})`; 
                handleOptimizationResult(data.results || data, selectedParamName, optLabel); 
                
                if(optimizationWorker) optimizationWorker.terminate(); 
                optimizationWorker=null; 
                
                hideOptimizationProgress();
                
                // 重新啟用優化按鈕
                optimizeButtons.forEach(btnId => {
                    const btn = document.getElementById(btnId);
                    if (btn) btn.disabled = false;
                });
                
                showSuccess("優化完成！");  
            } else if(type==='error'){ 
                showError(data?.message||"優化過程出錯"); 
                if(optimizationWorker) optimizationWorker.terminate(); 
                optimizationWorker=null; 
                
                hideOptimizationProgress();
                
                // 重新啟用優化按鈕
                optimizeButtons.forEach(btnId => {
                    const btn = document.getElementById(btnId);
                    if (btn) btn.disabled = false;
                });
            } 
        }; 
        
        optimizationWorker.onerror=e=>{
            showError(`Worker錯誤: ${e.message}`); 
            console.error("[Main] Opt Worker Error:",e); 
            optimizationWorker=null; 
            hideOptimizationProgress();
            
            // 重新啟用優化按鈕
            optimizeButtons.forEach(btnId => {
                const btn = document.getElementById(btnId);
                if (btn) btn.disabled = false;
            });
        }; 
    } catch (workerError) { 
        console.error("[Main] Opt Worker init error:", workerError); 
        showError(`啟動優化引擎失敗: ${workerError.message}`); 
        hideOptimizationProgress(); 
        
        // 重新啟用優化按鈕
        optimizeButtons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) btn.disabled = false;
        });
    } 
}
function handleOptimizationResult(results, optName, optLabel) { 
    currentOptimizationResults=[]; 
    if(!results||!Array.isArray(results)||results.length===0){
        document.getElementById("optimization-results").innerHTML=`<p class="text-gray-500">無有效優化結果</p>`;
        return;
    } 
    const validRes=results.filter(r=>r&&typeof r.annualizedReturn==='number'&&isFinite(r.annualizedReturn)&&typeof r.maxDrawdown==='number'); 
    if(validRes.length===0){
        document.getElementById("optimization-results").innerHTML=`<p class="text-gray-500">優化完成，但無有效結果</p>`;
        return;
    } 
    currentOptimizationResults=validRes; 
    sortState={key:'annualizedReturn',direction:'desc'}; 
    renderOptimizationTable(optName, optLabel); 
    addSortListeners(); 
}
function renderOptimizationTable(optName, optLabel) {
    const results = currentOptimizationResults;
    if (!results || results.length === 0) return;
    
    let bestRes = results[0];
    results.forEach(r => {
        if (r.annualizedReturn > bestRes.annualizedReturn) {
            bestRes = r;
        } else if (r.annualizedReturn === bestRes.annualizedReturn) {
            if (r.maxDrawdown < bestRes.maxDrawdown) {
                bestRes = r;
            } else if (r.maxDrawdown === bestRes.maxDrawdown) {
                const rS = isFinite(r.sortinoRatio) ? r.sortinoRatio : -Infinity;
                const bS = isFinite(bestRes.sortinoRatio) ? bestRes.sortinoRatio : -Infinity;
                if (rS > bS) bestRes = r;
            }
        }
    });
    
    const el = document.getElementById("optimization-results");
    const pLabel = optLabel || optName;
    
    let tableHtml = `<div class="overflow-x-auto">
        <table class="optimization-table w-full text-sm text-left text-gray-500">
            <thead class="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                    <th scope="col" class="px-4 py-3 sortable-header" data-sort-key="paramValue">${pLabel} 值</th>
                    <th scope="col" class="px-4 py-3 sortable-header sort-desc" data-sort-key="annualizedReturn">年化報酬</th>
                    <th scope="col" class="px-4 py-3 sortable-header" data-sort-key="returnRate">總報酬</th>
                    <th scope="col" class="px-4 py-3 sortable-header" data-sort-key="maxDrawdown">最大回撤</th>
                    <th scope="col" class="px-4 py-3 sortable-header" data-sort-key="winRate">勝率</th>
                    <th scope="col" class="px-4 py-3 sortable-header" data-sort-key="sharpeRatio">夏普值</th>
                    <th scope="col" class="px-4 py-3 sortable-header" data-sort-key="sortinoRatio">索提諾值</th>
                    <th scope="col" class="px-4 py-3 sortable-header" data-sort-key="tradesCount">交易次數</th>
                </tr>
            </thead>
            <tbody>`;
    
    tableHtml += results.map(r => {
        const isBest = r === bestRes;
        const annCls = (r.annualizedReturn ?? 0) >= 0 ? 'text-green-600' : 'text-red-600';
        const totCls = (r.returnRate ?? 0) >= 0 ? 'text-green-600' : 'text-red-600';
        return `<tr class="border-b hover:bg-gray-50 ${isBest ? 'bg-green-50 font-semibold' : ''}">
            <td class="px-4 py-2">${r.paramValue}</td>
            <td class="px-4 py-2 ${annCls}">${r.annualizedReturn.toFixed(2)}%</td>
            <td class="px-4 py-2 ${totCls}">${r.returnRate.toFixed(2)}%</td>
            <td class="px-4 py-2">${r.maxDrawdown.toFixed(2)}%</td>
            <td class="px-4 py-2">${r.winRate.toFixed(1)}%</td>
            <td class="px-4 py-2">${r.sharpeRatio?.toFixed(2) ?? 'N/A'}</td>
            <td class="px-4 py-2">${r.sortinoRatio ? (isFinite(r.sortinoRatio) ? r.sortinoRatio.toFixed(2) : '∞') : 'N/A'}</td>
            <td class="px-4 py-2">${r.tradesCount}</td>
        </tr>`;
    }).join('');
    
    tableHtml += `</tbody></table></div>`;
    
    // 構建摘要HTML，顯示優化前的數據進行對比
    let summaryHtml = `<div class="mt-4 p-3 bg-gray-100 rounded-md text-sm">
        <h4 class="font-semibold">最佳參數組合: ${pLabel} = ${bestRes.paramValue}</h4>`;
    
    // 顯示優化前策略表現：優先使用 preOptimizationResult（在啟動優化時保存），若無則回退到 lastOverallResult
    const before = preOptimizationResult || lastOverallResult;
    if (before && before.annualizedReturn !== null && before.annualizedReturn !== undefined) {
        summaryHtml += `<div class="mt-2">
            <p class="text-gray-700 font-medium">優化前策略表現：</p>
            <p class="text-gray-600">
                年化報酬率: ${before.annualizedReturn?.toFixed(2) ?? 'N/A'}%, 
                最大回撤: ${before.maxDrawdown?.toFixed(2) ?? 'N/A'}%, 
                勝率: ${before.winRate?.toFixed(1) ?? 'N/A'}%, 
                夏普值: ${before.sharpeRatio?.toFixed(2) ?? 'N/A'}, 
                索提諾值: ${before.sortinoRatio?.toFixed(2) ?? 'N/A'}, 
                交易次數: ${before.totalTrades ?? before.tradesCount ?? before.tradeCount ?? 'N/A'}
            </p>
        </div>`;
    }
    
    // 已移除「優化後最佳表現」顯示，僅保留優化前策略表現供比對
    
    summaryHtml += `<p class="mt-1 text-xs text-gray-500">提示：點擊表格標頭可排序。將最佳參數手動更新到上方對應欄位，再執行回測。</p></div>`;
    
    el.innerHTML = summaryHtml + tableHtml;
}
function addSortListeners() { const table=document.querySelector("#optimization-results .optimization-table"); if(!table)return; const headers=table.querySelectorAll("th.sortable-header"); headers.forEach(header=>{ header.onclick=()=>{ const sortKey=header.dataset.sortKey; if(!sortKey)return; if(sortState.key===sortKey)sortState.direction=sortState.direction==='asc'?'desc':'asc'; else {sortState.key=sortKey; sortState.direction='desc';} sortTable();}; }); }
function sortTable() { const{key,direction}=sortState; if(!currentOptimizationResults||currentOptimizationResults.length===0)return; currentOptimizationResults.sort((a,b)=>{ let vA=a[key]; let vB=b[key]; if(key==='sortinoRatio'){vA=isFinite(vA)?vA:(direction==='asc'?Infinity:-Infinity); vB=isFinite(vB)?vB:(direction==='asc'?Infinity:-Infinity);} vA=(vA===null||vA===undefined||isNaN(vA))?(direction==='asc'?Infinity:-Infinity):vA; vB=(vB===null||vB===undefined||isNaN(vB))?(direction==='asc'?Infinity:-Infinity):vB; if(vA<vB)return direction==='asc'?-1:1; if(vA>vB)return direction==='asc'?1:-1; return 0; }); const optTitle=document.getElementById('optimization-title').textContent; let optLabel='參數值'; const match=optTitle.match(/\((.+)\)/); if(match&&match[1])optLabel=match[1]; renderOptimizationTable(sortState.key, optLabel); const headers=document.querySelectorAll("#optimization-results th.sortable-header"); headers.forEach(h=>{h.classList.remove('sort-asc','sort-desc'); if(h.dataset.sortKey===key)h.classList.add(direction==='asc'?'sort-asc':'sort-desc');}); addSortListeners(); }
function updateStrategyParams(type) {
    const strategySelect = document.getElementById(`${type}Strategy`);
    const paramsContainer = document.getElementById(`${type}Params`);
    if (!strategySelect || !paramsContainer) {
        console.error(`[Main] Cannot find elements for type: ${type}`);
        return;
    }
    
    const strategyKey = strategySelect.value;
    let internalKey = strategyKey;
    
    if (type === 'exit') {
        if(['ma_cross','macd_cross','k_d_cross','ema_cross'].includes(strategyKey)) {
            internalKey = `${strategyKey}_exit`;
        }
    } else if (type === 'shortEntry') {
        internalKey = strategyKey;
        if (!strategyDescriptions[internalKey] && ['ma_cross', 'ma_below', 'ema_cross', 'rsi_overbought', 'macd_cross', 'bollinger_reversal', 'k_d_cross', 'price_breakdown', 'williams_overbought', 'turtle_stop_loss'].includes(strategyKey)) {
            internalKey = `short_${strategyKey}`;
        }
    } else if (type === 'shortExit') {
        internalKey = strategyKey;
        if (!strategyDescriptions[internalKey] && ['ma_cross', 'ma_above', 'ema_cross', 'rsi_oversold', 'macd_cross', 'bollinger_breakout', 'k_d_cross', 'price_breakout', 'williams_oversold', 'turtle_breakout', 'trailing_stop'].includes(strategyKey)) {
            internalKey = `cover_${strategyKey}`;
        }
    }
    
    const config = strategyDescriptions[internalKey];
    paramsContainer.innerHTML = '';
    
    if (!config?.defaultParams || Object.keys(config.defaultParams).length === 0) {
        paramsContainer.innerHTML = '<p class="text-xs text-gray-400 italic">此策略無需參數</p>';
    } else {
        for (const pName in config.defaultParams) {
            const defVal = config.defaultParams[pName];
            let lbl = pName;
            let idSfx = pName.charAt(0).toUpperCase() + pName.slice(1);
            
            // 標籤名稱處理
            if (internalKey === 'k_d_cross') {
                if(pName==='period')lbl='KD週期';
                else if(pName==='thresholdX'){lbl='D值上限(X)';idSfx='KdThresholdX';}
            } else if (internalKey === 'k_d_cross_exit') {
                if(pName==='period')lbl='KD週期';
                else if(pName==='thresholdY'){lbl='D值下限(Y)';idSfx='KdThresholdY';}
            } else if (internalKey === 'turtle_stop_loss') {
                if(pName==='stopLossPeriod'){lbl='停損週期';idSfx='StopLossPeriod';}
            } else if ((internalKey === 'macd_cross' || internalKey === 'macd_cross_exit') && pName === 'signalPeriod') {
                lbl='DEA週期(x)'; idSfx = 'SignalPeriod';
            } else if ((internalKey === 'macd_cross' || internalKey === 'macd_cross_exit') && pName === 'shortPeriod') {
                lbl='DI短EMA(n)';
            } else if ((internalKey === 'macd_cross' || internalKey === 'macd_cross_exit') && pName === 'longPeriod') {
                lbl='DI長EMA(m)';
            } else if (internalKey === 'short_k_d_cross') {
                if(pName==='period')lbl='KD週期';
                else if(pName==='thresholdY'){lbl='D值下限(Y)';idSfx='ShortKdThresholdY';}
            } else if (internalKey === 'cover_k_d_cross') {
                if(pName==='period')lbl='KD週期';
                else if(pName==='thresholdX'){lbl='D值上限(X)';idSfx='CoverKdThresholdX';}
            } else if (internalKey === 'short_macd_cross') {
                if(pName==='shortPeriod')lbl='DI短EMA(n)';
                else if(pName==='longPeriod')lbl='DI長EMA(m)';
                else if(pName==='signalPeriod'){lbl='DEA週期(x)';idSfx='ShortSignalPeriod';}
            } else if (internalKey === 'cover_macd_cross') {
                if(pName==='shortPeriod')lbl='DI短EMA(n)';
                else if(pName==='longPeriod')lbl='DI長EMA(m)';
                else if(pName==='signalPeriod'){lbl='DEA週期(x)';idSfx='CoverSignalPeriod';}
            } else if (internalKey === 'short_turtle_stop_loss') {
                if(pName==='stopLossPeriod'){lbl='觀察週期';idSfx='ShortStopLossPeriod';}
            } else if (internalKey === 'cover_turtle_breakout') {
                if(pName==='breakoutPeriod'){lbl='突破週期';idSfx='CoverBreakoutPeriod';}
            } else if (internalKey === 'cover_trailing_stop') {
                if(pName==='percentage'){lbl='百分比(%)';idSfx='CoverTrailingStopPercentage';}
            } else {
                const baseKey = internalKey.replace('short_', '').replace('cover_', '').replace('_exit', '');
                if (baseKey === 'ma_cross' || baseKey === 'ema_cross') {
                    if(pName==='shortPeriod')lbl='短期SMA';
                    else if(pName==='longPeriod')lbl='長期SMA';
                } else if (baseKey === 'ma_above' || baseKey === 'ma_below') {
                    if(pName==='period')lbl='SMA週期';
                } else if(pName==='period')lbl='週期';
                else if(pName==='threshold')lbl='閾值';
                else if(pName==='signalPeriod')lbl='信號週期';
                else if(pName==='deviations')lbl='標準差';
                else if(pName==='multiplier')lbl='成交量倍數';
                else if(pName==='percentage')lbl='百分比(%)';
                else if(pName==='breakoutPeriod')lbl='突破週期';
                else if(pName==='stopLossPeriod')lbl='停損週期';
                else { lbl = pName; }
            }
            
            const id = `${type}${idSfx}`;
            const pg = document.createElement('div');
            const lb = document.createElement('label');
            lb.htmlFor = id;
            lb.className = "block text-xs font-medium text-gray-600 mb-1";
            
            // 檢查是否有優化範圍資訊並添加範圍顯示（適用於所有策略類型）
            const optimizeTarget = config.optimizeTargets?.find(t => t.name === pName);
            if (optimizeTarget?.range) {
                const rangeText = `${optimizeTarget.range.from}-${optimizeTarget.range.to}`;
                lb.innerHTML = `${lbl}<br><span class="text-xs text-blue-500 font-normal">範圍: ${rangeText}</span>`;
            } else {
                lb.textContent = lbl;
            }
            
            const ip = document.createElement('input');
            ip.type = 'number';
            ip.id = id;
            ip.value = defVal;
            ip.className = "w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm text-sm focus:ring-blue-500 focus:border-blue-500";
            
            // 設定輸入範圍
            if(pName.includes('Period')||pName==='period'||pName==='stopLossPeriod'||pName==='breakoutPeriod'){
                ip.min=1;ip.max=200;ip.step=1;
            } else if(pName==='threshold'&&(internalKey.includes('rsi')||internalKey.includes('williams'))){
                ip.min=internalKey.includes('williams')?-100:0;
                ip.max=internalKey.includes('williams')?0:100;
                ip.step=1;
            } else if(pName==='thresholdX'||pName==='thresholdY'){
                ip.min=0;ip.max=100;ip.step=1;
            } else if(pName==='deviations'){
                ip.min=0.5;ip.max=5;ip.step=0.1;
            } else if(pName==='multiplier'){
                ip.min=1;ip.max=10;ip.step=0.1;
            } else if(pName==='percentage'){
                ip.min=0.1;ip.max=100;ip.step=0.1;
            }
            
            pg.appendChild(lb);
            pg.appendChild(ip);
            paramsContainer.appendChild(pg);
        }
    }
    
    // 更新優化參數選項
    let optimizeSelectId = null;
    if (type === 'entry' || type === 'exit' || type === 'shortEntry' || type === 'shortExit') {
        if (type === 'entry') optimizeSelectId = 'optimizeEntryParamSelect';
        else if (type === 'exit') optimizeSelectId = 'optimizeExitParamSelect';
        else if (type === 'shortEntry') optimizeSelectId = 'optimizeShortEntryParamSelect';
        else if (type === 'shortExit') optimizeSelectId = 'optimizeShortExitParamSelect';
        
        if (optimizeSelectId) {
            const optimizeSelect = document.getElementById(optimizeSelectId);
            if (optimizeSelect) {
                optimizeSelect.innerHTML = '';
                const targets = config?.optimizeTargets || [];
                if (targets.length > 0) {
                    targets.forEach(t => {
                        const opt = document.createElement('option');
                        opt.value = t.name;
                        opt.textContent = t.label;
                        optimizeSelect.appendChild(opt);
                    });
                    optimizeSelect.disabled = false;
                    optimizeSelect.title = `選擇優化參數`;
                } else {
                    const opt = document.createElement('option');
                    opt.value="null";
                    opt.textContent = '無可優化';
                    optimizeSelect.appendChild(opt);
                    optimizeSelect.disabled = true;
                    optimizeSelect.title = '此策略無可優化參數';
                }
            } else {
                console.warn(`[Update Params] Optimize select element not found: #${optimizeSelectId}`);
            }
        }
    }
}
function resetSettings() { document.getElementById("stockNo").value="2330"; initDates(); document.getElementById("initialCapital").value="100000"; document.getElementById("positionSize").value="100"; document.getElementById("stopLoss").value="0"; document.getElementById("takeProfit").value="0"; document.getElementById("positionBasisInitial").checked = true; setDefaultFees("2330"); document.querySelector('input[name="tradeTiming"][value="close"]').checked = true; document.getElementById("entryStrategy").value="ma_cross"; updateStrategyParams('entry'); document.getElementById("exitStrategy").value="ma_cross"; updateStrategyParams('exit'); const shortCheckbox = document.getElementById("enableShortSelling"); const shortArea = document.getElementById("short-strategy-area"); shortCheckbox.checked = false; shortArea.style.display = 'none'; document.getElementById("shortEntryStrategy").value="short_ma_cross"; updateStrategyParams('shortEntry'); document.getElementById("shortExitStrategy").value="cover_ma_cross"; updateStrategyParams('shortExit'); cachedStockData=null; cachedDataStore.clear(); clearPersistentDataCacheIndex(); lastFetchSettings=null; refreshPriceInspectorControls(); clearPreviousResults(); showSuccess("設定已重置"); }
function initTabs() { 
    // Initialize with summary tab active
    activateTab('summary'); 
}
function activateTab(tabId) { 
    const tabs = document.querySelectorAll('[data-tab]'); 
    const contents = document.querySelectorAll('.tab-content'); 
    
    // Update button states
    tabs.forEach(tab => { 
        const currentTabId = tab.getAttribute('data-tab'); 
        const isActive = currentTabId === tabId; 
        
        if (isActive) {
            tab.className = 'tab py-4 px-1 border-b-2 border-primary text-primary font-medium text-sm whitespace-nowrap';
            tab.style.color = 'var(--primary)';
            tab.style.borderColor = 'var(--primary)';
        } else {
            tab.className = 'tab py-4 px-1 border-b-2 border-transparent text-muted hover:text-foreground font-medium text-sm whitespace-nowrap';
            tab.style.color = 'var(--muted-foreground)';
            tab.style.borderColor = 'transparent';
        }
    }); 
    
    // Show corresponding content
    contents.forEach(content => { 
        const isTargetTab = content.id === `${tabId}-tab`;
        if (isTargetTab) {
            content.classList.remove('hidden');
            content.classList.add('active');
        } else {
            content.classList.add('hidden');
            content.classList.remove('active');
        }
    }); 
}
function setDefaultFees(stockNo) {
    const buyFeeInput = document.getElementById('buyFee');
    const sellFeeInput = document.getElementById('sellFee');
    if (!buyFeeInput || !sellFeeInput) return;

    const stockCode = typeof stockNo === 'string' ? stockNo.trim().toUpperCase() : '';
    const isETF = stockCode.startsWith('00');
    const isTAIEX = stockCode === 'TAIEX';
    const isUSMarket = currentMarket === 'US';

    if (isUSMarket) {
        buyFeeInput.value = '0.0000';
        sellFeeInput.value = '0.0000';
        console.log(`[Fees] US market defaults applied for ${stockCode || '(未輸入)'}`);
        return;
    }

    const stockBuyFeeRate = 0.1425;
    const stockSellFeeRate = 0.1425;
    const stockTaxRate = 0.3;
    const etfBuyFeeRate = 0.1;
    const etfSellFeeRate = 0.1;
    const etfTaxRate = 0.1;

    if (isTAIEX) {
        buyFeeInput.value = '0.0000';
        sellFeeInput.value = '0.0000';
        console.log(`[Fees] 指數預設費率 for ${stockCode}`);
    } else if (isETF) {
        buyFeeInput.value = etfBuyFeeRate.toFixed(4);
        sellFeeInput.value = (etfSellFeeRate + etfTaxRate).toFixed(4);
        console.log(`[Fees] ETF 預設費率 for ${stockCode} -> Buy: ${buyFeeInput.value}%, Sell+Tax: ${sellFeeInput.value}%`);
    } else {
        buyFeeInput.value = stockBuyFeeRate.toFixed(4);
        sellFeeInput.value = (stockSellFeeRate + stockTaxRate).toFixed(4);
        console.log(`[Fees] Stock 預設費率 for ${stockCode} -> Buy: ${buyFeeInput.value}%, Sell+Tax: ${sellFeeInput.value}%`);
    }
}
function getSavedStrategies() { const strategies = localStorage.getItem(SAVED_STRATEGIES_KEY); try { const parsed = strategies ? JSON.parse(strategies) : {}; // 清理損壞的數據
        const cleaned = {};
        for (const [name, data] of Object.entries(parsed)) {
            if (data && typeof data === 'object' && data.settings) {
                cleaned[name] = data;
            } else {
                console.warn(`[Storage] Removing corrupted strategy: ${name}`, data);
            }
        }
        // 如果有損壞數據被清理，更新 localStorage
        if (Object.keys(cleaned).length !== Object.keys(parsed).length) {
            localStorage.setItem(SAVED_STRATEGIES_KEY, JSON.stringify(cleaned));
        }
        return cleaned; } catch (e) { console.error("讀取策略時解析JSON錯誤:", e); return {}; } }
function saveStrategyToLocalStorage(name, settings, metrics) { 
    try { 
        const strategies = getSavedStrategies(); 
        strategies[name] = { 
            settings: { 
                stockNo: settings.stockNo, 
                startDate: settings.startDate, 
                endDate: settings.endDate, 
                initialCapital: settings.initialCapital, 
                tradeTiming: settings.tradeTiming, 
                entryStrategy: settings.entryStrategy, 
                entryParams: settings.entryParams, 
                exitStrategy: settings.exitStrategy, 
                exitParams: settings.exitParams, 
                enableShorting: settings.enableShorting, 
                shortEntryStrategy: settings.shortEntryStrategy, 
                shortEntryParams: settings.shortEntryParams, 
                shortExitStrategy: settings.shortExitStrategy, 
                shortExitParams: settings.shortExitParams, 
                positionSize: settings.positionSize, 
                stopLoss: settings.stopLoss, 
                takeProfit: settings.takeProfit, 
                positionBasis: settings.positionBasis, 
                buyFee: settings.buyFee, 
                sellFee: settings.sellFee 
            }, 
            metrics: metrics 
        }; 
        
        localStorage.setItem(SAVED_STRATEGIES_KEY, JSON.stringify(strategies)); 
        return true; 
    } catch (e) { 
        console.error("儲存策略到 localStorage 時發生錯誤:", e); 
        if (e.name === 'QuotaExceededError') { 
            showError("儲存失敗：localStorage 空間已滿。請刪除一些舊策略。"); 
        } else { 
            showError(`儲存策略失敗: ${e.message}`); 
        } 
        return false; 
    } 
}
function deleteStrategyFromLocalStorage(name) { try { const strategies = getSavedStrategies(); if (strategies[name]) { delete strategies[name]; localStorage.setItem(SAVED_STRATEGIES_KEY, JSON.stringify(strategies)); return true; } return false; } catch (e) { console.error("刪除策略時發生錯誤:", e); showError(`刪除策略失敗: ${e.message}`); return false; } }
function populateSavedStrategiesDropdown() { 
    const selectElement = document.getElementById('loadStrategySelect'); 
    if (!selectElement) return;
    
    selectElement.innerHTML = '<option value="">-- 選擇要載入的策略 --</option>'; 
    const strategies = getSavedStrategies(); 
    const strategyNames = Object.keys(strategies).sort(); 
    
    strategyNames.forEach(name => { 
        const strategyData = strategies[name]; 
        if (!strategyData) return; // 跳過 null 或 undefined 的策略資料 
        
        const metrics = strategyData.metrics || {}; // 修正：年化報酬率已經是百分比格式，不需要再乘以100
        const annReturn = (metrics.annualizedReturn !== null && !isNaN(metrics.annualizedReturn)) ? metrics.annualizedReturn.toFixed(2) + '%' : 'N/A'; 
        const sharpe = (metrics.sharpeRatio !== null && !isNaN(metrics.sharpeRatio)) ? metrics.sharpeRatio.toFixed(2) : 'N/A'; 
        const displayText = `${name} (年化:${annReturn} | Sharpe:${sharpe})`; 
        const option = document.createElement('option'); 
        option.value = name; 
        option.textContent = displayText; 
        selectElement.appendChild(option); 
    }); 
}
function saveStrategy() { 
    // 生成預設策略名稱（使用中文名稱）
    const stockNo = document.getElementById('stockNo').value.trim().toUpperCase() || '2330';
    const entryStrategy = document.getElementById('entryStrategy').value;
    const exitStrategy = document.getElementById('exitStrategy').value;
    const enableShorting = document.getElementById('enableShortSelling').checked;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    // 計算期間年份
    let yearPeriod = '';
    if (startDate && endDate) {
        const startYear = new Date(startDate).getFullYear();
        const endYear = new Date(endDate).getFullYear();
        const yearDiff = endYear - startYear;
        if (yearDiff > 0) {
            yearPeriod = `${yearDiff}年`;
        }
    }
    
    // 獲取中文策略名稱
    const entryStrategyName = strategyDescriptions[entryStrategy]?.name || entryStrategy;
    
    // 出場策略需要特殊處理以獲取正確的中文名稱
    let exitStrategyName;
    if (['ma_cross', 'macd_cross', 'k_d_cross', 'ema_cross'].includes(exitStrategy)) {
        const exitStrategyKey = exitStrategy + '_exit';
        exitStrategyName = strategyDescriptions[exitStrategyKey]?.name || exitStrategy;
    } else {
        exitStrategyName = strategyDescriptions[exitStrategy]?.name || exitStrategy;
    }
    
    let defaultName = `${stockNo}_${entryStrategyName}_${exitStrategyName}`;
    if (enableShorting) {
        const shortEntryStrategy = document.getElementById('shortEntryStrategy').value;
        const shortExitStrategy = document.getElementById('shortExitStrategy').value;
        const shortEntryStrategyName = strategyDescriptions[shortEntryStrategy]?.name || shortEntryStrategy;
        const shortExitStrategyName = strategyDescriptions[shortExitStrategy]?.name || shortExitStrategy;
        defaultName = `${stockNo}_${entryStrategyName}_${exitStrategyName}_${shortEntryStrategyName}_${shortExitStrategyName}`;
    }
    
    // 添加期間年份到預設名稱末尾
    if (yearPeriod) {
        defaultName += `_${yearPeriod}`;
    }
    
    const strategyName = prompt("請輸入策略名稱：", defaultName); 
    if (!strategyName || strategyName.trim() === "") { 
        showInfo("策略名稱不能為空。"); 
        return; 
    } 
    const trimmedName = strategyName.trim();
    
    const strategies = getSavedStrategies(); 
    if (strategies[trimmedName]) { 
        if (!confirm(`策略 "${trimmedName}" 已存在。是否覆蓋？`)) { 
            return; 
        } 
    } 
    if (lastOverallResult === null || lastOverallResult.annualizedReturn === null || lastOverallResult.sharpeRatio === null) { 
        if (!confirm("尚未執行回測或上次回測無有效績效指標。是否仍要儲存此策略設定（績效指標將顯示為 N/A）？")) { 
            return; 
        } 
    } 
    const currentSettings = getBacktestParams(); 
    const currentMetrics = { annualizedReturn: lastOverallResult?.annualizedReturn, sharpeRatio: lastOverallResult?.sharpeRatio }; 
    
    if (saveStrategyToLocalStorage(trimmedName, currentSettings, currentMetrics)) { 
        populateSavedStrategiesDropdown(); 
        showSuccess(`策略 "${trimmedName}" 已儲存！`); 
    }
}
function loadStrategy() { const selectElement = document.getElementById('loadStrategySelect'); const strategyName = selectElement.value; if (!strategyName) { showInfo("請先從下拉選單選擇要載入的策略。"); return; } const strategies = getSavedStrategies(); const strategyData = strategies[strategyName]; if (!strategyData || !strategyData.settings) { showError(`載入策略 "${strategyName}" 失敗：找不到策略數據。`); return; } const settings = strategyData.settings; console.log(`[Main] Loading strategy: ${strategyName}`, settings); try { document.getElementById('stockNo').value = settings.stockNo || '2330'; setDefaultFees(settings.stockNo || '2330'); document.getElementById('startDate').value = settings.startDate || ''; document.getElementById('endDate').value = settings.endDate || ''; document.getElementById('initialCapital').value = settings.initialCapital || 100000; document.getElementById('recentYears').value = 5; const tradeTimingInput = document.querySelector(`input[name="tradeTiming"][value="${settings.tradeTiming || 'close'}"]`); if (tradeTimingInput) tradeTimingInput.checked = true; document.getElementById('buyFee').value = (settings.buyFee !== undefined) ? settings.buyFee : (document.getElementById('buyFee').value || 0.1425); document.getElementById('sellFee').value = (settings.sellFee !== undefined) ? settings.sellFee : (document.getElementById('sellFee').value || 0.4425); document.getElementById('positionSize').value = settings.positionSize || 100; document.getElementById('stopLoss').value = settings.stopLoss ?? 0; document.getElementById('takeProfit').value = settings.takeProfit ?? 0; const positionBasisInput = document.querySelector(`input[name="positionBasis"][value="${settings.positionBasis || 'initialCapital'}"]`); if (positionBasisInput) positionBasisInput.checked = true; document.getElementById('entryStrategy').value = settings.entryStrategy || 'ma_cross'; updateStrategyParams('entry'); if(settings.entryParams) { for (const pName in settings.entryParams) { let idSfx = pName.charAt(0).toUpperCase() + pName.slice(1); let finalIdSfx = idSfx; if (settings.entryStrategy === 'k_d_cross' && pName === 'thresholdX') finalIdSfx = 'KdThresholdX'; else if ((settings.entryStrategy === 'macd_cross') && pName === 'signalPeriod') finalIdSfx = 'SignalPeriod'; const inputElement = document.getElementById(`entry${finalIdSfx}`); if (inputElement) inputElement.value = settings.entryParams[pName]; else console.warn(`[Load] Entry Param Input not found: entry${finalIdSfx}`); } } document.getElementById('exitStrategy').value = settings.exitStrategy || 'ma_cross'; updateStrategyParams('exit'); if(settings.exitParams) { for (const pName in settings.exitParams) { let idSfx = pName.charAt(0).toUpperCase() + pName.slice(1); let finalIdSfx = idSfx; const exitInternalKey = (['ma_cross','macd_cross','k_d_cross','ema_cross'].includes(settings.exitStrategy)) ? `${settings.exitStrategy}_exit` : settings.exitStrategy; if (exitInternalKey === 'k_d_cross_exit' && pName === 'thresholdY') finalIdSfx = 'KdThresholdY'; else if (exitInternalKey === 'turtle_stop_loss' && pName === 'stopLossPeriod') finalIdSfx = 'StopLossPeriod'; else if (exitInternalKey === 'macd_cross_exit' && pName === 'signalPeriod') finalIdSfx = 'SignalPeriod'; const inputElement = document.getElementById(`exit${finalIdSfx}`); if (inputElement) inputElement.value = settings.exitParams[pName]; else console.warn(`[Load] Exit Param Input not found: exit${finalIdSfx}`); } } const shortCheckbox = document.getElementById('enableShortSelling'); const shortArea = document.getElementById('short-strategy-area'); shortCheckbox.checked = settings.enableShorting || false; shortArea.style.display = shortCheckbox.checked ? 'grid' : 'none'; if (settings.enableShorting) { document.getElementById('shortEntryStrategy').value = settings.shortEntryStrategy || 'short_ma_cross'; updateStrategyParams('shortEntry'); if(settings.shortEntryParams) { for (const pName in settings.shortEntryParams) { let idSfx = pName.charAt(0).toUpperCase() + pName.slice(1); let finalIdSfx = idSfx; const shortEntryInternalKey = `short_${settings.shortEntryStrategy}`; if (shortEntryInternalKey === 'short_k_d_cross' && pName === 'thresholdY') finalIdSfx = 'ShortKdThresholdY'; else if (shortEntryInternalKey === 'short_macd_cross' && pName === 'signalPeriod') finalIdSfx = 'ShortSignalPeriod'; else if (shortEntryInternalKey === 'short_turtle_stop_loss' && pName === 'stopLossPeriod') finalIdSfx = 'ShortStopLossPeriod'; const inputElement = document.getElementById(`shortEntry${finalIdSfx}`); if (inputElement) inputElement.value = settings.shortEntryParams[pName]; else console.warn(`[Load] Short Entry Param Input not found: shortEntry${finalIdSfx}`); } } document.getElementById('shortExitStrategy').value = settings.shortExitStrategy || 'cover_ma_cross'; updateStrategyParams('shortExit'); if(settings.shortExitParams) { for (const pName in settings.shortExitParams) { let idSfx = pName.charAt(0).toUpperCase() + pName.slice(1); let finalIdSfx = idSfx; const shortExitInternalKey = `cover_${settings.shortExitStrategy}`; if (shortExitInternalKey === 'cover_k_d_cross' && pName === 'thresholdX') finalIdSfx = 'CoverKdThresholdX'; else if (shortExitInternalKey === 'cover_macd_cross' && pName === 'signalPeriod') finalIdSfx = 'CoverSignalPeriod'; else if (shortExitInternalKey === 'cover_turtle_breakout' && pName === 'breakoutPeriod') finalIdSfx = 'CoverBreakoutPeriod'; else if (shortExitInternalKey === 'cover_trailing_stop' && pName === 'percentage') finalIdSfx = 'CoverTrailingStopPercentage'; const inputElement = document.getElementById(`shortExit${finalIdSfx}`); if (inputElement) inputElement.value = settings.shortExitParams[pName]; else console.warn(`[Load] Short Exit Param Input not found: shortExit${finalIdSfx}`); } } } else { document.getElementById('shortEntryStrategy').value = 'short_ma_cross'; updateStrategyParams('shortEntry'); document.getElementById('shortExitStrategy').value = 'cover_ma_cross'; updateStrategyParams('shortExit'); } showSuccess(`策略 "${strategyName}" 已載入！`); 
    
    // 顯示確認對話框並自動執行回測
    if (confirm(`策略參數已載入完成！\n\n是否立即執行回測以查看策略表現？`)) {
        // 自動執行回測
        setTimeout(() => {
            runBacktestInternal();
        }, 100);
    }
    
    lastOverallResult = null; lastSubPeriodResults = null; } catch (error) { console.error(`載入策略 "${strategyName}" 時發生錯誤:`, error); showError(`載入策略失敗: ${error.message}`); } }
function deleteStrategy() { const selectElement = document.getElementById('loadStrategySelect'); const strategyName = selectElement.value; if (!strategyName) { showInfo("請先從下拉選單選擇要刪除的策略。"); return; } if (confirm(`確定要刪除策略 "${strategyName}" 嗎？此操作無法復原。`)) { if (deleteStrategyFromLocalStorage(strategyName)) { populateSavedStrategiesDropdown(); showSuccess(`策略 "${strategyName}" 已刪除！`); } } }
function randomizeSettings() { const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)]; const getRandomValue = (min, max, step) => { if (step === undefined || step === 0) step = 1; const range = max - min; if (range <= 0 && step > 0) return min; if (step <= 0) return min; const steps = Math.max(0, Math.floor(range / step)); const randomStep = Math.floor(Math.random() * (steps + 1)); let value = min + randomStep * step; if (step.toString().includes('.')) { const precision = step.toString().split('.')[1].length; value = parseFloat(value.toFixed(precision)); } return Math.max(min, Math.min(max, value)); }; const allKeys = Object.keys(strategyDescriptions); const entryKeys = allKeys.filter(k => !k.startsWith('short_') && !k.startsWith('cover_') && !k.endsWith('_exit') && k !== 'fixed_stop_loss'); const exitKeysRaw = allKeys.filter(k => (k.endsWith('_exit') || ['ma_below', 'rsi_overbought', 'bollinger_reversal', 'trailing_stop', 'price_breakdown', 'williams_overbought', 'turtle_stop_loss', 'fixed_stop_loss'].includes(k)) && !k.startsWith('short_') && !k.startsWith('cover_')); const exitKeys = exitKeysRaw.map(k => k.replace('_exit', '')).filter(k => k !== 'fixed_stop_loss'); const shortEntryKeys = allKeys.filter(k => k.startsWith('short_') && k !== 'short_fixed_stop_loss'); const coverKeys = allKeys.filter(k => k.startsWith('cover_') && k !== 'cover_fixed_stop_loss'); const setRandomParams = (type, strategyKey) => { let internalKey = strategyKey; if (type === 'exit' && ['ma_cross','macd_cross','k_d_cross','ema_cross'].includes(strategyKey)) internalKey = `${strategyKey}_exit`; else if (type === 'shortEntry') { if (!strategyDescriptions[internalKey] && ['ma_cross', 'ma_below', 'ema_cross', 'rsi_overbought', 'macd_cross', 'bollinger_reversal', 'k_d_cross', 'price_breakdown', 'williams_overbought', 'turtle_stop_loss'].includes(strategyKey)) internalKey = `short_${strategyKey}`; } else if (type === 'shortExit') { if (!strategyDescriptions[internalKey] && ['ma_cross', 'ma_above', 'ema_cross', 'rsi_oversold', 'macd_cross', 'bollinger_breakout', 'k_d_cross', 'price_breakout', 'williams_oversold', 'turtle_breakout', 'trailing_stop'].includes(strategyKey)) internalKey = `cover_${strategyKey}`; } const config = strategyDescriptions[internalKey]; if (!config || !config.defaultParams) return; let params = {}; for (const pName in config.defaultParams) { const target = config.optimizeTargets?.find(t => t.name === pName); let randomVal; if (target?.range) { randomVal = getRandomValue(target.range.from, target.range.to, target.range.step); } else { if (pName.includes('Period') || pName.includes('period')) randomVal = getRandomValue(5, 100, 1); else if (pName === 'threshold' && internalKey.includes('rsi')) randomVal = getRandomValue(10, 90, 1); else if (pName === 'threshold' && internalKey.includes('williams')) randomVal = getRandomValue(-90, -10, 1); else if (pName === 'thresholdX' || pName === 'thresholdY') randomVal = getRandomValue(10, 90, 1); else if (pName === 'deviations') randomVal = getRandomValue(1, 3, 0.1); else if (pName === 'multiplier') randomVal = getRandomValue(1.5, 5, 0.1); else if (pName === 'percentage') randomVal = getRandomValue(1, 25, 0.5); else randomVal = config.defaultParams[pName]; } params[pName] = randomVal; } if (['ma_cross', 'ema_cross', 'short_ma_cross', 'short_ema_cross', 'cover_ma_cross', 'cover_ema_cross'].some(prefix => internalKey.startsWith(prefix))) { if (params.shortPeriod && params.longPeriod && params.shortPeriod >= params.longPeriod) { params.shortPeriod = getRandomValue(3, Math.max(4, params.longPeriod - 1), 1); console.log(`[Random] Adjusted ${type} shortPeriod to ${params.shortPeriod} (long: ${params.longPeriod})`); } } for (const pName in params) { let idSfx = pName.charAt(0).toUpperCase() + pName.slice(1); if (internalKey === 'k_d_cross' && pName === 'thresholdX') idSfx = 'KdThresholdX'; else if (internalKey === 'k_d_cross_exit' && pName === 'thresholdY') idSfx = 'KdThresholdY'; else if (internalKey === 'turtle_stop_loss' && pName === 'stopLossPeriod') idSfx = 'StopLossPeriod'; else if ((internalKey === 'macd_cross' || internalKey === 'macd_cross_exit') && pName === 'signalPeriod') idSfx = 'SignalPeriod'; else if (internalKey === 'short_k_d_cross' && pName === 'thresholdY') idSfx = 'ShortKdThresholdY'; else if (internalKey === 'cover_k_d_cross' && pName === 'thresholdX') idSfx = 'CoverKdThresholdX'; else if (internalKey === 'short_macd_cross' && pName === 'signalPeriod') idSfx = 'ShortSignalPeriod'; else if (internalKey === 'cover_macd_cross' && pName === 'signalPeriod') idSfx = 'CoverSignalPeriod'; else if (internalKey === 'short_turtle_stop_loss' && pName === 'stopLossPeriod') idSfx = 'ShortStopLossPeriod'; else if (internalKey === 'cover_turtle_breakout' && pName === 'breakoutPeriod') idSfx = 'CoverBreakoutPeriod'; else if (internalKey === 'cover_trailing_stop' && pName === 'percentage') idSfx = 'CoverTrailingStopPercentage'; const inputId = `${type}${idSfx}`; const inputEl = document.getElementById(inputId); if (inputEl) { inputEl.value = params[pName]; } else { console.warn(`[Random] Input element not found for ${type} - ${pName}: #${inputId}`); } } }; const randomEntryKey = getRandomElement(entryKeys); const randomExitKey = getRandomElement(exitKeys); document.getElementById('entryStrategy').value = randomEntryKey; document.getElementById('exitStrategy').value = randomExitKey; updateStrategyParams('entry'); updateStrategyParams('exit'); setRandomParams('entry', randomEntryKey); setRandomParams('exit', randomExitKey); if (document.getElementById('enableShortSelling').checked) { const randomShortEntryKey = getRandomElement(shortEntryKeys); const randomCoverKey = getRandomElement(coverKeys); document.getElementById('shortEntryStrategy').value = randomShortEntryKey; document.getElementById('shortExitStrategy').value = randomCoverKey; updateStrategyParams('shortEntry'); updateStrategyParams('shortExit'); setRandomParams('shortEntry', randomShortEntryKey.replace('short_', '')); setRandomParams('shortExit', randomCoverKey.replace('cover_', '')); } showSuccess("策略與參數已隨機設定！"); }

// --- 市場切換和股票代碼智慧功能 ---

// 全域變數
let currentMarket = 'TWSE'; // 預設為上市
let isAutoSwitching = false; // 防止無限重複切換
// Patch Tag: LB-TW-NAMELOCK-20250616A
let manualMarketOverride = false; // 使用者手動鎖定市場時停用自動辨識
let manualOverrideCodeSnapshot = ''; // 紀錄觸發鎖定時的股票代碼
let isFetchingName = false; // 防止重複查詢股票名稱
// Patch Tag: LB-US-NAMECACHE-20250622A
const stockNameLookupCache = new Map(); // Map<cacheKey, { info, cachedAt }>
const STOCK_NAME_CACHE_LIMIT = 4096;
const STOCK_NAME_CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12 小時記憶體快取
const LOCAL_STOCK_NAME_CACHE_KEY = 'LB_TW_NAME_CACHE_V20250620A';
const LOCAL_STOCK_NAME_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 台股名稱保留 7 天
const LOCAL_US_NAME_CACHE_KEY = 'LB_US_NAME_CACHE_V20250622A';
const LOCAL_US_NAME_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 3; // 美股名稱保留 3 天
const TAIWAN_DIRECTORY_CACHE_KEY = 'LB_TW_DIRECTORY_CACHE_V20250620A';
const TAIWAN_DIRECTORY_CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 台股官方清單 24 小時過期
const TAIWAN_DIRECTORY_VERSION = 'LB-TW-DIRECTORY-20250620A';
const MIN_STOCK_LOOKUP_LENGTH = 4;
const STOCK_NAME_DEBOUNCE_MS = 800;
const persistentTaiwanNameCache = loadPersistentTaiwanNameCache();
const persistentUSNameCache = loadPersistentUSNameCache();
const taiwanDirectoryState = {
    ready: false,
    loading: false,
    version: null,
    updatedAt: null,
    source: null,
    cache: null,
    cachedAt: null,
    entries: new Map(),
    lastError: null,
};
let taiwanDirectoryReadyPromise = null;
hydrateTaiwanNameCache();
hydrateUSNameCache();
preloadTaiwanDirectory({ skipNetwork: true }).catch((error) => {
    console.warn('[Taiwan Directory] 本地清單預載失敗:', error);
});

// Patch Tag: LB-US-MARKET-20250612A
// Patch Tag: LB-NAME-CACHE-20250614A
const MARKET_META = {
    TWSE: { label: '上市', fetchName: fetchStockNameFromTWSE },
    TPEX: { label: '上櫃', fetchName: fetchStockNameFromTPEX },
    US: { label: '美股', fetchName: fetchStockNameFromUS },
};

function loadPersistentTaiwanNameCache() {
    if (typeof window === 'undefined' || !window.localStorage) {
        return new Map();
    }
    try {
        const raw = window.localStorage.getItem(LOCAL_STOCK_NAME_CACHE_KEY);
        if (!raw) return new Map();
        const parsed = JSON.parse(raw);
        const now = Date.now();
        const map = new Map();
        if (Array.isArray(parsed)) {
            for (const entry of parsed) {
                if (!entry || typeof entry !== 'object') continue;
                const { key, info, cachedAt } = entry;
                if (!key || !info || !info.name) continue;
                const stampedAt = typeof cachedAt === 'number' ? cachedAt : now;
                if (now - stampedAt > LOCAL_STOCK_NAME_CACHE_TTL_MS) continue;
                map.set(key, { info, cachedAt: stampedAt });
            }
        } else if (parsed && typeof parsed === 'object') {
            for (const [key, value] of Object.entries(parsed)) {
                if (!value || typeof value !== 'object') continue;
                if (!value.info || !value.info.name) continue;
                const stampedAt = typeof value.cachedAt === 'number' ? value.cachedAt : now;
                if (now - stampedAt > LOCAL_STOCK_NAME_CACHE_TTL_MS) continue;
                map.set(key, { info: value.info, cachedAt: stampedAt });
            }
        }
        return map;
    } catch (error) {
        console.warn('[Stock Name] 無法載入台股名稱快取:', error);
        return new Map();
    }
}

function loadPersistentUSNameCache() {
    if (typeof window === 'undefined' || !window.localStorage) {
        return new Map();
    }
    try {
        const raw = window.localStorage.getItem(LOCAL_US_NAME_CACHE_KEY);
        if (!raw) return new Map();
        const parsed = JSON.parse(raw);
        const now = Date.now();
        const map = new Map();
        if (Array.isArray(parsed)) {
            for (const entry of parsed) {
                if (!entry || typeof entry !== 'object') continue;
                const { key, info, cachedAt } = entry;
                if (!key || !info || !info.name) continue;
                const stampedAt = typeof cachedAt === 'number' ? cachedAt : now;
                if (now - stampedAt > LOCAL_US_NAME_CACHE_TTL_MS) continue;
                map.set(key, { info, cachedAt: stampedAt });
            }
        } else if (parsed && typeof parsed === 'object') {
            for (const [key, value] of Object.entries(parsed)) {
                if (!value || typeof value !== 'object') continue;
                if (!value.info || !value.info.name) continue;
                const stampedAt = typeof value.cachedAt === 'number' ? value.cachedAt : now;
                if (now - stampedAt > LOCAL_US_NAME_CACHE_TTL_MS) continue;
                map.set(key, { info: value.info, cachedAt: stampedAt });
            }
        }
        return map;
    } catch (error) {
        console.warn('[Stock Name] 無法載入美股名稱快取:', error);
        return new Map();
    }
}

function hydrateTaiwanNameCache() {
    if (!(persistentTaiwanNameCache instanceof Map)) return;
    if (persistentTaiwanNameCache.size === 0) return;
    let removed = false;
    const now = Date.now();
    for (const [key, entry] of persistentTaiwanNameCache.entries()) {
        if (!entry || !entry.info || !entry.info.name) {
            persistentTaiwanNameCache.delete(key);
            removed = true;
            continue;
        }
        if (now - (entry.cachedAt || 0) > LOCAL_STOCK_NAME_CACHE_TTL_MS) {
            persistentTaiwanNameCache.delete(key);
            removed = true;
            continue;
        }
        if (!stockNameLookupCache.has(key)) {
            stockNameLookupCache.set(key, { info: entry.info, cachedAt: entry.cachedAt });
        }
    }
    if (removed) {
        savePersistentTaiwanNameCache();
    }
}

function hydrateUSNameCache() {
    if (!(persistentUSNameCache instanceof Map)) return;
    if (persistentUSNameCache.size === 0) return;
    let removed = false;
    const now = Date.now();
    for (const [key, entry] of persistentUSNameCache.entries()) {
        if (!entry || !entry.info || !entry.info.name) {
            persistentUSNameCache.delete(key);
            removed = true;
            continue;
        }
        if (now - (entry.cachedAt || 0) > LOCAL_US_NAME_CACHE_TTL_MS) {
            persistentUSNameCache.delete(key);
            removed = true;
            continue;
        }
        if (!stockNameLookupCache.has(key)) {
            stockNameLookupCache.set(key, { info: entry.info, cachedAt: entry.cachedAt });
        }
    }
    if (removed) {
        savePersistentUSNameCache();
    }
}

function savePersistentTaiwanNameCache() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (!(persistentTaiwanNameCache instanceof Map)) return;
    try {
        const payload = Array.from(persistentTaiwanNameCache.entries()).map(([key, value]) => ({
            key,
            info: value.info,
            cachedAt: value.cachedAt,
        }));
        window.localStorage.setItem(LOCAL_STOCK_NAME_CACHE_KEY, JSON.stringify(payload));
    } catch (error) {
        console.warn('[Stock Name] 無法寫入台股名稱快取:', error);
    }
}

function savePersistentUSNameCache() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (!(persistentUSNameCache instanceof Map)) return;
    try {
        const payload = Array.from(persistentUSNameCache.entries()).map(([key, value]) => ({
            key,
            info: value.info,
            cachedAt: value.cachedAt,
        }));
        window.localStorage.setItem(LOCAL_US_NAME_CACHE_KEY, JSON.stringify(payload));
    } catch (error) {
        console.warn('[Stock Name] 無法寫入美股名稱快取:', error);
    }
}

function prunePersistentTaiwanNameCache() {
    if (!(persistentTaiwanNameCache instanceof Map)) return;
    const now = Date.now();
    let mutated = false;
    for (const [key, entry] of persistentTaiwanNameCache.entries()) {
        if (!entry || !entry.info || !entry.info.name) {
            persistentTaiwanNameCache.delete(key);
            mutated = true;
            continue;
        }
        if (now - (entry.cachedAt || 0) > LOCAL_STOCK_NAME_CACHE_TTL_MS) {
            persistentTaiwanNameCache.delete(key);
            mutated = true;
        }
    }
    while (persistentTaiwanNameCache.size > STOCK_NAME_CACHE_LIMIT) {
        const oldest = persistentTaiwanNameCache.keys().next().value;
        if (!oldest) break;
        persistentTaiwanNameCache.delete(oldest);
        mutated = true;
    }
    if (mutated) {
        savePersistentTaiwanNameCache();
    }
}

function prunePersistentUSNameCache() {
    if (!(persistentUSNameCache instanceof Map)) return;
    const now = Date.now();
    let mutated = false;
    for (const [key, entry] of persistentUSNameCache.entries()) {
        if (!entry || !entry.info || !entry.info.name) {
            persistentUSNameCache.delete(key);
            mutated = true;
            continue;
        }
        if (now - (entry.cachedAt || 0) > LOCAL_US_NAME_CACHE_TTL_MS) {
            persistentUSNameCache.delete(key);
            mutated = true;
        }
    }
    while (persistentUSNameCache.size > STOCK_NAME_CACHE_LIMIT) {
        const oldest = persistentUSNameCache.keys().next().value;
        if (!oldest) break;
        persistentUSNameCache.delete(oldest);
        mutated = true;
    }
    if (mutated) {
        savePersistentUSNameCache();
    }
}

function persistTaiwanNameCacheEntry(key, entry) {
    if (!(persistentTaiwanNameCache instanceof Map)) return;
    if (!key || !entry || !entry.info || !entry.info.name) return;
    persistentTaiwanNameCache.set(key, entry);
    prunePersistentTaiwanNameCache();
    savePersistentTaiwanNameCache();
}

function persistUSNameCacheEntry(key, entry) {
    if (!(persistentUSNameCache instanceof Map)) return;
    if (!key || !entry || !entry.info || !entry.info.name) return;
    persistentUSNameCache.set(key, entry);
    prunePersistentUSNameCache();
    savePersistentUSNameCache();
}

function removePersistentUSNameCacheEntry(key) {
    if (!(persistentUSNameCache instanceof Map)) return;
    if (!key) return;
    if (persistentUSNameCache.delete(key)) {
        savePersistentUSNameCache();
    }
}

function createStockNameCacheKey(market, stockCode) {
    const normalizedMarket = normalizeMarketValue(typeof market === 'string' ? market : '');
    const normalizedCode = (stockCode || '').trim().toUpperCase();
    if (!normalizedMarket || !normalizedCode) return null;
    return `${normalizedMarket}|${normalizedCode}`;
}

function getLeadingDigitCount(symbol) {
    if (!symbol) return 0;
    const match = symbol.match(/^\d+/);
    return match ? match[0].length : 0;
}

function shouldEnforceNumericLookupGate(symbol) {
    if (!symbol) return false;
    return /^\d/.test(symbol);
}

function shouldRestrictToTaiwanMarkets(symbol) {
    if (!symbol) return false;
    const normalized = symbol.trim().toUpperCase();
    if (normalized.length < MIN_STOCK_LOOKUP_LENGTH) return false;
    const prefix = normalized.slice(0, MIN_STOCK_LOOKUP_LENGTH);
    return /^\d{4}$/.test(prefix);
}

function isTaiwanMarket(market) {
    const normalized = normalizeMarketValue(market || '');
    return normalized === 'TWSE' || normalized === 'TPEX';
}

function isStockNameCacheEntryFresh(entry, ttlMs) {
    if (!entry) return false;
    if (!ttlMs || !Number.isFinite(ttlMs) || ttlMs <= 0) return true;
    const cachedAt = typeof entry.cachedAt === 'number' ? entry.cachedAt : 0;
    if (!cachedAt) return true;
    return Date.now() - cachedAt <= ttlMs;
}

function storeStockNameCacheEntry(market, stockCode, info, options = {}) {
    const key = createStockNameCacheKey(market, stockCode);
    if (!key || !info || !info.name) return;
    const now = Date.now();
    if (stockNameLookupCache.has(key)) {
        stockNameLookupCache.delete(key);
    }
    const entry = { info, cachedAt: now };
    stockNameLookupCache.set(key, entry);
    while (stockNameLookupCache.size > STOCK_NAME_CACHE_LIMIT) {
        const oldest = stockNameLookupCache.keys().next().value;
        if (!oldest) break;
        stockNameLookupCache.delete(oldest);
    }
    const normalizedMarket = normalizeMarketValue(market);
    if (isTaiwanMarket(normalizedMarket) && options.persist !== false) {
        persistTaiwanNameCacheEntry(key, entry);
    } else if (normalizedMarket === 'US' && options.persist !== false) {
        persistUSNameCacheEntry(key, entry);
    }
}

function loadTaiwanDirectoryFromStorage() {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
        const raw = window.localStorage.getItem(TAIWAN_DIRECTORY_CACHE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        const cachedAt = typeof parsed.cachedAt === 'number' ? parsed.cachedAt : 0;
        if (cachedAt && Date.now() - cachedAt > TAIWAN_DIRECTORY_CACHE_TTL_MS) {
            return null;
        }
        const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
        return {
            version: parsed.version || null,
            updatedAt: parsed.updatedAt || null,
            source: parsed.source || null,
            cache: parsed.cache || null,
            entries,
            cachedAt,
        };
    } catch (error) {
        console.warn('[Taiwan Directory] 無法讀取本地清單快取:', error);
        return null;
    }
}

function saveTaiwanDirectoryToStorage(payload) {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (!payload) return;
    try {
        const cachedAt = typeof payload.cachedAt === 'number' ? payload.cachedAt : Date.now();
        const record = {
            version: payload.version || null,
            updatedAt: payload.updatedAt || null,
            source: payload.source || null,
            entries: Array.isArray(payload.entries) ? payload.entries : [],
            cachedAt,
            cache: payload.cache || null,
        };
        window.localStorage.setItem(TAIWAN_DIRECTORY_CACHE_KEY, JSON.stringify(record));
    } catch (error) {
        console.warn('[Taiwan Directory] 無法寫入本地清單快取:', error);
    }
}

function normaliseDirectoryEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;
    const stockId = (entry.stockId || entry.stock_id || '').toString().trim().toUpperCase();
    const name = (entry.name || entry.stock_name || '').toString().trim();
    if (!stockId || !name) return null;
    const market = entry.market ? normalizeMarketValue(entry.market) : null;
    const board = entry.board || (market === 'TWSE' ? '上市' : market === 'TPEX' ? '上櫃' : null);
    const instrumentType = entry.instrumentType || (entry.isETF ? 'ETF' : null);
    const isETF = entry.isETF === true || /^00\d{2,4}$/.test(stockId);
    const marketCategory = entry.marketCategory || entry.rawType || null;
    return {
        stockId,
        name,
        market,
        board,
        instrumentType,
        isETF,
        marketCategory,
    };
}

function applyTaiwanDirectoryPayload(payload, options = {}) {
    if (!payload) return false;
    const seedCache = options.seedCache !== false;
    const rawEntries = Array.isArray(payload.entries)
        ? payload.entries
        : Array.isArray(payload.data)
            ? payload.data
            : payload.data && typeof payload.data === 'object'
                ? Object.values(payload.data)
                : payload.entries && typeof payload.entries === 'object'
                    ? Object.values(payload.entries)
                    : [];
    const map = new Map();
    const sourceLabel = payload.source || '台股官方清單';
    const versionLabel = payload.version ? `${sourceLabel}｜${payload.version}` : sourceLabel;

    for (const raw of rawEntries) {
        const entry = normaliseDirectoryEntry(raw);
        if (!entry) continue;
        map.set(entry.stockId, entry);

        if (seedCache && entry.market) {
            const info = {
                name: entry.name,
                board: entry.board,
                instrumentType: entry.instrumentType,
                marketCategory: entry.marketCategory,
                market: entry.market,
                sourceLabel: versionLabel,
                matchStrategy: 'taiwan-directory',
                directoryVersion: payload.version || TAIWAN_DIRECTORY_VERSION,
                resolvedSymbol: entry.stockId,
                infoSource: sourceLabel,
            };
            storeStockNameCacheEntry(entry.market, entry.stockId, info, { persist: false });
        }
    }

    if (map.size === 0) return false;

    taiwanDirectoryState.entries = map;
    taiwanDirectoryState.version = payload.version || TAIWAN_DIRECTORY_VERSION;
    taiwanDirectoryState.updatedAt = payload.updatedAt || payload.fetchedAt || null;
    taiwanDirectoryState.source = sourceLabel;
    taiwanDirectoryState.cache = payload.cache || null;
    taiwanDirectoryState.cachedAt = typeof payload.cachedAt === 'number' ? payload.cachedAt : Date.now();
    taiwanDirectoryState.ready = true;
    taiwanDirectoryState.lastError = null;

    if (options.persist !== false) {
        const storedEntries = Array.from(map.values()).map((entry) => ({
            stockId: entry.stockId,
            name: entry.name,
            market: entry.market,
            board: entry.board,
            instrumentType: entry.instrumentType,
            isETF: entry.isETF,
            marketCategory: entry.marketCategory,
        }));
        saveTaiwanDirectoryToStorage({
            version: taiwanDirectoryState.version,
            updatedAt: taiwanDirectoryState.updatedAt,
            source: taiwanDirectoryState.source,
            entries: storedEntries,
            cache: taiwanDirectoryState.cache,
            cachedAt: taiwanDirectoryState.cachedAt,
        });
    }

    return true;
}

async function preloadTaiwanDirectory(options = {}) {
    if (taiwanDirectoryState.ready && !options.forceRefresh) {
        return taiwanDirectoryState;
    }
    if (taiwanDirectoryState.loading) {
        return taiwanDirectoryReadyPromise || taiwanDirectoryState;
    }

    taiwanDirectoryState.loading = true;

    try {
        if (!options.forceRefresh) {
            const stored = loadTaiwanDirectoryFromStorage();
            if (stored) {
                applyTaiwanDirectoryPayload(
                    {
                        version: stored.version,
                        updatedAt: stored.updatedAt,
                        source: stored.source,
                        cache: stored.cache,
                        entries: stored.entries,
                        cachedAt: stored.cachedAt,
                    },
                    { seedCache: options.seedCache !== false, persist: false },
                );
            }
            if (taiwanDirectoryState.ready && options.skipNetwork) {
                return taiwanDirectoryState;
            }
        }

        if (options.skipNetwork) {
            return taiwanDirectoryState;
        }

        const controller = typeof AbortController === 'function' ? new AbortController() : null;
        const timeoutId = controller ? setTimeout(() => controller.abort(), 16000) : null;
        const response = await fetch('/.netlify/functions/taiwan-directory', {
            signal: controller?.signal,
        });
        if (timeoutId) clearTimeout(timeoutId);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json();
        if (!payload || payload.status === 'error') {
            throw new Error(payload?.message || '台股官方清單回應異常');
        }
        const entries = payload.data && typeof payload.data === 'object' ? Object.values(payload.data) : [];
        applyTaiwanDirectoryPayload(
            {
                version: payload.version || null,
                updatedAt: payload.updatedAt || null,
                source: payload.source || null,
                cache: payload.cache || null,
                entries,
                cachedAt: Date.now(),
            },
            { seedCache: options.seedCache !== false },
        );
        recordTaiwanDirectoryBlobUsage(payload.cache || null);
    } catch (error) {
        taiwanDirectoryState.lastError = error;
        console.warn('[Taiwan Directory] 載入失敗:', error);
    } finally {
        taiwanDirectoryState.loading = false;
    }

    return taiwanDirectoryState;
}

function ensureTaiwanDirectoryReady(options = {}) {
    if (taiwanDirectoryState.ready && !options.forceRefresh) {
        return Promise.resolve(taiwanDirectoryState);
    }
    if (!taiwanDirectoryReadyPromise) {
        taiwanDirectoryReadyPromise = preloadTaiwanDirectory(options).finally(() => {
            taiwanDirectoryReadyPromise = null;
        });
    }
    return taiwanDirectoryReadyPromise;
}

function getTaiwanDirectoryEntry(stockCode) {
    if (!stockCode) return null;
    const normalized = stockCode.trim().toUpperCase();
    if (!normalized) return null;
    if (!(taiwanDirectoryState.entries instanceof Map)) return null;
    return taiwanDirectoryState.entries.get(normalized) || null;
}

function resolveCachedStockNameInfo(stockCode, preferredMarket) {
    const normalized = (stockCode || '').trim().toUpperCase();
    if (!normalized) return null;
    const candidateMarkets = preferredMarket
        ? [normalizeMarketValue(preferredMarket), 'TWSE', 'TPEX', 'US']
        : ['TWSE', 'TPEX', 'US'];
    const cacheHit = findStockNameCacheEntry(normalized, candidateMarkets.filter(Boolean));
    if (cacheHit && cacheHit.info) {
        return {
            market: cacheHit.market,
            info: cacheHit.info,
        };
    }
    const directoryEntry = getTaiwanDirectoryEntry(normalized);
    if (directoryEntry) {
        return {
            market: directoryEntry.market || preferredMarket || null,
            info: {
                name: directoryEntry.name,
                board: directoryEntry.board,
                instrumentType: directoryEntry.instrumentType,
                marketCategory: directoryEntry.marketCategory,
                sourceLabel: taiwanDirectoryState.source
                    ? `${taiwanDirectoryState.source}${taiwanDirectoryState.version ? `｜${taiwanDirectoryState.version}` : ''}`
                    : '台股官方清單',
                infoSource: taiwanDirectoryState.source || 'Taiwan Directory',
                directoryVersion: taiwanDirectoryState.version || TAIWAN_DIRECTORY_VERSION,
                market: directoryEntry.market || preferredMarket || null,
            },
        };
    }
    return null;
}

function findStockNameCacheEntry(stockCode, markets) {
    if (!Array.isArray(markets) || markets.length === 0) return null;
    const normalizedCode = (stockCode || '').trim().toUpperCase();
    if (!normalizedCode) return null;
    for (const market of markets) {
        const key = createStockNameCacheKey(market, normalizedCode);
        if (!key) continue;
        const entry = stockNameLookupCache.get(key);
        if (entry && entry.info && entry.info.name) {
            const normalizedMarket = normalizeMarketValue(market);
            const ttl = isTaiwanMarket(normalizedMarket)
                ? LOCAL_STOCK_NAME_CACHE_TTL_MS
                : normalizedMarket === 'US'
                    ? LOCAL_US_NAME_CACHE_TTL_MS
                    : STOCK_NAME_CACHE_TTL_MS;
            if (!isStockNameCacheEntryFresh(entry, ttl)) {
                stockNameLookupCache.delete(key);
                if (isTaiwanMarket(normalizedMarket) && persistentTaiwanNameCache instanceof Map) {
                    persistentTaiwanNameCache.delete(key);
                    savePersistentTaiwanNameCache();
                } else if (normalizedMarket === 'US') {
                    removePersistentUSNameCacheEntry(key);
                }
                continue;
            }
            return { market: normalizedMarket, info: entry.info, cachedAt: entry.cachedAt };
        }
    }
    return null;
}

function isLikelyTaiwanETF(symbol) {
    const normalized = (symbol || '').trim().toUpperCase();
    if (!normalized.startsWith('00')) return false;
    const base = normalized.replace(/[A-Z]$/, '');
    return /^\d{4,6}$/.test(base);
}

function deriveNameSourceLabel(market) {
    const normalized = normalizeMarketValue(market || '');
    if (normalized === 'US') return 'FinMind USStockInfo';
    if (normalized === 'TPEX') return 'TPEX 公開資訊';
    if (normalized === 'TWSE') return 'TWSE 日成交資訊';
    return '';
}

function getMarketDisplayName(market) {
    return MARKET_META[market]?.label || market;
}

function resolveStockNameSearchOrder(stockCode, preferredMarket) {
    const normalizedCode = (stockCode || '').trim().toUpperCase();
    const hasAlpha = /[A-Z]/.test(normalizedCode);
    const isNumeric = /^\d+$/.test(normalizedCode);
    const leadingDigits = getLeadingDigitCount(normalizedCode);
    const startsWithFourDigits = leadingDigits >= MIN_STOCK_LOOKUP_LENGTH;
    const restrictToTaiwan = shouldRestrictToTaiwanMarkets(normalizedCode);
    const preferred = normalizeMarketValue(preferredMarket || '');
    const baseOrder = [];
    if (restrictToTaiwan || startsWithFourDigits) {
        baseOrder.push('TWSE', 'TPEX');
    } else if (hasAlpha && !isNumeric && leadingDigits === 0) {
        baseOrder.push('US', 'TWSE', 'TPEX');
    } else {
        baseOrder.push('TWSE', 'TPEX', 'US');
    }
    const order = [];
    const seen = new Set();
    const push = (market) => {
        const normalized = normalizeMarketValue(market || '');
        if (!normalized || seen.has(normalized) || !MARKET_META[normalized]) return;
        if (restrictToTaiwan && !isTaiwanMarket(normalized)) return;
        seen.add(normalized);
        order.push(normalized);
    };
    push(preferred);
    baseOrder.forEach(push);
    return order;
}

function normalizeStockNameResult(result, context = {}) {
    if (!result) return null;
    const stockCode = (context.stockCode || '').trim().toUpperCase();
    const market = normalizeMarketValue(context.market || currentMarket || 'TWSE');
    const defaultSource = deriveNameSourceLabel(market);

    if (typeof result === 'string') {
        const trimmed = result.trim();
        if (!trimmed) return null;
        return {
            name: trimmed,
            market,
            board: MARKET_META[market]?.label || market,
            sourceLabel: defaultSource,
            symbol: stockCode || trimmed,
        };
    }

    if (typeof result !== 'object') return null;
    if (result.error) return null;

    const name = (result.name || result.stockName || result.stock_name || result.fullName || '').toString().trim();
    if (!name) return null;

    const info = {
        name,
        market: result.market ? normalizeMarketValue(result.market) : market,
        board: result.board || result.marketLabel || result.marketType || MARKET_META[market]?.label || market,
        instrumentType: result.instrumentType || result.securityType || result.type || null,
        marketCategory: result.marketCategory || result.marketCategoryName || result.exchange || null,
        sourceLabel: result.source || result.sourceLabel || result.infoSource || defaultSource,
        symbol: (result.symbol || result.stockNo || result.stock_id || result.stockId || result.data_id || result.ticker || stockCode || '').toString().toUpperCase(),
        matchStrategy: result.matchStrategy || null,
        resolvedSymbol: result.resolvedSymbol || null,
        directoryVersion: result.directoryVersion || result.directory_version || null,
        infoSource: result.infoSource || result.info_source || null,
    };

    if ((result.isETF || result.etf === true) && !info.instrumentType) {
        info.instrumentType = 'ETF';
    }

    if (!info.instrumentType && info.market !== 'US' && isLikelyTaiwanETF(stockCode)) {
        info.instrumentType = 'ETF';
    }

    return info;
}

function formatStockNameDisplay(info, options = {}) {
    if (!info || !info.name) return null;
    const classificationParts = [];
    const marketLabel = info.market ? getMarketDisplayName(info.market) : null;
    if (marketLabel) classificationParts.push(marketLabel);
    else if (info.board) classificationParts.push(info.board);
    if (info.instrumentType) classificationParts.push(info.instrumentType);
    if (info.marketCategory) classificationParts.push(info.marketCategory);
    const uniqueClassification = [...new Set(classificationParts.filter(Boolean))];

    const suffixParts = [];
    if (options.autoSwitched && options.targetLabel) {
        suffixParts.push(`已切換至${options.targetLabel}`);
    }
    if (options.fromCache) {
        suffixParts.push('快取');
    }

    const main = `${info.name}${uniqueClassification.length > 0 ? `（${uniqueClassification.join('・')}）` : ''}`;
    const suffix = suffixParts.length > 0 ? `（${suffixParts.join('・')}）` : '';

    return {
        text: `${main}${suffix}`,
        sourceLabel: info.sourceLabel || '',
    };
}

function composeStockNameText(display, fallback = '') {
    if (!display) return fallback;
    return display.text || fallback;
}

// 初始化市場切換功能
function initializeMarketSwitch() {
    const marketSelect = document.getElementById('marketSelect');
    const stockNoInput = document.getElementById('stockNo');

    if (!marketSelect || !stockNoInput) return;

    currentMarket = normalizeMarketValue(marketSelect.value || 'TWSE');
    window.applyMarketPreset?.(currentMarket);

    marketSelect.addEventListener('change', () => {
        const nextMarket = normalizeMarketValue(marketSelect.value || 'TWSE');
        if (currentMarket === nextMarket) return;

        const triggeredByAuto = isAutoSwitching === true;
        currentMarket = nextMarket;
        console.log(`[Market Switch] 切換到: ${currentMarket}`);
        if (triggeredByAuto) {
            manualMarketOverride = false;
            manualOverrideCodeSnapshot = '';
        } else {
            manualMarketOverride = true;
            manualOverrideCodeSnapshot = (stockNoInput.value || '').trim().toUpperCase();
        }
        window.applyMarketPreset?.(currentMarket);
        window.refreshDataSourceTester?.();

        if (!triggeredByAuto) {
            hideStockName();
        }

        const stockCode = stockNoInput.value.trim().toUpperCase();
        if (stockCode && stockCode !== 'TAIEX') {
            debouncedFetchStockName(stockCode, { force: true, immediate: true });
        }
        setDefaultFees(stockCode);
    });

    stockNoInput.addEventListener('input', function() {
        const stockCode = this.value.trim().toUpperCase();
        if (manualMarketOverride && stockCode !== manualOverrideCodeSnapshot) {
            manualMarketOverride = false;
            manualOverrideCodeSnapshot = '';
        }
        manualOverrideCodeSnapshot = stockCode;
        hideStockName();
        if (stockCode === 'TAIEX') {
            showStockName('台灣加權指數', 'success');
            return;
        }
        if (stockCode) {
            debouncedFetchStockName(stockCode);
        }
    });

    stockNoInput.addEventListener('blur', function() {
        const stockCode = this.value.trim().toUpperCase();
        if (stockCode && stockCode !== 'TAIEX') {
            debouncedFetchStockName(stockCode, { force: true, immediate: true });
        }
    });
}

// 防抖函數 - 避免頻繁 API 請求
let stockNameTimeout;
function debouncedFetchStockName(stockCode, options = {}) {
    clearTimeout(stockNameTimeout);
    const normalizedCode = (stockCode || '').trim().toUpperCase();
    if (!normalizedCode || normalizedCode === 'TAIEX') return;
    const enforceGate = shouldEnforceNumericLookupGate(normalizedCode);
    if (!options.force && enforceGate) {
        const leadingDigits = getLeadingDigitCount(normalizedCode);
        if (leadingDigits < MIN_STOCK_LOOKUP_LENGTH) {
            console.log(
                `[Stock Name] Skip auto lookup (${normalizedCode}), leading digits ${leadingDigits} < ${MIN_STOCK_LOOKUP_LENGTH}`
            );
            return;
        }
    }
    const delay = options.immediate ? 0 : STOCK_NAME_DEBOUNCE_MS;
    stockNameTimeout = setTimeout(() => {
        fetchStockName(normalizedCode, options);
    }, delay);
}

async function resolveStockName(fetcher, stockCode, market) {
    try {
        const result = await fetcher(stockCode);
        return normalizeStockNameResult(result, { stockCode, market });
    } catch (error) {
        console.warn('[Stock Name] 查詢時發生錯誤:', error);
        return null;
    }
}

async function fetchStockName(stockCode, options = {}) {
    if (!stockCode || stockCode === 'TAIEX') return;
    const normalizedCode = stockCode.trim().toUpperCase();
    const enforceGate = shouldEnforceNumericLookupGate(normalizedCode);
    if (!options.force && enforceGate) {
        const leadingDigits = getLeadingDigitCount(normalizedCode);
        if (leadingDigits < MIN_STOCK_LOOKUP_LENGTH) {
            console.log(
                `[Stock Name] Skip lookup (${normalizedCode}), leading digits ${leadingDigits} < ${MIN_STOCK_LOOKUP_LENGTH}`
            );
            return;
        }
    }
    if (isFetchingName) {
        console.log('[Stock Name] 已有進行中的查詢，跳過本次請求');
        return;
    }
    isFetchingName = true;

    console.log(`[Stock Name] 查詢股票名稱: ${normalizedCode} (市場: ${currentMarket})`);

    try {
        showStockName('查詢中...', 'info');
        const allowAutoSwitch = !manualMarketOverride;
        const restrictToTaiwan = shouldRestrictToTaiwanMarkets(normalizedCode);
        if (restrictToTaiwan) {
            console.log(`[Stock Name] ${normalizedCode} 前四碼為數字，限定查詢上市/上櫃來源`);
        }
        const searchOrder = allowAutoSwitch
            ? resolveStockNameSearchOrder(normalizedCode, currentMarket)
            : restrictToTaiwan
                ? ['TWSE', 'TPEX']
                : [currentMarket];

        const cacheHit = findStockNameCacheEntry(normalizedCode, searchOrder);
        if (cacheHit && cacheHit.info) {
            if (cacheHit.cachedAt) {
                const cachedISO = new Date(cacheHit.cachedAt).toISOString();
                console.log(`[Stock Name] 快取命中 ${cacheHit.market} ｜ ${cachedISO}`);
            }
            if (cacheHit.market === currentMarket || !allowAutoSwitch) {
                const display = formatStockNameDisplay(cacheHit.info, { fromCache: true });
                showStockName(composeStockNameText(display, cacheHit.info.name), 'success');
                return;
            }
            if (allowAutoSwitch) {
                await switchToMarket(cacheHit.market, normalizedCode, {
                    presetInfo: cacheHit.info,
                    fromCache: true,
                    skipToast: true,
                });
                return;
            }
        }

        for (const market of searchOrder) {
            const fetcher = MARKET_META[market]?.fetchName;
            if (typeof fetcher !== 'function') continue;
            const info = await resolveStockName(fetcher, normalizedCode, market);
            if (!info) continue;

            storeStockNameCacheEntry(market, normalizedCode, info);

            if (market === currentMarket || !allowAutoSwitch) {
                const display = formatStockNameDisplay(info);
                showStockName(composeStockNameText(display, info.name), 'success');
                return;
            }

            if (allowAutoSwitch) {
                await switchToMarket(market, normalizedCode, { presetInfo: info });
                return;
            }
        }

        const currentLabel = getMarketDisplayName(currentMarket);
        showMarketSwitchSuggestion(normalizedCode, currentLabel, null);
    } catch (error) {
        console.error('[Stock Name] 查詢錯誤:', error);
        showStockName('查詢失敗', 'error');
    } finally {
        isFetchingName = false;
    }
}
// 從 TWSE 取得股票名稱
async function fetchStockNameFromTWSE(stockCode) {
    try {
        await ensureTaiwanDirectoryReady();
        const directoryEntry = getTaiwanDirectoryEntry(stockCode);
        if (directoryEntry) {
            return {
                name: directoryEntry.name,
                board: directoryEntry.board || '上市',
                source: taiwanDirectoryState.source
                    ? `${taiwanDirectoryState.source}${taiwanDirectoryState.version ? `｜${taiwanDirectoryState.version}` : ''}`
                    : '台股官方清單',
                instrumentType: directoryEntry.instrumentType,
                market: directoryEntry.market || 'TWSE',
                marketCategory: directoryEntry.marketCategory || null,
                matchStrategy: 'taiwan-directory',
                directoryVersion: taiwanDirectoryState.version || TAIWAN_DIRECTORY_VERSION,
                resolvedSymbol: directoryEntry.stockId,
            };
        }

        // 使用當月第一天作為查詢日期
        const now = new Date();
        const queryDate = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}01`;

        const url = `https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&stockNo=${stockCode}&date=${queryDate}&_=${Date.now()}`;
        const response = await fetch(url);
        
        if (!response.ok) return null;
        
        const data = await response.json();
        
        if (data.stat === 'OK' && data.title) {
            // 從 title 提取股票名稱，通常格式為："110年01月 2330 台積電 各日成交資訊"
            const match = data.title.match(/\d+年\d+月\s+\d+\s+(.+?)\s+各日成交資訊/);
            if (match && match[1]) {
                const name = match[1].trim();
                return {
                    name,
                    board: '上市',
                    source: 'TWSE 日成交資訊',
                    instrumentType: isLikelyTaiwanETF(stockCode) ? 'ETF' : null,
                };
            }
        }

        return null;
    } catch (error) {
        console.error('[TWSE API] 查詢股票名稱失敗:', error);
        return null;
    }
}

// 從 TPEX 取得股票名稱 (使用代理伺服器解決CORS問題)
async function fetchStockNameFromTPEX(stockCode) {
    try {
        await ensureTaiwanDirectoryReady();
        const directoryEntry = getTaiwanDirectoryEntry(stockCode);
        if (directoryEntry) {
            return {
                name: directoryEntry.name,
                board: directoryEntry.board || '上櫃',
                source: taiwanDirectoryState.source
                    ? `${taiwanDirectoryState.source}${taiwanDirectoryState.version ? `｜${taiwanDirectoryState.version}` : ''}`
                    : '台股官方清單',
                instrumentType: directoryEntry.instrumentType,
                market: directoryEntry.market || 'TPEX',
                marketCategory: directoryEntry.marketCategory || null,
                matchStrategy: 'taiwan-directory',
                directoryVersion: taiwanDirectoryState.version || TAIWAN_DIRECTORY_VERSION,
                resolvedSymbol: directoryEntry.stockId,
            };
        }

        console.log(`[TPEX Name] 查詢股票代碼: ${stockCode}`);

        // 方法1: 使用代理伺服器 (如果可用)
        const proxyResult = await fetchTPEXNameViaProxy(stockCode);
        if (proxyResult && !proxyResult.error && proxyResult.name) {
            return {
                name: proxyResult.name.trim(),
                board: '上櫃',
                source: proxyResult.source || 'TPEX 公開資訊代理',
                instrumentType: isLikelyTaiwanETF(stockCode) ? 'ETF' : null,
            };
        }

        // 方法2: 使用JSONP方式嘗試舊API
        const jsonpResult = await fetchTPEXNameViaJSONP(stockCode);
        if (jsonpResult) {
            return {
                name: typeof jsonpResult === 'string' ? jsonpResult.trim() : String(jsonpResult),
                board: '上櫃',
                source: 'TPEX JSONP',
                instrumentType: isLikelyTaiwanETF(stockCode) ? 'ETF' : null,
            };
        }

        console.warn(`[TPEX Name] 無法取得股票代碼 ${stockCode} 的名稱`);
        return null;

    } catch (error) {
        console.error(`[TPEX Name] 查詢股票名稱失敗:`, error);
        return null;
    }
}

async function fetchStockNameFromUS(stockCode) {
    try {
        const url = `/api/us/?mode=info&stockNo=${encodeURIComponent(stockCode)}`;
        const response = await fetch(url);
        if (!response.ok) {
            console.warn(`[US Name] API 回傳狀態碼 ${response.status}`);
            return null;
        }
        const data = await response.json();
        if (!data || data.error) return null;
        if (typeof data === 'string') {
            const name = data.trim();
            if (!name) return null;
            return {
                name,
                market: 'US',
                source: 'FinMind USStockInfo',
                symbol: stockCode,
            };
        }
        if (typeof data === 'object') {
            const name = (data.stockName || data.name || '').toString().trim();
            if (!name) return null;
            return {
                name,
                market: 'US',
                marketCategory: data.marketCategory || data.marketCategoryName || data.market || null,
                source: data.source || data.infoSource || 'FinMind USStockInfo',
                instrumentType: data.securityType || data.instrumentType || null,
                symbol: (data.symbol || data.stockNo || stockCode || '').toString().toUpperCase(),
                matchStrategy: data.matchStrategy || null,
                resolvedSymbol: data.resolvedSymbol || null,
            };
        }
        return null;
    } catch (error) {
        console.error('[US Name] 查詢股票名稱失敗:', error);
        return null;
    }
}

// 使用代理伺服器獲取TPEX股票名稱
async function fetchTPEXNameViaProxy(stockNo) {
    // **關鍵修正：使用一個固定的、格式完整的歷史日期**
    const placeholderDate = '113/01/01'; 

    const url = `/.netlify/functions/tpex-proxy?stockNo=${stockNo}&date=${placeholderDate}`;
    
    console.log(`[TPEX Proxy Name] Fetching name for ${stockNo} via proxy: ${url}`);
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`[TPEX Proxy Name] 代理回傳 HTTP ${response.status}`);
            return { error: `HTTP status ${response.status}` };
        }
        const data = await response.json();

        if (data.error) {
            console.warn('[TPEX Proxy Name] 代理回傳錯誤標記', data);
            return data;
        }

        if (data.iTotalRecords > 0 && data.stockName) {
            return { name: data.stockName.trim(), source: 'TPEX Proxy' };
        } else if (data.aaData && data.aaData.length > 0) {
            const nameField = data.aaData[0][1] || '';
            const name = nameField.replace(stockNo, '').trim();
            return { name, source: 'TPEX Proxy' };
        } else {
             return { error: 'no_data' };
        }
    } catch (error) {
        console.error('[TPEX Proxy Name] 呼叫代理時發生錯誤:', error);
        return { error: error.message };
    }
}

// 使用JSONP方式嘗試獲取TPEX股票名稱
function fetchTPEXNameViaJSONP(stockCode) {
    return new Promise((resolve) => {
        try {
            // 嘗試使用支援JSONP的舊API端點
            const now = new Date();
            const rocYear = now.getFullYear() - 1911;
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const queryDate = `${rocYear}/${month}`;
            
            const callbackName = `tpexCallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const script = document.createElement('script');
            
            // 設置超時
            const timeout = setTimeout(() => {
                cleanup();
                resolve(null);
            }, 5000);
            
            const cleanup = () => {
                clearTimeout(timeout);
                if (script.parentNode) {
                    script.parentNode.removeChild(script);
                }
                if (window[callbackName]) {
                    delete window[callbackName];
                }
            };
            
            window[callbackName] = (data) => {
                cleanup();
                
                try {
                    if (data && data.stat === 'OK' && data.aaData) {
                        for (const row of data.aaData) {
                            if (row && row[0] === stockCode && row[1]) {
                                resolve(row[1].trim());
                                return;
                            }
                        }
                    }
                    resolve(null);
                } catch (e) {
                    console.warn(`[TPEX JSONP] 解析錯誤:`, e);
                    resolve(null);
                }
            };
            
            // 嘗試JSONP格式的URL
            script.src = `https://www.tpex.org.tw/web/stock/aftertrading/daily_trading_info/st43_result.php?l=zh-tw&d=${queryDate}&stkno=${stockCode}&callback=${callbackName}`;
            script.onerror = () => {
                cleanup();
                resolve(null);
            };
            
            document.head.appendChild(script);
            
        } catch (error) {
            console.warn(`[TPEX JSONP] 設置錯誤:`, error);
            resolve(null);
        }
    });
}

// 顯示市場切換建議
function showMarketSwitchSuggestion(stockCode, currentMarketLabel, targetMarket) {
    const stockNameDisplay = document.getElementById('stockNameDisplay');
    if (!stockNameDisplay) return;

    stockNameDisplay.style.display = 'block';
    if (targetMarket && MARKET_META[targetMarket]) {
        const targetLabel = getMarketDisplayName(targetMarket);
        stockNameDisplay.innerHTML = `
            <div class="flex items-center justify-between p-2 bg-yellow-50 border border-yellow-200 rounded-md" style="background-color: #fffbeb; border-color: #fde68a;">
                <div class="flex items-center gap-2">
                    <svg class="w-4 h-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                    </svg>
                    <span class="text-yellow-800 text-xs">
                        ${currentMarketLabel}市場查無「${stockCode}」
                    </span>
                </div>
                <button
                    id="switchMarketBtn"
                    class="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    onclick="switchToMarket('${targetMarket}', '${stockCode}')"
                >
                    切換至${targetLabel}
                </button>
            </div>
        `;
    } else {
        stockNameDisplay.innerHTML = `
            <div class="flex items-center gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md" style="background-color: #fffbeb; border-color: #fde68a;">
                <svg class="w-4 h-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
                </svg>
                <span class="text-yellow-800 text-xs">
                    ${currentMarketLabel}、上櫃與美股市場皆未找到「${stockCode}」。
                </span>
            </div>
        `;
    }
}

async function switchToMarket(targetMarket, stockCode, options = {}) {
    const normalizedMarket = normalizeMarketValue(targetMarket || 'TWSE');
    const normalizedCode = (stockCode || '').trim().toUpperCase();
    const targetLabel = getMarketDisplayName(normalizedMarket);
    const { presetInfo = null, fromCache = false, skipToast = false } = options;

    console.log(`[Market Switch] 切換到 ${normalizedMarket} 查詢 ${normalizedCode}`);

    manualMarketOverride = false;
    manualOverrideCodeSnapshot = '';
    isAutoSwitching = true;
    currentMarket = normalizedMarket;

    const marketSelect = document.getElementById('marketSelect');
    if (marketSelect && marketSelect.value !== normalizedMarket) {
        marketSelect.value = normalizedMarket;
    }
    window.applyMarketPreset?.(currentMarket);
    window.refreshDataSourceTester?.();
    setDefaultFees(normalizedCode);

    if (!presetInfo) {
        showStockName('查詢中...', 'info');
    }

    try {
        let info = presetInfo;
        if (!info) {
            const fetcher = MARKET_META[normalizedMarket]?.fetchName;
            info = fetcher ? await resolveStockName(fetcher, normalizedCode, normalizedMarket) : null;
        }

        if (info) {
            storeStockNameCacheEntry(normalizedMarket, normalizedCode, info);
            const display = formatStockNameDisplay(info, { autoSwitched: true, targetLabel, fromCache });
            showStockName(composeStockNameText(display, info.name), 'success');
            if (!skipToast) {
                showSuccess(`已切換至${targetLabel}市場並找到: ${info.name}`);
            }
            return info;
        }

        showStockName(`當前市場查無「${normalizedCode}」`, 'error');
        return null;
    } catch (error) {
        console.error('[Market Switch] 查詢錯誤:', error);
        showStockName('查詢失敗', 'error');
        return null;
    } finally {
        isAutoSwitching = false;
    }
}
// 顯示股票名稱
function showStockName(name, type = 'success') {
    const stockNameDisplay = document.getElementById('stockNameDisplay');
    if (!stockNameDisplay) return;

    stockNameDisplay.style.display = 'block';
    const safeText = escapeHtml(typeof name === 'string' ? name : String(name ?? ''));
    stockNameDisplay.innerHTML = `<span class="stock-name-text">${safeText}</span>`;
    
    // 獲取內部的文字元素來設定顏色
    const textElement = stockNameDisplay.querySelector('.stock-name-text');
    if (textElement) {
        if (type === 'success') {
            textElement.style.color = 'var(--emerald-600, #059669)';
        } else if (type === 'error') {
            textElement.style.color = 'var(--rose-600, #dc2626)';
        } else if (type === 'info') {
            textElement.style.color = 'var(--blue-600, #2563eb)';
        } else {
            textElement.style.color = 'var(--muted-foreground)';
        }
    }
}

// 隱藏股票名稱
function hideStockName() {
    const stockNameDisplay = document.getElementById('stockNameDisplay');
    if (stockNameDisplay) {
        stockNameDisplay.style.display = 'none';
        stockNameDisplay.innerHTML = '';
    }
}

// --- 全局函數 ---
// 將 switchToMarket 函數添加到全局範圍，供 HTML onclick 調用
window.getTaiwanDirectoryMeta = function getTaiwanDirectoryMeta() {
    return {
        ready: taiwanDirectoryState.ready,
        version: taiwanDirectoryState.version,
        updatedAt: taiwanDirectoryState.updatedAt,
        source: taiwanDirectoryState.source,
        cachedAt: taiwanDirectoryState.cachedAt,
    };
};
window.switchToMarket = switchToMarket;

// --- 初始化 ---
// 在 DOM 載入完成後初始化市場切換功能
document.addEventListener('DOMContentLoaded', function() {
    // 延遲一點初始化，確保其他初始化完成
    setTimeout(() => {
        initializeMarketSwitch();
        console.log('[Market Switch] 市場切換功能已初始化');
    }, 100);
});