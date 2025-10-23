// Patch Tag: LB-BATCH-OPTIONS-20260918A
(function(global) {
    const DEFAULT_ROLE_STRATEGIES = Object.freeze({
        entry: Object.freeze([
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
        ]),
        exit: Object.freeze([
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
        ]),
        shortEntry: Object.freeze([
            'short_ma_cross',
            'short_ma_below',
            'short_rsi_overbought',
            'short_macd_cross',
            'short_bollinger_reversal',
            'short_k_d_cross',
            'short_price_breakdown',
            'short_williams_overbought',
            'short_turtle_stop_loss',
        ]),
        shortExit: Object.freeze([
            'cover_ma_cross',
            'cover_ma_above',
            'cover_rsi_oversold',
            'cover_macd_cross',
            'cover_bollinger_breakout',
            'cover_k_d_cross',
            'cover_price_breakout',
            'cover_williams_oversold',
            'cover_turtle_breakout',
            'cover_trailing_stop',
            'cover_fixed_stop_loss',
        ]),
    });

    function toArray(value) {
        if (!value) return [];
        if (Array.isArray(value)) return value;
        return [value];
    }

    function uniq(list) {
        return Array.from(new Set(list.filter(Boolean)));
    }

    function filterKnownStrategies(ids, strategyDescriptions) {
        if (!strategyDescriptions || typeof strategyDescriptions !== 'object') {
            return ids;
        }
        return ids.filter((id) => Boolean(strategyDescriptions[id]));
    }

    function deriveRoleStrategyIds(role, options = {}) {
        const catalog = options.catalog || DEFAULT_ROLE_STRATEGIES;
        const baseList = toArray(catalog?.[role]);
        const extras = toArray(options.include || options.extra || []);
        const combined = uniq([...baseList, ...extras]);
        return combined;
    }

    function buildRoleOptions(role, options = {}) {
        const strategyDescriptions = options.strategyDescriptions
            || global?.strategyDescriptions
            || {};
        const ids = filterKnownStrategies(
            deriveRoleStrategyIds(role, options),
            strategyDescriptions
        );
        return ids.map((id) => ({
            id,
            name: strategyDescriptions[id]?.name || id,
            description: strategyDescriptions[id]?.desc || '',
        }));
    }

    const api = {
        DEFAULT_ROLE_STRATEGIES,
        deriveRoleStrategyIds,
        buildRoleOptions,
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    if (global && typeof global === 'object') {
        if (!global.LazyBatchStrategyOptions) {
            global.LazyBatchStrategyOptions = {};
        }
        Object.assign(global.LazyBatchStrategyOptions, api);
    }
})(typeof window !== 'undefined' ? window : globalThis);
