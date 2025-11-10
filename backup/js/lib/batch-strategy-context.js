// Patch Tag: LB-BATCH-DEATHCROSS-20260916C
(function(global) {
    function cloneParams(source) {
        if (!source || typeof source !== 'object') {
            return {};
        }
        return JSON.parse(JSON.stringify(source));
    }

    function isFiniteNumber(value) {
        return typeof value === 'number' && Number.isFinite(value);
    }

    function deriveRiskManagement(params, options) {
        if (!options || options.includeRisk !== true) {
            return null;
        }
        if (!params || typeof params !== 'object') {
            return null;
        }
        const stopLoss = params.stopLoss;
        const takeProfit = params.takeProfit;
        if (!isFiniteNumber(stopLoss) && !isFiniteNumber(takeProfit)) {
            return null;
        }
        const risk = {};
        if (isFiniteNumber(stopLoss)) {
            risk.stopLoss = stopLoss;
        }
        if (isFiniteNumber(takeProfit)) {
            risk.takeProfit = takeProfit;
        }
        return Object.keys(risk).length > 0 ? risk : null;
    }

    function deriveBaseComboFromParams(params, options = {}) {
        if (!params || typeof params !== 'object') {
            return null;
        }
        const combo = {
            buyStrategy: params.entryStrategy || params.buyStrategy || null,
            sellStrategy: params.exitStrategy || params.sellStrategy || null,
            buyParams: cloneParams(params.entryParams),
            sellParams: cloneParams(params.exitParams)
        };

        if (options.includeShort === true) {
            combo.shortEntryStrategy = params.shortEntryStrategy || null;
            combo.shortExitStrategy = params.shortExitStrategy || null;
            combo.shortEntryParams = cloneParams(params.shortEntryParams);
            combo.shortExitParams = cloneParams(params.shortExitParams);
        }

        const risk = deriveRiskManagement(params, options);
        if (risk) {
            combo.riskManagement = risk;
        }

        return combo;
    }

    function cloneCombo(combo) {
        if (!combo || typeof combo !== 'object') {
            return null;
        }
        const cloned = {
            buyStrategy: combo.buyStrategy || null,
            sellStrategy: combo.sellStrategy || null,
            buyParams: cloneParams(combo.buyParams),
            sellParams: cloneParams(combo.sellParams)
        };
        if (combo.shortEntryStrategy || combo.shortEntryParams) {
            cloned.shortEntryStrategy = combo.shortEntryStrategy || null;
            cloned.shortEntryParams = cloneParams(combo.shortEntryParams);
        }
        if (combo.shortExitStrategy || combo.shortExitParams) {
            cloned.shortExitStrategy = combo.shortExitStrategy || null;
            cloned.shortExitParams = cloneParams(combo.shortExitParams);
        }
        if (combo.riskManagement) {
            cloned.riskManagement = cloneParams(combo.riskManagement);
        }
        return cloned;
    }

    function resolveDefaultParams(strategyId, strategyDescriptions) {
        if (!strategyId || !strategyDescriptions || typeof strategyDescriptions !== 'object') {
            return {};
        }
        const info = strategyDescriptions[strategyId];
        if (!info || typeof info.defaultParams !== 'object') {
            return {};
        }
        return cloneParams(info.defaultParams);
    }

    function normaliseStrategyId(normaliser, role, strategyId) {
        if (typeof normaliser === 'function') {
            const resolved = normaliser(role, strategyId);
            return resolved || strategyId;
        }
        return strategyId;
    }

    function buildStrategyOptimizationContext(strategyId, role, config = {}) {
        const baseCombo = config.baseCombo ? cloneCombo(config.baseCombo)
            : deriveBaseComboFromParams(config.params || {}, { includeRisk: true, includeShort: true }) || {};
        const strategyDescriptions = config.strategyDescriptions || {};
        const normaliser = config.normaliseStrategyId;

        const roleKey = role === 'buy' ? 'entry'
            : role === 'sell' ? 'exit'
                : role;

        const context = cloneCombo(baseCombo) || {};

        if (roleKey === 'entry' || roleKey === 'buy') {
            context.buyStrategy = normaliseStrategyId(normaliser, 'entry', strategyId);
            const defaults = resolveDefaultParams(strategyId, strategyDescriptions);
            if (baseCombo && baseCombo.buyStrategy === strategyId && baseCombo.buyParams) {
                context.buyParams = cloneParams(baseCombo.buyParams);
            } else {
                context.buyParams = defaults;
            }
            if (!context.sellStrategy && baseCombo && baseCombo.sellStrategy) {
                context.sellStrategy = normaliseStrategyId(normaliser, 'exit', baseCombo.sellStrategy);
            }
            if (!context.sellParams && baseCombo && baseCombo.sellParams) {
                context.sellParams = cloneParams(baseCombo.sellParams);
            }
        } else if (roleKey === 'exit' || roleKey === 'sell') {
            context.sellStrategy = normaliseStrategyId(normaliser, 'exit', strategyId);
            const defaults = resolveDefaultParams(strategyId, strategyDescriptions);
            if (baseCombo && baseCombo.sellStrategy === strategyId && baseCombo.sellParams) {
                context.sellParams = cloneParams(baseCombo.sellParams);
            } else {
                context.sellParams = defaults;
            }
            if (!context.buyStrategy && baseCombo && baseCombo.buyStrategy) {
                context.buyStrategy = normaliseStrategyId(normaliser, 'entry', baseCombo.buyStrategy);
            }
            if (!context.buyParams && baseCombo && baseCombo.buyParams) {
                context.buyParams = cloneParams(baseCombo.buyParams);
            }
        } else if (roleKey === 'shortEntry') {
            context.shortEntryStrategy = normaliseStrategyId(normaliser, 'shortEntry', strategyId);
            const defaults = resolveDefaultParams(strategyId, strategyDescriptions);
            if (baseCombo && baseCombo.shortEntryStrategy === strategyId && baseCombo.shortEntryParams) {
                context.shortEntryParams = cloneParams(baseCombo.shortEntryParams);
            } else {
                context.shortEntryParams = defaults;
            }
        } else if (roleKey === 'shortExit') {
            context.shortExitStrategy = normaliseStrategyId(normaliser, 'shortExit', strategyId);
            const defaults = resolveDefaultParams(strategyId, strategyDescriptions);
            if (baseCombo && baseCombo.shortExitStrategy === strategyId && baseCombo.shortExitParams) {
                context.shortExitParams = cloneParams(baseCombo.shortExitParams);
            } else {
                context.shortExitParams = defaults;
            }
            if (!context.shortEntryStrategy && baseCombo && baseCombo.shortEntryStrategy) {
                context.shortEntryStrategy = normaliseStrategyId(normaliser, 'shortEntry', baseCombo.shortEntryStrategy);
            }
            if (!context.shortEntryParams && baseCombo && baseCombo.shortEntryParams) {
                context.shortEntryParams = cloneParams(baseCombo.shortEntryParams);
            }
        }

        return context;
    }

    const api = {
        deriveBaseComboFromParams,
        buildStrategyOptimizationContext,
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    if (global && typeof global === 'object') {
        if (!global.LazyBatchContext) {
            global.LazyBatchContext = {};
        }
        Object.assign(global.LazyBatchContext, api);
    }
})(typeof window !== 'undefined' ? window : globalThis);
