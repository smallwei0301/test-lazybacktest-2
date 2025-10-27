// Patch Tag: LB-STRATEGY-COMPOSER-20250721A
const assert = require('assert');
const { buildComposite } = require('../js/strategy-composer.js');

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

function createRegistry(metaMap) {
    return {
        getStrategyMetaById(id) {
            return metaMap[id] || null;
        },
    };
}

const registry = createRegistry({
    alpha: {
        id: 'alpha',
        label: 'Alpha',
        paramsSchema: {
            type: 'object',
            properties: {
                threshold: { type: 'number', default: 30 },
            },
        },
    },
    beta: {
        id: 'beta',
        label: 'Beta',
        paramsSchema: {
            type: 'object',
            properties: {},
        },
    },
    gamma: {
        id: 'gamma',
        label: 'Gamma',
        paramsSchema: {
            type: 'object',
            properties: {},
        },
    },
    trail: {
        id: 'trail',
        label: 'Trail',
        paramsSchema: {
            type: 'object',
            properties: {
                percentage: { type: 'number', default: 5 },
            },
        },
    },
});

runTest('buildComposite applies schema defaults for plugin parameters', () => {
    const calls = [];
    const composite = buildComposite({ plugin: 'alpha' }, { registry });
    const result = composite({
        role: 'longEntry',
        index: 5,
        runtime: {},
        callPlugin(pluginId, params) {
            calls.push({ pluginId, params });
            return { enter: true, exit: false, short: false, cover: false, stopLossPercent: null, takeProfitPercent: null, meta: {} };
        },
    });
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].pluginId, 'alpha');
    assert.strictEqual(calls[0].params.threshold, 30);
    assert.strictEqual(result.enter, true);
    assert.strictEqual(result.exit, false);
});

runTest('AND combination aggregates signals and propagates metadata', () => {
    const composite = buildComposite({
        op: 'AND',
        rules: [
            { plugin: 'alpha' },
            { plugin: 'beta' },
        ],
    }, { registry });
    const metaBag = [];
    const result = composite({
        role: 'longEntry',
        index: 3,
        runtime: {},
        callPlugin(pluginId) {
            metaBag.push(pluginId);
            if (pluginId === 'alpha') {
                return { enter: true, exit: false, short: false, cover: false, meta: { indicatorValues: { RSI: [20, 35, 40] } } };
            }
            return { enter: true, exit: false, short: false, cover: false, meta: { indicatorValues: { KD: [25, 40, 45] } } };
        },
    });
    assert.deepStrictEqual(metaBag, ['alpha', 'beta']);
    assert.strictEqual(result.enter, true);
    assert.strictEqual(result.meta.operator, 'AND');
    assert.strictEqual(Array.isArray(result.meta.children), true);
    assert.strictEqual(result.meta.children.length, 2);
});

runTest('OR combination keeps stop loss from triggered child', () => {
    const composite = buildComposite({
        op: 'OR',
        rules: [
            { plugin: 'beta' },
            { plugin: 'gamma' },
        ],
    }, { registry });
    const result = composite({
        role: 'longEntry',
        index: 1,
        runtime: {},
        callPlugin(pluginId) {
            if (pluginId === 'beta') {
                return { enter: false, exit: false, short: false, cover: false, meta: {} };
            }
            return { enter: true, exit: false, short: false, cover: false, stopLossPercent: 6, meta: {} };
        },
    });
    assert.strictEqual(result.enter, true);
    assert.strictEqual(result.stopLossPercent, 6);
});

runTest('NOT operator inverts the signal', () => {
    const composite = buildComposite({ op: 'NOT', rule: { plugin: 'alpha' } }, { registry });
    const result = composite({
        role: 'longEntry',
        index: 0,
        runtime: {},
        callPlugin() {
            return { enter: true, exit: false, short: false, cover: false, meta: {} };
        },
    });
    assert.strictEqual(result.enter, false);
    assert.strictEqual(result.exit, true);
});

runTest('runtime mapping passes extras to plugin call', () => {
    const composite = buildComposite({
        plugin: 'trail',
        runtime: { currentPrice: 'price', referencePrice: 'peak' },
    }, { registry });
    const extrasBag = [];
    composite({
        role: 'longExit',
        index: 2,
        runtime: { price: 100, peak: 110 },
        callPlugin(pluginId, params, extras) {
            extrasBag.push({ pluginId, params, extras });
            return { enter: false, exit: true, short: false, cover: false, meta: {} };
        },
    });
    assert.strictEqual(extrasBag.length, 1);
    assert.deepStrictEqual(extrasBag[0].extras, { currentPrice: 100, referencePrice: 110 });
    assert.strictEqual(extrasBag[0].params.percentage, 5);
});

runTest('nested operators preserve boolean logic and meta tree', () => {
    const composite = buildComposite({
        op: 'AND',
        rules: [
            { plugin: 'alpha', params: { threshold: 25 } },
            {
                op: 'NOT',
                rule: {
                    op: 'OR',
                    rules: [
                        { plugin: 'beta' },
                        { plugin: 'gamma' },
                    ],
                },
            },
        ],
    }, { registry });
    const result = composite({
        role: 'longEntry',
        index: 11,
        runtime: {},
        callPlugin(pluginId) {
            if (pluginId === 'alpha') {
                return { enter: true, exit: false, short: false, cover: false, meta: { source: 'RSI' } };
            }
            if (pluginId === 'beta') {
                return { enter: false, exit: false, short: false, cover: false, meta: { source: 'KD' } };
            }
            return { enter: true, exit: false, short: false, cover: false, meta: { source: 'MACD' } };
        },
    });
    assert.strictEqual(result.enter, false);
    assert.strictEqual(result.exit, false);
    assert.strictEqual(result.meta.operator, 'AND');
    assert.strictEqual(result.meta.children.length, 2);
    const notBranch = result.meta.children[1];
    assert.ok(notBranch);
    assert.strictEqual(notBranch.operator, 'NOT');
    assert.ok(notBranch.child);
    assert.strictEqual(notBranch.child.operator, 'OR');
    assert.strictEqual(Array.isArray(notBranch.child.children), true);
    assert.strictEqual(notBranch.child.children.length, 2);
});

runTest('operator nodes require at least one child rule', () => {
    assert.throws(() => {
        buildComposite({ op: 'AND', rules: [] }, { registry });
    }, /rules 至少需要一個子節點/);
});

runTest('plugin nodes must provide non-empty plugin id', () => {
    assert.throws(() => {
        buildComposite({ plugin: '' }, { registry });
    }, /plugin 必須為非空字串/);
});

if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
}
