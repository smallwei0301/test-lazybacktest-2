const assert = require('assert');
const { createStrategyRoleCatalog } = require('../js/lib/strategy-role-catalog.js');

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
    ma_above: { defaultParams: {} },
    ma_below: { defaultParams: {} },
    macd_cross: { defaultParams: {} },
    macd_cross_exit: { defaultParams: {} },
    k_d_cross: { defaultParams: {} },
    k_d_cross_exit: { defaultParams: {} },
};

const rolePresets = {
    entry: ['ma_cross', 'ma_above'],
    exit: ['ma_below'],
    shortEntry: [],
    shortExit: [],
};

const roleMigrations = {
    exit: {
        ma_cross: 'ma_cross_exit',
        macd_cross: 'macd_cross_exit',
        k_d_cross: 'k_d_cross_exit',
    },
};

const catalog = createStrategyRoleCatalog({
    rolePresets,
    strategyDescriptions,
    roleMigrations,
});

runTest('exit role auto includes migrated *_exit strategies', () => {
    const exitStrategies = catalog.getStrategiesForRole('exit');
    assert(exitStrategies.includes('ma_cross_exit'));
    assert(exitStrategies.includes('macd_cross_exit'));
    assert(exitStrategies.includes('k_d_cross_exit'));
});

runTest('entry role keeps canonical ids and excludes exit variants', () => {
    const entryStrategies = catalog.getStrategiesForRole('entry');
    assert(entryStrategies.includes('ma_cross'));
    assert(entryStrategies.includes('macd_cross'));
    assert(!entryStrategies.includes('ma_cross_exit'));
});

if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
}
