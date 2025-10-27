const assert = require('assert');
require('../js/strategy-plugin-contract.js');
const { buildComposite } = require('../js/strategies/composer.js');

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

const pluginMap = new Map();

const registry = {
    getStrategyById(id) {
        return pluginMap.get(id) || null;
    },
    ensureStrategyLoaded(id) {
        return pluginMap.get(id) || null;
    },
};

function registerPlugin(id, evaluator) {
    pluginMap.set(id, {
        meta: { id, label: id },
        run: evaluator,
    });
}

registerPlugin('trend', (context) => ({
    enter: context.index % 2 === 0,
    meta: { source: 'trend', index: context.index },
}));

registerPlugin('volume', (context) => ({
    enter: context.index % 3 === 0,
    meta: { source: 'volume' },
}));

registerPlugin('riskStop', (context) => ({
    enter: context.index % 2 === 0,
    stopLossPercent: 5,
    meta: { risk: 'fixed-5' },
}));

function createContext(index, role) {
    const base = {
        role,
        index,
        series: { close: [], open: [], high: [], low: [], volume: [], date: [] },
        runtime: { warmupStartIndex: 0, effectiveStartIndex: 0, length: 0 },
    };
    return {
        ...base,
        invokePlugin(strategyId, roleOverride, params) {
            const plugin = registry.ensureStrategyLoaded(strategyId);
            if (!plugin || typeof plugin.run !== 'function') {
                throw new Error(`插件 ${strategyId} 未註冊`);
            }
            const context = {
                ...base,
                role: roleOverride || role,
                index,
                helpers: {
                    getIndicator: () => undefined,
                    log: () => undefined,
                    setCache: () => undefined,
                    getCache: () => undefined,
                },
            };
            const result = plugin.run(context, params || {});
            return result;
        },
    };
}

runTest('AND 與 NOT 可正確組合策略', () => {
    const dsl = {
        type: 'AND',
        nodes: [
            { type: 'plugin', id: 'trend' },
            { type: 'NOT', node: { type: 'plugin', id: 'volume' } },
        ],
    };
    const evaluator = buildComposite(dsl, registry);
    const resultA = evaluator(createContext(4, 'longEntry'));
    assert.strictEqual(resultA.enter, true, 'index 4 應觸發進場');
    const resultB = evaluator(createContext(6, 'longEntry'));
    assert.strictEqual(resultB.enter, false, 'index 6 不應觸發進場');
});

runTest('OR 組合會在任一策略成立時觸發', () => {
    const dsl = {
        type: 'OR',
        nodes: [
            { type: 'plugin', id: 'volume' },
            { type: 'plugin', id: 'trend' },
        ],
    };
    const evaluator = buildComposite(dsl, registry);
    const resultA = evaluator(createContext(3, 'longEntry'));
    assert.strictEqual(resultA.enter, true, 'index 3 應因 volume 成立');
    const resultB = evaluator(createContext(5, 'longEntry'));
    assert.strictEqual(resultB.enter, false, 'index 5 應為未觸發狀態');
});

runTest('停損資訊會在組合節點中保留', () => {
    const dsl = {
        type: 'AND',
        nodes: [
            { type: 'plugin', id: 'riskStop' },
            { type: 'plugin', id: 'trend' },
        ],
    };
    const evaluator = buildComposite(dsl, registry);
    const result = evaluator(createContext(2, 'longEntry'));
    assert.strictEqual(result.enter, true, 'index 2 應觸發進場');
    assert.strictEqual(result.stopLossPercent, 5, '停損應沿用 riskStop 的值');
    assert.strictEqual(result.meta && result.meta.risk, 'fixed-5');
});

if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
}
