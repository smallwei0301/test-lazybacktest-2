const assert = require('assert');
const helpers = require('../js/worker-dataset-helpers.js');

function stubBuildCacheKey(cur) {
    if (!cur) return '';
    const market = (cur.market || 'TWSE').toUpperCase();
    const stockNo = (cur.stockNo || '').toString().toUpperCase();
    const priceMode = (cur.priceMode || 'raw').toLowerCase() === 'adjusted' ? 'ADJ' : 'RAW';
    const split = cur.splitAdjustment ? 'SPLIT' : 'NOSPLIT';
    const dataStart = cur.dataStartDate || cur.startDate || 'NA';
    const effective = cur.effectiveStartDate || cur.startDate || 'NA';
    const lookback = Number.isFinite(cur.lookbackDays) ? `LB${Math.round(cur.lookbackDays)}` : 'LB-';
    return `${market}|${stockNo}|${priceMode}|${split}|${dataStart}|${effective}|${lookback}`;
}

function makeNeedsDataFetch(coverageMap) {
    return (cur) => {
        if (!cur || !cur.stockNo || !cur.endDate) return true;
        const key = stubBuildCacheKey(cur);
        const coverage = coverageMap.get(key);
        if (!coverage) return true;
        const startISO = cur.dataStartDate || cur.startDate;
        const endISO = cur.endDate;
        if (!startISO || !endISO) return true;
        const startMs = Date.parse(`${startISO}T00:00:00Z`);
        const endMs = Date.parse(`${endISO}T00:00:00Z`);
        return coverage.startMs > startMs || coverage.endMs < endMs;
    };
}

function isoRange(start, end) {
    return {
        start,
        end,
        startMs: Date.parse(`${start}T00:00:00Z`),
        endMs: Date.parse(`${end}T00:00:00Z`),
    };
}

(function runTests() {
    const coverageMap = new Map();
    const cacheStore = new Map();
    const range = isoRange('2023-09-01', '2024-06-30');
    const settings = {
        stockNo: '2330',
        startDate: '2024-01-01',
        dataStartDate: '2023-09-01',
        effectiveStartDate: '2024-01-01',
        endDate: '2024-06-30',
        market: 'TWSE',
        priceMode: 'adjusted',
        adjustedPrice: true,
        splitAdjustment: true,
        lookbackDays: 120,
    };
    const cacheKey = stubBuildCacheKey(settings);
    const cacheEntry = {
        data: [
            { date: '2023-09-01', close: 520 },
            { date: '2024-06-28', close: 600 },
        ],
        coverage: [{ start: range.start, end: range.end }],
        summary: { priceSource: 'proxy' },
        adjustments: [],
        debugSteps: [],
        adjustmentFallbackApplied: false,
        priceSource: 'proxy',
        dataSource: 'finmind',
        splitAdjustment: true,
    };

    cacheStore.set(cacheKey, cacheEntry);
    coverageMap.set(cacheKey, range);

    const context = {
        needsDataFetch: makeNeedsDataFetch(coverageMap),
        buildCacheKey: stubBuildCacheKey,
        ensureDatasetCacheEntryFresh: (_, entry) => entry,
        evaluateCacheStartGap: () => ({ shouldForce: false }),
        cachedDataStore: cacheStore,
        lastFetchSettings: { ...settings, coverage: cacheEntry.coverage },
        cachedStockData: cacheEntry.data,
    };

    const payload = helpers.resolveWorkerCachePayload(settings, { context, includeMeta: true });
    assert.strictEqual(payload.useCachedData, true, '應命中快取');
    assert.strictEqual(payload.cachedData, cacheEntry.data, '應回傳快取資料陣列');
    assert(payload.cachedMeta && payload.cachedMeta.priceSource === 'proxy', '應帶入快取摘要');

    const extendedSettings = { ...settings, startDate: '2023-06-01', dataStartDate: '2023-06-01', effectiveStartDate: '2023-06-01' };
    const payloadAfterRangeChange = helpers.resolveWorkerCachePayload(extendedSettings, { context, includeMeta: false });
    assert.strictEqual(payloadAfterRangeChange.useCachedData, false, '資料需求超出範圍時應停用快取');

    const gapContext = { ...context, evaluateCacheStartGap: () => ({ shouldForce: true }) };
    const payloadGap = helpers.resolveWorkerCachePayload(settings, { context: gapContext });
    assert.strictEqual(payloadGap.useCachedData, false, '首筆落後時應強制重新抓取');

    console.log('worker-dataset-helpers tests passed');
})();
