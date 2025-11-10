// Patch Tag: LB-BATCH-MAPPER-20260917A
(function(global) {
    function createBatchStrategyMapper(options = {}) {
        const strategyDescriptions = options.strategyDescriptions || {};
        const resolveLookupKey = typeof options.resolveLookupKey === 'function' ? options.resolveLookupKey : null;
        const normaliseForRole = typeof options.normaliseForRole === 'function' ? options.normaliseForRole : null;
        const normaliseAny = typeof options.normaliseAny === 'function' ? options.normaliseAny : null;

        const isKnownStrategy = (strategyId) => Boolean(strategyId && strategyDescriptions && strategyDescriptions[strategyId]);

        function applyRoleHeuristics(strategyId, role, originalId) {
            let candidate = strategyId;
            if (!candidate) {
                return candidate;
            }

            if (role === 'entry') {
                if (candidate.endsWith('_exit')) {
                    const baseCandidate = candidate.replace(/_exit$/, '');
                    if (isKnownStrategy(baseCandidate)) {
                        candidate = baseCandidate;
                    }
                }
            } else if (role === 'exit') {
                if (!candidate.endsWith('_exit')) {
                    const exitCandidate = `${candidate}_exit`;
                    if (isKnownStrategy(exitCandidate)) {
                        candidate = exitCandidate;
                    }
                }
                if (!isKnownStrategy(candidate) && originalId && !originalId.endsWith('_exit')) {
                    const exitCandidate = `${originalId}_exit`;
                    if (isKnownStrategy(exitCandidate)) {
                        candidate = exitCandidate;
                    }
                }
            } else if (role === 'shortEntry') {
                if (!candidate.startsWith('short_')) {
                    const stripped = candidate.startsWith('cover_') ? candidate.slice('cover_'.length) : candidate;
                    const shortCandidate = `short_${stripped}`;
                    if (isKnownStrategy(shortCandidate)) {
                        candidate = shortCandidate;
                    }
                }
            } else if (role === 'shortExit') {
                if (!candidate.startsWith('cover_')) {
                    const stripped = candidate.startsWith('short_') ? candidate.slice('short_'.length) : candidate;
                    const coverCandidate = `cover_${stripped}`;
                    if (isKnownStrategy(coverCandidate)) {
                        candidate = coverCandidate;
                    }
                }
            }

            if (!isKnownStrategy(candidate) && isKnownStrategy(originalId)) {
                return originalId;
            }

            return candidate;
        }

        function canonicalize(strategyId, role) {
            if (!strategyId) {
                return strategyId;
            }

            const originalId = strategyId;
            let resolved = null;

            if (resolveLookupKey) {
                resolved = resolveLookupKey(strategyId, role);
            }

            if (!resolved && normaliseForRole && role) {
                const migrated = normaliseForRole(role, strategyId);
                if (migrated) {
                    resolved = migrated;
                }
            }

            if (!resolved && normaliseAny) {
                const fallback = normaliseAny(strategyId);
                if (fallback) {
                    resolved = fallback;
                }
            }

            if (!resolved) {
                resolved = strategyId;
            }

            const heuristicsApplied = applyRoleHeuristics(resolved, role, originalId);
            if (heuristicsApplied !== resolved) {
                resolved = heuristicsApplied;
            }

            if (!isKnownStrategy(resolved) && isKnownStrategy(strategyId)) {
                return strategyId;
            }

            return resolved;
        }

        function getWorkerId(strategyId, role) {
            const canonical = canonicalize(strategyId, role);
            if (isKnownStrategy(canonical)) {
                return canonical;
            }
            if (isKnownStrategy(strategyId)) {
                return strategyId;
            }
            return canonical || strategyId;
        }

        function describeMapping(strategyId, role) {
            const canonical = canonicalize(strategyId, role);
            const known = isKnownStrategy(canonical);
            return {
                original: strategyId,
                canonical,
                role: role || null,
                known,
            };
        }

        return {
            canonicalize,
            getWorkerId,
            describeMapping,
            isKnownStrategy,
        };
    }

    const lexicalStrategyDescriptions = (typeof strategyDescriptions !== 'undefined' && strategyDescriptions)
        ? strategyDescriptions
        : null;
    const lexicalResolveLookupKey = (typeof resolveStrategyLookupKey === 'function')
        ? resolveStrategyLookupKey
        : null;
    const lexicalNormaliseForRole = (typeof normaliseStrategyIdForRole === 'function')
        ? normaliseStrategyIdForRole
        : null;
    const lexicalNormaliseAny = (typeof normaliseStrategyIdAny === 'function')
        ? normaliseStrategyIdAny
        : null;

    const defaultOptions = {
        strategyDescriptions: lexicalStrategyDescriptions
            || (global && typeof global.strategyDescriptions === 'object' && global.strategyDescriptions)
            || {},
        resolveLookupKey: lexicalResolveLookupKey
            || (global && typeof global.resolveStrategyLookupKey === 'function' ? global.resolveStrategyLookupKey : null),
        normaliseForRole: lexicalNormaliseForRole
            || (global && typeof global.normaliseStrategyIdForRole === 'function' ? global.normaliseStrategyIdForRole : null),
        normaliseAny: lexicalNormaliseAny
            || (global && typeof global.normaliseStrategyIdAny === 'function' ? global.normaliseStrategyIdAny : null),
    };

    const mapper = createBatchStrategyMapper(defaultOptions);

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { createBatchStrategyMapper };
    }

    if (global && typeof global === 'object') {
        if (!global.LazyBatchStrategyMapper) {
            global.LazyBatchStrategyMapper = mapper;
        } else {
            Object.assign(global.LazyBatchStrategyMapper, mapper);
        }
    }
})(typeof window !== 'undefined' ? window : globalThis);
