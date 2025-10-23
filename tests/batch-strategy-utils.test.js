const assert = require('assert');
const {
    resolveWorkerStrategyId,
    deriveStrategyCatalog,
} = require('../js/lib/batch-strategy-utils');

function runTest(name, fn) {
    try {
        fn();
        console.log(`✓ ${name}`);
    } catch (error) {
        console.error(`✗ ${name}`);
        console.error(error);
        process.exitCode = 1;
    }
}

const baseDescriptions = {
    ma_cross: { name: '均線黃金交叉', defaultParams: { shortPeriod: 5, longPeriod: 20 } },
    ma_cross_exit: { name: '均線死亡交叉', defaultParams: { shortPeriod: 5, longPeriod: 20 } },
    macd_cross: { name: 'MACD黃金交叉', defaultParams: { shortPeriod: 12, longPeriod: 26, signalPeriod: 9 } },
    macd_cross_exit: { name: 'MACD死亡交叉', defaultParams: { shortPeriod: 12, longPeriod: 26, signalPeriod: 9 } },
    k_d_cross: { name: 'KD黃金交叉', defaultParams: { period: 9, thresholdX: 30 } },
    k_d_cross_exit: { name: 'KD死亡交叉', defaultParams: { period: 9, thresholdY: 70 } },
    ma_below: { name: '價格跌破均線', defaultParams: { period: 20 } },
    trailing_stop: { name: '移動停損', defaultParams: { percentage: 5 } },
    short_ma_cross: { name: '均線死亡交叉 (做空)', defaultParams: { shortPeriod: 5, longPeriod: 20 } },
    cover_ma_cross: { name: '均線黃金交叉 (回補)', defaultParams: { shortPeriod: 5, longPeriod: 20 } },
};

const roleMap = {
    exit: { ma_cross: 'ma_cross_exit', macd_cross: 'macd_cross_exit', k_d_cross: 'k_d_cross_exit' },
    shortEntry: { ma_cross: 'short_ma_cross' },
    shortExit: { ma_cross: 'cover_ma_cross' },
};

const ctx = {
    strategyDescriptions: baseDescriptions,
    roleMap,
    lookupKey: (strategyId, role) => {
        if (role === 'exit' && strategyId && !strategyId.endsWith('_exit')) {
            const candidate = `${strategyId}_exit`;
            if (baseDescriptions[candidate]) {
                return candidate;
            }
        }
        return baseDescriptions[strategyId] ? strategyId : null;
    },
    normaliseForRole: (role, strategyId) => {
        const mapping = roleMap[role];
        if (mapping && mapping[strategyId]) {
            return mapping[strategyId];
        }
        if (role === 'exit' && strategyId && !strategyId.endsWith('_exit')) {
            return `${strategyId}_exit`;
        }
        if (role === 'shortEntry' && !strategyId.startsWith('short_')) {
            return `short_${strategyId}`;
        }
        if (role === 'shortExit' && !strategyId.startsWith('cover_')) {
            return `cover_${strategyId}`;
        }
        return strategyId;
    },
    normaliseAny: (strategyId) => strategyId,
};

runTest('maps legacy exit IDs to canonical worker IDs', () => {
    const resolved = resolveWorkerStrategyId('ma_cross', 'exit', ctx);
    assert.strictEqual(resolved, 'ma_cross_exit');
});

runTest('keeps entry strategies untouched', () => {
    const resolved = resolveWorkerStrategyId('ma_cross', 'entry', ctx);
    assert.strictEqual(resolved, 'ma_cross');
});

runTest('keeps explicit exit strategies canonical', () => {
    const resolved = resolveWorkerStrategyId('ma_cross_exit', 'exit', ctx);
    assert.strictEqual(resolved, 'ma_cross_exit');
});

runTest('derives catalog with death cross exits present', () => {
    const catalog = deriveStrategyCatalog(baseDescriptions, { roleMap });
    assert.ok(catalog.longExits.includes('ma_cross_exit'));
    assert.ok(catalog.longExits.includes('macd_cross_exit'));
    assert.ok(catalog.longExits.includes('k_d_cross_exit'));
    assert.ok(catalog.longEntries.includes('ma_cross'));
});
