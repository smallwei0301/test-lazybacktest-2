const assert = require('assert');

const { resolveWorkerDatasetCache } = require('../js/cache-helpers.js');

global.cachedDataStore = new Map();

global.normalizeMarketValue = (market) => (market || '').toString().toUpperCase();
global.ensureDatasetCacheEntryFresh = (key, entry) => entry;

global.buildCacheKey = function buildCacheKey(cur) {
    if (!cur) return '';
    const market = (cur.market || '').toUpperCase();
    const stockNo = (cur.stockNo || '').toString().toUpperCase();
    const priceMode = (cur.priceMode || 'raw').toLowerCase();
    const splitFlag = cur.splitAdjustment ? 'S' : 'N';
    const dataStart = cur.dataStartDate || cur.startDate || 'NA';
    const effectiveStart = cur.effectiveStartDate || cur.startDate || 'NA';
    const endDate = cur.endDate || 'NA';
    return [market, stockNo, priceMode, splitFlag, dataStart, effectiveStart, endDate].join('|');
};

global.coverageCoversRange = function coverageCoversRange(coverage, target) {
    if (!Array.isArray(coverage) || !target) return false;
    const toTime = (iso) => {
        const parsed = Date.parse(`${iso}T00:00:00Z`);
        return Number.isFinite(parsed) ? parsed : NaN;
    };
    const targetStart = toTime(target.start);
    const targetEnd = toTime(target.end);
    if (!Number.isFinite(targetStart) || !Number.isFinite(targetEnd) || targetEnd < targetStart) {
        return false;
    }
    return coverage.some((segment) => {
        const start = toTime(segment.start);
        const end = toTime(segment.end);
        return Number.isFinite(start)
            && Number.isFinite(end)
            && start <= targetStart
            && end >= targetEnd;
    });
};

global.computeCoverageFromRows = function computeCoverageFromRows(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return [];
    const sorted = rows.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    return [{ start: sorted[0].date, end: sorted[sorted.length - 1].date }];
};

global.needsDataFetch = function needsDataFetch(cur) {
    const key = global.buildCacheKey(cur);
    const entry = global.cachedDataStore.get(key);
    if (!entry || !Array.isArray(entry.coverage) || entry.coverage.length === 0) {
        return true;
    }
    const rangeStart = cur.dataStartDate || cur.startDate;
    return !global.coverageCoversRange(entry.coverage, { start: rangeStart, end: cur.endDate });
};

global.buildCachedMetaFromEntry = function buildCachedMetaFromEntry(entry) {
    if (!entry) return null;
    return { summary: entry.summary || null };
};

const dataset = [
    { date: '2024-01-02', close: 500 },
    { date: '2024-12-30', close: 650 },
];

const cacheKey = global.buildCacheKey({
    stockNo: '2330',
    startDate: '2024-01-02',
    endDate: '2024-12-30',
    dataStartDate: '2024-01-02',
    effectiveStartDate: '2024-03-01',
    market: 'TWSE',
    priceMode: 'adjusted',
    splitAdjustment: true,
});

global.cachedDataStore.set(cacheKey, {
    data: dataset,
    coverage: [{ start: '2024-01-02', end: '2024-12-30' }],
    summary: { dataSource: 'test' },
});

global.cachedStockData = dataset;
global.lastFetchSettings = {
    stockNo: '2330',
    startDate: '2024-01-02',
    endDate: '2024-12-30',
    dataStartDate: '2024-01-02',
    effectiveStartDate: '2024-03-01',
    market: 'TWSE',
    priceMode: 'adjusted',
    splitAdjustment: true,
};

const decision1 = resolveWorkerDatasetCache({
    stockNo: '2330',
    startDate: '2024-03-01',
    endDate: '2024-12-30',
    dataStartDate: '2024-01-02',
    effectiveStartDate: '2024-03-01',
    market: 'TWSE',
    priceMode: 'adjusted',
    adjustedPrice: true,
    splitAdjustment: true,
});

assert.strictEqual(decision1.useCachedData, true, 'expected cache usage for overlapping range');
assert.strictEqual(decision1.cachedData, dataset, 'should reuse cached dataset reference');
assert.strictEqual(decision1.source, 'store');

const decision2 = resolveWorkerDatasetCache({
    stockNo: '2330',
    startDate: '2023-03-01',
    endDate: '2024-12-30',
    dataStartDate: '2023-01-02',
    effectiveStartDate: '2023-03-01',
    market: 'TWSE',
    priceMode: 'adjusted',
    adjustedPrice: true,
    splitAdjustment: true,
});

assert.strictEqual(decision2.useCachedData, false, 'should not reuse cache when range extends earlier');
assert.strictEqual(decision2.needsFetch, true, 'should require fresh fetch for extended range');

// Remove store entry to simulate memory-only reuse scenario.
global.cachedDataStore.clear();

const decision3 = resolveWorkerDatasetCache({
    stockNo: '2330',
    startDate: '2024-03-01',
    endDate: '2024-12-30',
    dataStartDate: '2024-01-02',
    effectiveStartDate: '2024-03-01',
    market: 'TWSE',
    priceMode: 'adjusted',
    adjustedPrice: true,
    splitAdjustment: true,
});

assert.strictEqual(decision3.useCachedData, true, 'should fall back to last fetched in-memory data');
assert.strictEqual(decision3.cachedData, dataset, 'memory fallback should reuse dataset reference');
assert.strictEqual(decision3.source, 'memory');

console.log('resolveWorkerDatasetCache tests passed.');
