const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadScript(relativePath) {
    const absolutePath = path.join(__dirname, '..', relativePath);
    const code = fs.readFileSync(absolutePath, 'utf8');
    vm.runInThisContext(code, { filename: relativePath });
}

loadScript('js/strategy-plugin-contract.js');
loadScript('js/strategy-plugin-registry.js');
loadScript('js/strategy-composer.js');

const { createLegacyStrategyPlugin } = global.StrategyPluginContract;
const registry = global.StrategyPluginRegistry;
const composer = global.StrategyComposer;

function registerTestPlugin(config) {
    const plugin = createLegacyStrategyPlugin(
        {
            id: config.id,
            label: config.label,
            paramsSchema: config.paramsSchema,
        },
        config.run,
    );
    registry.registerStrategy(plugin);
}

registerTestPlugin({
    id: 'dsl_test_even',
    label: 'DSL 測試（偶數）',
    run(context) {
        const triggered = context.index % 2 === 0;
        return { enter: triggered, exit: false, short: false, cover: false, meta: { note: 'even' } };
    },
});

registerTestPlugin({
    id: 'dsl_test_threshold',
    label: 'DSL 測試（閾值）',
    paramsSchema: {
        type: 'object',
        properties: { threshold: { type: 'integer', minimum: 0, maximum: 100, default: 3 } },
        additionalProperties: true,
    },
    run(context, params) {
        const triggered = context.index >= Number(params.threshold || 0);
        return {
            enter: triggered,
            exit: false,
            short: false,
            cover: false,
            meta: { thresholdUsed: params.threshold },
        };
    },
});

registerTestPlugin({
    id: 'dsl_test_stoploss',
    label: 'DSL 測試（停損）',
    run() {
        return {
            enter: false,
            exit: true,
            short: false,
            cover: false,
            stopLossPercent: 7,
            meta: { source: 'stoploss' },
        };
    },
});

registerTestPlugin({
    id: 'dsl_test_never',
    label: 'DSL 測試（永遠 false）',
    run() {
        return { enter: false, exit: false, short: false, cover: false, meta: { source: 'never' } };
    },
});

registerTestPlugin({
    id: 'dsl_test_even_short',
    label: 'DSL 測試（偶數空單）',
    run(context) {
        return { enter: false, exit: false, short: context.index % 2 === 0, cover: false, meta: { parity: context.index % 2 } };
    },
});

registerTestPlugin({
    id: 'dsl_test_runtime',
    label: 'DSL 測試（runtime）',
    paramsSchema: {
        type: 'object',
        properties: {},
        additionalProperties: true,
    },
    run(context, params) {
        const flag = params && params.__runtime && params.__runtime.flag;
        return { enter: false, exit: Boolean(flag), short: false, cover: false, meta: { runtimeFlag: Boolean(flag) } };
    },
});

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

function buildContext(index, extras) {
    return {
        index,
        series: { close: [], open: [], high: [], low: [], date: [] },
        helpers: {
            getIndicator() {
                return undefined;
            },
            log() {},
        },
        runtime: { warmupStartIndex: 0, effectiveStartIndex: 0, length: 100 },
        composerRuntime: extras || {},
    };
}

runTest('AND 組合需同時觸發', () => {
    const dsl = {
        op: 'AND',
        rules: [{ pluginId: 'dsl_test_even' }, { pluginId: 'dsl_test_threshold', params: {} }],
    };
    const evaluate = composer.buildComposite(dsl, registry, { role: 'longEntry' });
    const passResult = evaluate(buildContext(6));
    assert.strictEqual(passResult.enter, true);
    assert.strictEqual(passResult.meta.composer.op, 'AND');
    assert.strictEqual(passResult.meta.thresholdUsed, 3);
    const failResult = evaluate(buildContext(1));
    assert.strictEqual(failResult.enter, false);
    assert.strictEqual(failResult.meta.composer.op, 'AND');
});

runTest('OR 組合沿用觸發源 stopLoss', () => {
    const dsl = {
        op: 'OR',
        rules: [{ pluginId: 'dsl_test_stoploss' }, { pluginId: 'dsl_test_never' }],
    };
    const evaluate = composer.buildComposite(dsl, registry, { role: 'longExit' });
    const result = evaluate(buildContext(0));
    assert.strictEqual(result.exit, true);
    assert.strictEqual(result.stopLossPercent, 7);
    assert.strictEqual(result.meta.source, 'stoploss');
    assert.strictEqual(Array.isArray(result.meta.composer.evaluated), true);
});

runTest('NOT 反轉子規則', () => {
    const dsl = { op: 'NOT', rule: { pluginId: 'dsl_test_even_short' } };
    const evaluate = composer.buildComposite(dsl, registry, { role: 'shortEntry' });
    const oddResult = evaluate(buildContext(3));
    assert.strictEqual(oddResult.short, true);
    const evenResult = evaluate(buildContext(4));
    assert.strictEqual(evenResult.short, false);
});

runTest('Runtime extras 會傳入 __runtime', () => {
    const dsl = { pluginId: 'dsl_test_runtime' };
    const evaluate = composer.buildComposite(dsl, registry, { role: 'longExit' });
    const result = evaluate(buildContext(1, { dsl_test_runtime: { flag: true } }));
    assert.strictEqual(result.exit, true);
    assert.strictEqual(result.meta.runtimeFlag, true);
});

runTest('containsPlugin 能夠偵測嵌套規則', () => {
    const complexDsl = {
        op: 'AND',
        rules: [
            { pluginId: 'dsl_test_never' },
            { op: 'OR', rules: [{ pluginId: 'dsl_test_runtime' }, { op: 'NOT', rule: { pluginId: 'dsl_test_even' } }] },
        ],
    };
    assert.strictEqual(composer.containsPlugin(complexDsl, 'dsl_test_runtime'), true);
    assert.strictEqual(composer.containsPlugin(complexDsl, 'unknown_plugin'), false);
});

if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
}
