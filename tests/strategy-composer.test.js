const assert = require('assert');
const { buildComposite } = require('../js/strategies/composer.js');

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

function createRegistry(resolvers) {
    return {
        runStrategy(strategyId, context, params) {
            if (!resolvers[strategyId]) {
                throw new Error(`未知策略 ${strategyId}`);
            }
            return resolvers[strategyId](context, params || {});
        },
    };
}

runTest('AND 組合需同時滿足並保留第一個停損參數', () => {
    const registry = createRegistry({
        alpha: (ctx, params) => ({
            enter: params.flag === true,
            stopLossPercent: params.stopLoss,
            meta: { id: 'alpha', ctx },
        }),
        beta: () => ({
            enter: true,
            takeProfitPercent: 12,
            meta: { id: 'beta' },
        }),
    });

    const node = {
        kind: 'AND',
        children: [
            { kind: 'plugin', id: 'alpha', params: { flag: true, stopLoss: 7 } },
            { kind: 'plugin', id: 'beta', params: {} },
        ],
    };

    const evaluator = buildComposite(node, registry);
    const result = evaluator({ role: 'longEntry', index: 0 }, {
        baseParams: { flag: false, ignored: 1 },
        extras: { note: 'test' },
    });

    assert.strictEqual(result.enter, true);
    assert.strictEqual(result.stopLossPercent, 7);
    assert.strictEqual(result.takeProfitPercent, 12);
    assert.strictEqual(result.meta.operator, 'AND');
    assert.strictEqual(Array.isArray(result.meta.children), true);
    assert.strictEqual(result.meta.children.length, 2);
});

runTest('OR 組合採用第一個成功策略的停損與停利', () => {
    const registry = createRegistry({
        gamma: () => ({ enter: false }),
        delta: () => ({ enter: true, stopLossPercent: 5, takeProfitPercent: 9 }),
    });

    const node = {
        kind: 'OR',
        children: [
            { kind: 'plugin', id: 'gamma', params: {} },
            { kind: 'plugin', id: 'delta', params: {} },
        ],
    };

    const evaluator = buildComposite(node, registry);
    const result = evaluator({ role: 'longEntry', index: 1 }, {});

    assert.strictEqual(result.enter, true);
    assert.strictEqual(result.stopLossPercent, 5);
    assert.strictEqual(result.takeProfitPercent, 9);
    assert.strictEqual(result.meta.operator, 'OR');
});

runTest('NOT 運算會反轉子節點結果並清除停損', () => {
    const registry = createRegistry({
        epsilon: () => ({ enter: true, stopLossPercent: 4 }),
    });

    const node = {
        kind: 'NOT',
        child: { kind: 'plugin', id: 'epsilon', params: {} },
    };

    const evaluator = buildComposite(node, registry);
    const result = evaluator({ role: 'longEntry', index: 2 }, {});

    assert.strictEqual(result.enter, false);
    assert.strictEqual(result.stopLossPercent, null);
    assert.strictEqual(result.meta.operator, 'NOT');
});

runTest('空頭回補節點可產出 cover 訊號', () => {
    const registry = createRegistry({
        cover_rule: (ctx) => ({
            cover: ctx.role === 'shortExit',
            meta: { idx: ctx.index },
        }),
    });

    const node = { kind: 'plugin', id: 'cover_rule', params: {} };
    const evaluator = buildComposite(node, registry);
    const result = evaluator({ role: 'shortExit', index: 5 }, {});

    assert.strictEqual(result.cover, true);
    assert.strictEqual(result.enter, false);
    assert.strictEqual(result.meta.idx, 5);
});

runTest('巢狀 AND 與 NOT 組合會產生正確布林值', () => {
    const registry = createRegistry({
        one: () => ({ enter: true }),
        two: () => ({ enter: true }),
    });

    const node = {
        kind: 'AND',
        children: [
            { kind: 'plugin', id: 'one', params: {} },
            {
                kind: 'NOT',
                child: { kind: 'plugin', id: 'two', params: {} },
            },
        ],
    };

    const evaluator = buildComposite(node, registry);
    const result = evaluator({ role: 'longEntry', index: 3 }, {});

    assert.strictEqual(result.enter, false);
    assert.strictEqual(result.meta.operator, 'AND');
});

if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
}
