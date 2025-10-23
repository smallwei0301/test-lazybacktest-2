const assert = require('assert');
const {
    deriveBaseComboFromParams,
    buildStrategyOptimizationContext,
} = require('../js/lib/batch-strategy-context.js');

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

const strategyDescriptions = {
    ma_cross: { defaultParams: { shortPeriod: 5, longPeriod: 20 } },
    ma_cross_exit: { defaultParams: { shortPeriod: 6, longPeriod: 30 } },
    macd_cross_exit: { defaultParams: { shortPeriod: 12, longPeriod: 26, signalPeriod: 9 } },
};

runTest('deriveBaseComboFromParams clones current selection with risk settings', () => {
    const params = {
        entryStrategy: 'ma_cross',
        exitStrategy: 'ma_cross_exit',
        entryParams: { shortPeriod: 8, longPeriod: 21 },
        exitParams: { shortPeriod: 10, longPeriod: 34 },
        stopLoss: 5,
        takeProfit: 12,
    };

    const combo = deriveBaseComboFromParams(params, { includeRisk: true });

    assert.deepStrictEqual(combo.buyStrategy, 'ma_cross');
    assert.deepStrictEqual(combo.sellStrategy, 'ma_cross_exit');
    assert.deepStrictEqual(combo.buyParams, { shortPeriod: 8, longPeriod: 21 });
    assert.deepStrictEqual(combo.sellParams, { shortPeriod: 10, longPeriod: 34 });
    assert.deepStrictEqual(combo.riskManagement, { stopLoss: 5, takeProfit: 12 });

    // Ensure deep clone
    combo.buyParams.shortPeriod = 99;
    assert.strictEqual(params.entryParams.shortPeriod, 8);
});

runTest('buildStrategyOptimizationContext keeps entry context when optimising exit strategy', () => {
    const baseCombo = {
        buyStrategy: 'ma_cross',
        sellStrategy: 'ma_cross_exit',
        buyParams: { shortPeriod: 8, longPeriod: 21 },
        sellParams: { shortPeriod: 10, longPeriod: 34 },
        riskManagement: { stopLoss: 5 },
    };

    const context = buildStrategyOptimizationContext('ma_cross_exit', 'exit', {
        baseCombo,
        strategyDescriptions,
    });

    assert.deepStrictEqual(context.buyStrategy, 'ma_cross');
    assert.deepStrictEqual(context.buyParams, { shortPeriod: 8, longPeriod: 21 });
    assert.deepStrictEqual(context.sellStrategy, 'ma_cross_exit');
    assert.deepStrictEqual(context.sellParams, { shortPeriod: 10, longPeriod: 34 });
    assert.deepStrictEqual(context.riskManagement, { stopLoss: 5 });
});

runTest('buildStrategyOptimizationContext falls back to defaults for new exit strategy while keeping entry context', () => {
    const baseCombo = {
        buyStrategy: 'ma_cross',
        sellStrategy: 'ma_cross_exit',
        buyParams: { shortPeriod: 7, longPeriod: 25 },
        sellParams: { shortPeriod: 9, longPeriod: 33 },
    };

    const context = buildStrategyOptimizationContext('macd_cross_exit', 'exit', {
        baseCombo,
        strategyDescriptions,
    });

    assert.deepStrictEqual(context.buyStrategy, 'ma_cross');
    assert.deepStrictEqual(context.buyParams, { shortPeriod: 7, longPeriod: 25 });
    assert.deepStrictEqual(context.sellStrategy, 'macd_cross_exit');
    assert.deepStrictEqual(context.sellParams, { shortPeriod: 12, longPeriod: 26, signalPeriod: 9 });
});

if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
}
