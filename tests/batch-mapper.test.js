const assert = require('assert');
const { createBatchStrategyMapper } = require('../js/lib/batch-strategy-mapper.js');

function runTest(name, fn) {
    try {
        fn();
        console.log(`\u2713 ${name}`);
    } catch (error) {
        console.error(`\u2717 ${name}`);
        console.error(error);
        process.exitCode = 1;
    }
}

const strategyDescriptions = {
    ma_cross: { defaultParams: {} },
    ma_cross_exit: { defaultParams: {} },
    macd_cross: { defaultParams: {} },
    macd_cross_exit: { defaultParams: {} },
    short_ma_cross: { defaultParams: {} },
    cover_ma_cross: { defaultParams: {} },
};

function normaliseForRole(role, strategyId) {
    if (!strategyId) return strategyId;
    if (role === 'exit' && strategyId === 'ma_cross') return 'ma_cross_exit';
    if (role === 'exit' && strategyId === 'macd_cross') return 'macd_cross_exit';
    if (role === 'shortEntry' && strategyId === 'ma_cross') return 'short_ma_cross';
    if (role === 'shortExit' && strategyId === 'ma_cross') return 'cover_ma_cross';
    return strategyId;
}

function resolveLookupKey(strategyId, role) {
    if (!strategyId) return strategyId;
    if (strategyDescriptions[strategyId]) {
        return strategyId;
    }
    return normaliseForRole(role, strategyId);
}

const mapper = createBatchStrategyMapper({
    strategyDescriptions,
    resolveLookupKey,
    normaliseForRole,
    normaliseAny: (strategyId) => strategyId,
});

runTest('entry strategies keep canonical ID', () => {
    const result = mapper.getWorkerId('ma_cross', 'entry');
    assert.strictEqual(result, 'ma_cross');
});

runTest('exit strategies migrate to exit variant', () => {
    const result = mapper.getWorkerId('ma_cross', 'exit');
    assert.strictEqual(result, 'ma_cross_exit');
});

runTest('entry strategies recover from exit suffix', () => {
    const result = mapper.getWorkerId('ma_cross_exit', 'entry');
    assert.strictEqual(result, 'ma_cross');
});

runTest('short entry strategies acquire short prefix', () => {
    const result = mapper.getWorkerId('ma_cross', 'shortEntry');
    assert.strictEqual(result, 'short_ma_cross');
});

runTest('short exit strategies acquire cover prefix', () => {
    const result = mapper.getWorkerId('ma_cross', 'shortExit');
    assert.strictEqual(result, 'cover_ma_cross');
});

if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
}
