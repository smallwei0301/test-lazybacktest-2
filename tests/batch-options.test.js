const assert = require('assert');
const { deriveRoleStrategyIds, buildRoleOptions } = require('../js/lib/batch-strategy-options.js');

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

const mockDescriptions = {
    ma_cross: { name: '均線黃金交叉' },
    ma_cross_exit: { name: '均線死亡交叉' },
    macd_cross_exit: { name: 'MACD死亡交叉' },
    k_d_cross_exit: { name: 'KD死亡交叉' },
    trailing_stop: { name: '移動停損 (%)' },
};

runTest('default exit strategies include death cross variants', () => {
    const ids = deriveRoleStrategyIds('exit');
    assert.ok(ids.includes('ma_cross_exit'), 'ma_cross_exit should exist');
    assert.ok(ids.includes('macd_cross_exit'), 'macd_cross_exit should exist');
    assert.ok(ids.includes('k_d_cross_exit'), 'k_d_cross_exit should exist');
});

runTest('buildRoleOptions filters to known strategies', () => {
    const options = buildRoleOptions('exit', {
        strategyDescriptions: mockDescriptions,
        include: ['unknown_exit'],
    });
    const ids = options.map((opt) => opt.id);
    assert.deepStrictEqual(ids.sort(), ['k_d_cross_exit', 'ma_cross_exit', 'macd_cross_exit', 'trailing_stop'].sort());
});

runTest('deriveRoleStrategyIds merges extras uniquely', () => {
    const ids = deriveRoleStrategyIds('entry', { include: ['ma_cross', 'custom_entry'] });
    assert.ok(ids.includes('custom_entry'), 'custom entry should be appended');
    const maCrossCount = ids.filter((id) => id === 'ma_cross').length;
    assert.strictEqual(maCrossCount, 1, 'ma_cross should not duplicate');
});

if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
}
