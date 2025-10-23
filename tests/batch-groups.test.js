const assert = require('assert');

const sampleStrategies = {
    ma_cross: { name: '均線黃金交叉' },
    ma_above: { name: '價格突破均線' },
    rsi_oversold: { name: 'RSI超賣' },
    macd_cross: { name: 'MACD黃金交叉' },
    k_d_cross: { name: 'KD黃金交叉' },
    ma_cross_exit: { name: '均線死亡交叉' },
    macd_cross_exit: { name: 'MACD死亡交叉' },
    k_d_cross_exit: { name: 'KD死亡交叉' },
    ma_below: { name: '價格跌破均線' },
    rsi_overbought: { name: 'RSI超買' },
    bollinger_reversal: { name: '布林通道反轉' },
    price_breakdown: { name: '價格跌破前低' },
    williams_overbought: { name: '威廉指標超買' },
    turtle_stop_loss: { name: '海龜停損' },
    trailing_stop: { name: '移動停損' },
    fixed_stop_loss: { name: '固定停損' },
    short_ma_cross: { name: '均線死亡交叉(空)' },
    short_macd_cross: { name: 'MACD死亡交叉(空)' },
    short_k_d_cross: { name: 'KD死亡交叉(空)' },
    short_turtle_stop_loss: { name: '海龜停損(空)' },
    cover_ma_cross: { name: '均線黃金交叉(回補)' },
    cover_macd_cross: { name: 'MACD黃金交叉(回補)' },
    cover_k_d_cross: { name: 'KD黃金交叉(回補)' },
    cover_turtle_breakout: { name: '海龜突破(回補)' },
    cover_trailing_stop: { name: '移動停損(回補)' },
    cover_fixed_stop_loss: { name: '固定停損(回補)' },
    volume_spike: { name: '成交量暴增' },
    price_breakout: { name: '價格突破前高' },
    williams_oversold: { name: '威廉指標超賣' },
};

global.window = { location: { hostname: 'test.local' } };
global.document = {
    getElementById: () => null,
    querySelectorAll: () => [],
    createElement: () => ({
        setAttribute: () => {},
        appendChild: () => {},
        innerHTML: '',
        className: ''
    })
};
global.window.document = global.document;
global.window.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    key: () => null,
    length: 0
};
global.window.sessionStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    key: () => null,
    length: 0
};
global.navigator = {};

global.strategyDescriptions = sampleStrategies;

delete require.cache[require.resolve('../js/batch-optimization.js')];
const batchModule = require('../js/batch-optimization.js');

const { collectBatchStrategyGroupsForTest } = batchModule;

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

runTest('collectBatchStrategyGroupsForTest exposes entry and exit arrays', () => {
    assert.ok(collectBatchStrategyGroupsForTest, 'helper should be exported');
    const groups = collectBatchStrategyGroupsForTest(sampleStrategies);
    assert.ok(Array.isArray(groups.entry), 'entry should be an array');
    assert.ok(Array.isArray(groups.exit), 'exit should be an array');
    assert.ok(Array.isArray(groups.shortEntry), 'shortEntry should be an array');
    assert.ok(Array.isArray(groups.shortExit), 'shortExit should be an array');
});

runTest('entry group includes long strategies and excludes exit-only ones', () => {
    const groups = collectBatchStrategyGroupsForTest(sampleStrategies);
    assert.ok(groups.entry.includes('ma_cross'));
    assert.ok(groups.entry.includes('volume_spike'));
    assert.ok(!groups.entry.includes('ma_cross_exit'));
    assert.ok(!groups.entry.includes('trailing_stop'));
});

runTest('exit group covers death cross exits and manual-only exits', () => {
    const groups = collectBatchStrategyGroupsForTest(sampleStrategies);
    assert.ok(groups.exit.includes('ma_cross_exit'));
    assert.ok(groups.exit.includes('macd_cross_exit'));
    assert.ok(groups.exit.includes('ma_below'));
    assert.ok(groups.exit.includes('trailing_stop'));
    assert.ok(!groups.exit.includes('volume_spike'));
});

runTest('short groups classify short and cover strategies', () => {
    const groups = collectBatchStrategyGroupsForTest(sampleStrategies);
    assert.ok(groups.shortEntry.includes('short_ma_cross'));
    assert.ok(groups.shortEntry.includes('short_turtle_stop_loss'));
    assert.ok(groups.shortExit.includes('cover_ma_cross'));
    assert.ok(groups.shortExit.includes('cover_trailing_stop'));
});

runTest('groups do not contain duplicates', () => {
    const groups = collectBatchStrategyGroupsForTest(sampleStrategies);
    const exitSet = new Set(groups.exit);
    assert.strictEqual(exitSet.size, groups.exit.length);
    const entrySet = new Set(groups.entry);
    assert.strictEqual(entrySet.size, groups.entry.length);
});

if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
}
