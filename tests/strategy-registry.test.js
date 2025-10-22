// Patch Tag: LB-STRATEGY-VERIFIER-20250730A
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const projectRoot = path.join(__dirname, '..');
const mainSource = fs.readFileSync(path.join(projectRoot, 'js', 'main.js'), 'utf8');

function extractSnippet(source, constName, closingPattern) {
    const startToken = `const ${constName}`;
    const startIndex = source.indexOf(startToken);
    if (startIndex === -1) {
        throw new Error(`Unable to locate declaration for ${constName}`);
    }
    const fromStart = source.slice(startIndex);
    const closingIndex = fromStart.indexOf(closingPattern);
    if (closingIndex === -1) {
        throw new Error(`Unable to locate closing pattern for ${constName}`);
    }
    return `${fromStart.slice(0, closingIndex + closingPattern.length)}\n`;
}

const scriptContent = [
    extractSnippet(mainSource, 'STRATEGY_REGISTRY_EXPECTATIONS', '})();'),
    extractSnippet(mainSource, 'STRATEGY_REGISTRY_ENTRY_POOL', ']);'),
    extractSnippet(mainSource, 'STRATEGY_REGISTRY_EXIT_POOL', ']);'),
    extractSnippet(mainSource, 'STRATEGY_REGISTRY_SHORT_ENTRY_POOL', ']);'),
    extractSnippet(mainSource, 'STRATEGY_REGISTRY_SHORT_EXIT_POOL', ']);'),
].join('\n');

const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(scriptContent, sandbox);

const expectations = vm.runInContext('STRATEGY_REGISTRY_EXPECTATIONS', sandbox);
const entryPool = vm.runInContext('STRATEGY_REGISTRY_ENTRY_POOL', sandbox);
const exitPool = vm.runInContext('STRATEGY_REGISTRY_EXIT_POOL', sandbox);
const shortEntryPool = vm.runInContext('STRATEGY_REGISTRY_SHORT_ENTRY_POOL', sandbox);
const shortExitPool = vm.runInContext('STRATEGY_REGISTRY_SHORT_EXIT_POOL', sandbox);

const expectedExpectations = [
    { key: 'bollinger_breakout', label: '布林通道突破', pluginId: 'bollinger_breakout' },
    { key: 'bollinger_reversal', label: '布林通道反轉', pluginId: 'bollinger_reversal' },
    { key: 'cover_bollinger_breakout', label: '布林通道突破 (回補)', pluginId: 'cover_bollinger_breakout' },
    { key: 'cover_k_d_cross', label: 'KD黃金交叉 (D<X) (回補)', pluginId: 'cover_k_d_cross' },
    { key: 'cover_ma_above', label: '價格突破均線 (回補)', pluginId: 'cover_ma_above' },
    { key: 'cover_ma_cross', label: '均線黃金交叉 (回補)', pluginId: 'cover_ma_cross' },
    { key: 'macd_cross', label: 'MACD黃金交叉 (DI版)', pluginId: 'macd_cross' },
    { key: 'macd_cross_exit', label: 'MACD死亡交叉 (DI版)', pluginId: 'macd_cross' },
    { key: 'cover_macd_cross', label: 'MACD黃金交叉 (DI版) (回補)', pluginId: 'cover_macd_cross' },
    { key: 'cover_rsi_oversold', label: 'RSI超賣 (回補)', pluginId: 'cover_rsi_oversold' },
    { key: 'cover_price_breakout', label: '價格突破前高 (回補)', pluginId: 'cover_price_breakout' },
    { key: 'cover_trailing_stop', label: '移動停損 (%) (空單停損)', pluginId: 'cover_trailing_stop' },
    { key: 'cover_turtle_breakout', label: '海龜N日高 (回補)', pluginId: 'cover_turtle_breakout' },
    { key: 'cover_williams_oversold', label: '威廉指標超賣 (回補)', pluginId: 'cover_williams_oversold' },
    { key: 'k_d_cross', label: 'KD黃金交叉 (D<X)', pluginId: 'k_d_cross' },
    { key: 'k_d_cross_exit', label: 'KD死亡交叉 (D>Y)', pluginId: 'k_d_cross' },
    { key: 'ma_above', label: '價格突破均線', pluginId: 'ma_above' },
    { key: 'ma_below', label: '價格跌破均線', pluginId: 'ma_below' },
    { key: 'ma_cross', label: '均線黃金交叉', pluginId: 'ma_cross' },
    { key: 'ma_cross_exit', label: '均線死亡交叉', pluginId: 'ma_cross' },
    { key: 'price_breakdown', label: '價格跌破前低', pluginId: 'price_breakdown' },
    { key: 'price_breakout', label: '價格突破前高', pluginId: 'price_breakout' },
    { key: 'rsi_overbought', label: 'RSI超買', pluginId: 'rsi_overbought' },
    { key: 'rsi_oversold', label: 'RSI超賣', pluginId: 'rsi_oversold' },
    { key: 'short_bollinger_reversal', label: '布林通道反轉 (做空)', pluginId: 'short_bollinger_reversal' },
    { key: 'short_k_d_cross', label: 'KD死亡交叉 (D>Y) (做空)', pluginId: 'short_k_d_cross' },
    { key: 'short_ma_below', label: '價格跌破均線 (做空)', pluginId: 'short_ma_below' },
    { key: 'short_ma_cross', label: '均線死亡交叉 (做空)', pluginId: 'short_ma_cross' },
    { key: 'short_macd_cross', label: 'MACD死亡交叉 (DI版) (做空)', pluginId: 'short_macd_cross' },
    { key: 'short_price_breakdown', label: '價格跌破前低 (做空)', pluginId: 'short_price_breakdown' },
    { key: 'short_rsi_overbought', label: 'RSI超買 (做空)', pluginId: 'short_rsi_overbought' },
    { key: 'short_turtle_stop_loss', label: '海龜N日低 (做空)', pluginId: 'short_turtle_stop_loss' },
    { key: 'short_williams_overbought', label: '威廉指標超買 (做空)', pluginId: 'short_williams_overbought' },
    { key: 'trailing_stop', label: '移動停損 (%)', pluginId: 'trailing_stop' },
    { key: 'turtle_breakout', label: '海龜突破 (僅進場)', pluginId: 'turtle_breakout' },
    { key: 'turtle_stop_loss', label: '海龜停損 (N日低)', pluginId: 'turtle_stop_loss' },
    { key: 'volume_spike', label: '成交量暴增', pluginId: 'volume_spike' },
    { key: 'williams_overbought', label: '威廉指標超買', pluginId: 'williams_overbought' },
    { key: 'williams_oversold', label: '威廉指標超賣', pluginId: 'williams_oversold' },
];

