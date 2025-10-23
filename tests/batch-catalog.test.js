const assert = require('assert');
const {
    hydrateBatchStrategyCatalog,
    DEFAULT_ENTRY_STRATEGIES,
    DEFAULT_EXIT_STRATEGIES,
} = require('../js/lib/batch-strategy-catalog.js');

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

runTest('hydrates catalog with available strategies only', () => {
    const descriptions = {
        ma_cross: {},
        rsi_oversold: {},
        macd_cross_exit: {},
        ma_cross_exit: {},
        fixed_stop_loss: {},
    };

    const result = hydrateBatchStrategyCatalog(descriptions);

    assert.deepStrictEqual(result.entry, ['ma_cross', 'rsi_oversold']);
    assert.deepStrictEqual(result.exit, ['ma_cross_exit', 'macd_cross_exit', 'fixed_stop_loss']);
    assert.ok(Array.isArray(result.missing.entry));
    assert.ok(result.missing.entry.includes('macd_cross'));
    assert.ok(result.missing.exit.includes('k_d_cross_exit'));
});

runTest('returns defaults arrays for reference', () => {
    assert.ok(Array.isArray(DEFAULT_ENTRY_STRATEGIES));
    assert.ok(DEFAULT_ENTRY_STRATEGIES.includes('ma_cross'));
    assert.ok(Array.isArray(DEFAULT_EXIT_STRATEGIES));
    assert.ok(DEFAULT_EXIT_STRATEGIES.includes('macd_cross_exit'));
});

runTest('supports includeMissing=false option', () => {
    const descriptions = { ma_cross: {}, ma_cross_exit: {} };
    const result = hydrateBatchStrategyCatalog(descriptions, { includeMissing: false });
    assert.deepStrictEqual(result.entry, ['ma_cross']);
    assert.deepStrictEqual(result.exit, ['ma_cross_exit']);
    assert.strictEqual(result.missing, undefined);
});

if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
}
