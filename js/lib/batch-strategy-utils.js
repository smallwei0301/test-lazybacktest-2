// Patch Tag: LB-BATCH-CATALOG-20260918A
(function(global) {
    const DEFAULT_ORDER = {
        longEntries: [
            'ma_cross', 'ma_above', 'rsi_oversold', 'macd_cross', 'bollinger_breakout',
            'k_d_cross', 'volume_spike', 'price_breakout', 'williams_oversold',
            'ema_cross', 'turtle_breakout'
        ],
        longExits: [
            'ma_cross_exit', 'ma_below', 'rsi_overbought', 'macd_cross_exit', 'bollinger_reversal',
            'k_d_cross_exit', 'price_breakdown', 'williams_overbought',
            'ema_cross_exit', 'turtle_stop_loss', 'trailing_stop', 'fixed_stop_loss'
        ],
        shortEntries: [
            'short_ma_cross', 'short_ma_below', 'short_rsi_overbought', 'short_macd_cross',
            'short_bollinger_reversal', 'short_k_d_cross', 'short_price_breakdown',
            'short_williams_overbought', 'short_turtle_stop_loss'
        ],
        shortExits: [
            'cover_ma_cross', 'cover_ma_above', 'cover_rsi_oversold', 'cover_macd_cross',
            'cover_bollinger_breakout', 'cover_k_d_cross', 'cover_price_breakout',
            'cover_williams_oversold', 'cover_turtle_breakout', 'cover_trailing_stop',
            'cover_fixed_stop_loss'
        ]
    };

    const RISK_STRATEGIES = new Set(['fixed_stop_loss', 'cover_fixed_stop_loss', 'trailing_stop', 'cover_trailing_stop']);

    function normaliseRole(role) {
        if (!role) return null;
        if (role === 'buy') return 'entry';
        if (role === 'sell') return 'exit';
        return role;
    }

    function uniquePush(bucket, value, descriptions, seen) {
        if (!value || !descriptions || !descriptions[value]) {
            return;
        }
        if (seen.has(value)) {
            return;
        }
        bucket.push(value);
        seen.add(value);
    }

    function ensureExitVariant(id, descriptions) {
        if (!id) return id;
        if (id.endsWith('_exit')) {
            return id;
        }
        const candidate = `${id}_exit`;
        if (descriptions && descriptions[candidate]) {
            return candidate;
        }
        return id;
    }

    function ensureShortVariant(prefix, id, descriptions) {
        if (!id) return id;
        if (id.startsWith(prefix)) {
            return id;
        }
        const stripped = id.startsWith('cover_') ? id.slice('cover_'.length) : id;
        const candidate = `${prefix}${stripped}`;
        if (descriptions && descriptions[candidate]) {
            return candidate;
        }
        return id;
    }

    function deriveStrategyCatalog(descriptions = {}, options = {}) {
        const roleMap = options.roleMap || {};
        const defaults = options.defaults || DEFAULT_ORDER;

        const catalog = {
            longEntries: [],
            longExits: [],
            shortEntries: [],
            shortExits: [],
            riskExits: []
        };

        const seen = {
            longEntries: new Set(),
            longExits: new Set(),
            shortEntries: new Set(),
            shortExits: new Set(),
            riskExits: new Set()
        };

        const add = (bucket, value) => {
            uniquePush(catalog[bucket], value, descriptions, seen[bucket]);
            if (bucket === 'longExits' && RISK_STRATEGIES.has(value)) {
                uniquePush(catalog.riskExits, value, descriptions, seen.riskExits);
            }
        };

        const roleValues = (map) => {
            if (!map) return [];
            return Object.values(map).filter(Boolean);
        };

        (defaults.longEntries || []).forEach((id) => add('longEntries', id));
        (defaults.longExits || []).forEach((id) => add('longExits', id));
        (defaults.shortEntries || []).forEach((id) => add('shortEntries', id));
        (defaults.shortExits || []).forEach((id) => add('shortExits', id));

        roleValues(roleMap.exit).forEach((id) => add('longExits', id));
        roleValues(roleMap.shortEntry).forEach((id) => add('shortEntries', id));
        roleValues(roleMap.shortExit).forEach((id) => add('shortExits', id));

        Object.keys(descriptions).forEach((id) => {
            if (RISK_STRATEGIES.has(id)) {
                add('longExits', id);
                return;
            }
            if (id.startsWith('short_')) {
                add('shortEntries', id);
                return;
            }
            if (id.startsWith('cover_')) {
                add('shortExits', id);
                return;
            }
            if (id.endsWith('_exit')) {
                add('longExits', id);
                return;
            }
            add('longEntries', id);
        });

        // Ensure exit variants referenced by role maps exist even if only base ID present
        if (roleMap.exit) {
            Object.keys(roleMap.exit).forEach((legacy) => {
                const mapped = roleMap.exit[legacy];
                if (descriptions[mapped]) {
                    add('longEntries', legacy);
                    add('longExits', mapped);
                }
            });
        }

        return catalog;
    }

    function resolveWorkerStrategyId(strategyId, role, ctx = {}) {
        if (!strategyId) return strategyId;
        const roleKey = normaliseRole(role);
        const descriptions = ctx.strategyDescriptions || {};
        const lookupKey = typeof ctx.lookupKey === 'function' ? ctx.lookupKey : null;
        const normaliseForRole = typeof ctx.normaliseForRole === 'function' ? ctx.normaliseForRole : null;
        const normaliseAny = typeof ctx.normaliseAny === 'function' ? ctx.normaliseAny : null;
        const roleMap = ctx.roleMap || {};
        const trace = typeof ctx.trace === 'function' ? ctx.trace : null;

        const isKnown = (id) => Boolean(id && descriptions && descriptions[id]);
        const candidates = [];
        const pushed = new Set();

        const pushCandidate = (id, reason) => {
            if (!id || pushed.has(id)) {
                return;
            }
            pushed.add(id);
            candidates.push({ id, reason });
        };

        if (lookupKey) {
            pushCandidate(lookupKey(strategyId, roleKey), 'lookup-key');
        }
        if (normaliseForRole) {
            pushCandidate(normaliseForRole(roleKey, strategyId), 'role-normaliser');
        }
        if (roleKey && roleMap[roleKey] && roleMap[roleKey][strategyId]) {
            pushCandidate(roleMap[roleKey][strategyId], 'role-map');
        }
        if (normaliseAny) {
            pushCandidate(normaliseAny(strategyId), 'any-normaliser');
        }

        if (roleKey === 'exit') {
            pushCandidate(ensureExitVariant(strategyId, descriptions), 'exit-heuristic');
        } else if (roleKey === 'entry') {
            if (strategyId.endsWith('_exit')) {
                const baseId = strategyId.replace(/_exit$/, '');
                if (descriptions[baseId]) {
                    pushCandidate(baseId, 'entry-strip-exit');
                }
            }
        } else if (roleKey === 'shortEntry') {
            pushCandidate(ensureShortVariant('short_', strategyId, descriptions), 'short-entry-heuristic');
        } else if (roleKey === 'shortExit') {
            pushCandidate(ensureShortVariant('cover_', strategyId, descriptions), 'short-exit-heuristic');
        }

        pushCandidate(strategyId, 'original');

        for (const candidate of candidates) {
            const known = isKnown(candidate.id);
            if (trace) {
                trace({ candidate: candidate.id, reason: candidate.reason, accepted: known });
            }
            if (known) {
                return candidate.id;
            }
        }

        if (roleKey === 'exit') {
            const fallback = ensureExitVariant(strategyId, descriptions);
            if (fallback !== strategyId) {
                return fallback;
            }
        }

        return candidates.length > 0 ? candidates[0].id : strategyId;
    }

    const api = {
        deriveStrategyCatalog,
        resolveWorkerStrategyId,
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    if (global && typeof global === 'object') {
        if (!global.LazyBatchStrategyUtils) {
            global.LazyBatchStrategyUtils = {};
        }
        Object.assign(global.LazyBatchStrategyUtils, api);
    }
})(typeof window !== 'undefined' ? window : globalThis);
