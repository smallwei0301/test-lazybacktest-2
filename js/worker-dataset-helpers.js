// Worker dataset cache helpers - ensures batch與主回測共用相同檢查流程
// Patch Tag: LB-WORKER-DATASET-20260715A

(function(global) {
    const root = typeof global !== 'undefined' ? global : (typeof window !== 'undefined' ? window : {});

    function normalisePriceMode(value, adjustedFlag) {
        if (typeof value === 'string' && value.trim()) {
            return value.trim().toLowerCase();
        }
        return adjustedFlag ? 'adjusted' : 'raw';
    }

    function buildWorkerDatasetSettings(params = {}, overrides = {}) {
        const base = params || {};
        const startDate = overrides.startDate || base.startDate || null;
        const dataStartDate = overrides.dataStartDate || base.dataStartDate || startDate;
        const effectiveStartDate = overrides.effectiveStartDate || base.effectiveStartDate || startDate || dataStartDate;
        const endDate = overrides.endDate || base.endDate || null;
        const marketSource = overrides.market || base.marketType || base.market || (root.currentMarket || 'TWSE');
        const market = typeof marketSource === 'string' ? marketSource.toUpperCase() : 'TWSE';
        const priceMode = normalisePriceMode(overrides.priceMode || base.priceMode, overrides.adjustedPrice ?? base.adjustedPrice);

        return {
            stockNo: overrides.stockNo || base.stockNo || '',
            startDate,
            endDate,
            dataStartDate,
            effectiveStartDate,
            market,
            marketType: market,
            adjustedPrice: Boolean(overrides.adjustedPrice ?? base.adjustedPrice),
            splitAdjustment: Boolean(overrides.splitAdjustment ?? base.splitAdjustment),
            priceMode,
            lookbackDays: Number.isFinite(overrides.lookbackDays) ? overrides.lookbackDays : base.lookbackDays,
        };
    }

    function resolveWorkerCachePayload(settings = {}, options = {}) {
        const result = {
            useCachedData: false,
            cachedData: null,
            cachedMeta: null,
            cacheEntry: null,
            cacheKey: null,
            settings,
        };

        const overrideData = Array.isArray(options.overrideData) && options.overrideData.length > 0
            ? options.overrideData
            : null;
        if (overrideData) {
            result.useCachedData = true;
            result.cachedData = overrideData;
            return result;
        }

        if (!settings || !settings.stockNo || !settings.endDate) {
            return result;
        }

        const context = options.context || root;
        const needsDataFetchFn = typeof options.needsDataFetch === 'function'
            ? options.needsDataFetch
            : typeof context.needsDataFetch === 'function'
                ? context.needsDataFetch
                : null;
        const buildCacheKeyFn = typeof options.buildCacheKey === 'function'
            ? options.buildCacheKey
            : typeof context.buildCacheKey === 'function'
                ? context.buildCacheKey
                : null;
        const ensureFreshFn = typeof options.ensureDatasetCacheEntryFresh === 'function'
            ? options.ensureDatasetCacheEntryFresh
            : typeof context.ensureDatasetCacheEntryFresh === 'function'
                ? context.ensureDatasetCacheEntryFresh
                : null;
        const evaluateGapFn = typeof options.evaluateCacheStartGap === 'function'
            ? options.evaluateCacheStartGap
            : typeof context.evaluateCacheStartGap === 'function'
                ? context.evaluateCacheStartGap
                : null;
        const cachedDataStoreRef = options.cachedDataStore || context.cachedDataStore;
        const lastFetchSettingsRef = options.lastFetchSettings !== undefined
            ? options.lastFetchSettings
            : context.lastFetchSettings;
        const cachedStockDataRef = options.cachedStockData !== undefined
            ? options.cachedStockData
            : context.cachedStockData;

        const normalizedSettings = { ...settings };
        normalizedSettings.market = typeof settings.market === 'string' ? settings.market.toUpperCase() : 'TWSE';
        normalizedSettings.marketType = normalizedSettings.market;
        normalizedSettings.priceMode = normalisePriceMode(settings.priceMode, settings.adjustedPrice);
        if (!normalizedSettings.dataStartDate) {
            normalizedSettings.dataStartDate = normalizedSettings.startDate || normalizedSettings.effectiveStartDate || null;
        }
        if (!normalizedSettings.startDate) {
            normalizedSettings.startDate = normalizedSettings.dataStartDate || normalizedSettings.effectiveStartDate;
        }
        if (!normalizedSettings.effectiveStartDate) {
            normalizedSettings.effectiveStartDate = normalizedSettings.startDate;
        }

        let canUseCache = false;
        if (needsDataFetchFn) {
            try {
                canUseCache = !needsDataFetchFn({ ...normalizedSettings });
            } catch (error) {
                console.warn('[WorkerDatasetHelpers] needsDataFetch 檢查失敗，改用快取 key 比對。', error);
            }
        }
        if (!canUseCache && buildCacheKeyFn && lastFetchSettingsRef) {
            try {
                const currentKey = buildCacheKeyFn(normalizedSettings);
                const lastKey = buildCacheKeyFn(lastFetchSettingsRef);
                canUseCache = Boolean(currentKey && lastKey && currentKey === lastKey);
            } catch (error) {
                console.warn('[WorkerDatasetHelpers] buildCacheKey 比對失敗。', error);
            }
        }

        if (!canUseCache) {
            return result;
        }

        const cacheKey = buildCacheKeyFn ? buildCacheKeyFn(normalizedSettings) : null;
        let cacheEntry = null;
        if (cacheKey && cachedDataStoreRef && typeof cachedDataStoreRef.get === 'function') {
            const rawEntry = cachedDataStoreRef.get(cacheKey);
            cacheEntry = ensureFreshFn ? ensureFreshFn(cacheKey, rawEntry, normalizedSettings.market) : rawEntry;
        }

        if ((!cacheEntry || !Array.isArray(cacheEntry.data)) && cacheKey && buildCacheKeyFn && lastFetchSettingsRef) {
            try {
                const lastKey = buildCacheKeyFn(lastFetchSettingsRef);
                if (lastKey && cacheKey === lastKey && Array.isArray(cachedStockDataRef) && cachedStockDataRef.length > 0) {
                    cacheEntry = {
                        data: cachedStockDataRef,
                        summary: lastFetchSettingsRef.summary || null,
                        adjustments: Array.isArray(lastFetchSettingsRef.adjustments) ? lastFetchSettingsRef.adjustments : [],
                        debugSteps: Array.isArray(lastFetchSettingsRef.debugSteps) ? lastFetchSettingsRef.debugSteps : [],
                        adjustmentFallbackApplied: Boolean(lastFetchSettingsRef.adjustmentFallbackApplied),
                        priceSource: lastFetchSettingsRef.priceSource || null,
                        dataSource: lastFetchSettingsRef.dataSource || null,
                        splitAdjustment: Boolean(lastFetchSettingsRef.splitAdjustment),
                        splitDiagnostics: lastFetchSettingsRef.splitDiagnostics || null,
                        finmindStatus: lastFetchSettingsRef.finmindStatus || null,
                        coverage: Array.isArray(lastFetchSettingsRef.coverage) ? lastFetchSettingsRef.coverage : null,
                    };
                }
            } catch (error) {
                console.warn('[WorkerDatasetHelpers] 無法重建記憶體快取資料。', error);
            }
        }

        if (!cacheEntry || !Array.isArray(cacheEntry.data)) {
            return result;
        }

        if (evaluateGapFn && (normalizedSettings.effectiveStartDate || normalizedSettings.startDate)) {
            try {
                const gapCheck = evaluateGapFn(cacheKey, cacheEntry, normalizedSettings.effectiveStartDate || normalizedSettings.startDate);
                if (gapCheck && gapCheck.shouldForce) {
                    return result;
                }
            } catch (error) {
                console.warn('[WorkerDatasetHelpers] evaluateCacheStartGap 檢查失敗，允許 Worker 重新抓取。', error);
                return result;
            }
        }

        result.useCachedData = true;
        result.cachedData = cacheEntry.data;
        result.cacheEntry = cacheEntry;
        result.cacheKey = cacheKey;
        if (options.includeMeta !== false) {
            result.cachedMeta = {
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
        result.settings = normalizedSettings;
        return result;
    }

    const helpers = {
        buildWorkerDatasetSettings,
        resolveWorkerCachePayload,
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = helpers;
    } else {
        root.workerDatasetHelpers = helpers;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
