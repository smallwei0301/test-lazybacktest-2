// Patch Tag: LB-TW-DIRECTORY-20250620A
// Patch Tag: LB-STAGING-OPTIMIZER-20250627A
// Patch Tag: LB-COVERAGE-STREAM-20250705A

const STRATEGY_STATUS_PATCH_TAG = 'LB-STRATEGY-STATUS-20250723A';
const STRATEGY_STATUS_BADGE_BASE_CLASS = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-colors duration-150';
const STRATEGY_STATUS_BADGE_VARIANTS = Object.freeze({
    neutral: 'bg-gray-100 text-gray-600 border-gray-300',
    positive: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    negative: 'bg-rose-100 text-rose-700 border-rose-300',
    loading: 'bg-slate-100 text-slate-600 border-slate-300 animate-pulse',
});
const STRATEGY_STATUS_DIFF_THRESHOLD = 3;
const STRATEGY_HEALTH_THRESHOLDS = Object.freeze({
    annualizedReturn: 10,
    sharpeRatio: 1,
    sortinoRatio: 1.5,
    maxDrawdown: 20,
    stabilityRatio: 0.8,
});

document.addEventListener('DOMContentLoaded', function() {
    console.log('Chart object:', typeof Chart);
    console.log('Available Chart plugins:', Chart.registry ? Object.keys(Chart.registry.plugins.items) : 'No registry');
});

document.addEventListener('DOMContentLoaded', () => {
    const shouldForceRefresh = !taiwanDirectoryState.cachedAt
        || (Date.now() - taiwanDirectoryState.cachedAt) > TAIWAN_DIRECTORY_CACHE_TTL_MS;
    ensureTaiwanDirectoryReady({ forceRefresh: shouldForceRefresh }).catch((error) => {
        console.warn('[Taiwan Directory] ???亙仃??', error);
    });
    console.info(`[Main] Strategy status card patch loaded: ${STRATEGY_STATUS_PATCH_TAG}`);
    resetStrategyStatusCard('idle');
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
const START_GAP_RETRY_MS = 6 * 60 * 60 * 1000; // ?剖?????閰阡??唳???

const DATA_CACHE_INDEX_KEY = 'LB_DATA_CACHE_INDEX_V20250723A';
const DATA_CACHE_VERSION = 'LB-SUPERSET-CACHE-20250723A';
const TW_DATA_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const US_DATA_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 3;
const DEFAULT_DATA_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;

const SESSION_DATA_CACHE_VERSION = 'LB-SUPERSET-CACHE-20250723A';
const SESSION_DATA_CACHE_INDEX_KEY = 'LB_SESSION_DATA_CACHE_INDEX_V20250723A';
const SESSION_DATA_CACHE_ENTRY_PREFIX = 'LB_SESSION_DATA_CACHE_ENTRY_V20250723A::';
const SESSION_DATA_CACHE_LIMIT = 24;

const YEAR_STORAGE_VERSION = 'LB-CACHE-TIER-20250720A';
const YEAR_STORAGE_PREFIX = 'LB_YEAR_DATA_CACHE_V20250720A';
const YEAR_STORAGE_TW_TTL_MS = 1000 * 60 * 60 * 24 * 3;
const YEAR_STORAGE_US_TTL_MS = 1000 * 60 * 60 * 24 * 1;
const YEAR_STORAGE_DEFAULT_TTL_MS = 1000 * 60 * 60 * 24 * 2;

const BLOB_LEDGER_STORAGE_KEY = 'LB_BLOB_LEDGER_V20250720A';
const BLOB_LEDGER_VERSION = 'LB-CACHE-TIER-20250720A';
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
        console.warn('[Main] ?⊥?頛 Session ?葫敹怠?蝝Ｗ?:', error);
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
        console.warn('[Main] ?⊥?撖怠 Session ?葫敹怠?蝝Ｗ?:', error);
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
                console.warn('[Main] ?⊥?蝘駁 Session ?葫敹怠??:', error);
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
        console.warn('[Main] 閫?? Session ?葫敹怠?憭望?:', error);
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
        console.warn('[Main] 撖怠 Session ?葫敹怠?憭望?:', error);
    }
}

