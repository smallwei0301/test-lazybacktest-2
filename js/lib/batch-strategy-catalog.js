// Patch Tag: LB-BATCH-CATALOG-20260918A
(function(global) {
    const DEFAULT_ENTRY_STRATEGIES = Object.freeze([
        'ma_cross',
        'ma_above',
        'rsi_oversold',
        'macd_cross',
        'bollinger_breakout',
        'k_d_cross',
        'volume_spike',
        'price_breakout',
        'williams_oversold',
        'ema_cross',
        'turtle_breakout',
    ]);

    const DEFAULT_EXIT_STRATEGIES = Object.freeze([
        'ma_cross_exit',
        'ma_below',
        'rsi_overbought',
        'macd_cross_exit',
        'bollinger_reversal',
        'k_d_cross_exit',
        'volume_spike',
        'price_breakdown',
        'williams_overbought',
        'ema_cross_exit',
        'turtle_stop_loss',
        'trailing_stop',
        'fixed_stop_loss',
    ]);

    function toArray(value) {
        return Array.isArray(value) ? value.slice() : [];
    }

    function hydrateBatchStrategyCatalog(descriptions = {}, options = {}) {
        const entrySource = options.entry ? toArray(options.entry) : DEFAULT_ENTRY_STRATEGIES;
        const exitSource = options.exit ? toArray(options.exit) : DEFAULT_EXIT_STRATEGIES;
        const includeMissing = options.includeMissing !== false;

        const buildList = (source) => {
            const available = [];
            const missing = [];
            source.forEach((id) => {
                if (descriptions && descriptions[id]) {
                    available.push(id);
                } else {
                    missing.push(id);
                }
            });
            return { available, missing };
        };

        const entryLists = buildList(entrySource);
        const exitLists = buildList(exitSource);

        const result = {
            entry: entryLists.available,
            exit: exitLists.available,
        };

        if (includeMissing) {
            result.missing = {
                entry: entryLists.missing,
                exit: exitLists.missing,
            };
        }

        return result;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            hydrateBatchStrategyCatalog,
            DEFAULT_ENTRY_STRATEGIES: toArray(DEFAULT_ENTRY_STRATEGIES),
            DEFAULT_EXIT_STRATEGIES: toArray(DEFAULT_EXIT_STRATEGIES),
        };
    }

    if (global && typeof global === 'object') {
        const catalogApi = {
            defaults: {
                entry: toArray(DEFAULT_ENTRY_STRATEGIES),
                exit: toArray(DEFAULT_EXIT_STRATEGIES),
            },
            hydrate(options = {}) {
                const descriptions = options.descriptions
                    || (typeof global.strategyDescriptions === 'object' ? global.strategyDescriptions : {});
                return hydrateBatchStrategyCatalog(descriptions, options);
            }
        };

        if (!global.LazyBatchStrategyCatalog) {
            global.LazyBatchStrategyCatalog = catalogApi;
        } else {
            global.LazyBatchStrategyCatalog.defaults = catalogApi.defaults;
            global.LazyBatchStrategyCatalog.hydrate = catalogApi.hydrate;
        }
    }
})(typeof window !== 'undefined' ? window : globalThis);
