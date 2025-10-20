(function (root, factory) {
    const exports = factory(root);
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = exports;
    }
})(typeof globalThis !== 'undefined' ? globalThis : window, function (root) {
    function resolveWorkerDatasetCache(params, options = {}) {
        const emptyResult = {
            useCachedData: false,
            cachedData: null,
            cachedMeta: null,
            cacheEntry: null,
            cacheKey: '',
            curSettings: null,
            needsFetch: true,
            source: null,
        };

        if (!params || typeof params !== 'object') {
            return { ...emptyResult };
        }

        const getGlobal = (name) => {
            if (Object.prototype.hasOwnProperty.call(options, name) && options[name] !== undefined) {
                return options[name];
            }
            return root ? root[name] : undefined;
        };

        const currentMarket = getGlobal('currentMarket') || 'TWSE';
        const market = (getGlobal('market') || params.market || params.marketType || currentMarket || 'TWSE').toString().toUpperCase();
        const dataStartDate = options.dataStartDate || params.dataStartDate || params.startDate || params.effectiveStartDate || null;
        const effectiveStartDate = options.effectiveStartDate || params.effectiveStartDate || params.startDate || dataStartDate;
        const endDate = options.endDate || params.endDate || null;
        const lookbackDays = Number.isFinite(options.lookbackDays)
            ? options.lookbackDays
            : (Number.isFinite(params.lookbackDays) ? params.lookbackDays : undefined);

        const curSettings = {
            stockNo: options.stockNo || params.stockNo,
            startDate: dataStartDate || params.startDate || null,
            endDate,
            dataStartDate: dataStartDate || null,
            effectiveStartDate: effectiveStartDate || null,
            market,
            marketType: market,
            adjustedPrice: Boolean(options.adjustedPrice ?? params.adjustedPrice),
            priceMode: (options.priceMode || params.priceMode || ((options.adjustedPrice ?? params.adjustedPrice) ? 'adjusted' : 'raw') || 'raw').toString().toLowerCase(),
            splitAdjustment: Boolean(options.splitAdjustment ?? params.splitAdjustment),
            lookbackDays,
        };

        const buildCacheKeyFn = typeof getGlobal('buildCacheKey') === 'function' ? getGlobal('buildCacheKey') : null;
        const cacheKey = buildCacheKeyFn ? buildCacheKeyFn(curSettings) : '';
        const normalizeMarketKeyForCache = typeof getGlobal('normalizeMarketKeyForCache') === 'function'
            ? getGlobal('normalizeMarketKeyForCache')
            : null;
        const normalizeMarketValue = typeof getGlobal('normalizeMarketValue') === 'function' ? getGlobal('normalizeMarketValue') : null;
        const normalizedMarketKey = normalizeMarketKeyForCache
            ? normalizeMarketKeyForCache(market)
            : (normalizeMarketValue ? normalizeMarketValue(market) : market);
        const needsDataFetchFn = typeof getGlobal('needsDataFetch') === 'function' ? getGlobal('needsDataFetch') : null;
        const ensureDatasetCacheEntryFresh = typeof getGlobal('ensureDatasetCacheEntryFresh') === 'function'
            ? getGlobal('ensureDatasetCacheEntryFresh')
            : null;
        const coverageCoversRangeFn = typeof getGlobal('coverageCoversRange') === 'function'
            ? getGlobal('coverageCoversRange')
            : null;
        const computeCoverageFromRows = typeof getGlobal('computeCoverageFromRows') === 'function'
            ? getGlobal('computeCoverageFromRows')
            : null;
        const buildCachedMetaFromEntry = typeof getGlobal('buildCachedMetaFromEntry') === 'function'
            ? getGlobal('buildCachedMetaFromEntry')
            : null;

        const overrideData = Array.isArray(options.cachedDataOverride) && options.cachedDataOverride.length > 0
            ? options.cachedDataOverride
            : null;
        const overrideMeta = options.cachedMetaOverride || null;

        let useCachedData = false;
        let cachedData = null;
        let cachedMeta = null;
        let cacheEntry = null;
        let needsFetch = true;
        let source = null;

        if (overrideData) {
            cachedData = overrideData;
            cachedMeta = overrideMeta;
            useCachedData = true;
            needsFetch = false;
            source = 'override';
        } else {
            if (needsDataFetchFn) {
                needsFetch = needsDataFetchFn({ ...curSettings });
            }

            if (!needsFetch) {
                const cachedDataStore = getGlobal('cachedDataStore');
                if (cachedDataStore && typeof cachedDataStore.get === 'function' && cacheKey) {
                    const existingEntry = cachedDataStore.get(cacheKey);
                    cacheEntry = ensureDatasetCacheEntryFresh
                        ? ensureDatasetCacheEntryFresh(cacheKey, existingEntry, normalizedMarketKey)
                        : existingEntry;
                }

                if (cacheEntry && Array.isArray(cacheEntry.data) && cacheEntry.data.length > 0) {
                    cachedData = cacheEntry.data;
                    useCachedData = true;
                    needsFetch = false;
                    source = 'store';
                }
            }
        }

        if (!useCachedData && !overrideData) {
            const cachedStockData = getGlobal('cachedStockData');
            const lastFetchSettings = getGlobal('lastFetchSettings');
            if (
                Array.isArray(cachedStockData) && cachedStockData.length > 0
                && lastFetchSettings && buildCacheKeyFn && cacheKey
            ) {
                const normalizedLastStart = lastFetchSettings.dataStartDate
                    || lastFetchSettings.startDate
                    || lastFetchSettings.effectiveStartDate
                    || lastFetchSettings.startDate;
                const lastKey = buildCacheKeyFn({
                    ...lastFetchSettings,
                    startDate: normalizedLastStart,
                    dataStartDate: normalizedLastStart,
                });
                if (lastKey === cacheKey) {
                    cachedData = cachedStockData;
                    useCachedData = true;
                    needsFetch = false;
                    source = 'memory';
                }
            }
        }

        const requiredRange = curSettings.startDate && curSettings.endDate
            ? { start: curSettings.startDate, end: curSettings.endDate }
            : null;

        if (useCachedData && coverageCoversRangeFn && requiredRange) {
            let coverage = cacheEntry && Array.isArray(cacheEntry.coverage) ? cacheEntry.coverage : null;
            if (!coverage && computeCoverageFromRows && Array.isArray(cachedData)) {
                coverage = computeCoverageFromRows(cachedData);
            }
            if (!coverage || !coverageCoversRangeFn(coverage, requiredRange)) {
                useCachedData = false;
                cachedData = null;
                cachedMeta = null;
                cacheEntry = null;
                source = null;
                needsFetch = true;
            }
        }

        if (useCachedData) {
            if (source === 'store' && cacheEntry && buildCachedMetaFromEntry) {
                cachedMeta = buildCachedMetaFromEntry(cacheEntry, effectiveStartDate, lookbackDays);
            } else if (!cachedMeta && overrideMeta) {
                cachedMeta = overrideMeta;
            }
        } else {
            cachedMeta = null;
        }

        const result = {
            useCachedData,
            cachedData: useCachedData ? cachedData : null,
            cachedMeta: useCachedData ? cachedMeta : null,
            cacheEntry: useCachedData ? cacheEntry : null,
            cacheKey,
            curSettings,
            needsFetch,
            source,
        };

        return result;
    }

    root.resolveWorkerDatasetCache = resolveWorkerDatasetCache;

    return { resolveWorkerDatasetCache };
});