function removeSessionDataCacheEntry(cacheKey) {
    if (!cacheKey) return;
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    try {
        window.sessionStorage.removeItem(buildSessionStorageEntryKey(cacheKey));
    } catch (error) {
        console.warn('[Main] 蝘駁 Session ?葫敹怠?憭望?:', error);
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
        console.warn('[Main] 閫??撟游漲敹怠?憭望?:', error);
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
            console.warn('[Main] 撖怠撟游漲敹怠?憭望?:', error);
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
            console.warn('[Main] 瑼Ｘ撟游漲敹怠??仃??', error);
            toRemove.push(key);
        }
    }
    toRemove.forEach((key) => {
        try {
            window.localStorage.removeItem(key);
        } catch (error) {
            console.warn('[Main] 蝘駁撟游漲敹怠?憭望?:', error);
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
        console.warn('[Main] 頛 Blob ?券?蝝?仃??', error);
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
        console.warn('[Main] 撖怠 Blob ?券?蝝?仃??', error);
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
    const dataSourceLabel = meta.dataSource || '?汗??Session 敹怠?';
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
        dataSource: 'Year superset cache',
        dataSources: ['Year superset cache'],
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
    console.log(`[Main] Rehydrated year superset cache for ${curSettings.stockNo} (${sliceStart} ~ ${sliceEnd}).`);


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
        console.warn('[Main] ?⊥?頛鞈?敹怠?蝝Ｗ?:', error);
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
        console.warn('[Main] ?⊥?撖怠鞈?敹怠?蝝Ｗ?:', error);
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
            console.warn('[Main] ?⊥?皜鞈?敹怠?蝝Ｗ?:', error);
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

// --- 銝餃?皜砍??---
function runBacktestInternal() {
    console.log("[Main] runBacktestInternal called");
    if (!workerUrl) { showError("?閮?撘?撠皞?撠梁?嚗?蝔?閰行??頛???); hideLoading(); return; }
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
                        ? `${startCheck.gapDays} 憭奈
                        : '?芰憭拇';
                    const firstDateText = startCheck.firstEffectiveDate || '??;
                    console.warn(`[Main] 敹怠?擐????交? (${firstDateText}) 頛身摰絲暺敺?${gapText}嚗?粹??唳???start=${effectiveStartDate}`);
                    useCache = false;
                    cachedEntry = null;
                } else if (startCheck.acknowledged && Number.isFinite(startCheck.gapDays) && startCheck.gapDays > START_GAP_TOLERANCE_DAYS) {
                    console.warn(`[Main] 敹怠?擐????交?撌脰敺?${startCheck.gapDays} 憭抬?撌脣餈?蝣箄?鞈?蝻箏嚗?窒?典翰???);
                }
            } else {
                console.warn('[Main] 敹怠??批捆銝??冽?蝯??啣虜嚗?粹??唳???);
                useCache = false;
                cachedEntry = null;
            }
        }
        const msg=useCache?"??雿輻敹怠??瑁??葫...":"???脣??豢?銝血?皜?..";
        showLoading(msg);
        resetStrategyStatusCard('loading');
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
            console.log(`[Main] 敺翰?銝?${cacheKey}嚗???${curSettings.startDate} ~ ${curSettings.endDate}`);
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
                if(message)document.getElementById('loadingText').textContent=`??${message}`;
            } else if(type==='marketError'){
                // ??撣?亥岷?航炊嚗＊蝷箸?折隤方???閰望?
                hideLoading();
                if (window.showMarketSwitchModal) {
                    window.showMarketSwitchModal(message, marketType, stockNo);
                } else {
                    console.error('[Main] showMarketSwitchModal function not found');
                    showError(message);
                }
            } else if(type==='stockNameInfo'){
                // ???∠巨?迂鞈?嚗＊蝷箏UI銝?
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
                     console.log("[Main] 雿輻銝餃銵?敹怠?鞈??瑁??葫??);

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
                        console.warn(`[Main] ${params?.stockNo || ''} 蝚砌?蝑???文?賢??澈韏琿? ${runtimeDataset.firstValidCloseGapFromEffective} 憭押);
                    }
                    if (runtimeDataset?.invalidRowsInRange?.count > 0) {
                        const reasonSummary = formatDiagnosticsReasonCounts(runtimeDataset.invalidRowsInRange.reasons);
                        console.warn(`[Main] ${params?.stockNo || ''} ???菜葫??${runtimeDataset.invalidRowsInRange.count} 蝑??????蝯梯?: ${reasonSummary}`);
                    }
                    if (fetchDiag?.overview?.invalidRowsInRange?.count > 0) {
                        const fetchReason = formatDiagnosticsReasonCounts(fetchDiag.overview.invalidRowsInRange.reasons);
                        console.warn(`[Main] ${params?.stockNo || ''} ?垢??? ${fetchDiag.overview.invalidRowsInRange.count} 蝑??雿???蝯梯?: ${fetchReason}`);
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
                    suggestionText.textContent = data.suggestion || '?⊥???撱箄降';
                    suggestionArea.classList.remove('hidden', 'loading');
                     suggestionArea.className = 'my-4 p-4 border-l-4 rounded-md text-center'; // Base classes
                    if (data.suggestion === '??鞎瑕' || data.suggestion === '?? (憭?') { suggestionArea.classList.add('bg-green-50', 'border-green-500', 'text-green-800'); }
                    else if (data.suggestion === '?征鞈?' || data.suggestion === '?? (蝛?') { suggestionArea.classList.add('bg-red-50', 'border-red-500', 'text-red-800'); }
                    else if (data.suggestion === '??鞈?' || data.suggestion === '?征??') { suggestionArea.classList.add('bg-yellow-50', 'border-yellow-500', 'text-yellow-800'); }
                    else if (data.suggestion === '蝑?') { suggestionArea.classList.add('bg-gray-100', 'border-gray-400', 'text-gray-600'); }
                     else { suggestionArea.classList.add('bg-gray-100', 'border-gray-400', 'text-gray-600'); }

                    hideLoading();
                    showSuccess("?葫摰?嚗?);
                    if(backtestWorker) backtestWorker.terminate(); backtestWorker = null;
                }
            } else if(type==='suggestionError'){
                const suggestionArea = document.getElementById('today-suggestion-area');
                const suggestionText = document.getElementById('suggestion-text');
                if(suggestionArea && suggestionText){
                    suggestionText.textContent = data.message || '閮?撱箄降??隤?;
                    suggestionArea.classList.remove('hidden', 'loading');
                    suggestionArea.className = 'my-4 p-4 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-md text-center';
                }
                 hideLoading();
                 showError("?葫摰?嚗?閮?撱箄降??隤扎?);
                 if(backtestWorker) backtestWorker.terminate(); backtestWorker = null;
            } else if(type==='error'){
                showError(data?.message||'?葫???航炊');
                if(backtestWorker)backtestWorker.terminate(); backtestWorker=null;
                hideLoading();
                const suggestionArea = document.getElementById('today-suggestion-area');
                 if (suggestionArea) suggestionArea.classList.add('hidden');
                 resetStrategyStatusCard('idle');
            }
        };

        backtestWorker.onerror=e=>{
             showError(`Worker?航炊: ${e.message}`); console.error("[Main] Worker Error:",e);
             if(backtestWorker)backtestWorker.terminate(); backtestWorker=null;
             hideLoading();
             const suggestionArea = document.getElementById('today-suggestion-area');
              if (suggestionArea) suggestionArea.classList.add('hidden');
              resetStrategyStatusCard('idle');
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
                workerMsg.cachedData = cachePayload; // Prefer摰敹怠?鞈?
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
        showError(`?瑁??葫??隤? ${error.message}`);
        hideLoading();
        const suggestionArea = document.getElementById('today-suggestion-area');
        if (suggestionArea) suggestionArea.classList.add('hidden');
        resetStrategyStatusCard('idle');
        if(backtestWorker)backtestWorker.terminate(); backtestWorker = null;
    }
}

function clearPreviousResults() {
    document.getElementById("backtest-result").innerHTML=`<p class="text-gray-500">隢銵?皜?/p>`;
    document.getElementById("trade-results").innerHTML=`<p class="text-gray-500">隢銵?皜?/p>`;
    document.getElementById("optimization-results").innerHTML=`<p class="text-gray-500">隢銵??/p>`;
    document.getElementById("performance-table-container").innerHTML=`<p class="text-gray-500">隢??瑁??葫隞亦????蜀???/p>`;
    if(stockChart){
        stockChart.destroy(); 
        stockChart=null; 
        const chartContainer = document.getElementById('chart-container');
        if (chartContainer) {
            chartContainer.innerHTML = '<canvas id="chart" class="w-full h-full absolute inset-0"></canvas><div class="text-muted text-center" style="color: var(--muted-foreground);"><i data-lucide="bar-chart-3" class="lucide w-12 h-12 mx-auto mb-2 opacity-50"></i><p>?瑁??葫敺?憿舐內瘛典潭蝺?/p></div>';
            if (typeof lucide !== 'undefined' && lucide.createIcons) {
                lucide.createIcons();
            }
        }
    }
    const resEl=document.getElementById("result");
    resEl.className = 'my-6 p-4 bg-blue-100 border-l-4 border-blue-500 text-blue-700 rounded-md';
    resEl.innerHTML = `<i class="fas fa-info-circle mr-2"></i> 隢身摰??訾蒂?瑁??;
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
    resetStrategyStatusCard('idle');
    visibleStockData = [];
    renderPricePipelineSteps();
    renderPriceInspectorDebug();
    refreshDataDiagnosticsPanel();
}

const adjustmentReasonLabels = {
    missingPriceRow: '蝻箏?撠??寞',
    invalidBaseClose: '?⊥??箸???,
    ratioOutOfRange: '隤踵瘥??啣虜',
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
        .join('??);
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
        let detailText = step.detail ? ` ??${escapeHtml(step.detail)}` : '';
        if (step.key === 'adjustmentApply' && lastPriceDebug.fallbackApplied) {
            detailText += ' ??撌脣??典??渡葬??;
        }
        const reasonFormatted = step.skipReasons ? formatSkipReasons(step.skipReasons) : '';
        const reasonText = reasonFormatted ? ` ??${escapeHtml(reasonFormatted)}` : '';
        return `<div class="flex items-center gap-2 text-[11px]">
            <span class="${status}">??/span>
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
        summaryItems.push(`?? ${applied} 隞跆);
        summaryItems.push(`?仿? ${skipped} 隞跆);
    }
    if (lastPriceDebug.fallbackApplied) {
        summaryItems.push('?蝮格撌脣???);
    }
    const summaryLine = summaryItems.length > 0
        ? `<div class="text-[11px] font-medium" style="color: var(--foreground);">${escapeHtml(summaryItems.join(' ??'))}</div>`
        : '';
    const stepsHtml = lastPriceDebug.steps.map((step) => {
        const status = step.status === 'success' ? 'text-emerald-600'
            : step.status === 'warning' ? 'text-amber-600' : 'text-rose-600';
        let detailText = step.detail ? ` ??${escapeHtml(step.detail)}` : '';
        if (step.key === 'adjustmentApply' && lastPriceDebug.fallbackApplied) {
            detailText += ' ??撌脣??典??渡葬??;
        }
        const reasonFormatted = step.skipReasons ? formatSkipReasons(step.skipReasons) : '';
        const reasonText = reasonFormatted ? ` ??${escapeHtml(reasonFormatted)}` : '';
        return `<div class="flex items-start gap-2 text-[11px]">
            <span class="${status}">??/span>
            <span style="color: var(--foreground);">${escapeHtml(step.label)}${detailText}${reasonText}</span>
        </div>`;
    }).join('');
    panel.innerHTML = `<div class="space-y-2">${summaryLine}${stepsHtml}</div>`;
    panel.classList.remove('hidden');
}

const dataDiagnosticsState = { open: false };

function formatDiagnosticsValue(value) {
    if (value === null || value === undefined || value === '') return '??;
    if (typeof value === 'number') {
        if (Number.isNaN(value)) return '??;
        return value.toString();
    }
    return String(value);
}

function formatDiagnosticsRange(start, end) {
    if (!start && !end) return '??;
    if (start && end) return `${start} ~ ${end}`;
    return start || end || '??;
}

function formatDiagnosticsIndex(entry) {
    if (!entry || typeof entry !== 'object') return '??;
    const date = entry.date || '??;
    const index = Number.isFinite(entry.index) ? `#${entry.index}` : '#??;
    return `${date} (${index})`;
}

function formatDiagnosticsGap(days) {
    if (!Number.isFinite(days)) return '??;
    if (days === 0) return '0 憭?;
    return `${days > 0 ? '+' : ''}${days} 憭奈;
}

function formatDiagnosticsReasonCounts(reasons) {
    if (!reasons || typeof reasons !== 'object') return '??;
    const entries = Object.entries(reasons)
        .map(([reason, count]) => [reason, Number(count)])
        .filter(([, count]) => Number.isFinite(count) && count > 0)
        .sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) return '??;
    return entries.map(([reason, count]) => `${reason}?${count}`).join('??);
}

function getStrategyStatusCardElements() {
    const card = document.getElementById('strategy-status-card');
    const headline = document.getElementById('strategy-status-headline');
    const detail = document.getElementById('strategy-status-detail');
    const badge = document.getElementById('strategy-status-badge');
    if (!card || !headline || !detail || !badge) return null;
    return { card, headline, detail, badge };
}

function setStrategyStatusCardState({ visible, variant, badgeText, headlineText, detailText, detailHTML }) {
    const elements = getStrategyStatusCardElements();
    if (!elements) return;
    const { card, headline, detail, badge } = elements;
    const variantClass = STRATEGY_STATUS_BADGE_VARIANTS[variant] || STRATEGY_STATUS_BADGE_VARIANTS.neutral;
    badge.className = `${STRATEGY_STATUS_BADGE_BASE_CLASS} ${variantClass}`;
    badge.textContent = badgeText;
    headline.textContent = headlineText;
    if (typeof detailHTML === 'string' && detailHTML.length > 0) {
        detail.innerHTML = detailHTML;
    } else if (detailText !== undefined && detailText !== null) {
        detail.textContent = detailText;
    } else {
        detail.textContent = '';
    }
    if (visible) {
        card.classList.remove('hidden');
    } else {
        card.classList.add('hidden');
    }
}

function resetStrategyStatusCard(mode = 'idle') {
    if (mode === 'loading') {
        setStrategyStatusCardState({
            visible: true,
            variant: 'loading',
            badgeText: '閮?銝?,
            headlineText: '甇?瘥?隤啁??唳?敺?,
            detailText: '瞍?撠?甇?蕃?暹??蝑?撠望????唳?瘥???璅?瑼ｇ?隢??瘞渡????颯?,
        });
        return;
    }
    setStrategyStatusCardState({
        visible: false,
        variant: 'loading',
        badgeText: '撠?魚',
        headlineText: '?瑁??葫敺??剜?蝑?唳?',
        detailText: '?葫銝蝯?嚗????餌????亥?鞎瑕??隤唬?銝◢嚗????垢?箸?璅?瑼Ｗ?敺?霈?蝘??啣?擃釭??,
    });
}

function toFiniteNumber(value) {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }
    if (typeof value === 'string') {
        const parsed = Number.parseFloat(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

function formatPercentValue(value) {
    const num = toFiniteNumber(value);
    if (num === null) return '??;
    const prefix = num > 0 ? '+' : num < 0 ? '' : '';
    return `${prefix}${num.toFixed(2)}%`;
}

function formatPercentDiff(value) {
    const num = toFiniteNumber(value);
    if (num === null) return '0.00 ???';
    return `${Math.abs(num).toFixed(2)} ???`;
}

function splitSummaryIntoBulletLines(summary) {
    if (typeof summary !== 'string') return [];
    return summary
        .split(/[嚗?]+/u)
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0)
        .map((segment) => {
            if (/[??嚗$/u.test(segment)) {
                return segment;
            }
            return `${segment}?;
        });
}

function buildStrategyHealthSummary(result) {
    const thresholds = STRATEGY_HEALTH_THRESHOLDS;
    const highlights = [];
    const cautions = [];

    const annualized = toFiniteNumber(result && result.annualizedReturn);
    if (annualized !== null) {
        if (annualized >= thresholds.annualizedReturn) {
            highlights.push(`撟游??梢 ${annualized.toFixed(2)}%`);
        } else {
            cautions.push(`撟游??梢?芣? ${annualized.toFixed(2)}%嚗???賢?撘梧?撱箄降瑼Ｚ??脣?渡?憟);
        }
    }

    const sharpeRaw = result && result.sharpeRatio;
    if (typeof sharpeRaw === 'number' && !Number.isNaN(sharpeRaw)) {
        if (Number.isFinite(sharpeRaw)) {
            if (sharpeRaw >= thresholds.sharpeRatio) {
                highlights.push(`憭??${sharpeRaw.toFixed(2)}`);
            } else {
                cautions.push(`憭?澆? ${sharpeRaw.toFixed(2)}嚗郭??靘??梢銝?瞍漁嚗??芣?閬??????);
            }
        } else if (sharpeRaw > 0) {
            highlights.push('憭?潸隅餈蝒桀之');
        }
    }

    const sortinoRaw = result && result.sortinoRatio;
    if (typeof sortinoRaw === 'number' && !Number.isNaN(sortinoRaw)) {
        if (Number.isFinite(sortinoRaw)) {
            if (sortinoRaw >= thresholds.sortinoRatio) {
                highlights.push(`蝝Ｘ?隢暹???${sortinoRaw.toFixed(2)}`);
            } else {
                cautions.push(`蝝Ｘ?隢暹????${sortinoRaw.toFixed(2)}嚗?瑼◢?芣?嗅?????閮?閮剖???`);
            }
        } else if (sortinoRaw > 0) {
            highlights.push('蝝Ｘ?隢暹??扔雿喉?頞刻??∠狙憭改?');
        }
    }

    const maxDrawdownRaw = toFiniteNumber(result && result.maxDrawdown);
    if (maxDrawdownRaw !== null) {
        const dd = Math.abs(maxDrawdownRaw);
        if (dd <= thresholds.maxDrawdown) {
            highlights.push(`?憭批??文? ${dd.toFixed(2)}%`);
        } else {
            cautions.push(`?憭批??日? ${dd.toFixed(2)}%嚗雿?賜?甇瑁?憭批?瑼???閬?鞈?蝺抵?`);
        }
    }

    const annHalf1 = toFiniteNumber(result && result.annReturnHalf1);
    const annHalf2 = toFiniteNumber(result && result.annReturnHalf2);
    if (annHalf1 !== null && annHalf2 !== null && annHalf1 !== 0) {
        const ratio = annHalf2 / annHalf1;
        if (Number.isFinite(ratio)) {
            if (ratio >= thresholds.stabilityRatio) {
                highlights.push(`??畾萄?祆? ${ratio.toFixed(2)}`);
            } else {
                cautions.push(`??畾萄?祆???${ratio.toFixed(2)}嚗??亙銝?撣?????撱箄降憭?皛曉?撽?`);
            }
        }
    }

    const sharpeHalf1 = toFiniteNumber(result && result.sharpeHalf1);
    const sharpeHalf2 = toFiniteNumber(result && result.sharpeHalf2);
    if (sharpeHalf1 !== null && sharpeHalf2 !== null && sharpeHalf1 !== 0) {
        const ratio = sharpeHalf2 / sharpeHalf1;
        if (Number.isFinite(ratio)) {
            if (ratio >= thresholds.stabilityRatio) {
                highlights.push(`??畾萄??格? ${ratio.toFixed(2)}`);
            } else {
                cautions.push(`??畾萄??格??芣? ${ratio.toFixed(2)}嚗?賢??券??砍?嚗???撽?璅?`);
            }
        }
    }

    if (highlights.length === 0 && cautions.length === 0) {
        return '??撌⊥炎鞈?銝雲嚗?敺?頝?甈∠Ⅱ隤??;
    }

    if (cautions.length === 0) {
        const highlightText = highlights.join('??);
        return `??撌⊥炎?冽??嚗?{highlightText}嚗?蝑?桀??臭誑鋡怠??箝?撣詨末???扯”?玨?喳?;
    }

    const cautionText = cautions.join('嚗?);
    const highlightTail = highlights.length > 0 ? `嚗憭?${highlights.join('??)} 銵函??蝯血?嚗?敺??芸摰?` : '';
    return `??撌⊥炎嚗?{cautionText}${highlightTail}嚗?隤踵??????詨?銝;
}

function updateStrategyStatusCard(result) {
    const elements = getStrategyStatusCardElements();
    if (!elements) return;
    const strategyTotalReturn = toFiniteNumber(result && result.returnRate);
    let buyHoldTotalReturn = null;
    if (Array.isArray(result && result.buyHoldReturns)) {
        for (let idx = result.buyHoldReturns.length - 1; idx >= 0; idx -= 1) {
            const candidate = toFiniteNumber(result.buyHoldReturns[idx]);
            if (candidate !== null) {
                buyHoldTotalReturn = candidate;
                break;
            }
        }
    }
    const strategyAnnual = toFiniteNumber(result && result.annualizedReturn);
    const buyHoldAnnual = toFiniteNumber(result && result.buyHoldAnnualizedReturn);

    let metricLabel = '蝮賢?祉?';
    let strategyMetric = strategyTotalReturn;
    let buyHoldMetric = buyHoldTotalReturn;
    let diff = strategyMetric !== null && buyHoldMetric !== null
        ? strategyMetric - buyHoldMetric
        : null;

    if (diff === null && strategyAnnual !== null && buyHoldAnnual !== null) {
        metricLabel = '撟游??梢??;
        strategyMetric = strategyAnnual;
        buyHoldMetric = buyHoldAnnual;
        diff = strategyMetric - buyHoldMetric;
    }

    if (diff === null || strategyMetric === null || buyHoldMetric === null) {
        setStrategyStatusCardState({
            visible: true,
            variant: 'loading',
            badgeText: '鞈?鋆?',
            headlineText: '? 鞈??鋆?',
            detailText: '餈?鞈??眺?交??皞??刻楝銝?隢炎?亙??身摰?蝔???銝甈～?,
        });
        return;
    }

    let variant = 'neutral';
    let badgeText = '???芸?';
    let headlineText = '?? ?急???撟單?';
    let baseDetailText = `蝑${metricLabel} ${formatPercentValue(strategyMetric)}嚗眺?交???${formatPercentValue(buyHoldMetric)}嚗榆頝??${formatPercentDiff(diff)}??憒典凝隤踹???鞈??蔭嚗?銝??撠望?璈?頞??;
    let detailHTML = null;

    const healthSummary = buildStrategyHealthSummary(result);

    if (diff > STRATEGY_STATUS_DIFF_THRESHOLD) {
        variant = 'positive';
        badgeText = '蝑??';
        headlineText = '?? 蝑摰?鞎瑕??';
        baseDetailText = `蝑${metricLabel} ${formatPercentValue(strategyMetric)}嚗眺?交???${formatPercentValue(buyHoldMetric)}嚗????${formatPercentDiff(diff)}???隞交?芸楛??嚗?憸券?抒恣?銝擛??;
    } else if (diff < -STRATEGY_STATUS_DIFF_THRESHOLD) {
        variant = 'negative';
        badgeText = '蝑?硃';
        headlineText = '??儭?蝑?急??賢?';
        const bulletLines = [
            `蝑${metricLabel} ${formatPercentValue(strategyMetric)}嚗眺?交???${formatPercentValue(buyHoldMetric)}嚗?敺?${formatPercentDiff(diff)}?,
        ];
        if (healthSummary) {
            const healthLines = splitSummaryIntoBulletLines(healthSummary);
            if (healthLines.length > 0) {
                bulletLines.push(...healthLines);
            } else {
                bulletLines.push(healthSummary.endsWith('??) ? healthSummary : `${healthSummary}?);
            }
        }
        const bulletListHtml = bulletLines
            .map((line) => `<li>${escapeHtml(line)}</li>`)
            .join('');
        detailHTML = `
            <p class="text-[15px] font-semibold leading-relaxed" style="color: var(--foreground);">敹怠?怎??亙??憸券蝞∠?撠?隤踵?嚗?銝瘜ａ???/p>
            <ul class="mt-2 space-y-1 list-disc pl-5 text-[13px] leading-relaxed" style="color: var(--foreground);">
                ${bulletListHtml}
            </ul>
        `.trim();
    }

    const detailText = detailHTML
        ? undefined
        : healthSummary
            ? `${baseDetailText} ${healthSummary}`
            : baseDetailText;

    setStrategyStatusCardState({
        visible: true,
        variant,
        badgeText,
        headlineText,
        detailText,
        detailHTML,
    });
}

function renderDiagnosticsEntries(containerId, entries) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!Array.isArray(entries) || entries.length === 0) {
        container.innerHTML = `<p class="text-[11px]" style="color: var(--muted-foreground);">?∟???/p>`;
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
        container.innerHTML = `<p class="text-[11px]" style="color: var(--muted-foreground);">${options.emptyText || '?∠撣豢見??}</p>`;
        return;
    }
    container.innerHTML = samples
        .map((sample) => {
            const date = escapeHtml(sample.date || '');
            const index = Number.isFinite(sample.index) ? `#${sample.index}` : '#??;
            const reasons = Array.isArray(sample.reasons)
                ? escapeHtml(sample.reasons.join('??))
                : '??;
            const close = sample.close !== undefined && sample.close !== null
                ? escapeHtml(sample.close.toString())
                : '??;
            const volume = sample.volume !== undefined && sample.volume !== null
                ? escapeHtml(sample.volume.toString())
                : '??;
            return `<div class="border rounded px-2 py-1 text-[11px]" style="border-color: var(--border);">
                <div style="color: var(--foreground);">${date} (${index})</div>
                <div class="text-muted-foreground" style="color: var(--muted-foreground);">??: ${reasons}</div>
                <div class="text-muted-foreground" style="color: var(--muted-foreground);">?嗥: ${close} 嚚??? ${volume}</div>
            </div>`;
        })
        .join('');
}

function renderDiagnosticsPreview(containerId, rows) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!Array.isArray(rows) || rows.length === 0) {
        container.innerHTML = `<p class="text-[11px]" style="color: var(--muted-foreground);">撠???啗?璅???/p>`;
        return;
    }
    container.innerHTML = rows
        .map((row) => {
            const index = Number.isFinite(row.index) ? `#${row.index}` : '#??;
            const date = escapeHtml(row.date || '');
            const close = row.close !== undefined && row.close !== null
                ? escapeHtml(row.close.toString())
                : '??;
            const open = row.open !== undefined && row.open !== null
                ? escapeHtml(row.open.toString())
                : '??;
            const high = row.high !== undefined && row.high !== null
                ? escapeHtml(row.high.toString())
                : '??;
            const low = row.low !== undefined && row.low !== null
                ? escapeHtml(row.low.toString())
                : '??;
            const volume = row.volume !== undefined && row.volume !== null
                ? escapeHtml(row.volume.toString())
                : '??;
            return `<div class="border rounded px-2 py-1 text-[11px]" style="border-color: var(--border);">
                <div style="color: var(--foreground);">${date} (${index})</div>
                <div class="text-muted-foreground" style="color: var(--muted-foreground);">??${open} 擃?${high} 雿?${low}</div>
                <div class="text-muted-foreground" style="color: var(--muted-foreground);">??${close} 嚚???${volume}</div>
            </div>`;
        })
        .join('');
}

function renderDiagnosticsTestingGuidance(diag) {
    const container = document.getElementById('dataDiagnosticsTesting');
    if (!container) return;
    if (!diag) {
        container.innerHTML = `<p class="text-[11px]" style="color: var(--muted-foreground);">?瑁??葫敺??冽迨??撱箄降???葫閰行郊撽?/p>`;
        return;
    }
    const dataset = diag.runtime?.dataset || {};
    const buyHold = diag.runtime?.buyHold || {};
    const fetchOverview = diag.fetch?.overview || {};
    const reasonSummary = formatDiagnosticsReasonCounts(dataset.invalidRowsInRange?.reasons);
    const buyHoldFirst = buyHold.firstValidPriceDate || '??;
    const fetchRange = formatDiagnosticsRange(fetchOverview.firstDate, fetchOverview.lastDate);
    container.innerHTML = `<ol class="list-decimal pl-4 space-y-1">
        <li style="color: var(--foreground);">隢?撠?銵刻絲暺?${escapeHtml(dataset.requestedStart || '??)}嚗?鞎瑕??擐嚗?{escapeHtml(buyHoldFirst)}嚗?銝行???銝迨?∠??芸???/li>
        <li style="color: var(--foreground);">?乓??雿絞閮＊蝷?${escapeHtml(reasonSummary)}嚗??瑕? console 銝?[Worker] dataset/fetch summary ?”?潸撓?箝?/li>
        <li style="color: var(--foreground);">蝣箄??垢鞈?蝭? ${escapeHtml(fetchRange)} ?臬閬??澈??憒?蝻箄????澆??望?閮餉???/li>
    </ol>`;
}

function renderDiagnosticsFetch(fetchDiag) {
    const summaryContainer = document.getElementById('dataDiagnosticsFetchSummary');
    const monthsContainer = document.getElementById('dataDiagnosticsFetchMonths');
    if (!summaryContainer || !monthsContainer) return;
    if (!fetchDiag) {
        summaryContainer.innerHTML = `<p class="text-[11px]" style="color: var(--muted-foreground);">撠?瑕??垢鞈???/p>`;
        monthsContainer.innerHTML = '';
        return;
    }
    const overview = fetchDiag.overview || {};
    renderDiagnosticsEntries('dataDiagnosticsFetchSummary', [
        { label: '??韏琿?', value: fetchDiag.dataStartDate || fetchDiag.requested?.start || '?? },
        { label: '?垢鞈?蝭?', value: formatDiagnosticsRange(overview.firstDate, overview.lastDate) },
        { label: '?澈韏琿?', value: overview.warmupStartDate || fetchDiag.dataStartDate || fetchDiag.requested?.start || '?? },
        { label: '蝚砌?蝑????, value: formatDiagnosticsIndex(overview.firstValidCloseOnOrAfterWarmupStart || overview.firstValidCloseOnOrAfterEffectiveStart) },
        { label: '頝?頨怨絲暺予??, value: formatDiagnosticsGap(overview.firstValidCloseGapFromWarmup ?? overview.firstValidCloseGapFromEffective) },
        { label: '?垢?⊥?蝑', value: overview.invalidRowsInRange?.count ?? 0 },
        { label: '?垢?⊥?甈?', value: formatDiagnosticsReasonCounts(overview.invalidRowsInRange?.reasons) },
        { label: '?漲?挾', value: Array.isArray(fetchDiag.months) ? fetchDiag.months.length : 0 },
    ]);
    if (!Array.isArray(fetchDiag.months) || fetchDiag.months.length === 0) {
        monthsContainer.innerHTML = `<p class="text-[11px]" style="color: var(--muted-foreground);">瘝??漲敹怠?蝝??/p>`;
        return;
    }
    const recentMonths = fetchDiag.months.slice(-6);
    monthsContainer.innerHTML = recentMonths
        .map((month) => {
            const monthLabel = escapeHtml(month.label || month.monthKey || '??);
            const rows = formatDiagnosticsValue(month.rowsReturned);
            const missing = formatDiagnosticsValue(month.missingSegments);
            const forced = formatDiagnosticsValue(month.forcedRepairs);
            const firstDate = escapeHtml(month.firstRowDate || '??);
            const cacheUsed = month.usedCache ? '?? : '??;
            return `<div class="border rounded px-2 py-1 text-[11px]" style="border-color: var(--border);">
                <div class="font-medium" style="color: var(--foreground);">${monthLabel}</div>
                <div class="flex flex-wrap gap-2 text-muted-foreground" style="color: var(--muted-foreground);">
                    <span>蝑 ${rows}</span>
                    <span>蝻箏 ${missing}</span>
                    <span>撘瑕鋆? ${forced}</span>
                    <span>擐? ${firstDate}</span>
                    <span>雿輻敹怠? ${cacheUsed}</span>
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
        hintEl.textContent = '隢??瑁??葫敺????頨怨?敹怠?閮箸鞈???;
        contentEl.classList.add('hidden');
        titleEl.textContent = '鞈??澈閮箸';
        renderDiagnosticsEntries('dataDiagnosticsSummary', []);
        renderDiagnosticsEntries('dataDiagnosticsName', []);
        renderDiagnosticsEntries('dataDiagnosticsWarmup', []);
        renderDiagnosticsEntries('dataDiagnosticsBuyHold', []);
        renderDiagnosticsSamples('dataDiagnosticsInvalidSamples', []);
        renderDiagnosticsSamples('dataDiagnosticsBuyHoldSamples', []);
        renderDiagnosticsFetch(null);
        renderDiagnosticsPreview('dataDiagnosticsPreview', []);
        renderDiagnosticsTestingGuidance(null);
        return;
    }
    hintEl.textContent = '?仿????嚗?銝雿菜?靘迨?∠??批捆??console 閮箸鞈???;
    contentEl.classList.remove('hidden');
    const meta = diag.meta || {};
    const dataset = diag.runtime?.dataset || {};
    const warmup = diag.runtime?.warmup || {};
    const buyHold = diag.runtime?.buyHold || {};
    titleEl.textContent = `鞈??澈閮箸嚗?{dataset.requestedStart || warmup.requestedStart || '??} ??${dataset.endDate || diag.fetch?.requested?.end || '??}`;
    renderDiagnosticsEntries('dataDiagnosticsName', [
        { label: '?∠巨隞?Ⅳ', value: meta.stockNo || dataset.stockNo || '?? },
        { label: '?∠巨?迂', value: meta.stockName || '?? },
        { label: '?迂靘?', value: meta.nameSource || '?? },
        { label: '?迂撣', value: meta.nameMarket ? getMarketDisplayName(meta.nameMarket) : '?? },
        { label: '?啗皜靘?', value: meta.directorySource || '?? },
        { label: '皜?', value: meta.directoryVersion || '?? },
        { label: '皜?湔??', value: meta.directoryUpdatedAt || '?? },
    ]);
    renderDiagnosticsEntries('dataDiagnosticsSummary', [
        { label: '鞈?蝮賜???, value: dataset.totalRows },
        { label: '鞈?蝭?', value: formatDiagnosticsRange(dataset.firstDate, dataset.lastDate) },
        { label: '雿輻?絲暺?, value: dataset.requestedStart || warmup.requestedStart || '?? },
        { label: '?澈韏琿?', value: dataset.warmupStartDate || warmup.warmupStartDate || dataset.dataStartDate || warmup.dataStartDate || '?? },
        { label: '?澈蝑', value: dataset.warmupRows },
        { label: '?????, value: dataset.rowsWithinRange },
        { label: '蝚砌?蝑?=雿輻?絲暺?, value: formatDiagnosticsIndex(dataset.firstRowOnOrAfterRequestedStart) },
        { label: '蝚砌?蝑????, value: formatDiagnosticsIndex(dataset.firstValidCloseOnOrAfterRequestedStart) },
        { label: '頝?頨怨絲暺予??, value: formatDiagnosticsGap(dataset.firstValidCloseGapFromWarmup ?? dataset.firstValidCloseGapFromEffective) },
        { label: '頝蝙?刻絲暺予??, value: formatDiagnosticsGap(dataset.firstValidCloseGapFromRequested) },
        { label: '???⊥?蝑', value: dataset.invalidRowsInRange?.count ?? 0 },
        { label: '蝚砌?蝑????, value: dataset.firstInvalidRowOnOrAfterEffectiveStart ? formatDiagnosticsIndex(dataset.firstInvalidRowOnOrAfterEffectiveStart) : '?? },
        { label: '?⊥?甈?蝯梯?', value: formatDiagnosticsReasonCounts(dataset.invalidRowsInRange?.reasons) },
    ]);
    renderDiagnosticsSamples(
        'dataDiagnosticsInvalidSamples',
        dataset.invalidRowsInRange?.samples || [],
        { emptyText: '??撠閫撖?⊥?蝑?? }
    );
    renderDiagnosticsEntries('dataDiagnosticsWarmup', [
        { label: '?澈韏琿?', value: warmup.warmupStartDate || warmup.dataStartDate || dataset.warmupStartDate || '?? },
        { label: 'Longest ??蝒?, value: warmup.longestLookback },
        { label: 'KD ?瘙?(憭?蝛?', value: `${formatDiagnosticsValue(warmup.kdNeedLong)} / ${formatDiagnosticsValue(warmup.kdNeedShort)}` },
        { label: 'MACD ?瘙?(憭?蝛?', value: `${formatDiagnosticsValue(warmup.macdNeedLong)} / ${formatDiagnosticsValue(warmup.macdNeedShort)}` },
        { label: '璅⊥韏瑕?蝝Ｗ?', value: warmup.computedStartIndex },
        { label: '??韏瑕?蝝Ｗ?', value: warmup.effectiveStartIndex },
        { label: '?澈?蝑', value: warmup.barsBeforeFirstTrade },
        { label: '閮剖? Lookback 憭拇', value: warmup.lookbackDays },
        { label: '頝?頨怨絲暺予??, value: formatDiagnosticsGap(warmup.firstValidCloseGapFromWarmup ?? dataset.firstValidCloseGapFromWarmup) },
    ]);
    renderDiagnosticsEntries('dataDiagnosticsBuyHold', [
        { label: '擐????嗥蝝Ｗ?', value: buyHold.firstValidPriceIdx },
        { label: '擐????嗥?交?', value: buyHold.firstValidPriceDate || '?? },
        { label: '頝?頨怨絲暺予??, value: formatDiagnosticsGap(buyHold.firstValidPriceGapFromEffective) },
        { label: '頝蝙?刻絲暺予??, value: formatDiagnosticsGap(buyHold.firstValidPriceGapFromRequested) },
        { label: '?澈敺??斤???, value: buyHold.invalidBarsBeforeFirstValid?.count ?? 0 },
    ]);
    renderDiagnosticsSamples(
        'dataDiagnosticsBuyHoldSamples',
        buyHold.invalidBarsBeforeFirstValid?.samples || [],
        { emptyText: '?澈敺閫撖?嗥?寧撩憭晞? }
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
        container.innerHTML = `<div class="rounded-md border border-dashed px-3 py-2" style="border-color: var(--border); color: var(--muted-foreground);">撠蝝舐? Blob ?券?蝯梯?嚗銵?皜砍?撠甇日＊蝷箸??雿???亥岷??/div>`;
        if (updatedAtEl) updatedAtEl.textContent = '';
        return;
    }
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthRecord = blobUsageLedger.months?.[monthKey] || null;
    if (!monthRecord) {
        container.innerHTML = `<div class="rounded-md border border-dashed px-3 py-2" style="border-color: var(--border); color: var(--muted-foreground);">?祆?撠閫貊隞颱? Blob ????/div>`;
        if (updatedAtEl) updatedAtEl.textContent = '';
        return;
    }
    const totalOps = Number(monthRecord.readOps || 0) + Number(monthRecord.writeOps || 0);
    const hit = Number(monthRecord.cacheHits || 0);
    const miss = Number(monthRecord.cacheMisses || 0);
    const hitRate = totalOps > 0 ? `${((hit / totalOps) * 100).toFixed(1)}%` : '??;
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
            .map((item) => `<div class="flex items-center justify-between"><span>${escapeHtml(item.stock)}</span><span style="color: var(--muted-foreground);">${item.count} 甈?{item.market ? `??{escapeHtml(item.market)}` : ''}</span></div>`)
            .join('')
        : '<div style="color: var(--muted-foreground);">撠?梢??亥岷</div>';

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
            const indicator = expanded ? '嚗? : '嚗?;
            const rowsHtml = group.rows.map((item) => {
                const actionLabel = item.raw.action === 'write' ? '撖怠' : '霈??;
                const badgeClass = item.raw.action === 'write'
                    ? 'bg-amber-100 text-amber-700 border-amber-200'
                    : 'bg-emerald-100 text-emerald-700 border-emerald-200';
                const statusLabel = item.raw.cacheHit ? '?賭葉' : '鋆?';
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
                        <span>${group.rows.length} 蝑?/span>
                        <span data-blob-group-indicator="${group.key}" aria-hidden="true">${indicator}</span>
                    </span>
                </button>
                <div class="space-y-2 px-3 pb-3 ${expanded ? '' : 'hidden'}" data-blob-group-body="${group.key}">
                    ${rowsHtml}
                </div>
            </div>`;
        }).join('')
        : '<div style="color: var(--muted-foreground);">撠閮?餈???</div>';

    container.innerHTML = `
        <div class="grid grid-cols-2 gap-3 text-[11px]">
            <div class="rounded-md border px-3 py-2" style="border-color: var(--border);">
                <div class="font-medium" style="color: var(--foreground);">?祆?????/div>
                <div class="mt-1 text-lg font-semibold" style="color: var(--foreground);">${formatNumberWithComma(totalOps)}</div>
                <div class="mt-1 text-xs" style="color: var(--muted-foreground);">霈??${formatNumberWithComma(monthRecord.readOps || 0)}?餃神??${formatNumberWithComma(monthRecord.writeOps || 0)}</div>
            </div>
            <div class="rounded-md border px-3 py-2" style="border-color: var(--border);">
                <div class="font-medium" style="color: var(--foreground);">?賭葉??/div>
                <div class="mt-1 text-lg font-semibold" style="color: var(--foreground);">${hitRate}</div>
                <div class="mt-1 text-xs" style="color: var(--muted-foreground);">?賭葉 ${formatNumberWithComma(hit)}?餉???${formatNumberWithComma(miss)}</div>
            </div>
        </div>
        <div class="rounded-md border px-3 py-2" style="border-color: var(--border);">
            <div class="font-medium mb-1" style="color: var(--foreground);">?梢??∠巨</div>
            <div class="space-y-1">${topStocksHtml}</div>
        </div>
        <div class="rounded-md border px-3 py-2" style="border-color: var(--border);">
            <div class="font-medium mb-1" style="color: var(--foreground);">餈???</div>
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
                if (indicator) indicator.textContent = nextState ? '嚗? : '嚗?;
                setBlobUsageGroupExpanded(dateKey, nextState);
            });
        });
    }

    if (updatedAtEl) {
        updatedAtEl.textContent = blobUsageLedger.updatedAt
            ? `?湔??${new Date(blobUsageLedger.updatedAt).toLocaleString('zh-TW')}`
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
        let sourceText = `?豢?靘?: ${dataSource}`;
        displayEl.textContent = sourceText;
        displayEl.classList.remove('hidden');
        if (typeof window.refreshDataSourceTester === 'function') {
            try {
                window.refreshDataSourceTester();
            } catch (error) {
                console.warn('[Main] ?湔鞈?靘?皜祈岫?Ｘ???憭?', error);
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
    const modeLabel = modeKey === 'adjusted' ? '???寞' : '???嗥??;
    const sourceLabel = resolvePriceInspectorSourceLabel();
    const lastStartFallback = lastFetchSettings?.effectiveStartDate || lastFetchSettings?.startDate || '';
    const displayData = visibleStockData.length > 0 ? visibleStockData : [];
    const firstDate = displayData[0]?.date || lastStartFallback;
    const lastDate = displayData[displayData.length - 1]?.date || lastFetchSettings?.endDate || '';

    controls.classList.remove('hidden');
    openBtn.disabled = false;
    if (summaryEl) {
        const summaryParts = [`${firstDate} ~ ${lastDate}`, `${displayData.length} 蝑?(${modeLabel})`];
        if (sourceLabel) {
            summaryParts.push(sourceLabel);
        }
        summaryEl.textContent = summaryParts.join(' ??');
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

    pushColumn('longEntry', `憭?脣嚚?{resolveStrategyDisplayName(lastOverallResult.entryStrategy)}`);
    pushColumn('longExit', `憭?箏嚚?{resolveStrategyDisplayName(lastOverallResult.exitStrategy)}`);
    if (lastOverallResult.enableShorting) {
        pushColumn('shortEntry', `?征?脣嚚?{resolveStrategyDisplayName(lastOverallResult.shortEntryStrategy)}`);
        pushColumn('shortExit', `?征?箏嚚?{resolveStrategyDisplayName(lastOverallResult.shortExitStrategy)}`);
    }
    return columns;
}

function formatIndicatorNumericValue(value, column) {
    if (!Number.isFinite(value)) return '銝雲';
    if (column?.format === 'integer') {
        return Math.round(value).toLocaleString('zh-TW');
    }
    const digits = typeof column?.decimals === 'number' ? column.decimals : 2;
    return Number(value).toFixed(digits);
}

function renderIndicatorCell(columnGroup, rowIndex) {
    if (!columnGroup || !Array.isArray(columnGroup.columns) || columnGroup.columns.length === 0) {
        return '??;
    }
    const lines = [];
    columnGroup.columns.forEach((col) => {
        const values = Array.isArray(col.values) ? col.values : [];
        const rawValue = values[rowIndex];
        if (col.format === 'text') {
            const textValue = rawValue !== null && rawValue !== undefined && rawValue !== ''
                ? String(rawValue)
                : '??;
            lines.push(`${escapeHtml(col.label)}: ${escapeHtml(textValue)}`);
        } else {
            const formatted = formatIndicatorNumericValue(rawValue, col);
            lines.push(`${escapeHtml(col.label)}: ${formatted}`);
        }
    });
    return lines.length > 0 ? lines.join('<br>') : '??;
}

function formatStageModeLabel(mode, type) {
    if (!mode) return '';
    if (type === 'entry') {
        return mode === 'price_pullback' ? '?寞??Ⅳ' : '蝑閮??孛??;
    }
    if (type === 'exit') {
        return mode === 'price_rally' ? '?寞韏圈???箏' : '蝑閮??孛??;
    }
    return '';
}

function resolveStageModeDisplay(stageCandidate, stageMode, type) {
    if (stageCandidate && stageCandidate.isSingleFull) {
        return '?';
    }
    const explicitLabel = stageMode && typeof stageMode === 'object' && typeof stageMode.label === 'string'
        ? stageMode.label
        : '';
    const modeValue = stageMode && typeof stageMode === 'object' && stageMode.value !== undefined
        ? stageMode.value
        : stageMode;
    const fallbackLabel = formatStageModeLabel(modeValue, type);
    return explicitLabel || fallbackLabel || '??;
}

function renderStageStateCell(state, context) {
    if (!state || typeof state !== 'object') return '??;
    const type = context?.type === 'exit' ? 'exit' : 'entry';
    const parts = [];
    const modeLabel = formatStageModeLabel(state.mode, type);
    if (modeLabel) parts.push(escapeHtml(modeLabel));

    if (type === 'entry') {
        if (Number.isFinite(state.filledStages) && Number.isFinite(state.totalStages)) {
            parts.push(`撌脤?${state.filledStages}/${state.totalStages} 畾琛);
        }
        if (Number.isFinite(state.sharesHeld)) {
            parts.push(`? ${state.sharesHeld} ?︶);
        }
        if (Number.isFinite(state.averageEntryPrice)) {
            parts.push(`? ${state.averageEntryPrice.toFixed(2)}`);
        }
        if (Number.isFinite(state.lastStagePrice)) {
            parts.push(`??唳挾 ${state.lastStagePrice.toFixed(2)}`);
        }
        if (state.totalStages > state.filledStages) {
            if (state.mode === 'price_pullback' && Number.isFinite(state.nextTriggerPrice)) {
                parts.push(`敺孛?潘??嗥 < ${state.nextTriggerPrice.toFixed(2)}`);
            } else {
                parts.push('敺孛?潘?蝑閮?');
            }
        } else if (state.totalStages > 0 && state.filledStages >= state.totalStages) {
            parts.push('撌脣?賊脣');
        }
    } else {
        if (Number.isFinite(state.executedStages) && Number.isFinite(state.totalStages)) {
            parts.push(`撌脣 ${state.executedStages}/${state.totalStages} 畾琛);
        }
        if (Number.isFinite(state.remainingShares)) {
            parts.push(`?拚? ${state.remainingShares} ?︶);
        }
        if (Number.isFinite(state.lastStagePrice)) {
            parts.push(`??唳挾 ${state.lastStagePrice.toFixed(2)}`);
        }
        if (state.totalStages > state.executedStages) {
            if (state.mode === 'price_rally' && Number.isFinite(state.nextTriggerPrice)) {
                parts.push(`敺孛?潘??嗥 > ${state.nextTriggerPrice.toFixed(2)}`);
            } else {
                parts.push('敺孛?潘?蝑閮?');
            }
        } else if (state.totalStages > 0 && state.executedStages >= state.totalStages) {
            parts.push('撌脣?詨??);
        }
    }

    if (parts.length === 0) return '??;
    return parts.map((part) => escapeHtml(part)).join('<br>');
}

function openPriceInspectorModal() {
    if (!Array.isArray(visibleStockData) || visibleStockData.length === 0) {
        showError('撠???寞鞈?嚗??銵?皜研?);
        return;
    }
    const modal = document.getElementById('priceInspectorModal');
    const tbody = document.getElementById('priceInspectorTableBody');
    const subtitle = document.getElementById('priceInspectorSubtitle');
    if (!modal || !tbody) return;

    const modeKey = (lastFetchSettings?.priceMode || (lastFetchSettings?.adjustedPrice ? 'adjusted' : 'raw') || 'raw').toString().toLowerCase();
    const modeLabel = modeKey === 'adjusted' ? '憿舐內??敺?? : '憿舐內???嗥??;
    const sourceLabel = resolvePriceInspectorSourceLabel();
    if (subtitle) {
        const marketLabel = (lastFetchSettings?.market || lastFetchSettings?.marketType || currentMarket || 'TWSE').toUpperCase();
        const subtitleParts = [`${modeLabel}`, marketLabel, `${visibleStockData.length} 蝑];
        if (sourceLabel) {
            subtitleParts.push(sourceLabel);
        }
        subtitle.textContent = subtitleParts.join(' ??');
    }
    renderPriceInspectorDebug();

    // Patch Tag: LB-PRICE-INSPECTOR-20250512A
    const headerRow = document.getElementById('priceInspectorHeaderRow');
    const indicatorColumns = collectPriceInspectorIndicatorColumns();
    const longEntryStageStates = Array.isArray(lastOverallResult?.longEntryStageStates)
        ? lastOverallResult.longEntryStageStates
        : [];
    const longExitStageStates = Array.isArray(lastOverallResult?.longExitStageStates)
        ? lastOverallResult.longExitStageStates
        : [];
    const baseHeaderConfig = [
        { key: 'date', label: '?交?', align: 'left' },
        { key: 'open', label: '?', align: 'right' },
        { key: 'high', label: '?擃?, align: 'right' },
        { key: 'low', label: '?雿?, align: 'right' },
        { key: 'rawClose', label: '???嗥', align: 'right' },
        { key: 'close', label: '???嗥', align: 'right' },
        { key: 'factor', label: '????', align: 'right' },
    ];
    indicatorColumns.forEach((col) => {
        baseHeaderConfig.push({ key: col.key, label: col.header, align: 'left', isIndicator: true, series: col.series });
    });
    baseHeaderConfig.push(
        { key: 'longEntryStage', label: '憭?脣?挾', align: 'left' },
        { key: 'longExitStage', label: '憭?箏?挾', align: 'left' },
    );
    baseHeaderConfig.push(
        { key: 'position', label: '?????, align: 'left' },
        { key: 'formula', label: '閮??砍?', align: 'left' },
        { key: 'volume', label: '(?)??, align: 'right' },
        { key: 'source', label: '?寞靘?', align: 'left' },
    );

    if (headerRow) {
        headerRow.innerHTML = baseHeaderConfig
            .map((cfg) => `<th class="px-3 py-2 text-${cfg.align} font-medium">${escapeHtml(cfg.label)}</th>`)
            .join('');
    }

    const totalColumns = baseHeaderConfig.length;

    const formatNumber = (value, digits = 2) => (Number.isFinite(value) ? Number(value).toFixed(digits) : '??);
    const formatFactor = (value) => (Number.isFinite(value) && value !== 0 ? Number(value).toFixed(6) : '??);
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
                : '??;
            const factor = Number(row?.adjustedFactor);
            const closeValue = Number(row?.close);
            const rawCloseValue = computeRawClose(row);
            const rawCloseText = formatNumber(rawCloseValue);
            const closeText = formatNumber(closeValue);
            const factorText = formatFactor(factor);
            const hasFactor = Number.isFinite(factor) && Math.abs(factor) > 0;
            let formulaText = '??;
            if (closeText !== '??) {
                if (hasFactor && rawCloseText !== '?? && factorText !== '??) {
                    formulaText = `${rawCloseText} ? ${factorText} = ${closeText}`;
                } else {
                    formulaText = `${closeText}嚗隤踵嚗;
                }
            }
            const rowSource =
                typeof row?.priceSource === 'string' && row.priceSource.trim().length > 0
                    ? row.priceSource.trim()
                    : sourceLabel || '??;
            const indicatorCells = indicatorColumns
                .map((col) =>
                    `<td class="px-3 py-2 text-left" style="color: var(--muted-foreground);">${renderIndicatorCell(col.series, rowIndex)}</td>`
                )
                .join('');
            const entryStageState = longEntryStageStates[rowIndex] || null;
            const exitStageState = longExitStageStates[rowIndex] || null;
            const entryStageCell = renderStageStateCell(entryStageState, { type: 'entry' });
            const exitStageCell = renderStageStateCell(exitStageState, { type: 'exit' });
            const positionLabel = lastPositionStates[rowIndex] || '蝛箸?';
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
                    <td class="px-3 py-2 text-left" style="color: var(--foreground);">${entryStageCell}</td>
                    <td class="px-3 py-2 text-left" style="color: var(--foreground);">${exitStageCell}</td>
                    <td class="px-3 py-2 text-left" style="color: var(--foreground);">${escapeHtml(positionLabel)}</td>
                    <td class="px-3 py-2 text-left" style="color: var(--muted-foreground);">${escapeHtml(formulaText)}</td>
                    <td class="px-3 py-2 text-right" style="color: var(--muted-foreground);">${volumeLabel}</td>
                    <td class="px-3 py-2 text-left" style="color: var(--muted-foreground);">${escapeHtml(rowSource)}</td>
                </tr>`;
        })
        .join('');

    tbody.innerHTML =
        rowsHtml ||
        `<tr><td class="px-3 py-4 text-center" colspan="${totalColumns}" style="color: var(--muted-foreground);">?∟???/td></tr>`;

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
        showError("?葫蝯??⊥???豢?");
        lastOverallResult = null; lastSubPeriodResults = null;
         if (suggestionArea) suggestionArea.classList.add('hidden');
         hideLoading();
        resetStrategyStatusCard('idle');
        return;
    }
    try {
        lastOverallResult = result;
        lastSubPeriodResults = result.subPeriodResults;
        lastIndicatorSeries = result.priceIndicatorSeries || null;
        lastPositionStates = Array.isArray(result.positionStates) ? result.positionStates : [];

        updateDataSourceDisplay(dataSource, stockName);
        displayBacktestResult(result);
        updateStrategyStatusCard(result);
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
         showError(`???葫蝯???隤? ${error.message}`);
         if (suggestionArea) suggestionArea.classList.add('hidden');
         hideLoading();
         resetStrategyStatusCard('idle');
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
        el.innerHTML = `<p class="text-gray-500">?⊥?蝯?</p>`; 
        return; 
    } 
    const entryKey = result.entryStrategy; const exitKeyRaw = result.exitStrategy; const exitInternalKey = (['ma_cross','macd_cross','k_d_cross','ema_cross'].includes(exitKeyRaw)) ? `${exitKeyRaw}_exit` : exitKeyRaw; const entryDesc = strategyDescriptions[entryKey] || { name: result.entryStrategy || 'N/A', desc: 'N/A' }; const exitDesc = strategyDescriptions[exitInternalKey] || { name: result.exitStrategy || 'N/A', desc: 'N/A' }; let shortEntryDesc = null, shortExitDesc = null; if (result.enableShorting && result.shortEntryStrategy && result.shortExitStrategy) { shortEntryDesc = strategyDescriptions[result.shortEntryStrategy] || { name: result.shortEntryStrategy, desc: 'N/A' }; shortExitDesc = strategyDescriptions[result.shortExitStrategy] || { name: result.shortExitStrategy, desc: 'N/A' }; } const avgP = result.completedTrades?.length > 0 ? result.completedTrades.reduce((s, t) => s + (t.profit||0), 0) / result.completedTrades.length : 0; const maxCL = result.maxConsecutiveLosses || 0; const bhR = parseFloat(result.buyHoldReturns?.[result.buyHoldReturns.length - 1] ?? 0); const bhAnnR = result.buyHoldAnnualizedReturn ?? 0; const sharpe = result.sharpeRatio?.toFixed(2) ?? 'N/A'; const sortino = result.sortinoRatio ? (isFinite(result.sortinoRatio) ? result.sortinoRatio.toFixed(2) : '??) : 'N/A'; const maxDD = result.maxDrawdown?.toFixed(2) ?? 0; const totalTrades = result.tradesCount ?? 0; const winTrades = result.winTrades ?? 0; const winR = totalTrades > 0 ? (winTrades / totalTrades * 100).toFixed(1) : 0; const totalProfit = result.totalProfit ?? 0; const returnRate = result.returnRate ?? 0; const annualizedReturn = result.annualizedReturn ?? 0; const finalValue = result.finalValue ?? result.initialCapital; let annReturnRatioStr = 'N/A'; let sharpeRatioStr = 'N/A'; if (result.annReturnHalf1 !== null && result.annReturnHalf2 !== null && result.annReturnHalf1 !== 0) { annReturnRatioStr = (result.annReturnHalf2 / result.annReturnHalf1).toFixed(2); } if (result.sharpeHalf1 !== null && result.sharpeHalf2 !== null && result.sharpeHalf1 !== 0) { sharpeRatioStr = (result.sharpeHalf2 / result.sharpeHalf1).toFixed(2); } const overfittingTooltip = "撠?皜祆???敺???嚗?蝞畾萄??芰?蝮賢?祉????桀潘???蝞瘥?(敺挾/?挾)???潭餈?1 頛蔔嚗誨銵函??亦蜀?銝???頛帘摰??祈???> 0.5 ?舀??; let performanceHtml = `
        <div class="mb-8">
            <h4 class="text-lg font-semibold mb-6" style="color: var(--foreground);">蝮暹???</h4>
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: linear-gradient(135deg, color-mix(in srgb, var(--primary) 8%, var(--background)) 0%, color-mix(in srgb, var(--primary) 4%, var(--background)) 100%); border-color: color-mix(in srgb, var(--primary) 25%, transparent);">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm font-medium" style="color: var(--primary);">撟游??梢??/p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                <span class="tooltiptext">撠蜇?梢??祕??皜祆???敺洵銝??????唳?敺????嚗??撟游像???拙?祉???br>?砍?嚗?(?蝯??/ ???祇?)^(1 / 撟湔) - 1) * 100%<br>瘜冽?嚗迨?詨澆??葫???瑕漲??嚗???梢?航撠璆菟??僑??祉???/span>
                            </span>
                        </div>
                        <p class="text-2xl font-bold ${annualizedReturn>=0?'text-emerald-600':'text-rose-600'}">${annualizedReturn>=0?'+':''}${annualizedReturn.toFixed(2)}%</p>
                    </div>
                </div>                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: color-mix(in srgb, var(--muted) 15%, var(--background)); border-color: color-mix(in srgb, var(--border) 80%, transparent);">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm font-medium" style="color: var(--muted-foreground);">鞎瑕??撟游?</p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                <span class="tooltiptext">?函?祕??皜祆??嚗蝝眺?乩蒂??閰脰蟡函?撟游??梢?撘?銝?雿蝙?刻?寡?蝞?/span>
                            </span>
                        </div>
                        <p class="text-2xl font-bold ${bhAnnR>=0?'text-emerald-600':'text-rose-600'}">${bhAnnR>=0?'+':''}${bhAnnR.toFixed(2)}%</p>
                    </div>
                </div>                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: linear-gradient(135deg, color-mix(in srgb, #10b981 8%, var(--background)) 0%, color-mix(in srgb, #10b981 4%, var(--background)) 100%); border-color: color-mix(in srgb, #10b981 25%, transparent);">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm font-medium text-emerald-600">蝮賢?祉?</p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                <span class="tooltiptext">蝑?蝯蜇鞈?詨??澆?憪???梢??br>?砍?嚗??蝯??- ???祇?) / ???祇? * 100%<br>甇斤蝺批?祉?嚗????????/span>
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
                                <span class="tooltiptext">鞎瑕??蝮賢?祉?</span>
                            </span>
                        </div>
                        <p class="text-2xl font-bold ${bhR>=0?'text-emerald-600':'text-rose-600'}">${bhR>=0?'+':''}${bhR.toFixed(2)}%</p>
                    </div>
                </div>
            </div>
        </div>`;
    let riskHtml = `
        <div class="mb-8">
            <h4 class="text-lg font-semibold mb-6" style="color: var(--foreground);">憸券??</h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: linear-gradient(135deg, color-mix(in srgb, #ef4444 8%, var(--background)) 0%, color-mix(in srgb, #ef4444 4%, var(--background)) 100%); border-color: color-mix(in srgb, #ef4444 25%, transparent);">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm font-medium text-rose-600">?憭批???/p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                <span class="tooltiptext">蝑**蝮質???*?脩?敺風?脫?擃???唳?雿???憭抒??頝??撘?(撜啣?- 靚瑕? / 撜啣?* 100%</span>
                            </span>
                        </div>
                        <p class="text-2xl font-bold text-rose-600">${maxDD}%</p>
                    </div>
                </div>                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: linear-gradient(135deg, color-mix(in srgb, var(--primary) 8%, var(--background)) 0%, color-mix(in srgb, var(--primary) 4%, var(--background)) 100%); border-color: color-mix(in srgb, var(--primary) 25%, transparent);">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm font-medium" style="color: var(--primary);">憭??/p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                <span class="tooltiptext">銵⊿?瘥雿蜇憸券(璅?撌???脣???憿?研虜 > 1 銵函內銝嚗? 2 ?貊憟踝?> 3 ?虜?芰? (?詨??潛憸券?拍?)??/span>
                            </span>
                        </div>
                        <p class="text-2xl font-bold" style="color: var(--primary);">${sharpe}</p>
                    </div>
                </div>                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background:  color-mix(in srgb, var(--muted) 12%, var(--background)); border-color: color-mix(in srgb, var(--border) 60%, transparent);">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm font-medium" style="color: var(--muted-foreground);">蝝Ｘ?隢暹???/p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                <span class="tooltiptext">銵⊿?瘥雿?'銝?憸券' ??脣???憿??(?芾?扳??郭????擃?憟踝??虜?冽瘥?銝?蝑?踹??扳?憸券???/span>
                            </span>
                        </div>
                        <p class="text-2xl font-bold" style="color: var(--muted-foreground);">${sortino}</p>
                    </div>
                </div>                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 8%, var(--background)) 0%, color-mix(in srgb, var(--accent) 4%, var(--background)) 100%); border-color: color-mix(in srgb, var(--accent) 25%, transparent);">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm font-medium" style="color: var(--accent);">????梢??)</p>
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
                            <p class="text-sm font-medium" style="color: var(--secondary);">???憭?潭?)</p>
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
            <h4 class="text-lg font-semibold mb-6" style="color: var(--foreground);">鈭斗?蝯梯?</h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: color-mix(in srgb, var(--muted) 12%, var(--background)); border-color: color-mix(in srgb, var(--border) 60%, transparent);">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm font-medium" style="color: var(--muted-foreground);">??</p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                <span class="tooltiptext">?????蝛箔漱??/span>
                            </span>
                        </div>
                        <p class="text-2xl font-bold" style="color: var(--foreground);">${winR}%</p>
                        <p class="text-sm mt-1" style="color: var(--muted-foreground);">(${winTrades}/${totalTrades})</p>
                    </div>
                </div>                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: color-mix(in srgb, var(--muted) 12%, var(--background)); border-color: color-mix(in srgb, var(--border) 60%, transparent);">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm font-medium" style="color: var(--muted-foreground);">蝮賭漱?活??/p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                <span class="tooltiptext">?????蝛箔漱??/span>
                            </span>
                        </div>
                        <p class="text-2xl font-bold" style="color: var(--foreground);">${totalTrades}</p>
                        <p class="text-sm mt-1" style="color: var(--muted-foreground);">甈?/p>
                    </div>
                </div>                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: color-mix(in srgb, var(--muted) 12%, var(--background)); border-color: color-mix(in srgb, var(--border) 60%, transparent);">
                    <div class="text-center">
                        <p class="text-sm font-medium mb-3" style="color: var(--muted-foreground);">撟喳?鈭斗??</p>
                        <p class="text-2xl font-bold ${avgP>=0?'text-emerald-600':'text-rose-600'}">${avgP>=0?'+':''}${Math.round(avgP).toLocaleString()}</p>
                        <p class="text-sm mt-1" style="color: var(--muted-foreground);">??/p>
                    </div>
                </div>                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: color-mix(in srgb, var(--muted) 12%, var(--background)); border-color: color-mix(in srgb, var(--border) 60%, transparent);">
                    <div class="text-center">
                        <p class="text-sm font-medium mb-3" style="color: var(--muted-foreground);">?憭折?甈⊥</p>
                        <p class="text-2xl font-bold" style="color: var(--foreground);">${maxCL}</p>
                        <p class="text-sm mt-1" style="color: var(--muted-foreground);">甈?/p>
                    </div>
                </div>
            </div>
        </div>`;
    let strategySettingsHtml = `
        <div>
            <h4 class="text-lg font-semibold mb-6" style="color: var(--foreground);">蝑閮剖?</h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">                <div class="p-6 rounded-xl border shadow-sm transition-all duration-200 hover:shadow-md" style="background: linear-gradient(135deg, color-mix(in srgb, #10b981 8%, var(--background)) 0%, color-mix(in srgb, #10b981 4%, var(--background)) 100%); border-color: color-mix(in srgb, #10b981 25%, transparent);">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm font-medium text-emerald-600">?? ?脣蝑</p>
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
                            <p class="text-sm font-medium text-rose-600">?? ?箏蝑</p>
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
                            <p class="text-sm font-medium" style="color: var(--accent);">?? ?征蝑</p>
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
                            <p class="text-sm font-medium" style="color: var(--primary);">?? ??蝑</p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs rounded-full cursor-help" style="background-color: var(--primary); color: var(--primary-foreground);">?</span>
                                <span class="tooltiptext">${shortExitDesc.desc.replace(/\n/g,'<br>')}</span>
                            </span>
                        </div>
                        <p class="text-base font-semibold" style="color: var(--foreground);">${shortExitDesc.name}</p>
                    </div>
                </div>` : `                <div class="p-6 rounded-xl border shadow-sm" style="background: color-mix(in srgb, var(--muted) 15%, var(--background)); border-color: color-mix(in srgb, var(--border) 80%, transparent);">
                    <div class="text-center">
                        <p class="text-sm font-medium" style="color: var(--muted-foreground);">?? ?征蝑?芸???/p>
                    </div>
                </div>
                <div class="bg-gray-100 p-6 rounded-xl border border-gray-200 shadow-sm">
                    <div class="text-center">
                        <p class="text-sm text-gray-500 font-medium">?? ??蝑?芸???/p>
                    </div>
                </div> `}                <div class="bg-orange-50 p-6 rounded-xl border border-orange-200 shadow-sm">
                    <div class="text-center">
                        <div class="flex items-center justify-center mb-3">
                            <p class="text-sm text-orange-600 font-medium">?? ?典?憸冽</p>
                            <span class="tooltip ml-2">
                                <span class="info-icon inline-flex items-center justify-center w-5 h-5 text-xs bg-blue-600 text-white rounded-full cursor-help">?</span>
                                <span class="tooltiptext">??/?閮剖? (憭征?梁)</span>
                            </span>
                        </div>
                        <p class="text-base font-semibold text-gray-800">??${result.stopLoss>0?result.stopLoss+'%':'N/A'} / ??${result.takeProfit>0?result.takeProfit+'%':'N/A'}</p>
                    </div>
                </div>
                <div class="bg-indigo-50 p-6 rounded-xl border border-indigo-200 shadow-sm">
                    <div class="text-center">
                        <p class="text-sm text-indigo-600 font-medium mb-3">??鞎瑁都??暺?/p>
                        <p class="text-base font-semibold text-gray-800">${result.tradeTiming==='open'?'??':'?嗆?嗥'}</p>
                    </div>
                </div>
                <div class="bg-blue-50 p-6 rounded-xl border border-blue-200 shadow-sm">
                    <div class="text-center">
                        <p class="text-sm text-blue-600 font-medium mb-3">? ???祇?</p>
                        <p class="text-base font-semibold text-gray-800">${result.initialCapital.toLocaleString()}??/p>
                    </div>
                </div>
                <div class="bg-yellow-50 p-6 rounded-xl border border-yellow-200 shadow-sm">
                    <div class="text-center">
                        <p class="text-sm text-yellow-600 font-medium mb-3">?? ?蝯???/p>
                        <p class="text-base font-semibold text-gray-800">${Math.round(finalValue).toLocaleString()}??/p>
                    </div>
                </div> </div> </div>`;

        // 撠???憛??湔???銝行溶??嗥???
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
        return '<div class="mt-1 text-xs" style="color: #dc2626;">(???潭撘隤?</div>'; 
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
        return `<div class="mt-1 text-xs" style="color: var(--muted-foreground);">(K/D ??${formatV(kPrev)}/${formatV(dPrev)}, ??${formatV(kNow)}/${formatV(dNow)}, 甈?${formatV(kNext)}/${formatV(dNext)})</div>`; 
    } catch (e) { 
        console.error("[Main] Error in formatKDParams:", e, kdVals); 
        return '<div class="mt-1 text-xs" style="color: #dc2626;">(KD?潭撘隤?</div>'; 
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
        return `<div class="mt-1 text-xs" style="color: var(--muted-foreground);">(DIF/DEA ??${formatV(difPrev)}/${formatV(deaPrev)}, ??${formatV(difNow)}/${formatV(deaNow)}, 甈?${formatV(difNext)}/${formatV(deaNext)})</div>`; 
    } catch (e) { 
        console.error("[Main] Error in formatMACDParams:", e, macdValues); 
        return '<div class="mt-1 text-xs" style="color: #dc2626;">(MACD?潭撘隤?</div>'; 
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
    
    // ?內??歇鋡怎宏?歹??⊿??湔
    
    // 瑼Ｘ?豢?????
    if (!result || !result.completedTrades || !Array.isArray(result.completedTrades)) { 
        tradeResultsEl.innerHTML = `<p class="text-xs text-muted-foreground text-center py-8" style="color: var(--muted-foreground);">鈭斗?閮??豢??⊥??撩憭?/p>`; 
        console.error("[Main] Invalid completedTrades data:", result); 
        return; 
    }
    
    // 瘝?鈭斗?閮?
    if (result.completedTrades.length === 0) { 
        tradeResultsEl.innerHTML = `<p class="text-xs text-muted-foreground text-center py-8" style="color: var(--muted-foreground);">瘝?鈭斗?閮?</p>`; 
        return; 
    }
    
    try { 
        let tradeHtml = result.completedTrades.map((tradePair, index) => { 
            if (!tradePair || !tradePair.entry || !tradePair.exit || !tradePair.entry.type || !tradePair.exit.type) { 
                console.warn(`[Main] Invalid trade pair structure at index ${index}:`, tradePair); 
                return `<div class="trade-signal p-3 border-b last:border-b-0" style="border-color: var(--border);"><p class="text-xs text-red-600">?航炊嚗迨蝑漱???豢?蝯?銝???(Index: ${index})</p></div>`; 
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
                    entryParamsDisplay = '<span class="block text-xs text-red-500 mt-1">(?脣靽⊥?澆??航炊)</span>'; 
                }
                
                let exitParamsDisplay = ''; 
                const sl = exitTrade?.triggeredByStopLoss || false; 
                const tp = exitTrade?.triggeredByTakeProfit || false; 
                let trigger = ''; 
                if(sl) trigger='<span class="ml-2 text-xs font-medium px-2 py-0.5 rounded" style="background-color: #fee2e2; color: #dc2626;">????</span>'; 
                else if(tp) trigger='<span class="ml-2 text-xs font-medium px-2 py-0.5 rounded" style="background-color: #dcfce7; color: #16a34a;">????/span>'; 
                
                try { 
                    if (exitTrade?.kdValues) exitParamsDisplay = formatKDParams(exitTrade.kdValues); 
                    else if (exitTrade?.macdValues) exitParamsDisplay = formatMACDParams(exitTrade.macdValues); 
                    else if (exitTrade?.indicatorValues) exitParamsDisplay = formatIndicatorValues(exitTrade.indicatorValues); 
                } catch (exitFormatError) { 
                    console.error(`[Main] Error formatting exit display for trade index ${index}:`, exitFormatError, exitTrade); 
                    exitParamsDisplay = '<span class="block text-xs text-red-500 mt-1">(?箏靽⊥?澆??航炊)</span>'; 
                }
                
                const entryDate = entryTrade.date || 'N/A'; 
                const entryPrice = typeof entryTrade.price === 'number' ? entryTrade.price.toFixed(2) : 'N/A'; 
                const entryShares = entryTrade.shares || 'N/A'; 
                const entryActionText = isShortTrade ? '?征' : '鞎瑕'; 
                const entryActionClass = isShortTrade ? 'short-signal' : 'buy-signal'; 
                const entryActionStyle = isShortTrade ? 'background-color: #fef3c7; color: #d97706;' : 'background-color: #fee2e2; color: #dc2626;';
                
                const exitDate = exitTrade.date || 'N/A'; 
                const exitPrice = typeof exitTrade.price === 'number' ? exitTrade.price.toFixed(2) : 'N/A'; 
                const exitActionText = isShortTrade ? '??' : '鞈?'; 
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
                                    <span class="text-xs" style="color: var(--muted-foreground);">${entryShares} ??/span>
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
                                    <span class="text-sm font-bold" style="color: ${profitColor};">${profitSign}${profitValue}??/span>
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
                return `<div class="trade-signal p-3 border-b" style="border-color: var(--border);"><p class="text-xs text-red-600">?航炊嚗撘?甇斤?鈭斗?撠??粹 (Index: ${index})</p></div>`; 
            } 
        }).join(''); 
        
        tradeResultsEl.innerHTML = `<div class="trade-list rounded-md max-h-80 overflow-y-auto" style="border: 1px solid var(--border);">${tradeHtml}</div>`; 
    } catch (error) { 
        console.error("[Main] Error rendering trade results list:", error); 
        tradeResultsEl.innerHTML = `<p class="text-xs text-red-600 text-center py-8">憿舐內鈭斗?閮??”??隤扎?/p>`; 
        showError("憿舐內鈭斗?閮???荔?隢炎?交?嗅??); 
    } 
}
function renderChart(result) {
    const chartContainer = document.getElementById('chart-container');
    if (!chartContainer) {
        console.error("[Main] Chart container not found");
        return;
    }
    
    if (!result || !result.dates || result.dates.length === 0) {
        chartContainer.innerHTML = `<div class="text-center text-muted py-8" style="color: var(--muted-foreground);"><i data-lucide="bar-chart-3" class="lucide w-12 h-12 mx-auto mb-2 opacity-50"></i><p>?⊥?皜脫??”嚗??頞喋?/p></div>`;
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
        { label: '鞎瑕銝行???%', data: bhData, borderColor: '#6b7280', borderWidth: 1.5, tension: 0.1, pointRadius: 0, yAxisID: 'y', spanGaps: true },
        { label: '蝑 %', data: stratData, borderColor: '#3b82f6', borderWidth: 2, tension: 0.1, pointRadius: 0, yAxisID: 'y', spanGaps: true }
    ];
    
    if (buySigs.length > 0) {
        datasets.push({ type:'scatter', label:'鞎瑕', data:buySigs, backgroundColor:'#ef4444', radius:6, pointStyle:'triangle', rotation:0, yAxisID:'y' });
    }
    if (sellSigs.length > 0) {
        datasets.push({ type:'scatter', label:'鞈?', data:sellSigs, backgroundColor:'#22c55e', radius:6, pointStyle:'triangle', rotation:180, yAxisID:'y' });
    }
    if (result.enableShorting) {
        if (shortSigs.length > 0) {
            datasets.push({ type:'scatter', label:'?征', data:shortSigs, backgroundColor:'#f59e0b', radius:7, pointStyle:'rectRot', yAxisID:'y' });
        }
        if (coverSigs.length > 0) {
            datasets.push({ type:'scatter', label:'??', data:coverSigs, backgroundColor:'#8b5cf6', radius:7, pointStyle:'rect', yAxisID:'y' });
        }
    }
    
    // 蝣箔??辣撌脰酉??
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
                        text: '?嗥???(%)'
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
    
    // ?芸?蝢拇??喃?隞嗉????舀撌阡???
    const canvas = stockChart.canvas;
    let isPanning = false;
    let lastX = 0;
    
    canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0 || e.button === 2) { // 撌阡???
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
            
            // 閮?撟喟宏??
            const range = scale.max - scale.min;
            const panAmount = (deltaX / canvas.width) * range;
            
            // ?湔蝮格
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
    
    // 蝳?喲?詨
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
}
// ?芸?撠?脣漲憿舐內?賣
function showOptimizationProgress(message) {
    console.log('[Main] showOptimizationProgress 鋡怨矽??', message);
    const progressSection = document.getElementById('optimization-progress-section');
    const statusText = document.getElementById('optimization-status-text');
    const progressBar = document.getElementById('optimization-progress-bar');
    const progressText = document.getElementById('optimization-progress-text');
    
    console.log('[Main] ?脣漲??瑼Ｘ:', {
        progressSection: !!progressSection,
        statusText: !!statusText,
        progressBar: !!progressBar,
        progressText: !!progressText
    });
    
    if (progressSection && statusText) {
        progressSection.classList.remove('hidden');
        statusText.textContent = message || '???芸??脰?銝?..';
        
        // ?蔭?脣漲璇?
        if (progressBar) progressBar.style.width = '0%';
        if (progressText) progressText.textContent = '0%';
        
        console.log('[Main] 憿舐內?芸??脣漲:', message);
        console.log('[Main] ?脣漲???class list:', progressSection.classList.toString());
    } else {
        console.error('[Main] ?⊥??曉?芸??脣漲憿舐內??!');
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
    
    console.log(`[Main] ?湔?芸??脣漲: ${safeProgress}%`, message);
}

function hideOptimizationProgress() {
    console.log('[Main] hideOptimizationProgress 鋡怨矽??);
    const progressSection = document.getElementById('optimization-progress-section');
    if (progressSection) {
        progressSection.classList.add('hidden');
        console.log('[Main] ?梯??芸??脣漲憿舐內');
        console.log('[Main] ?脣漲???class list:', progressSection.classList.toString());
    } else {
        console.error('[Main] ?曆???optimization-progress-section ??');
    }
}

function runOptimizationInternal(optimizeType) { 
    if (!workerUrl) { 
        showError("?閮?撘?撠皞?撠梁?嚗?蝔?閰行??頛???); 
        return; 
    } 
    
    console.log(`[Main] runOptimizationInternal called for ${optimizeType}`); 
    
    // 蝡???啣????
    activateTab('optimization');
    console.log('[Main] 撌脣???芸??');
    
    // ?脣??芸???蝯??冽撠?憿舐內嚗??怎揣?姥瘥??漱?活?賂?
    if (lastOverallResult) {
        preOptimizationResult = {
            annualizedReturn: lastOverallResult.annualizedReturn,
            maxDrawdown: lastOverallResult.maxDrawdown,
            winRate: lastOverallResult.winRate,
            sharpeRatio: lastOverallResult.sharpeRatio,
            sortinoRatio: lastOverallResult.sortinoRatio,
            totalTrades: lastOverallResult.totalTrades ?? lastOverallResult.tradesCount ?? lastOverallResult.tradeCount ?? null
        };
        console.log('[Main] 撌脣摮??蝯??冽撠?:', preOptimizationResult);
    } else {
        preOptimizationResult = null;
        console.log('[Main] ?∪?函??芸?????);
    }
    
    // 憿舐內??皞????
    showOptimizationProgress('??甇?撽??...');
    
    const params=getBacktestParams(); 
    let targetStratKey, paramSelectId, selectedParamName, optLabel, optRange, msgAction, configKey, config; 
    const isShortOpt = optimizeType === 'shortEntry' || optimizeType === 'shortExit'; 
    const isRiskOpt = optimizeType === 'risk'; 
    
    if (isShortOpt && !params.enableShorting) { 
        hideOptimizationProgress();
        showError("隢???征蝑??脰??征?賊??芸???); 
        return; 
    } 
    
    if (!validateBacktestParams(params)) {
        hideOptimizationProgress();
        return;
    }
    
    const msgActionMap = {'entry': '憭?脣', 'exit': '憭?箏', 'shortEntry': '?征?脣', 'shortExit': '???箏', 'risk': '憸券?批'}; 
    msgAction = msgActionMap[optimizeType] || '?芰'; 
    
    if (isRiskOpt) { 
        paramSelectId = 'optimizeRiskParamSelect'; 
        selectedParamName = document.getElementById(paramSelectId)?.value; 
        config = globalOptimizeTargets[selectedParamName]; 
        if (!config) { 
            hideOptimizationProgress();
            showError(`?曆??圈◢?芸???${selectedParamName} ???蝵柴); 
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
            showError("?芰?????); 
            return; 
        } 
        
        selectedParamName = document.getElementById(paramSelectId)?.value; 
        if (!selectedParamName || selectedParamName === 'null') { 
            hideOptimizationProgress();
            showError(`隢 ${msgAction} 蝑?豢?????脰??芸??); 
            return; 
        } 
        
        config = strategyDescriptions[configKey]; 
        const optTarget = config?.optimizeTargets?.find(t => t.name === selectedParamName); 
        if (!optTarget) { 
            hideOptimizationProgress();
            showError(`?曆??啣???"${selectedParamName}" (${configKey}) ???蝵柴); 
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
    const msg=`?????芸? ${msgAction} (${optLabel}) (${useCache?'雿輻敹怠?':'頛?唳??})...`; 
    
    // ???支???蝯?嚗?銝??脣漲
    clearPreviousResults(); 
    console.log('[Main] 撌脫??支???蝯?');
    
    // ?嗅??湔?脣漲憿舐內?箏祕???芸?靽⊥
    showOptimizationProgress(msg);
    console.log('[Main] 撌脫?圈脣漲憿舐內??', msg);
    
    // 蝳?芸???嚗甇ａ?銴???
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
                // 雿輻?芸?撠?脣漲?湔
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
                
                document.getElementById('optimization-title').textContent=`${msgAction}?芸? (${optLabel})`; 
                handleOptimizationResult(data.results || data, selectedParamName, optLabel); 
                
                if(optimizationWorker) optimizationWorker.terminate(); 
                optimizationWorker=null; 
                
                hideOptimizationProgress();
                
                // ???芸???
                optimizeButtons.forEach(btnId => {
                    const btn = document.getElementById(btnId);
                    if (btn) btn.disabled = false;
                });
                
                showSuccess("?芸?摰?嚗?);  
            } else if(type==='error'){ 
                showError(data?.message||"?芸????粹"); 
                if(optimizationWorker) optimizationWorker.terminate(); 
                optimizationWorker=null; 
                
                hideOptimizationProgress();
                
                // ???芸???
                optimizeButtons.forEach(btnId => {
                    const btn = document.getElementById(btnId);
                    if (btn) btn.disabled = false;
                });
            } 
        }; 
        
        optimizationWorker.onerror=e=>{
            showError(`Worker?航炊: ${e.message}`); 
            console.error("[Main] Opt Worker Error:",e); 
            optimizationWorker=null; 
            hideOptimizationProgress();
            
            // ???芸???
            optimizeButtons.forEach(btnId => {
                const btn = document.getElementById(btnId);
                if (btn) btn.disabled = false;
            });
        }; 
    } catch (workerError) { 
        console.error("[Main] Opt Worker init error:", workerError); 
        showError(`???芸?撘?憭望?: ${workerError.message}`); 
        hideOptimizationProgress(); 
        
        // ???芸???
        optimizeButtons.forEach(btnId => {
            const btn = document.getElementById(btnId);
            if (btn) btn.disabled = false;
        });
    } 
}
function handleOptimizationResult(results, optName, optLabel) { 
    currentOptimizationResults=[]; 
    if(!results||!Array.isArray(results)||results.length===0){
        document.getElementById("optimization-results").innerHTML=`<p class="text-gray-500">?⊥??????/p>`;
        return;
    } 
    const validRes=results.filter(r=>r&&typeof r.annualizedReturn==='number'&&isFinite(r.annualizedReturn)&&typeof r.maxDrawdown==='number'); 
    if(validRes.length===0){
        document.getElementById("optimization-results").innerHTML=`<p class="text-gray-500">?芸?摰?嚗??⊥?????/p>`;
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
                    <th scope="col" class="px-4 py-3 sortable-header" data-sort-key="paramValue">${pLabel} ??/th>
                    <th scope="col" class="px-4 py-3 sortable-header sort-desc" data-sort-key="annualizedReturn">撟游??梢</th>
                    <th scope="col" class="px-4 py-3 sortable-header" data-sort-key="returnRate">蝮賢??/th>
                    <th scope="col" class="px-4 py-3 sortable-header" data-sort-key="maxDrawdown">?憭批???/th>
                    <th scope="col" class="px-4 py-3 sortable-header" data-sort-key="winRate">??</th>
                    <th scope="col" class="px-4 py-3 sortable-header" data-sort-key="sharpeRatio">憭??/th>
                    <th scope="col" class="px-4 py-3 sortable-header" data-sort-key="sortinoRatio">蝝Ｘ?隢曉?/th>
                    <th scope="col" class="px-4 py-3 sortable-header" data-sort-key="tradesCount">鈭斗?甈⊥</th>
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
            <td class="px-4 py-2">${r.sortinoRatio ? (isFinite(r.sortinoRatio) ? r.sortinoRatio.toFixed(2) : '??) : 'N/A'}</td>
            <td class="px-4 py-2">${r.tradesCount}</td>
        </tr>`;
    }).join('');
    
    tableHtml += `</tbody></table></div>`;
    
    // 瑽遣??HTML嚗＊蝷箏????脰?撠?
    let summaryHtml = `<div class="mt-4 p-3 bg-gray-100 rounded-md text-sm">
        <h4 class="font-semibold">?雿喳??貊??? ${pLabel} = ${bestRes.paramValue}</h4>`;
    
    // 憿舐內?芸????亥”?橘??芸?雿輻 preOptimizationResult嚗???芸???摮?嚗?∪????lastOverallResult
    const before = preOptimizationResult || lastOverallResult;
    if (before && before.annualizedReturn !== null && before.annualizedReturn !== undefined) {
        summaryHtml += `<div class="mt-2">
            <p class="text-gray-700 font-medium">?芸????亥”?橘?</p>
            <p class="text-gray-600">
                撟游??梢?? ${before.annualizedReturn?.toFixed(2) ?? 'N/A'}%, 
                ?憭批??? ${before.maxDrawdown?.toFixed(2) ?? 'N/A'}%, 
                ??: ${before.winRate?.toFixed(1) ?? 'N/A'}%, 
                憭?? ${before.sharpeRatio?.toFixed(2) ?? 'N/A'}, 
                蝝Ｘ?隢曉? ${before.sortinoRatio?.toFixed(2) ?? 'N/A'}, 
                鈭斗?甈⊥: ${before.totalTrades ?? before.tradesCount ?? before.tradeCount ?? 'N/A'}
            </p>
        </div>`;
    }
    
    // 撌脩宏?扎???雿唾”?整＊蝷綽??????蝑銵函靘?撠?
    
    summaryHtml += `<p class="mt-1 text-xs text-gray-500">?內嚗??”?潭??剖?????雿喳??豢???啣銝撠?甈?嚗??瑁??葫??/p></div>`;
    
    el.innerHTML = summaryHtml + tableHtml;
}
function addSortListeners() { const table=document.querySelector("#optimization-results .optimization-table"); if(!table)return; const headers=table.querySelectorAll("th.sortable-header"); headers.forEach(header=>{ header.onclick=()=>{ const sortKey=header.dataset.sortKey; if(!sortKey)return; if(sortState.key===sortKey)sortState.direction=sortState.direction==='asc'?'desc':'asc'; else {sortState.key=sortKey; sortState.direction='desc';} sortTable();}; }); }
function sortTable() { const{key,direction}=sortState; if(!currentOptimizationResults||currentOptimizationResults.length===0)return; currentOptimizationResults.sort((a,b)=>{ let vA=a[key]; let vB=b[key]; if(key==='sortinoRatio'){vA=isFinite(vA)?vA:(direction==='asc'?Infinity:-Infinity); vB=isFinite(vB)?vB:(direction==='asc'?Infinity:-Infinity);} vA=(vA===null||vA===undefined||isNaN(vA))?(direction==='asc'?Infinity:-Infinity):vA; vB=(vB===null||vB===undefined||isNaN(vB))?(direction==='asc'?Infinity:-Infinity):vB; if(vA<vB)return direction==='asc'?-1:1; if(vA>vB)return direction==='asc'?1:-1; return 0; }); const optTitle=document.getElementById('optimization-title').textContent; let optLabel='???; const match=optTitle.match(/\((.+)\)/); if(match&&match[1])optLabel=match[1]; renderOptimizationTable(sortState.key, optLabel); const headers=document.querySelectorAll("#optimization-results th.sortable-header"); headers.forEach(h=>{h.classList.remove('sort-asc','sort-desc'); if(h.dataset.sortKey===key)h.classList.add(direction==='asc'?'sort-asc':'sort-desc');}); addSortListeners(); }
const stagingOptimizationState = {
    running: false,
    results: [],
    bestResult: null,
    combinations: [],
};

function formatStagePercentages(values) {
    if (!Array.isArray(values) || values.length === 0) return '??;
    return values
        .map((val) => {
            if (!Number.isFinite(val)) return '0%';
            const rounded = Number.parseFloat(val.toFixed(2));
            if (Math.abs(rounded) < 0.01) return '0%';
            if (Math.abs(rounded - Math.round(rounded)) < 0.01) {
                return `${Math.round(rounded)}%`;
            }
            return `${rounded.toFixed(2)}%`;
        })
        .join(' / ');
}

function scaleStageWeights(base, weights) {
    if (!Array.isArray(weights) || weights.length === 0) return [];
    const sanitizedWeights = weights
        .map((weight) => Number.parseFloat(weight))
        .filter((weight) => Number.isFinite(weight) && weight > 0);
    if (sanitizedWeights.length === 0) return [];
    if (!Number.isFinite(base) || base <= 0) {
        return sanitizedWeights.map((value) => Number.parseFloat(value.toFixed(2)));
    }
    const totalWeight = sanitizedWeights.reduce((sum, weight) => sum + weight, 0);
    if (!Number.isFinite(totalWeight) || totalWeight <= 0) return [];
    const scaled = [];
    let allocated = 0;
    sanitizedWeights.forEach((weight, index) => {
        let value = (base * weight) / totalWeight;
        value = Number.isFinite(value) ? value : 0;
        value = Number.parseFloat(value.toFixed(2));
        if (value <= 0) {
            value = Number.parseFloat((base / sanitizedWeights.length).toFixed(2));
        }
        if (index === sanitizedWeights.length - 1) {
            value = Number.parseFloat((base - allocated).toFixed(2));
        }
        allocated = Number.parseFloat((allocated + value).toFixed(2));
        scaled.push(Math.max(value, 0.1));
    });
    const scaledTotal = scaled.reduce((sum, val) => sum + val, 0);
    const diff = Number.parseFloat((base - scaledTotal).toFixed(2));
    if (Math.abs(diff) >= 0.01 && scaled.length > 0) {
        const lastIndex = scaled.length - 1;
        const adjusted = Number.parseFloat((scaled[lastIndex] + diff).toFixed(2));
        scaled[lastIndex] = Math.max(adjusted, 0.1);
    }
    return scaled.map((val) => Number.parseFloat(val.toFixed(2)));
}

function normalizeStageValues(values, base) {
    if (!Array.isArray(values) || values.length === 0) return [];
    const sanitized = values
        .map((val) => Number.parseFloat(val))
        .filter((val) => Number.isFinite(val) && val > 0);
    if (sanitized.length === 0) return [];
    if (!Number.isFinite(base) || base <= 0) {
        return sanitized.map((val) => Number.parseFloat(val.toFixed(2)));
    }
    const total = sanitized.reduce((sum, val) => sum + val, 0);
    if (Math.abs(total - base) < 0.01) {
        return sanitized.map((val) => Number.parseFloat(val.toFixed(2)));
    }
    return scaleStageWeights(base, sanitized);
}

function dedupeStageCandidates(candidates) {
    const map = new Map();
    candidates.forEach((candidate) => {
        if (!candidate || !Array.isArray(candidate.values) || candidate.values.length === 0) return;
        const key = candidate.values.map((val) => Number.parseFloat(val).toFixed(2)).join('|');
        if (!map.has(key)) {
            map.set(key, candidate);
        }
    });
    return Array.from(map.values());
}

function isFullAllocationSingleStage(values, base) {
    if (!Array.isArray(values) || values.length === 0) return false;
    const sanitized = values
        .map((val) => Number.parseFloat(val))
        .filter((val) => Number.isFinite(val) && val > 0);
    if (sanitized.length !== 1) return false;
    const total = sanitized[0];
    if (!Number.isFinite(total)) return false;
    const target = Number.isFinite(base) && base > 0 ? base : total;
    const tolerance = Math.max(0.1, target * 0.001);
    return Math.abs(total - target) <= tolerance;
}

function resolveModesForCandidate(isSingleFull, options, preferredValue) {
    if (!Array.isArray(options) || options.length === 0) return [];
    if (!isSingleFull) return options.slice();
    const preferred = preferredValue ? options.find((opt) => opt && opt.value === preferredValue) : null;
    return [preferred || options[0]];
}

function buildStagingOptimizationCombos(params) {
    const positionSize = Number.parseFloat(params.positionSize) || 100;
    const entryBase = Math.max(positionSize, 1);
    const exitBase = 100;

    const entryCandidates = [];
    const normalizedEntry = normalizeStageValues(params.entryStages, entryBase);
    if (normalizedEntry.length > 0) {
        entryCandidates.push({
            id: 'entry_current',
            label: '?桀?閮剖?',
            values: normalizedEntry,
            display: formatStagePercentages(normalizedEntry),
            isSingleFull: isFullAllocationSingleStage(normalizedEntry, entryBase),
        });
    }
    const entryProfiles = [
        { id: 'entry_single', label: '?格挾皛踹?, weights: [1] },
        { id: 'entry_even_two', label: '?拇挾撟喳?', weights: [0.5, 0.5] },
        { id: 'entry_front_heavy', label: '??敺? (60/40)', weights: [0.6, 0.4] },
        { id: 'entry_back_heavy', label: '??敺? (40/60)', weights: [0.4, 0.6] },
        { id: 'entry_pyramid', label: '??憛?(50/30/20)', weights: [0.5, 0.3, 0.2] },
        { id: 'entry_reverse_pyramid', label: '??摮? (20/30/50)', weights: [0.2, 0.3, 0.5] },
        { id: 'entry_ladder', label: '?０?? (30/30/40)', weights: [0.3, 0.3, 0.4] },
    ];
    entryProfiles.forEach((profile) => {
        const values = scaleStageWeights(entryBase, profile.weights);
        if (values.length === 0) return;
        entryCandidates.push({
            id: profile.id,
            label: profile.label,
            values,
            display: formatStagePercentages(values),
            isSingleFull: isFullAllocationSingleStage(values, entryBase),
        });
    });
    const dedupedEntry = dedupeStageCandidates(entryCandidates);

    const exitCandidates = [];
    const normalizedExit = normalizeStageValues(params.exitStages, exitBase);
    if (normalizedExit.length > 0) {
        exitCandidates.push({
            id: 'exit_current',
            label: '?桀?閮剖?',
            values: normalizedExit,
            display: formatStagePercentages(normalizedExit),
            isSingleFull: isFullAllocationSingleStage(normalizedExit, exitBase),
        });
    }
    const exitProfiles = [
        { id: 'exit_single', label: '銝甈∪皜?, weights: [1] },
        { id: 'exit_even_two', label: '?拇挾撟喳?', weights: [0.5, 0.5] },
        { id: 'exit_front_heavy', label: '??敺? (60/40)', weights: [0.6, 0.4] },
        { id: 'exit_back_heavy', label: '??敺? (40/60)', weights: [0.4, 0.6] },
        { id: 'exit_triplet', label: '銝挾?０ (30/30/40)', weights: [0.3, 0.3, 0.4] },
        { id: 'exit_tail_hold', label: '靽?撠暹挾 (25/25/50)', weights: [0.25, 0.25, 0.5] },
    ];
    exitProfiles.forEach((profile) => {
        const values = scaleStageWeights(exitBase, profile.weights);
        if (values.length === 0) return;
        exitCandidates.push({
            id: profile.id,
            label: profile.label,
            values,
            display: formatStagePercentages(values),
            isSingleFull: isFullAllocationSingleStage(values, exitBase),
        });
    });
    const dedupedExit = dedupeStageCandidates(exitCandidates);

    const entryModeOptionsRaw = [
        { value: 'price_pullback', label: formatStageModeLabel('price_pullback', 'entry') || '?寞??Ⅳ' },
        { value: 'signal_repeat', label: formatStageModeLabel('signal_repeat', 'entry') || '蝑閮??孛?? },
    ];
    const exitModeOptionsRaw = [
        { value: 'price_rally', label: formatStageModeLabel('price_rally', 'exit') || '?寞韏圈???箏' },
        { value: 'signal_repeat', label: formatStageModeLabel('signal_repeat', 'exit') || '蝑閮??孛?? },
    ];

    const sortModeOptions = (options, targetValue) => {
        if (!targetValue) return options.slice();
        return options.slice().sort((a, b) => {
            if (a.value === targetValue) return -1;
            if (b.value === targetValue) return 1;
            return 0;
        });
    };

    const entryModeOptions = sortModeOptions(entryModeOptionsRaw, params.entryStagingMode || null);
    const exitModeOptions = sortModeOptions(exitModeOptionsRaw, params.exitStagingMode || null);

    const combos = [];
    dedupedEntry.forEach((entryCandidate) => {
        const entryModes = resolveModesForCandidate(
            isFullAllocationSingleStage(entryCandidate.values, entryBase),
            entryModeOptions,
            params.entryStagingMode || null,
        );
        if (!entryModes.length) return;
        dedupedExit.forEach((exitCandidate) => {
            const exitModes = resolveModesForCandidate(
                isFullAllocationSingleStage(exitCandidate.values, exitBase),
                exitModeOptions,
                params.exitStagingMode || null,
            );
            if (!exitModes.length) return;
            entryModes.forEach((entryMode) => {
                exitModes.forEach((exitMode) => {
                    combos.push({
                        entry: entryCandidate,
                        exit: exitCandidate,
                        entryMode,
                        exitMode,
                    });
                });
            });
        });
    });

    return {
        entryCandidates: dedupedEntry,
        exitCandidates: dedupedExit,
        combos,
    };
}

function buildCachedMetaFromEntry(entry, effectiveStartDate, lookbackDays) {
    if (!entry) return null;
    return {
        summary: entry.summary || null,
        adjustments: Array.isArray(entry.adjustments) ? entry.adjustments : [],
        debugSteps: Array.isArray(entry.debugSteps) ? entry.debugSteps : [],
        adjustmentFallbackApplied: Boolean(entry.adjustmentFallbackApplied),
        priceSource: entry.priceSource || null,
        dataSource: entry.dataSource || null,
        splitAdjustment: Boolean(entry.splitAdjustment),
        fetchRange: entry.fetchRange || null,
        effectiveStartDate: entry.effectiveStartDate || effectiveStartDate,
        lookbackDays: entry.lookbackDays || lookbackDays,
        diagnostics: entry.fetchDiagnostics || entry.datasetDiagnostics || null,
    };
}

function syncCacheFromBacktestResult(data, dataSource, params, curSettings, cacheKey, effectiveStartDate, lookbackDays, existingEntry) {
    if (!data) return existingEntry || null;
    const priceMode = curSettings.priceMode || (params.adjustedPrice ? 'adjusted' : 'raw');

    const mergeRawData = Array.isArray(data.rawData) && data.rawData.length > 0;
    const mergedDataMap = new Map(Array.isArray(existingEntry?.data) ? existingEntry.data.map((row) => [row.date, row]) : []);
    if (mergeRawData) {
        data.rawData.forEach((row) => {
            if (row && row.date) {
                mergedDataMap.set(row.date, row);
            }
        });
    }
    let mergedData = Array.from(mergedDataMap.values());
    mergedData.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    let fetchedRange = null;
    if (data?.rawMeta?.fetchRange && data.rawMeta.fetchRange.start && data.rawMeta.fetchRange.end) {
        fetchedRange = {
            start: data.rawMeta.fetchRange.start,
            end: data.rawMeta.fetchRange.end,
        };
    } else if (curSettings.startDate && curSettings.endDate) {
        fetchedRange = { start: curSettings.startDate, end: curSettings.endDate };
    }

    if (!mergeRawData && Array.isArray(data.rawDataUsed) && data.rawDataUsed.length > 0) {
        mergedData = data.rawDataUsed.slice();
        mergedData.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        if (!fetchedRange && mergedData.length > 0) {
            fetchedRange = {
                start: mergedData[0].date || curSettings.startDate,
                end: mergedData[mergedData.length - 1].date || curSettings.endDate,
            };
        }
    }

    if (!mergedData || mergedData.length === 0) {
        return existingEntry || null;
    }

    const mergedCoverage = mergeIsoCoverage(
        existingEntry?.coverage || [],
        fetchedRange && fetchedRange.start && fetchedRange.end ? { start: fetchedRange.start, end: fetchedRange.end } : null,
    );
    const sourceSet = new Set(Array.isArray(existingEntry?.dataSources) ? existingEntry.dataSources : []);
    if (dataSource) sourceSet.add(dataSource);
    const sourceArray = Array.from(sourceSet);

    const rawMeta = data.rawMeta || {};
    const dataDebug = data.dataDebug || {};
    const debugSteps = Array.isArray(rawMeta.debugSteps)
        ? rawMeta.debugSteps
        : (Array.isArray(dataDebug.debugSteps) ? dataDebug.debugSteps : []);
    const summaryMeta = rawMeta.summary || dataDebug.summary || existingEntry?.summary || null;
    const adjustmentsMeta = Array.isArray(rawMeta.adjustments)
        ? rawMeta.adjustments
        : (Array.isArray(dataDebug.adjustments) ? dataDebug.adjustments : existingEntry?.adjustments || []);
    const fallbackFlag = typeof rawMeta.adjustmentFallbackApplied === 'boolean'
        ? rawMeta.adjustmentFallbackApplied
        : (typeof dataDebug.adjustmentFallbackApplied === 'boolean'
            ? dataDebug.adjustmentFallbackApplied
            : Boolean(existingEntry?.adjustmentFallbackApplied));
    const priceSourceMeta = rawMeta.priceSource || dataDebug.priceSource || existingEntry?.priceSource || null;
    const splitDiagnosticsMeta = rawMeta.splitDiagnostics || dataDebug.splitDiagnostics || existingEntry?.splitDiagnostics || null;
    const finmindStatusMeta = rawMeta.finmindStatus || dataDebug.finmindStatus || existingEntry?.finmindStatus || null;
    const adjustmentDebugLogMeta = rawMeta.adjustmentDebugLog || dataDebug.adjustmentDebugLog || existingEntry?.adjustmentDebugLog || null;
    const adjustmentChecksMeta = rawMeta.adjustmentChecks || dataDebug.adjustmentChecks || existingEntry?.adjustmentChecks || null;

    const updatedEntry = {
        ...(existingEntry || {}),
        data: mergedData,
        coverage: mergedCoverage,
        dataSources: sourceArray,
        dataSource: summariseSourceLabels(sourceArray),
        fetchedAt: Date.now(),
        adjustedPrice: params.adjustedPrice,
        splitAdjustment: params.splitAdjustment,
        priceMode,
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
        effectiveStartDate: curSettings.effectiveStartDate || effectiveStartDate,
        lookbackDays,
        datasetDiagnostics: data?.datasetDiagnostics || existingEntry?.datasetDiagnostics || null,
        fetchDiagnostics: data?.datasetDiagnostics?.fetch || existingEntry?.fetchDiagnostics || null,
    };

    applyCacheStartMetadata(cacheKey, updatedEntry, curSettings.effectiveStartDate || effectiveStartDate, {
        toleranceDays: START_GAP_TOLERANCE_DAYS,
        acknowledgeExcessGap: false,
    });
    cachedDataStore.set(cacheKey, updatedEntry);
    visibleStockData = extractRangeData(updatedEntry.data, curSettings.effectiveStartDate || effectiveStartDate, curSettings.endDate);
    cachedStockData = updatedEntry.data;
    lastFetchSettings = { ...curSettings };
    refreshPriceInspectorControls();
    updatePriceDebug(updatedEntry);
    return updatedEntry;
}

function updateStagingOptimizationStatus(message, isError = false) {
    const statusEl = document.getElementById('staging-optimization-status');
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.style.color = isError ? 'var(--destructive)' : 'var(--muted-foreground)';
    statusEl.classList.toggle('font-semibold', Boolean(isError));
}

function updateStagingOptimizationProgress(currentIndex, total, entryLabel, exitLabel, entryModeLabel, exitModeLabel) {
    const progressWrapper = document.getElementById('staging-optimization-progress');
    const progressBar = document.getElementById('staging-optimization-progress-bar');
    if (progressWrapper) {
        progressWrapper.classList.remove('hidden');
    }
    if (progressBar && Number.isFinite(total) && total > 0) {
        const percent = Math.max(0, Math.min(100, Math.round((currentIndex / total) * 100)));
        progressBar.style.width = `${percent}%`;
    }
    const entryText = entryLabel || '??;
    const exitText = exitLabel || '??;
    const entryModeText = entryModeLabel ? `嚗?{entryModeLabel}嚗 : '';
    const exitModeText = exitModeLabel ? `嚗?{exitModeLabel}嚗 : '';
    updateStagingOptimizationStatus(`皜祈岫蝚?${currentIndex} / ${total} 蝯??脣 ${entryText}${entryModeText}嚗??${exitText}${exitModeText}`);
}

function formatPercent(value) {
    if (!Number.isFinite(value)) return 'N/A';
    const rounded = Number.parseFloat(value.toFixed(2));
    const sign = rounded > 0 ? '+' : '';
    return `${sign}${rounded}%`;
}

function formatNumber(value, digits = 2) {
    if (!Number.isFinite(value)) return 'N/A';
    return value.toFixed(digits);
}

function renderStagingOptimizationResults(results) {
    const resultsContainer = document.getElementById('staging-optimization-results');
    const tableBody = document.getElementById('staging-optimization-table-body');
    const summaryEl = document.getElementById('staging-optimization-summary');
    if (!resultsContainer || !tableBody || !summaryEl) return;

    if (!Array.isArray(results) || results.length === 0) {
        tableBody.innerHTML = '';
        summaryEl.textContent = '?芸?敺????挾蝯?蝯???;
        resultsContainer.classList.add('hidden');
        return;
    }

    const sorted = [...results].sort((a, b) => {
        const aAnn = Number.isFinite(a.metrics?.annualizedReturn) ? a.metrics.annualizedReturn : -Infinity;
        const bAnn = Number.isFinite(b.metrics?.annualizedReturn) ? b.metrics.annualizedReturn : -Infinity;
        if (bAnn !== aAnn) return bAnn - aAnn;
        const aSharpe = Number.isFinite(a.metrics?.sharpeRatio) ? a.metrics.sharpeRatio : -Infinity;
        const bSharpe = Number.isFinite(b.metrics?.sharpeRatio) ? b.metrics.sharpeRatio : -Infinity;
        if (bSharpe !== aSharpe) return bSharpe - aSharpe;
        const aDrawdown = Number.isFinite(a.metrics?.maxDrawdown) ? a.metrics.maxDrawdown : Infinity;
        const bDrawdown = Number.isFinite(b.metrics?.maxDrawdown) ? b.metrics.maxDrawdown : Infinity;
        return aDrawdown - bDrawdown;
    });

    stagingOptimizationState.results = sorted;
    stagingOptimizationState.bestResult = sorted[0] || null;

    const rows = sorted.slice(0, Math.min(sorted.length, 10)).map((item, index) => {
        const metrics = item.metrics || {};
        const annCls = Number.isFinite(metrics.annualizedReturn) && metrics.annualizedReturn >= 0 ? 'text-emerald-600' : 'text-rose-600';
        const drawCls = Number.isFinite(metrics.maxDrawdown) ? 'text-rose-600' : '';
        const sharpeText = Number.isFinite(metrics.sharpeRatio) ? metrics.sharpeRatio.toFixed(2) : 'N/A';
        const drawdownText = Number.isFinite(metrics.maxDrawdown) ? `${metrics.maxDrawdown.toFixed(2)}%` : 'N/A';
        const tradesText = Number.isFinite(metrics.tradesCount) ? metrics.tradesCount : (Number.isFinite(metrics.tradeCount) ? metrics.tradeCount : 'N/A');
        const entryModeLabel = resolveStageModeDisplay(item.combination?.entry, item.combination?.entryMode, 'entry');
        const exitModeLabel = resolveStageModeDisplay(item.combination?.exit, item.combination?.exitMode, 'exit');
        return `<tr class="${index === 0 ? 'bg-emerald-50 font-semibold' : 'hover:bg-muted/40'}">
            <td class="px-3 py-2">${index + 1}</td>
            <td class="px-3 py-2">${item.combination.entry.display}</td>
            <td class="px-3 py-2">${entryModeLabel}</td>
            <td class="px-3 py-2">${item.combination.exit.display}</td>
            <td class="px-3 py-2">${exitModeLabel}</td>
            <td class="px-3 py-2 ${annCls}">${formatPercent(metrics.annualizedReturn)}</td>
            <td class="px-3 py-2">${sharpeText}</td>
            <td class="px-3 py-2 ${drawCls}">${drawdownText}</td>
            <td class="px-3 py-2">${tradesText}</td>
        </tr>`;
    }).join('');

    tableBody.innerHTML = rows;
    resultsContainer.classList.remove('hidden');

    const best = stagingOptimizationState.bestResult;
    if (best && best.metrics) {
        const metrics = best.metrics;
        const entryModeLabel = resolveStageModeDisplay(best.combination?.entry, best.combination?.entryMode, 'entry');
        const exitModeLabel = resolveStageModeDisplay(best.combination?.exit, best.combination?.exitMode, 'exit');
        summaryEl.innerHTML = `?刻蝯?嚗?strong>${best.combination.entry.display}</strong>嚗?{entryModeLabel}嚗?? <strong>${best.combination.exit.display}</strong>嚗?{exitModeLabel}嚗 +
            ` 撟游??梢 <span class="${metrics.annualizedReturn >= 0 ? 'text-emerald-600' : 'text-rose-600'}">${formatPercent(metrics.annualizedReturn)}</span>` +
            ` 嚗?憭瘥? ${formatNumber(metrics.sharpeRatio, 2)} 嚗??憭批???<span class="text-rose-600">${formatPercent(metrics.maxDrawdown)}</span>? +
            `<br><span class="text-xs" style="color: var(--muted-foreground);">?勗???${sorted.length} 蝯葫閰艾?/span>`;
    } else {
        summaryEl.textContent = '?芣?圈???挾蝯???;
    }

    updateStagingOptimizationStatus('?挾?芸?摰?嚗?潔??寞??行??柴?, false);
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}

async function runStagingOptimization() {
    if (!workerUrl) {
        showError('?閮?撘?撠皞?撠梁?嚗?蝔?閰艾?);
        return;
    }
    if (stagingOptimizationState.running) {
        updateStagingOptimizationStatus('?挾?芸??脰?銝哨?隢???);
        return;
    }

    if (window.lazybacktestMultiStagePanel && typeof window.lazybacktestMultiStagePanel.open === 'function') {
        window.lazybacktestMultiStagePanel.open();
    }

    const runButton = document.getElementById('stagingOptimizationBtn');
    const applyButton = document.getElementById('applyStagingOptimizationBtn');
    if (applyButton) applyButton.disabled = true;

    const baseParams = getBacktestParams();
    if (!validateBacktestParams(baseParams)) {
        activateTab('staging-optimizer');
        updateStagingOptimizationStatus('隢?靽格迤?葫閮剖?敺??岫?挾?芸???, true);
        return;
    }

    activateTab('staging-optimizer');
    const progressBar = document.getElementById('staging-optimization-progress-bar');
    if (progressBar) progressBar.style.width = '0%';
    const resultsContainer = document.getElementById('staging-optimization-results');
    if (resultsContainer) resultsContainer.classList.add('hidden');
    updateStagingOptimizationStatus('甇??渡???挾蝯?...', false);

    stagingOptimizationState.running = true;
    stagingOptimizationState.results = [];
    stagingOptimizationState.bestResult = null;

    if (runButton) {
        runButton.disabled = true;
        runButton.innerHTML = '<i data-lucide="loader-2" class="lucide-sm animate-spin"></i> ?挾?芸?銝?..';
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
        }
    }

    try {
        const combinations = buildStagingOptimizationCombos(baseParams);
        stagingOptimizationState.combinations = combinations.combos;
        if (!Array.isArray(combinations.combos) || combinations.combos.length === 0) {
            updateStagingOptimizationStatus('?桀?閮剖??⊥??Ｙ?????畾萇???, true);
            stagingOptimizationState.running = false;
            if (runButton) {
                runButton.disabled = false;
                runButton.innerHTML = '<i data-lucide="play-circle" class="lucide-sm"></i> 銝?萄??畾萇???;
                if (typeof lucide !== 'undefined' && lucide.createIcons) {
                    lucide.createIcons();
                }
            }
            return;
        }

        const sharedUtils = (typeof lazybacktestShared === 'object' && lazybacktestShared) ? lazybacktestShared : null;
        const maxIndicatorPeriod = sharedUtils && typeof sharedUtils.getMaxIndicatorPeriod === 'function'
            ? sharedUtils.getMaxIndicatorPeriod(baseParams)
            : 0;
        const lookbackDays = sharedUtils && typeof sharedUtils.estimateLookbackBars === 'function'
            ? sharedUtils.estimateLookbackBars(maxIndicatorPeriod, { minBars: 90, multiplier: 2 })
            : Math.max(90, maxIndicatorPeriod * 2);
        const effectiveStartDate = baseParams.startDate;
        let dataStartDate = effectiveStartDate;
        if (sharedUtils && typeof sharedUtils.computeBufferedStartDate === 'function') {
            dataStartDate = sharedUtils.computeBufferedStartDate(effectiveStartDate, lookbackDays, {
                minDate: sharedUtils.MIN_DATA_DATE,
                marginTradingDays: 12,
                extraCalendarDays: 7,
            }) || effectiveStartDate;
        }
        if (!dataStartDate) dataStartDate = effectiveStartDate;

        const curSettings = {
            stockNo: baseParams.stockNo,
            startDate: dataStartDate,
            endDate: baseParams.endDate,
            effectiveStartDate,
            market: (baseParams.market || baseParams.marketType || currentMarket || 'TWSE').toUpperCase(),
            adjustedPrice: baseParams.adjustedPrice,
            splitAdjustment: baseParams.splitAdjustment,
            priceMode: (baseParams.priceMode || (baseParams.adjustedPrice ? 'adjusted' : 'raw') || 'raw').toLowerCase(),
            lookbackDays,
        };
        const cacheKey = buildCacheKey(curSettings);
        let cachedEntry = cachedDataStore.get(cacheKey) || null;
        let cachedPayload = Array.isArray(cachedEntry?.data) ? cachedEntry.data : (Array.isArray(cachedStockData) ? cachedStockData : null);
        let cachedMeta = cachedEntry ? buildCachedMetaFromEntry(cachedEntry, effectiveStartDate, lookbackDays) : null;
        let datasetReady = Array.isArray(cachedPayload) && cachedPayload.length > 0;

        const results = [];
        const total = combinations.combos.length;
        let index = 0;

        for (const combo of combinations.combos) {
            index += 1;
            const entryModeProgressLabel = resolveStageModeDisplay(combo.entry, combo.entryMode, 'entry');
            const exitModeProgressLabel = resolveStageModeDisplay(combo.exit, combo.exitMode, 'exit');
            updateStagingOptimizationProgress(
                index - 1,
                total,
                combo.entry.display,
                combo.exit.display,
                entryModeProgressLabel === '?? ? '' : entryModeProgressLabel,
                exitModeProgressLabel === '?? ? '' : exitModeProgressLabel
            );

            const candidateParams = {
                ...baseParams,
                entryStages: combo.entry.values.slice(),
                exitStages: combo.exit.values.slice(),
                entryStagingMode: combo.entryMode?.value || combo.entryMode || baseParams.entryStagingMode,
                exitStagingMode: combo.exitMode?.value || combo.exitMode || baseParams.exitStagingMode,
            };

            const runOptions = {
                useCache: datasetReady,
                cachedData: datasetReady ? cachedPayload : null,
                cachedMeta: datasetReady ? cachedMeta : null,
                dataStartDate,
                effectiveStartDate,
                lookbackDays,
                curSettings,
                cacheKey,
                existingEntry: cachedEntry,
            };

            const { result, updatedEntry, rawDataUsed } = await executeStagingCandidate(candidateParams, runOptions);
            if (!datasetReady) {
                if (updatedEntry && Array.isArray(updatedEntry.data)) {
                    cachedEntry = updatedEntry;
                    cachedPayload = updatedEntry.data;
                    cachedMeta = buildCachedMetaFromEntry(updatedEntry, effectiveStartDate, lookbackDays);
                    datasetReady = true;
                } else if (Array.isArray(rawDataUsed) && rawDataUsed.length > 0) {
                    cachedPayload = rawDataUsed;
                    cachedMeta = null;
                    datasetReady = true;
                    cachedStockData = rawDataUsed;
                }
            } else if (updatedEntry && Array.isArray(updatedEntry.data)) {
                cachedEntry = updatedEntry;
                cachedPayload = updatedEntry.data;
                cachedMeta = buildCachedMetaFromEntry(updatedEntry, effectiveStartDate, lookbackDays);
            }

            const entryModeCompleteLabel = resolveStageModeDisplay(combo.entry, combo.entryMode, 'entry');
            const exitModeCompleteLabel = resolveStageModeDisplay(combo.exit, combo.exitMode, 'exit');
            updateStagingOptimizationProgress(
                index,
                total,
                combo.entry.display,
                combo.exit.display,
                entryModeCompleteLabel === '?? ? '' : entryModeCompleteLabel,
                exitModeCompleteLabel === '?? ? '' : exitModeCompleteLabel
            );

            const metrics = {
                annualizedReturn: Number.isFinite(result?.annualizedReturn) ? result.annualizedReturn : null,
                sharpeRatio: Number.isFinite(result?.sharpeRatio) ? result.sharpeRatio : null,
                maxDrawdown: Number.isFinite(result?.maxDrawdown) ? result.maxDrawdown : null,
                tradesCount: Number.isFinite(result?.tradesCount) ? result.tradesCount : Number.isFinite(result?.tradeCount) ? result.tradeCount : null,
            };

            results.push({
                combination: combo,
                metrics,
                raw: result,
            });
        }

        renderStagingOptimizationResults(results);
        if (applyButton) applyButton.disabled = !stagingOptimizationState.bestResult;
    } catch (error) {
        console.error('[Staging Optimization] ?潛??航炊:', error);
        updateStagingOptimizationStatus(`?挾?芸??潛??航炊嚗?{error.message}`, true);
    } finally {
        stagingOptimizationState.running = false;
        if (runButton) {
            runButton.disabled = false;
            runButton.innerHTML = '<i data-lucide="play-circle" class="lucide-sm"></i> 銝?萄??畾萇???;
            if (typeof lucide !== 'undefined' && lucide.createIcons) {
                lucide.createIcons();
            }
        }
    }
}

function executeStagingCandidate(params, options) {
    return new Promise((resolve, reject) => {
        const worker = new Worker(workerUrl);
        const cleanup = () => {
            try { worker.terminate(); } catch (err) { console.warn('[Staging Optimization] Worker terminate failed:', err); }
        };
        worker.onerror = (err) => {
            cleanup();
            reject(err);
        };
        worker.onmessage = (event) => {
            const { type, data, dataSource } = event.data;
            if (type === 'result') {
                let updatedEntry = null;
                if (!options.useCache || !options.existingEntry || Array.isArray(data?.rawData)) {
                    updatedEntry = syncCacheFromBacktestResult(
                        data,
                        dataSource,
                        params,
                        options.curSettings,
                        options.cacheKey,
                        options.effectiveStartDate,
                        options.lookbackDays,
                        options.existingEntry,
                    );
                }
                cleanup();
                resolve({ result: data, updatedEntry, rawDataUsed: data?.rawDataUsed || null });
            } else if (type === 'error') {
                cleanup();
                reject(new Error(data?.message || '?挾?芸???憭望?'));
            }
        };

        const message = {
            type: 'runBacktest',
            params,
            useCachedData: Boolean(options.useCache && Array.isArray(options.cachedData) && options.cachedData.length > 0),
            dataStartDate: options.dataStartDate,
            effectiveStartDate: options.effectiveStartDate,
            lookbackDays: options.lookbackDays,
        };
        if (message.useCachedData) {
            message.cachedData = options.cachedData;
            if (options.cachedMeta) {
                message.cachedMeta = options.cachedMeta;
            }
        }
        worker.postMessage(message);
    });
}

function applyBestStagingRecommendation() {
    const best = stagingOptimizationState.bestResult;
    if (!best) {
        updateStagingOptimizationStatus('撠?Ｙ??刻?挾嚗??銵?畾萄??, true);
        return;
    }
    if (window.lazybacktestMultiStagePanel && typeof window.lazybacktestMultiStagePanel.open === 'function') {
        window.lazybacktestMultiStagePanel.open();
    }
    if (window.lazybacktestStagedEntry && typeof window.lazybacktestStagedEntry.setValues === 'function') {
        window.lazybacktestStagedEntry.setValues(best.combination.entry.values, { manual: true });
    }
    if (window.lazybacktestStagedExit && typeof window.lazybacktestStagedExit.setValues === 'function') {
        window.lazybacktestStagedExit.setValues(best.combination.exit.values, { manual: true });
    }
    const entryModeSelect = document.getElementById('entryStagingMode');
    if (entryModeSelect && best.combination.entryMode) {
        entryModeSelect.value = best.combination.entryMode.value || best.combination.entryMode;
        entryModeSelect.dispatchEvent(new Event('change'));
    }
    const exitModeSelect = document.getElementById('exitStagingMode');
    if (exitModeSelect && best.combination.exitMode) {
        exitModeSelect.value = best.combination.exitMode.value || best.combination.exitMode;
        exitModeSelect.dispatchEvent(new Event('change'));
    }
    updateStagingOptimizationStatus('撌脣??冽?血?畾蛛?隢??啣銵?皜祉Ⅱ隤蜀??, false);
    showSuccess('撌脣??冽?血?畾菔身摰?撱箄降??葫隞亦Ⅱ隤蜀?”?整?);
}


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
        paramsContainer.innerHTML = '<p class="text-xs text-gray-400 italic">甇斤??亦??</p>';
    } else {
        for (const pName in config.defaultParams) {
            const defVal = config.defaultParams[pName];
            let lbl = pName;
            let idSfx = pName.charAt(0).toUpperCase() + pName.slice(1);
            
            // 璅惜?迂??
            if (internalKey === 'k_d_cross') {
                if(pName==='period')lbl='KD?望?';
                else if(pName==='thresholdX'){lbl='D?潔???X)';idSfx='KdThresholdX';}
            } else if (internalKey === 'k_d_cross_exit') {
                if(pName==='period')lbl='KD?望?';
                else if(pName==='thresholdY'){lbl='D?潔???Y)';idSfx='KdThresholdY';}
            } else if (internalKey === 'turtle_stop_loss') {
                if(pName==='stopLossPeriod'){lbl='???望?';idSfx='StopLossPeriod';}
            } else if ((internalKey === 'macd_cross' || internalKey === 'macd_cross_exit') && pName === 'signalPeriod') {
                lbl='DEA?望?(x)'; idSfx = 'SignalPeriod';
            } else if ((internalKey === 'macd_cross' || internalKey === 'macd_cross_exit') && pName === 'shortPeriod') {
                lbl='DI?胥MA(n)';
            } else if ((internalKey === 'macd_cross' || internalKey === 'macd_cross_exit') && pName === 'longPeriod') {
                lbl='DI?幌MA(m)';
            } else if (internalKey === 'short_k_d_cross') {
                if(pName==='period')lbl='KD?望?';
                else if(pName==='thresholdY'){lbl='D?潔???Y)';idSfx='ShortKdThresholdY';}
            } else if (internalKey === 'cover_k_d_cross') {
                if(pName==='period')lbl='KD?望?';
                else if(pName==='thresholdX'){lbl='D?潔???X)';idSfx='CoverKdThresholdX';}
            } else if (internalKey === 'short_macd_cross') {
                if(pName==='shortPeriod')lbl='DI?胥MA(n)';
                else if(pName==='longPeriod')lbl='DI?幌MA(m)';
                else if(pName==='signalPeriod'){lbl='DEA?望?(x)';idSfx='ShortSignalPeriod';}
            } else if (internalKey === 'cover_macd_cross') {
                if(pName==='shortPeriod')lbl='DI?胥MA(n)';
                else if(pName==='longPeriod')lbl='DI?幌MA(m)';
                else if(pName==='signalPeriod'){lbl='DEA?望?(x)';idSfx='CoverSignalPeriod';}
            } else if (internalKey === 'short_turtle_stop_loss') {
                if(pName==='stopLossPeriod'){lbl='閫撖望?';idSfx='ShortStopLossPeriod';}
            } else if (internalKey === 'cover_turtle_breakout') {
                if(pName==='breakoutPeriod'){lbl='蝒?望?';idSfx='CoverBreakoutPeriod';}
            } else if (internalKey === 'cover_trailing_stop') {
                if(pName==='percentage'){lbl='?曉?瘥?%)';idSfx='CoverTrailingStopPercentage';}
            } else {
                const baseKey = internalKey.replace('short_', '').replace('cover_', '').replace('_exit', '');
                if (baseKey === 'ma_cross' || baseKey === 'ema_cross') {
                    if(pName==='shortPeriod')lbl='?剜?SMA';
                    else if(pName==='longPeriod')lbl='?瑟?SMA';
                } else if (baseKey === 'ma_above' || baseKey === 'ma_below') {
                    if(pName==='period')lbl='SMA?望?';
                } else if(pName==='period')lbl='?望?';
                else if(pName==='threshold')lbl='?曉?;
                else if(pName==='signalPeriod')lbl='靽∟??望?';
                else if(pName==='deviations')lbl='璅?撌?;
                else if(pName==='multiplier')lbl='?漱?';
                else if(pName==='percentage')lbl='?曉?瘥?%)';
                else if(pName==='breakoutPeriod')lbl='蝒?望?';
                else if(pName==='stopLossPeriod')lbl='???望?';
                else { lbl = pName; }
            }
            
            const id = `${type}${idSfx}`;
            const pg = document.createElement('div');
            const lb = document.createElement('label');
            lb.htmlFor = id;
            lb.className = "block text-xs font-medium text-gray-600 mb-1";
            
            // 瑼Ｘ?臬?????閮蒂瘛餃?蝭?憿舐內嚗?冽????仿???
            const optimizeTarget = config.optimizeTargets?.find(t => t.name === pName);
            if (optimizeTarget?.range) {
                const rangeText = `${optimizeTarget.range.from}-${optimizeTarget.range.to}`;
                lb.innerHTML = `${lbl}<br><span class="text-xs text-blue-500 font-normal">蝭?: ${rangeText}</span>`;
            } else {
                lb.textContent = lbl;
            }
            
            const ip = document.createElement('input');
            ip.type = 'number';
            ip.id = id;
            ip.value = defVal;
            ip.className = "w-full px-2 py-1 border border-gray-300 rounded-md shadow-sm text-sm focus:ring-blue-500 focus:border-blue-500";
            
            // 閮剖?頛詨蝭?
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
    
    // ?湔?芸???賊?
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
                    optimizeSelect.title = `?豢??芸??`;
                } else {
                    const opt = document.createElement('option');
                    opt.value="null";
                    opt.textContent = '?∪?芸?';
                    optimizeSelect.appendChild(opt);
                    optimizeSelect.disabled = true;
                    optimizeSelect.title = '甇斤??亦?臬????;
                }
            } else {
                console.warn(`[Update Params] Optimize select element not found: #${optimizeSelectId}`);
            }
        }
    }
}

function resetSettings() {
    document.getElementById("stockNo").value = "2330";
    initDates();
    document.getElementById("initialCapital").value = "100000";
    document.getElementById("positionSize").value = "100";
    if (window.lazybacktestStagedEntry && typeof window.lazybacktestStagedEntry.resetToDefault === 'function') {
        window.lazybacktestStagedEntry.resetToDefault(100);
    }
    if (window.lazybacktestStagedExit && typeof window.lazybacktestStagedExit.resetToDefault === 'function') {
        window.lazybacktestStagedExit.resetToDefault(100);
    }
    const entryModeSelect = document.getElementById("entryStagingMode");
    if (entryModeSelect) entryModeSelect.value = "signal_repeat";
    const exitModeSelect = document.getElementById("exitStagingMode");
    if (exitModeSelect) exitModeSelect.value = "signal_repeat";
    document.getElementById("stopLoss").value = "0";
    document.getElementById("takeProfit").value = "0";
    document.getElementById("positionBasisInitial").checked = true;
    setDefaultFees("2330");
    document.querySelector('input[name="tradeTiming"][value="close"]').checked = true;
    document.getElementById("entryStrategy").value = "ma_cross";
    updateStrategyParams('entry');
    document.getElementById("exitStrategy").value = "ma_cross";
    updateStrategyParams('exit');
    const shortCheckbox = document.getElementById("enableShortSelling");
    const shortArea = document.getElementById("short-strategy-area");
    shortCheckbox.checked = false;
    shortArea.style.display = 'none';
    document.getElementById("shortEntryStrategy").value = "short_ma_cross";
    updateStrategyParams('shortEntry');
    document.getElementById("shortExitStrategy").value = "cover_ma_cross";
    updateStrategyParams('shortExit');
    cachedStockData = null;
    cachedDataStore.clear();
    lastFetchSettings = null;
    refreshPriceInspectorControls();
    clearPreviousResults();
    showSuccess("閮剖?撌脤?蝵?);
}

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
        console.log(`[Fees] US market defaults applied for ${stockCode || '(?芾撓??'}`);
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
        console.log(`[Fees] ??身鞎餌? for ${stockCode}`);
    } else if (isETF) {
        buyFeeInput.value = etfBuyFeeRate.toFixed(4);
        sellFeeInput.value = (etfSellFeeRate + etfTaxRate).toFixed(4);
        console.log(`[Fees] ETF ?身鞎餌? for ${stockCode} -> Buy: ${buyFeeInput.value}%, Sell+Tax: ${sellFeeInput.value}%`);
    } else {
        buyFeeInput.value = stockBuyFeeRate.toFixed(4);
        sellFeeInput.value = (stockSellFeeRate + stockTaxRate).toFixed(4);
        console.log(`[Fees] Stock ?身鞎餌? for ${stockCode} -> Buy: ${buyFeeInput.value}%, Sell+Tax: ${sellFeeInput.value}%`);
    }
}
function getSavedStrategies() { const strategies = localStorage.getItem(SAVED_STRATEGIES_KEY); try { const parsed = strategies ? JSON.parse(strategies) : {}; // 皜??????
        const cleaned = {};
        for (const [name, data] of Object.entries(parsed)) {
            if (data && typeof data === 'object' && data.settings) {
                cleaned[name] = data;
            } else {
                console.warn(`[Storage] Removing corrupted strategy: ${name}`, data);
            }
        }
        // 憒???憯?◤皜?嚗??localStorage
        if (Object.keys(cleaned).length !== Object.keys(parsed).length) {
            localStorage.setItem(SAVED_STRATEGIES_KEY, JSON.stringify(cleaned));
        }
        return cleaned; } catch (e) { console.error("霈???交?閫??JSON?航炊:", e); return {}; } }
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
                entryStages: settings.entryStages,
                entryStagingMode: settings.entryStagingMode,
                exitStrategy: settings.exitStrategy,
                exitParams: settings.exitParams,
                exitStages: settings.exitStages,
                exitStagingMode: settings.exitStagingMode,
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
        console.error("?脣?蝑??localStorage ??隤?", e); 
        if (e.name === 'QuotaExceededError') { 
            showError("?脣?憭望?嚗ocalStorage 蝛粹?撌脫遛???芷銝鈭?蝑??); 
        } else { 
            showError(`?脣?蝑憭望?: ${e.message}`); 
        } 
        return false; 
    } 
}
function deleteStrategyFromLocalStorage(name) { try { const strategies = getSavedStrategies(); if (strategies[name]) { delete strategies[name]; localStorage.setItem(SAVED_STRATEGIES_KEY, JSON.stringify(strategies)); return true; } return false; } catch (e) { console.error("?芷蝑??隤?", e); showError(`?芷蝑憭望?: ${e.message}`); return false; } }
function populateSavedStrategiesDropdown() { 
    const selectElement = document.getElementById('loadStrategySelect'); 
    if (!selectElement) return;
    
    selectElement.innerHTML = '<option value="">-- ?豢?閬??亦?蝑 --</option>'; 
    const strategies = getSavedStrategies(); 
    const strategyNames = Object.keys(strategies).sort(); 
    
    strategyNames.forEach(name => { 
        const strategyData = strategies[name]; 
        if (!strategyData) return; // 頝喲? null ??undefined ???亥???
        
        const metrics = strategyData.metrics || {}; // 靽格迤嚗僑??祉?撌脩??舐???澆?嚗??閬?銋誑100
        const annReturn = (metrics.annualizedReturn !== null && !isNaN(metrics.annualizedReturn)) ? metrics.annualizedReturn.toFixed(2) + '%' : 'N/A'; 
        const sharpe = (metrics.sharpeRatio !== null && !isNaN(metrics.sharpeRatio)) ? metrics.sharpeRatio.toFixed(2) : 'N/A'; 
        const displayText = `${name} (撟游?:${annReturn} | Sharpe:${sharpe})`; 
        const option = document.createElement('option'); 
        option.value = name; 
        option.textContent = displayText; 
        selectElement.appendChild(option); 
    }); 
}
function saveStrategy() { 
    // ???身蝑?迂嚗蝙?其葉??蝔梧?
    const stockNo = document.getElementById('stockNo').value.trim().toUpperCase() || '2330';
    const entryStrategy = document.getElementById('entryStrategy').value;
    const exitStrategy = document.getElementById('exitStrategy').value;
    const enableShorting = document.getElementById('enableShortSelling').checked;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    // 閮???撟港遢
    let yearPeriod = '';
    if (startDate && endDate) {
        const startYear = new Date(startDate).getFullYear();
        const endYear = new Date(endDate).getFullYear();
        const yearDiff = endYear - startYear;
        if (yearDiff > 0) {
            yearPeriod = `${yearDiff}撟循;
        }
    }
    
    // ?脣?銝剜?蝑?迂
    const entryStrategyName = strategyDescriptions[entryStrategy]?.name || entryStrategy;
    
    // ?箏蝑?閬畾??誑?脣?甇?Ⅱ?葉??蝔?
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
    
    // 瘛餃???撟港遢?圈?閮剖?蝔望撠?
    if (yearPeriod) {
        defaultName += `_${yearPeriod}`;
    }
    
    const strategyName = prompt("隢撓?亦??亙?蝔梧?", defaultName); 
    if (!strategyName || strategyName.trim() === "") { 
        showInfo("蝑?迂銝?箇征??); 
        return; 
    } 
    const trimmedName = strategyName.trim();
    
    const strategies = getSavedStrategies(); 
    if (strategies[trimmedName]) { 
        if (!confirm(`蝑 "${trimmedName}" 撌脣??具?西???`)) { 
            return; 
        } 
    } 
    if (lastOverallResult === null || lastOverallResult.annualizedReturn === null || lastOverallResult.sharpeRatio === null) { 
        if (!confirm("撠?瑁??葫??甈∪?皜祉??蝮暹?????虫?閬摮迨蝑閮剖?嚗蜀??璅?憿舐內??N/A嚗?")) { 
            return; 
        } 
    } 
    const currentSettings = getBacktestParams(); 
    const currentMetrics = { annualizedReturn: lastOverallResult?.annualizedReturn, sharpeRatio: lastOverallResult?.sharpeRatio }; 
    
    if (saveStrategyToLocalStorage(trimmedName, currentSettings, currentMetrics)) { 
        populateSavedStrategiesDropdown(); 
        showSuccess(`蝑 "${trimmedName}" 撌脣摮?`); 
    }
}
function loadStrategy() { const selectElement = document.getElementById('loadStrategySelect'); const strategyName = selectElement.value; if (!strategyName) { showInfo("隢?敺???桅??頛???乓?); return; } const strategies = getSavedStrategies(); const strategyData = strategies[strategyName]; if (!strategyData || !strategyData.settings) { showError(`頛蝑 "${strategyName}" 憭望?嚗銝蝑?豢??); return; } const settings = strategyData.settings; console.log(`[Main] Loading strategy: ${strategyName}`, settings); try { document.getElementById('stockNo').value = settings.stockNo || '2330'; setDefaultFees(settings.stockNo || '2330'); document.getElementById('startDate').value = settings.startDate || ''; document.getElementById('endDate').value = settings.endDate || ''; document.getElementById('initialCapital').value = settings.initialCapital || 100000; document.getElementById('recentYears').value = 5; const tradeTimingInput = document.querySelector(`input[name="tradeTiming"][value="${settings.tradeTiming || 'close'}"]`); if (tradeTimingInput) tradeTimingInput.checked = true; document.getElementById('buyFee').value = (settings.buyFee !== undefined) ? settings.buyFee : (document.getElementById('buyFee').value || 0.1425); document.getElementById('sellFee').value = (settings.sellFee !== undefined) ? settings.sellFee : (document.getElementById('sellFee').value || 0.4425); document.getElementById('positionSize').value = settings.positionSize || 100;
        if (window.lazybacktestStagedEntry) {
            if (Array.isArray(settings.entryStages) && settings.entryStages.length > 0 && typeof window.lazybacktestStagedEntry.setValues === 'function') {
                window.lazybacktestStagedEntry.setValues(settings.entryStages);
            } else if (typeof window.lazybacktestStagedEntry.resetToDefault === 'function') {
                window.lazybacktestStagedEntry.resetToDefault(settings.positionSize || 100);
            }
        }
        const entryModeSelect = document.getElementById('entryStagingMode');
        if (entryModeSelect) entryModeSelect.value = settings.entryStagingMode || 'signal_repeat';
        if (window.lazybacktestStagedExit) {
            if (Array.isArray(settings.exitStages) && settings.exitStages.length > 0 && typeof window.lazybacktestStagedExit.setValues === 'function') {
                window.lazybacktestStagedExit.setValues(settings.exitStages);
            } else if (typeof window.lazybacktestStagedExit.resetToDefault === 'function') {
                window.lazybacktestStagedExit.resetToDefault(100);
            }
        }
        const exitModeSelect = document.getElementById('exitStagingMode');
        if (exitModeSelect) exitModeSelect.value = settings.exitStagingMode || 'signal_repeat'; document.getElementById('stopLoss').value = settings.stopLoss ?? 0; document.getElementById('takeProfit').value = settings.takeProfit ?? 0; const positionBasisInput = document.querySelector(`input[name="positionBasis"][value="${settings.positionBasis || 'initialCapital'}"]`); if (positionBasisInput) positionBasisInput.checked = true; document.getElementById('entryStrategy').value = settings.entryStrategy || 'ma_cross'; updateStrategyParams('entry'); if(settings.entryParams) { for (const pName in settings.entryParams) { let idSfx = pName.charAt(0).toUpperCase() + pName.slice(1); let finalIdSfx = idSfx; if (settings.entryStrategy === 'k_d_cross' && pName === 'thresholdX') finalIdSfx = 'KdThresholdX'; else if ((settings.entryStrategy === 'macd_cross') && pName === 'signalPeriod') finalIdSfx = 'SignalPeriod'; const inputElement = document.getElementById(`entry${finalIdSfx}`); if (inputElement) inputElement.value = settings.entryParams[pName]; else console.warn(`[Load] Entry Param Input not found: entry${finalIdSfx}`); } } document.getElementById('exitStrategy').value = settings.exitStrategy || 'ma_cross'; updateStrategyParams('exit'); if(settings.exitParams) { for (const pName in settings.exitParams) { let idSfx = pName.charAt(0).toUpperCase() + pName.slice(1); let finalIdSfx = idSfx; const exitInternalKey = (['ma_cross','macd_cross','k_d_cross','ema_cross'].includes(settings.exitStrategy)) ? `${settings.exitStrategy}_exit` : settings.exitStrategy; if (exitInternalKey === 'k_d_cross_exit' && pName === 'thresholdY') finalIdSfx = 'KdThresholdY'; else if (exitInternalKey === 'turtle_stop_loss' && pName === 'stopLossPeriod') finalIdSfx = 'StopLossPeriod'; else if (exitInternalKey === 'macd_cross_exit' && pName === 'signalPeriod') finalIdSfx = 'SignalPeriod'; const inputElement = document.getElementById(`exit${finalIdSfx}`); if (inputElement) inputElement.value = settings.exitParams[pName]; else console.warn(`[Load] Exit Param Input not found: exit${finalIdSfx}`); } } const shortCheckbox = document.getElementById('enableShortSelling'); const shortArea = document.getElementById('short-strategy-area'); shortCheckbox.checked = settings.enableShorting || false; shortArea.style.display = shortCheckbox.checked ? 'grid' : 'none'; if (settings.enableShorting) { document.getElementById('shortEntryStrategy').value = settings.shortEntryStrategy || 'short_ma_cross'; updateStrategyParams('shortEntry'); if(settings.shortEntryParams) { for (const pName in settings.shortEntryParams) { let idSfx = pName.charAt(0).toUpperCase() + pName.slice(1); let finalIdSfx = idSfx; const shortEntryInternalKey = `short_${settings.shortEntryStrategy}`; if (shortEntryInternalKey === 'short_k_d_cross' && pName === 'thresholdY') finalIdSfx = 'ShortKdThresholdY'; else if (shortEntryInternalKey === 'short_macd_cross' && pName === 'signalPeriod') finalIdSfx = 'ShortSignalPeriod'; else if (shortEntryInternalKey === 'short_turtle_stop_loss' && pName === 'stopLossPeriod') finalIdSfx = 'ShortStopLossPeriod'; const inputElement = document.getElementById(`shortEntry${finalIdSfx}`); if (inputElement) inputElement.value = settings.shortEntryParams[pName]; else console.warn(`[Load] Short Entry Param Input not found: shortEntry${finalIdSfx}`); } } document.getElementById('shortExitStrategy').value = settings.shortExitStrategy || 'cover_ma_cross'; updateStrategyParams('shortExit'); if(settings.shortExitParams) { for (const pName in settings.shortExitParams) { let idSfx = pName.charAt(0).toUpperCase() + pName.slice(1); let finalIdSfx = idSfx; const shortExitInternalKey = `cover_${settings.shortExitStrategy}`; if (shortExitInternalKey === 'cover_k_d_cross' && pName === 'thresholdX') finalIdSfx = 'CoverKdThresholdX'; else if (shortExitInternalKey === 'cover_macd_cross' && pName === 'signalPeriod') finalIdSfx = 'CoverSignalPeriod'; else if (shortExitInternalKey === 'cover_turtle_breakout' && pName === 'breakoutPeriod') finalIdSfx = 'CoverBreakoutPeriod'; else if (shortExitInternalKey === 'cover_trailing_stop' && pName === 'percentage') finalIdSfx = 'CoverTrailingStopPercentage'; const inputElement = document.getElementById(`shortExit${finalIdSfx}`); if (inputElement) inputElement.value = settings.shortExitParams[pName]; else console.warn(`[Load] Short Exit Param Input not found: shortExit${finalIdSfx}`); } } } else { document.getElementById('shortEntryStrategy').value = 'short_ma_cross'; updateStrategyParams('shortEntry'); document.getElementById('shortExitStrategy').value = 'cover_ma_cross'; updateStrategyParams('shortExit'); } showSuccess(`蝑 "${strategyName}" 撌脰??伐?`); 
    
    // 憿舐內蝣箄?撠店獢蒂?芸??瑁??葫
    if (confirm(`蝑?撌脰??亙???\n\n?臬蝡?瑁??葫隞交???亥”?橘?`)) {
        // ?芸??瑁??葫
        setTimeout(() => {
            runBacktestInternal();
        }, 100);
    }
    
    lastOverallResult = null; lastSubPeriodResults = null; } catch (error) { console.error(`頛蝑 "${strategyName}" ??隤?`, error); showError(`頛蝑憭望?: ${error.message}`); } }
function deleteStrategy() { const selectElement = document.getElementById('loadStrategySelect'); const strategyName = selectElement.value; if (!strategyName) { showInfo("隢?敺???桅???芷???乓?); return; } if (confirm(`蝣箏?閬?斤???"${strategyName}" ??甇斗?雿瘜儔?)) { if (deleteStrategyFromLocalStorage(strategyName)) { populateSavedStrategiesDropdown(); showSuccess(`蝑 "${strategyName}" 撌脣?歹?`); } } }
function randomizeSettings() { const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)]; const getRandomValue = (min, max, step) => { if (step === undefined || step === 0) step = 1; const range = max - min; if (range <= 0 && step > 0) return min; if (step <= 0) return min; const steps = Math.max(0, Math.floor(range / step)); const randomStep = Math.floor(Math.random() * (steps + 1)); let value = min + randomStep * step; if (step.toString().includes('.')) { const precision = step.toString().split('.')[1].length; value = parseFloat(value.toFixed(precision)); } return Math.max(min, Math.min(max, value)); }; const allKeys = Object.keys(strategyDescriptions); const entryKeys = allKeys.filter(k => !k.startsWith('short_') && !k.startsWith('cover_') && !k.endsWith('_exit') && k !== 'fixed_stop_loss'); const exitKeysRaw = allKeys.filter(k => (k.endsWith('_exit') || ['ma_below', 'rsi_overbought', 'bollinger_reversal', 'trailing_stop', 'price_breakdown', 'williams_overbought', 'turtle_stop_loss', 'fixed_stop_loss'].includes(k)) && !k.startsWith('short_') && !k.startsWith('cover_')); const exitKeys = exitKeysRaw.map(k => k.replace('_exit', '')).filter(k => k !== 'fixed_stop_loss'); const shortEntryKeys = allKeys.filter(k => k.startsWith('short_') && k !== 'short_fixed_stop_loss'); const coverKeys = allKeys.filter(k => k.startsWith('cover_') && k !== 'cover_fixed_stop_loss'); const setRandomParams = (type, strategyKey) => { let internalKey = strategyKey; if (type === 'exit' && ['ma_cross','macd_cross','k_d_cross','ema_cross'].includes(strategyKey)) internalKey = `${strategyKey}_exit`; else if (type === 'shortEntry') { if (!strategyDescriptions[internalKey] && ['ma_cross', 'ma_below', 'ema_cross', 'rsi_overbought', 'macd_cross', 'bollinger_reversal', 'k_d_cross', 'price_breakdown', 'williams_overbought', 'turtle_stop_loss'].includes(strategyKey)) internalKey = `short_${strategyKey}`; } else if (type === 'shortExit') { if (!strategyDescriptions[internalKey] && ['ma_cross', 'ma_above', 'ema_cross', 'rsi_oversold', 'macd_cross', 'bollinger_breakout', 'k_d_cross', 'price_breakout', 'williams_oversold', 'turtle_breakout', 'trailing_stop'].includes(strategyKey)) internalKey = `cover_${strategyKey}`; } const config = strategyDescriptions[internalKey]; if (!config || !config.defaultParams) return; let params = {}; for (const pName in config.defaultParams) { const target = config.optimizeTargets?.find(t => t.name === pName); let randomVal; if (target?.range) { randomVal = getRandomValue(target.range.from, target.range.to, target.range.step); } else { if (pName.includes('Period') || pName.includes('period')) randomVal = getRandomValue(5, 100, 1); else if (pName === 'threshold' && internalKey.includes('rsi')) randomVal = getRandomValue(10, 90, 1); else if (pName === 'threshold' && internalKey.includes('williams')) randomVal = getRandomValue(-90, -10, 1); else if (pName === 'thresholdX' || pName === 'thresholdY') randomVal = getRandomValue(10, 90, 1); else if (pName === 'deviations') randomVal = getRandomValue(1, 3, 0.1); else if (pName === 'multiplier') randomVal = getRandomValue(1.5, 5, 0.1); else if (pName === 'percentage') randomVal = getRandomValue(1, 25, 0.5); else randomVal = config.defaultParams[pName]; } params[pName] = randomVal; } if (['ma_cross', 'ema_cross', 'short_ma_cross', 'short_ema_cross', 'cover_ma_cross', 'cover_ema_cross'].some(prefix => internalKey.startsWith(prefix))) { if (params.shortPeriod && params.longPeriod && params.shortPeriod >= params.longPeriod) { params.shortPeriod = getRandomValue(3, Math.max(4, params.longPeriod - 1), 1); console.log(`[Random] Adjusted ${type} shortPeriod to ${params.shortPeriod} (long: ${params.longPeriod})`); } } for (const pName in params) { let idSfx = pName.charAt(0).toUpperCase() + pName.slice(1); if (internalKey === 'k_d_cross' && pName === 'thresholdX') idSfx = 'KdThresholdX'; else if (internalKey === 'k_d_cross_exit' && pName === 'thresholdY') idSfx = 'KdThresholdY'; else if (internalKey === 'turtle_stop_loss' && pName === 'stopLossPeriod') idSfx = 'StopLossPeriod'; else if ((internalKey === 'macd_cross' || internalKey === 'macd_cross_exit') && pName === 'signalPeriod') idSfx = 'SignalPeriod'; else if (internalKey === 'short_k_d_cross' && pName === 'thresholdY') idSfx = 'ShortKdThresholdY'; else if (internalKey === 'cover_k_d_cross' && pName === 'thresholdX') idSfx = 'CoverKdThresholdX'; else if (internalKey === 'short_macd_cross' && pName === 'signalPeriod') idSfx = 'ShortSignalPeriod'; else if (internalKey === 'cover_macd_cross' && pName === 'signalPeriod') idSfx = 'CoverSignalPeriod'; else if (internalKey === 'short_turtle_stop_loss' && pName === 'stopLossPeriod') idSfx = 'ShortStopLossPeriod'; else if (internalKey === 'cover_turtle_breakout' && pName === 'breakoutPeriod') idSfx = 'CoverBreakoutPeriod'; else if (internalKey === 'cover_trailing_stop' && pName === 'percentage') idSfx = 'CoverTrailingStopPercentage'; const inputId = `${type}${idSfx}`; const inputEl = document.getElementById(inputId); if (inputEl) { inputEl.value = params[pName]; } else { console.warn(`[Random] Input element not found for ${type} - ${pName}: #${inputId}`); } } }; const randomEntryKey = getRandomElement(entryKeys); const randomExitKey = getRandomElement(exitKeys); document.getElementById('entryStrategy').value = randomEntryKey; document.getElementById('exitStrategy').value = randomExitKey; updateStrategyParams('entry'); updateStrategyParams('exit'); setRandomParams('entry', randomEntryKey); setRandomParams('exit', randomExitKey); if (document.getElementById('enableShortSelling').checked) { const randomShortEntryKey = getRandomElement(shortEntryKeys); const randomCoverKey = getRandomElement(coverKeys); document.getElementById('shortEntryStrategy').value = randomShortEntryKey; document.getElementById('shortExitStrategy').value = randomCoverKey; updateStrategyParams('shortEntry'); updateStrategyParams('shortExit'); setRandomParams('shortEntry', randomShortEntryKey.replace('short_', '')); setRandomParams('shortExit', randomCoverKey.replace('cover_', '')); } showSuccess("蝑???詨歇?冽?閮剖?嚗?); }

// --- 撣???蟡其誨蝣潭?批???---

// ?典?霈
let currentMarket = 'TWSE'; // ?身?箔?撣?
let isAutoSwitching = false; // ?脫迫?⊿?????
// Patch Tag: LB-TW-NAMELOCK-20250616A
let manualMarketOverride = false; // 雿輻????摰??湔???芸?颲刻?
let manualOverrideCodeSnapshot = ''; // 蝝?孛?潮?摰??蟡其誨蝣?
let isFetchingName = false; // ?脫迫???亥岷?∠巨?迂
// Patch Tag: LB-US-NAMECACHE-20250622A
const stockNameLookupCache = new Map(); // Map<cacheKey, { info, cachedAt }>
const STOCK_NAME_CACHE_LIMIT = 4096;
const STOCK_NAME_CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12 撠?閮擃翰??
const LOCAL_STOCK_NAME_CACHE_KEY = 'LB_TW_NAME_CACHE_V20250620A';
const LOCAL_STOCK_NAME_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // ?啗?迂靽? 7 憭?
const LOCAL_US_NAME_CACHE_KEY = 'LB_US_NAME_CACHE_V20250622A';
const LOCAL_US_NAME_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 3; // 蝢?迂靽? 3 憭?
const TAIWAN_DIRECTORY_CACHE_KEY = 'LB_TW_DIRECTORY_CACHE_V20250620A';
const TAIWAN_DIRECTORY_CACHE_TTL_MS = 1000 * 60 * 60 * 24; // ?啗摰皜 24 撠???
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
    console.warn('[Taiwan Directory] ?砍皜??憭望?:', error);
});

// Patch Tag: LB-US-MARKET-20250612A
// Patch Tag: LB-NAME-CACHE-20250614A
const MARKET_META = {
    TWSE: { label: '銝?', fetchName: fetchStockNameFromTWSE },
    TPEX: { label: '銝?', fetchName: fetchStockNameFromTPEX },
    US: { label: '蝢', fetchName: fetchStockNameFromUS },
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
        console.warn('[Stock Name] ?⊥?頛?啗?迂敹怠?:', error);
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
        console.warn('[Stock Name] ?⊥?頛蝢?迂敹怠?:', error);
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
        console.warn('[Stock Name] ?⊥?撖怠?啗?迂敹怠?:', error);
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
        console.warn('[Stock Name] ?⊥?撖怠蝢?迂敹怠?:', error);
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
        console.warn('[Taiwan Directory] ?⊥?霈??唳??桀翰??', error);
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
        console.warn('[Taiwan Directory] ?⊥?撖怠?砍皜敹怠?:', error);
    }
}

function normaliseDirectoryEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;
    const stockId = (entry.stockId || entry.stock_id || '').toString().trim().toUpperCase();
    const name = (entry.name || entry.stock_name || '').toString().trim();
    if (!stockId || !name) return null;
    const market = entry.market ? normalizeMarketValue(entry.market) : null;
    const board = entry.board || (market === 'TWSE' ? '銝?' : market === 'TPEX' ? '銝?' : null);
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
    const sourceLabel = payload.source || '?啗摰皜';
    const versionLabel = payload.version ? `${sourceLabel}嚚?{payload.version}` : sourceLabel;

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
            throw new Error(payload?.message || '?啗摰皜???啣虜');
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
        console.warn('[Taiwan Directory] 頛憭望?:', error);
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
                    ? `${taiwanDirectoryState.source}${taiwanDirectoryState.version ? `嚚?{taiwanDirectoryState.version}` : ''}`
                    : '?啗摰皜',
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
    if (normalized === 'TPEX') return 'TPEX ?祇?鞈?';
    if (normalized === 'TWSE') return 'TWSE ?交?鈭方?閮?;
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
        suffixParts.push(`撌脣??${options.targetLabel}`);
    }
    if (options.fromCache) {
        suffixParts.push('敹怠?');
    }

    const main = `${info.name}${uniqueClassification.length > 0 ? `嚗?{uniqueClassification.join('??)}嚗 : ''}`;
    const suffix = suffixParts.length > 0 ? `嚗?{suffixParts.join('??)}嚗 : '';

    return {
        text: `${main}${suffix}`,
        sourceLabel: info.sourceLabel || '',
    };
}

function composeStockNameText(display, fallback = '') {
    if (!display) return fallback;
    return display.text || fallback;
}

// ?????游?????
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
        console.log(`[Market Switch] ???? ${currentMarket}`);
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
            showStockName('?啁???', 'success');
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

// ?脫??賣 - ?踹??餌? API 隢?
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
        console.warn('[Stock Name] ?亥岷??隤?', error);
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
        console.log('[Stock Name] 撌脫??脰?銝剔??亥岷嚗歲?甈∟?瘙?);
        return;
    }
    isFetchingName = true;

    console.log(`[Stock Name] ?亥岷?∠巨?迂: ${normalizedCode} (撣: ${currentMarket})`);

    try {
        showStockName('?亥岷銝?..', 'info');
        const allowAutoSwitch = !manualMarketOverride;
        const restrictToTaiwan = shouldRestrictToTaiwanMarkets(normalizedCode);
        if (restrictToTaiwan) {
            console.log(`[Stock Name] ${normalizedCode} ??蝣潛?詨?嚗?摰閰Ｖ?撣?銝?靘?`);
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
                console.log(`[Stock Name] 敹怠??賭葉 ${cacheHit.market} 嚚?${cachedISO}`);
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
        console.error('[Stock Name] ?亥岷?航炊:', error);
        showStockName('?亥岷憭望?', 'error');
    } finally {
        isFetchingName = false;
    }
}
// 敺?TWSE ???∠巨?迂
async function fetchStockNameFromTWSE(stockCode) {
    try {
        await ensureTaiwanDirectoryReady();
        const directoryEntry = getTaiwanDirectoryEntry(stockCode);
        if (directoryEntry) {
            return {
                name: directoryEntry.name,
                board: directoryEntry.board || '銝?',
                source: taiwanDirectoryState.source
                    ? `${taiwanDirectoryState.source}${taiwanDirectoryState.version ? `嚚?{taiwanDirectoryState.version}` : ''}`
                    : '?啗摰皜',
                instrumentType: directoryEntry.instrumentType,
                market: directoryEntry.market || 'TWSE',
                marketCategory: directoryEntry.marketCategory || null,
                matchStrategy: 'taiwan-directory',
                directoryVersion: taiwanDirectoryState.version || TAIWAN_DIRECTORY_VERSION,
                resolvedSymbol: directoryEntry.stockId,
            };
        }

        // 雿輻?嗆?蝚砌?憭拐??箸閰Ｘ??
        const now = new Date();
        const queryDate = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}01`;

        const url = `https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&stockNo=${stockCode}&date=${queryDate}&_=${Date.now()}`;
        const response = await fetch(url);
        
        if (!response.ok) return null;
        
        const data = await response.json();
        
        if (data.stat === 'OK' && data.title) {
            // 敺?title ???∠巨?迂嚗虜?澆??綽?"110撟?1??2330 ?啁?????漱鞈?"
            const match = data.title.match(/\d+撟廄d+?s+\d+\s+(.+?)\s+??漱鞈?/);
            if (match && match[1]) {
                const name = match[1].trim();
                return {
                    name,
                    board: '銝?',
                    source: 'TWSE ?交?鈭方?閮?,
                    instrumentType: isLikelyTaiwanETF(stockCode) ? 'ETF' : null,
                };
            }
        }

        return null;
    } catch (error) {
        console.error('[TWSE API] ?亥岷?∠巨?迂憭望?:', error);
        return null;
    }
}

// 敺?TPEX ???∠巨?迂 (雿輻隞??隡箸??刻圾瘙慢ORS??)
async function fetchStockNameFromTPEX(stockCode) {
    try {
        await ensureTaiwanDirectoryReady();
        const directoryEntry = getTaiwanDirectoryEntry(stockCode);
        if (directoryEntry) {
            return {
                name: directoryEntry.name,
                board: directoryEntry.board || '銝?',
                source: taiwanDirectoryState.source
                    ? `${taiwanDirectoryState.source}${taiwanDirectoryState.version ? `嚚?{taiwanDirectoryState.version}` : ''}`
                    : '?啗摰皜',
                instrumentType: directoryEntry.instrumentType,
                market: directoryEntry.market || 'TPEX',
                marketCategory: directoryEntry.marketCategory || null,
                matchStrategy: 'taiwan-directory',
                directoryVersion: taiwanDirectoryState.version || TAIWAN_DIRECTORY_VERSION,
                resolvedSymbol: directoryEntry.stockId,
            };
        }

        console.log(`[TPEX Name] ?亥岷?∠巨隞?Ⅳ: ${stockCode}`);

        // ?寞?1: 雿輻隞??隡箸???(憒??舐)
        const proxyResult = await fetchTPEXNameViaProxy(stockCode);
        if (proxyResult && !proxyResult.error && proxyResult.name) {
            return {
                name: proxyResult.name.trim(),
                board: '銝?',
                source: proxyResult.source || 'TPEX ?祇?鞈?隞??',
                instrumentType: isLikelyTaiwanETF(stockCode) ? 'ETF' : null,
            };
        }

        // ?寞?2: 雿輻JSONP?孵??岫?PI
        const jsonpResult = await fetchTPEXNameViaJSONP(stockCode);
        if (jsonpResult) {
            return {
                name: typeof jsonpResult === 'string' ? jsonpResult.trim() : String(jsonpResult),
                board: '銝?',
                source: 'TPEX JSONP',
                instrumentType: isLikelyTaiwanETF(stockCode) ? 'ETF' : null,
            };
        }

        console.warn(`[TPEX Name] ?⊥????∠巨隞?Ⅳ ${stockCode} ??蝔常);
        return null;

    } catch (error) {
        console.error(`[TPEX Name] ?亥岷?∠巨?迂憭望?:`, error);
        return null;
    }
}

async function fetchStockNameFromUS(stockCode) {
    try {
        const url = `/api/us/?mode=info&stockNo=${encodeURIComponent(stockCode)}`;
        const response = await fetch(url);
        if (!response.ok) {
            console.warn(`[US Name] API ???Ⅳ ${response.status}`);
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
        console.error('[US Name] ?亥岷?∠巨?迂憭望?:', error);
        return null;
    }
}

// 雿輻隞??隡箸??函?PEX?∠巨?迂
async function fetchTPEXNameViaProxy(stockNo) {
    // **?靽格迤嚗蝙?其??摰??撘??渡?甇瑕?交?**
    const placeholderDate = '113/01/01'; 

    const url = `/.netlify/functions/tpex-proxy?stockNo=${stockNo}&date=${placeholderDate}`;
    
    console.log(`[TPEX Proxy Name] Fetching name for ${stockNo} via proxy: ${url}`);
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`[TPEX Proxy Name] 隞??? HTTP ${response.status}`);
            return { error: `HTTP status ${response.status}` };
        }
        const data = await response.json();

        if (data.error) {
            console.warn('[TPEX Proxy Name] 隞????航炊璅?', data);
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
        console.error('[TPEX Proxy Name] ?澆隞????隤?', error);
        return { error: error.message };
    }
}

// 雿輻JSONP?孵??岫?脣?TPEX?∠巨?迂
function fetchTPEXNameViaJSONP(stockCode) {
    return new Promise((resolve) => {
        try {
            // ?岫雿輻?舀JSONP??API蝡舫?
            const now = new Date();
            const rocYear = now.getFullYear() - 1911;
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const queryDate = `${rocYear}/${month}`;
            
            const callbackName = `tpexCallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const script = document.createElement('script');
            
            // 閮剔蔭頞?
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
                    console.warn(`[TPEX JSONP] 閫???航炊:`, e);
                    resolve(null);
                }
            };
            
            // ?岫JSONP?澆??RL
            script.src = `https://www.tpex.org.tw/web/stock/aftertrading/daily_trading_info/st43_result.php?l=zh-tw&d=${queryDate}&stkno=${stockCode}&callback=${callbackName}`;
            script.onerror = () => {
                cleanup();
                resolve(null);
            };
            
            document.head.appendChild(script);
            
        } catch (error) {
            console.warn(`[TPEX JSONP] 閮剔蔭?航炊:`, error);
            resolve(null);
        }
    });
}

// 憿舐內撣??撱箄降
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
                        ${currentMarketLabel}撣?亦??{stockCode}??
                    </span>
                </div>
                <button
                    id="switchMarketBtn"
                    class="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    onclick="switchToMarket('${targetMarket}', '${stockCode}')"
                >
                    ????{targetLabel}
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
                    ${currentMarketLabel}??瑹?蝢撣??曉??{stockCode}??
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

    console.log(`[Market Switch] ????${normalizedMarket} ?亥岷 ${normalizedCode}`);

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
        showStockName('?亥岷銝?..', 'info');
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
                showSuccess(`撌脣??${targetLabel}撣銝行?? ${info.name}`);
            }
            return info;
        }

        showStockName(`?嗅?撣?亦??{normalizedCode}?, 'error');
        return null;
    } catch (error) {
        console.error('[Market Switch] ?亥岷?航炊:', error);
        showStockName('?亥岷憭望?', 'error');
        return null;
    } finally {
        isAutoSwitching = false;
    }
}
// 憿舐內?∠巨?迂
function showStockName(name, type = 'success') {
    const stockNameDisplay = document.getElementById('stockNameDisplay');
    if (!stockNameDisplay) return;

    stockNameDisplay.style.display = 'block';
    const safeText = escapeHtml(typeof name === 'string' ? name : String(name ?? ''));
    stockNameDisplay.innerHTML = `<span class="stock-name-text">${safeText}</span>`;
    
    // ?脣??折??摮?蝝?閮剖?憿
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

// ?梯??∠巨?迂
function hideStockName() {
    const stockNameDisplay = document.getElementById('stockNameDisplay');
    if (stockNameDisplay) {
        stockNameDisplay.style.display = 'none';
        stockNameDisplay.innerHTML = '';
    }
}

// --- ?典??賣 ---
// 撠?switchToMarket ?賣瘛餃??啣撅蝭?嚗? HTML onclick 隤輻
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

// --- ????---
// ??DOM 頛摰?敺?憪?撣???
document.addEventListener('DOMContentLoaded', function() {
    // 撱園銝暺?憪?嚗Ⅱ靽隞?憪?摰?
    setTimeout(() => {
        initializeMarketSwitch();
        console.log('[Market Switch] 撣???撌脣?憪?');
    }, 100);
});