assert.strictEqual(
    expectations.length,
    expectedExpectations.length,
    `策略註冊驗證項目數量應為 ${expectedExpectations.length}`,
);

expectedExpectations.forEach((expected) => {
    const matched = expectations.some(
        (entry) =>
            entry.key === expected.key &&
            entry.pluginId === expected.pluginId &&
            entry.label === expected.label,
    );
    assert.ok(matched, `缺少策略驗證項目：${expected.label} (${expected.key})`);
});

function assertArrayContents(actual, expected, label) {
    assert.strictEqual(
        actual.length,
        expected.length,
        `${label} 組合應包含 ${expected.length} 種策略`,
    );
    expected.forEach((key) => {
        assert.ok(actual.includes(key), `${label} 組合缺少 ${key}`);
    });
}

assertArrayContents(entryPool, [
    'ma_cross',
    'ma_above',
    'rsi_oversold',
    'macd_cross',
    'bollinger_breakout',
    'k_d_cross',
    'volume_spike',
    'price_breakout',
    'williams_oversold',
    'turtle_breakout',
], '做多進場隨機池');

assertArrayContents(exitPool, [
    'ma_cross',
    'ma_below',
    'rsi_overbought',
    'macd_cross',
    'bollinger_reversal',
    'k_d_cross',
    'volume_spike',
    'price_breakdown',
    'williams_overbought',
    'turtle_stop_loss',
    'trailing_stop',
], '做多出場隨機池');

assertArrayContents(shortEntryPool, [
    'short_ma_cross',
    'short_ma_below',
    'short_rsi_overbought',
    'short_macd_cross',
    'short_bollinger_reversal',
    'short_k_d_cross',
    'short_price_breakdown',
    'short_williams_overbought',
    'short_turtle_stop_loss',
], '做空進場隨機池');

assertArrayContents(shortExitPool, [
    'cover_ma_cross',
    'cover_ma_above',
    'cover_rsi_oversold',
    'cover_macd_cross',
    'cover_bollinger_breakout',
    'cover_k_d_cross',
    'cover_price_breakout',
    'cover_williams_oversold',
    'cover_turtle_breakout',
    'cover_trailing_stop',
], '回補出場隨機池');

console.log('策略註冊驗證與抽樣回測隨機池測試通過。');
