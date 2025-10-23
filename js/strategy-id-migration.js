(function (global, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        const exports = factory();
        if (global) {
            global.StrategyIdMigration = exports;
        }
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const VERSION = 'LB-STRATEGY-ID-MIGRATION-20260916A';

    const legacyToCanonical = {
        exit: {
            ma_cross: 'ma_cross_exit',
            macd_cross: 'macd_cross_exit',
            k_d_cross: 'k_d_cross_exit',
            ema_cross: 'ema_cross_exit',
        },
        shortEntry: {
            ma_cross: 'short_ma_cross',
            ma_below: 'short_ma_below',
            rsi_overbought: 'short_rsi_overbought',
            macd_cross: 'short_macd_cross',
            bollinger_reversal: 'short_bollinger_reversal',
            k_d_cross: 'short_k_d_cross',
            price_breakdown: 'short_price_breakdown',
            williams_overbought: 'short_williams_overbought',
            turtle_stop_loss: 'short_turtle_stop_loss',
        },
        shortExit: {
            ma_cross: 'cover_ma_cross',
            ma_above: 'cover_ma_above',
            rsi_oversold: 'cover_rsi_oversold',
            macd_cross: 'cover_macd_cross',
            bollinger_breakout: 'cover_bollinger_breakout',
            k_d_cross: 'cover_k_d_cross',
            price_breakout: 'cover_price_breakout',
            williams_oversold: 'cover_williams_oversold',
            turtle_breakout: 'cover_turtle_breakout',
            trailing_stop: 'cover_trailing_stop',
            fixed_stop_loss: 'cover_fixed_stop_loss',
        },
    };

    const canonicalToLegacy = Object.entries(legacyToCanonical).reduce((acc, [role, table]) => {
        const reverse = {};
        Object.entries(table).forEach(([legacyId, canonicalId]) => {
            if (!reverse[canonicalId]) {
                reverse[canonicalId] = [];
            }
            reverse[canonicalId].push(legacyId);
        });
        acc[role] = reverse;
        return acc;
    }, {});

    function normalizeStrategyId(role, id) {
        if (!id || !role) {
            return id;
        }
        const table = legacyToCanonical[role];
        if (table && table[id]) {
            return table[id];
        }
        return id;
    }

    function normalizeStrategyOptionValue(role, id) {
        return normalizeStrategyId(role, id);
    }

    function collectLegacyIds(canonicalId, role) {
        if (!canonicalId || !role) {
            return [];
        }
        const roleTable = canonicalToLegacy[role];
        if (!roleTable || !roleTable[canonicalId]) {
            return [];
        }
        return [...roleTable[canonicalId]];
    }

    function migrateSettings(settings) {
        if (!settings || typeof settings !== 'object') {
            return { settings, changed: false, diffs: {} };
        }
        const updated = { ...settings };
        const diffs = {};
        const fields = [
            ['exitStrategy', 'exit'],
            ['shortEntryStrategy', 'shortEntry'],
            ['shortExitStrategy', 'shortExit'],
        ];
        fields.forEach(([field, role]) => {
            if (!(field in updated)) {
                return;
            }
            const current = updated[field];
            const canonical = normalizeStrategyId(role, current);
            if (canonical !== current) {
                updated[field] = canonical;
                diffs[field] = { from: current, to: canonical };
            }
        });
        return { settings: updated, changed: Object.keys(diffs).length > 0, diffs };
    }

    function migrateStrategySelection(selection) {
        if (!selection || typeof selection !== 'object') {
            return { selection, changed: false, diffs: {} };
        }
        const updated = { ...selection };
        const diffs = {};
        const fields = [
            ['longExit', 'exit'],
            ['shortEntry', 'shortEntry'],
            ['shortExit', 'shortExit'],
        ];
        fields.forEach(([field, role]) => {
            const entry = updated[field];
            if (!entry || typeof entry !== 'object') {
                return;
            }
            const currentId = entry.strategyId || entry.configKey;
            const canonical = normalizeStrategyId(role, currentId);
            if (canonical !== currentId) {
                updated[field] = {
                    ...entry,
                    strategyId: canonical,
                    configKey: canonical,
                };
                diffs[field] = { from: currentId, to: canonical };
            }
        });
        return { selection: updated, changed: Object.keys(diffs).length > 0, diffs };
    }

    function getVersionTag() {
        return VERSION;
    }

    return {
        VERSION,
        getVersionTag,
        normalizeStrategyId,
        normalizeStrategyOptionValue,
        collectLegacyIds,
        migrateSettings,
        migrateStrategySelection,
        legacyToCanonical,
    };
});
