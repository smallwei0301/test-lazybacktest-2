// Patch Tag: LB-BATCH-ROLEMAP-20260918A
(function(global) {
    const DEFAULT_ROLES = ['entry', 'exit', 'shortEntry', 'shortExit'];

    function cloneArray(value) {
        if (!Array.isArray(value)) {
            return [];
        }
        return value.slice();
    }

    function normaliseRole(role) {
        if (!role) {
            return 'entry';
        }
        if (DEFAULT_ROLES.includes(role)) {
            return role;
        }
        if (role === 'buy') return 'entry';
        if (role === 'sell') return 'exit';
        if (role === 'short') return 'shortEntry';
        return 'entry';
    }

    function ensureUniquePush(list, value) {
        if (!value || typeof value !== 'string') {
            return;
        }
        if (!list.includes(value)) {
            list.push(value);
        }
    }

    function extractPresetIds(preset) {
        if (!preset) {
            return [];
        }
        if (Array.isArray(preset)) {
            return preset.map((item) => {
                if (!item) return null;
                if (typeof item === 'string') {
                    return item;
                }
                if (typeof item === 'object') {
                    return item.strategyId || item.configKey || null;
                }
                return null;
            }).filter(Boolean);
        }
        return [];
    }

    function deriveRolePresetsFromCandidates(candidates) {
        if (!candidates || typeof candidates !== 'object') {
            return {};
        }
        return {
            entry: extractPresetIds(candidates.longEntry || candidates.entry),
            exit: extractPresetIds(candidates.longExit || candidates.exit),
            shortEntry: extractPresetIds(candidates.shortEntry),
            shortExit: extractPresetIds(candidates.shortExit),
        };
    }

    function guessRoleFromId(strategyId) {
        if (!strategyId || typeof strategyId !== 'string') {
            return 'entry';
        }
        if (strategyId.startsWith('short_')) {
            return 'shortEntry';
        }
        if (strategyId.startsWith('cover_')) {
            return 'shortExit';
        }
        if (strategyId.endsWith('_exit')) {
            return 'exit';
        }
        if (/_stop_loss$/i.test(strategyId) || /trailing_stop/i.test(strategyId)) {
            return 'exit';
        }
        if (/overbought/i.test(strategyId) || /breakdown/i.test(strategyId)) {
            return 'exit';
        }
        if (/below$/i.test(strategyId)) {
            return 'exit';
        }
        return 'entry';
    }

    function createStrategyRoleCatalog(options = {}) {
        const strategyDescriptions = options.strategyDescriptions || {};
        const rolePresets = options.rolePresets || {};
        const roleMigrations = options.roleMigrations || {};

        const roleLists = DEFAULT_ROLES.reduce((acc, role) => {
            acc[role] = [];
            return acc;
        }, {});

        function addToRole(role, strategyId) {
            const targetRole = normaliseRole(role);
            if (!roleLists[targetRole]) {
                return;
            }
            ensureUniquePush(roleLists[targetRole], strategyId);
        }

        function hasStrategy(strategyId) {
            return DEFAULT_ROLES.some((role) => roleLists[role].includes(strategyId));
        }

        DEFAULT_ROLES.forEach((role) => {
            const presetIds = extractPresetIds(rolePresets[role]);
            presetIds.forEach((strategyId) => addToRole(role, strategyId));
        });

        Object.keys(roleMigrations || {}).forEach((role) => {
            const mapping = roleMigrations[role];
            if (!mapping || typeof mapping !== 'object') {
                return;
            }
            Object.keys(mapping).forEach((sourceId) => {
                const targetId = mapping[sourceId];
                if (targetId) {
                    addToRole(role, targetId);
                }
                if (!hasStrategy(sourceId)) {
                    addToRole(role === 'exit' ? 'entry' : role, sourceId);
                }
            });
        });

        Object.keys(strategyDescriptions || {}).forEach((strategyId) => {
            if (!strategyId || hasStrategy(strategyId)) {
                return;
            }
            const guessedRole = guessRoleFromId(strategyId);
            addToRole(guessedRole, strategyId);
        });

        return {
            getStrategiesForRole(role) {
                const normalised = normaliseRole(role);
                return cloneArray(roleLists[normalised]);
            },
            hasStrategy(strategyId, role) {
                if (!strategyId) {
                    return false;
                }
                if (role) {
                    const normalised = normaliseRole(role);
                    return roleLists[normalised]?.includes(strategyId) || false;
                }
                return hasStrategy(strategyId);
            },
            guessRole: guessRoleFromId,
            listRoles() {
                return cloneArray(DEFAULT_ROLES);
            }
        };
    }

    function resolveGlobalRolePresets(globalObject) {
        if (!globalObject || typeof globalObject !== 'object') {
            return {};
        }
        if (globalObject.LazyStrategyCatalog && globalObject.LazyStrategyCatalog.rolePresets) {
            return globalObject.LazyStrategyCatalog.rolePresets;
        }
        if (globalObject.strategyRolePresets) {
            return globalObject.strategyRolePresets;
        }
        if (globalObject.strategyRegistrySampleCandidates) {
            return deriveRolePresetsFromCandidates(globalObject.strategyRegistrySampleCandidates);
        }
        return {};
    }

    const defaultCatalog = createStrategyRoleCatalog({
        strategyDescriptions: global?.strategyDescriptions || {},
        rolePresets: resolveGlobalRolePresets(global),
        roleMigrations: global?.STRATEGY_ID_ROLE_MIGRATIONS || {},
    });

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { createStrategyRoleCatalog, guessRoleFromId, deriveRolePresetsFromCandidates };
    }

    if (global && typeof global === 'object') {
        if (!global.LazyStrategyCatalog) {
            global.LazyStrategyCatalog = {};
        }
        if (!global.LazyStrategyCatalog.rolePresets) {
            global.LazyStrategyCatalog.rolePresets = resolveGlobalRolePresets(global);
        }
        Object.assign(global.LazyStrategyCatalog, defaultCatalog);
    }
})(typeof window !== 'undefined' ? window : globalThis);
