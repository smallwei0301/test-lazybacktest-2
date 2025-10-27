const assert = require('assert');
require('../js/strategy-plugin-contract.js');
const StrategyDSL = require('../js/lib/strategy-dsl.js');

function createRegistry() {
    const schemas = {
        alpha: {
            type: 'object',
            properties: {
                threshold: { type: 'number', default: 15 },
            },
            additionalProperties: false,
        },
        beta: {
            type: 'object',
            properties: {
                window: { type: 'integer', default: 5 },
            },
            additionalProperties: false,
        },
        gamma: {
            type: 'object',
            properties: {
                percentage: { type: 'number', default: 3 },
            },
            additionalProperties: false,
        },
    };
    return {
        getStrategyMetaById(id) {
            const schema = schemas[id];
            if (!schema) {
                throw new Error(`Unknown strategy ${id}`);
            }
            return { id, label: id, paramsSchema: schema };
        },
    };
}

function createExecutor(expectations) {
    const calls = [];
    return {
        calls,
        run(strategyId, role, index, params, extras) {
            calls.push({ strategyId, role, index, params, extras });
            if (!expectations[strategyId]) {
                return { enter: false, exit: false, short: false, cover: false };
            }
            return expectations[strategyId];
        },
    };
}

(function testAndCombination() {
    const registry = createRegistry();
    const dsl = {
        op: 'AND',
        rules: [
            { ref: 'alpha', params: { threshold: 12 } },
            { ref: 'beta', params: { window: 7 } },
        ],
    };
    const evaluator = StrategyDSL.buildComposite(dsl, registry);
    const executor = createExecutor({
        alpha: { enter: true, meta: { indicatorValues: { foo: [1, 2, 3] } } },
        beta: { enter: false },
    });
    const result = evaluator({
        role: 'longEntry',
        index: 10,
        runtimeExtras: { seed: 1 },
        runStrategy: executor.run.bind(executor),
    });

    assert.strictEqual(result.enter, false, 'AND 組合應該回傳 false');
    assert.strictEqual(result.exit, false);
    assert.deepStrictEqual(executor.calls.length, 2, '應該呼叫兩個葉節點');
    assert.deepStrictEqual(executor.calls[0].params.threshold, 12);
    assert.strictEqual(Array.isArray(evaluator.usedStrategyIds), true);
    assert.strictEqual(evaluator.usedStrategyIds.includes('alpha'), true);
    assert.strictEqual(evaluator.usedStrategyIds.includes('beta'), true);
})();

(function testOrCombinationMeta() {
    const registry = createRegistry();
    const dsl = {
        op: 'OR',
        rules: [
            { ref: 'alpha', params: { threshold: 25 } },
            { ref: 'beta', params: { window: 9 } },
        ],
    };
    const evaluator = StrategyDSL.buildComposite(dsl, registry);
    const executor = createExecutor({
        alpha: { exit: false },
        beta: { exit: true, meta: { indicatorValues: { bar: [3, 2, 1] } } },
    });
    const result = evaluator({
        role: 'longExit',
        index: 5,
        runStrategy: executor.run.bind(executor),
    });

    assert.strictEqual(result.exit, true, 'OR 組合應該回傳 true');
    assert.deepStrictEqual(result.meta && result.meta.indicatorValues && result.meta.indicatorValues.bar, [3, 2, 1]);
})();

(function testNotCombination() {
    const registry = createRegistry();
    const dsl = { op: 'NOT', rules: [{ ref: 'alpha' }] };
    const evaluator = StrategyDSL.buildComposite(dsl, registry);
    const executor = createExecutor({ alpha: { cover: true } });
    const result = evaluator({
        role: 'shortExit',
        index: 1,
        runStrategy: executor.run.bind(executor),
    });
    assert.strictEqual(result.cover, false, 'NOT 應該反轉結果');
})();

(function testStopLossPropagation() {
    const registry = createRegistry();
    const dsl = {
        op: 'OR',
        rules: [
            { ref: 'gamma', params: { percentage: 4 } },
            { ref: 'alpha', params: { threshold: 18 } },
        ],
    };
    const evaluator = StrategyDSL.buildComposite(dsl, registry);
    const executor = createExecutor({
        gamma: { exit: true, stopLossPercent: 4 },
        alpha: { exit: false },
    });
    const result = evaluator({
        role: 'longExit',
        index: 3,
        runStrategy: executor.run.bind(executor),
    });
    assert.strictEqual(result.stopLossPercent, 4, '應該保留停損百分比');
})();

(function testSchemaDefaults() {
    const registry = createRegistry();
    const evaluator = StrategyDSL.buildComposite({ ref: 'alpha' }, registry);
    const params = evaluator.getParamsForStrategy('alpha');
    assert.strictEqual(params.threshold, 15, '應帶入 schema 預設值');
})();

console.log('strategy-dsl.test.js passed');
