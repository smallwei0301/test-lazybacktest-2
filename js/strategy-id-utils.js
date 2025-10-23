(function (global) {
    const LEGACY_STRATEGY_ID_MAP = {
        exit: {
            'ma_cross': 'ma_cross_exit',
            'macd_cross': 'macd_cross_exit',
            'k_d_cross': 'k_d_cross_exit',
        },
        shortEntry: {
            'ma_cross': 'short_ma_cross',
            'ma_below': 'short_ma_below',
            'rsi_overbought': 'short_rsi_overbought',
            'macd_cross': 'short_macd_cross',
            'bollinger_reversal': 'short_bollinger_reversal',
            'k_d_cross': 'short_k_d_cross',
            'price_breakdown': 'short_price_breakdown',
            'williams_overbought': 'short_williams_overbought',
            'turtle_stop_loss': 'short_turtle_stop_loss',
        },
        shortExit: {
            'ma_cross': 'cover_ma_cross',
            'ma_above': 'cover_ma_above',
            'rsi_oversold': 'cover_rsi_oversold',
            'macd_cross': 'cover_macd_cross',
            'bollinger_breakout': 'cover_bollinger_breakout',
            'k_d_cross': 'cover_k_d_cross',
            'price_breakout': 'cover_price_breakout',
            'williams_oversold': 'cover_williams_oversold',
            'turtle_breakout': 'cover_turtle_breakout',
            'trailing_stop': 'cover_trailing_stop',
            'fixed_stop_loss': 'cover_fixed_stop_loss',
        },
    };

    function normaliseStrategyIdForRole(rawId, roleType) {
        if (!rawId || !roleType) return rawId;
        const mapping = LEGACY_STRATEGY_ID_MAP[roleType];
        if (!mapping || typeof mapping !== 'object') {
            return rawId;
        }
        if (Object.prototype.hasOwnProperty.call(mapping, rawId) && typeof mapping[rawId] === 'string') {
            return mapping[rawId];
        }
        return rawId;
    }

    function resolveStrategyAliases(strategyId, roleType) {
        if (!strategyId || !roleType) return [];
        const mapping = LEGACY_STRATEGY_ID_MAP[roleType];
        if (!mapping || typeof mapping !== 'object') {
            return [];
        }
        const aliases = new Set();
        Object.entries(mapping).forEach(([legacyId, canonicalId]) => {
            if (!canonicalId || legacyId === canonicalId) return;
            if (strategyId === legacyId) {
                aliases.add(canonicalId);
            } else if (strategyId === canonicalId) {
                aliases.add(legacyId);
            }
        });
        return Array.from(aliases);
    }

    function migrateStrategySettings(settings) {
        if (!settings || typeof settings !== 'object') {
            return { settings, changed: false };
        }
        const next = { ...settings };
        let changed = false;

        const exitId = normaliseStrategyIdForRole(next.exitStrategy, 'exit');
        if (exitId && exitId !== next.exitStrategy) {
            next.exitStrategy = exitId;
            changed = true;
        }

        if (Object.prototype.hasOwnProperty.call(next, 'shortEntryStrategy')) {
            const shortEntryId = normaliseStrategyIdForRole(next.shortEntryStrategy, 'shortEntry');
            if (shortEntryId && shortEntryId !== next.shortEntryStrategy) {
                next.shortEntryStrategy = shortEntryId;
                changed = true;
            }
        }

        if (Object.prototype.hasOwnProperty.call(next, 'shortExitStrategy')) {
            const shortExitId = normaliseStrategyIdForRole(next.shortExitStrategy, 'shortExit');
            if (shortExitId && shortExitId !== next.shortExitStrategy) {
                next.shortExitStrategy = shortExitId;
                changed = true;
            }
        }

        return { settings: next, changed };
    }

    const api = {
        LEGACY_STRATEGY_ID_MAP,
        normaliseStrategyIdForRole,
        resolveStrategyAliases,
        migrateStrategySettings,
    };

    global.LB_STRATEGY_ID_UTILS = api;
})(typeof window !== 'undefined' ? window : globalThis);
