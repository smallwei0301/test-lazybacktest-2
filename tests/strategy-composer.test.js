const assert = require('assert');
const StrategyComposer = require('../js/lib/strategy-composer.js');

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

function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

const fakeContract = {
    ensureRuleResult(result) {
        if (!isPlainObject(result)) {
            throw new TypeError('RuleResult must be an object');
        }
        return {
            enter: result.enter === true,
            exit: result.exit === true,
            short: result.short === true,
            cover: result.cover === true,
            stopLossPercent: Number.isFinite(result.stopLossPercent) ? Number(result.stopLossPercent) : null,
            takeProfitPercent: Number.isFinite(result.takeProfitPercent) ? Number(result.takeProfitPercent) : null,
            meta: isPlainObject(result.meta) ? JSON.parse(JSON.stringify(result.meta)) : {},
        };
    },
};

const baseSeries = {
    close: [100, 101, 102],
    open: [99, 100, 101],
    high: [101, 102, 103],
    low: [98, 99, 100],
    volume: [1000, 1200, 1500],
    date: ['2024-01-01', '2024-01-02', '2024-01-03'],
};

function createFakeRegistry() {
    const pluginData = {
        alpha: {
            label: 'Alpha',
            results: [
                { enter: true, meta: { indicatorValues: { alpha: [1, 2, 3] } } },
                { enter: true, meta: { indicatorValues: { alpha: [3, 4, 5] } } },
                { enter: false },
            ],
        },
        beta: {
            label: 'Beta',
            results: [{ enter: true }, { enter: false }, { enter: true }],
        },
        stop: {
            label: 'StopLoss',
            results: [
                { enter: true, stopLossPercent: 5 },
                { enter: false, stopLossPercent: null },
                { enter: true, stopLossPercent: 3 },
            ],
        },
        invert: {
            label: 'Invert',
            results: [{ enter: false }, { enter: true }, { enter: false }],
        },
        defaults: {
            label: 'Defaults',
            schema: {
                type: 'object',
                properties: {
                    threshold: { type: 'number', minimum: 0, maximum: 100, default: 25 },
                },
                additionalProperties: true,
            },
            results: [
                (context, params) => ({
                    enter: params.threshold >= 25,
                    meta: { threshold: params.threshold },
                }),
                (context, params) => ({
                    enter: params.threshold >= 25,
                    meta: { threshold: params.threshold },
                }),
            ],
        },
        runtime: {
            label: 'Runtime',
            results: [
                (context, params) => ({
                    enter: Boolean(params && params.__runtime && params.__runtime.stage === context.index),
                    meta: { stage: params && params.__runtime ? params.__runtime.stage : null },
                }),
            ],
        },
    };

    const runLog = {};

    function buildPlugin(strategyId) {
        const data = pluginData[strategyId];
        if (!data) {
            return null;
        }
        const meta = {
            id: strategyId,
            label: data.label || strategyId,
            paramsSchema: data.schema,
        };
        return {
            meta,
            run(context, params) {
                runLog[strategyId] = runLog[strategyId] || [];
                runLog[strategyId].push({ index: context.index, params });
                const source = data.results[context.index] ?? data.results[data.results.length - 1];
                if (typeof source === 'function') {
                    return source(context, params);
                }
                return isPlainObject(source) ? JSON.parse(JSON.stringify(source)) : {};
            },
        };
    }

    return {
        getStrategyById(id) {
            return buildPlugin(id);
        },
        ensureStrategyLoaded(id) {
            return buildPlugin(id);
        },
        getStrategyMetaById(id) {
            const data = pluginData[id];
            if (!data) {
                return null;
            }
            return {
                id,
                label: data.label || id,
                paramsSchema: data.schema,
            };
        },
        __log: runLog,
    };
}

function buildOptions(overrides = {}) {
    return {
        role: 'longEntry',
        contract: fakeContract,
        series: baseSeries,
        runtime: { warmupStartIndex: 0, effectiveStartIndex: 0, length: baseSeries.close.length },
        cacheStore: new Map(),
        indicators: {},
        ...overrides,
    };
}

runTest('AND 組合需所有子規則成立才觸發', () => {
    const registry = createFakeRegistry();
    const evaluator = StrategyComposer.buildComposite(
        { op: 'AND', rules: [{ op: 'PLUGIN', strategy: 'alpha' }, { op: 'PLUGIN', strategy: 'beta' }] },
        registry,
        buildOptions(),
    );
    const first = evaluator(0);
    assert.strictEqual(first.enter, true);
    assert.deepStrictEqual(first.meta.__composite__.states, [true, true]);
    const second = evaluator(1);
    assert.strictEqual(second.enter, false);
    assert.deepStrictEqual(second.meta.__composite__.states, [true, false]);
});

runTest('OR 組合會沿用第一個觸發規則的停損設定', () => {
    const registry = createFakeRegistry();
    const evaluator = StrategyComposer.buildComposite(
        { op: 'OR', rules: [{ op: 'PLUGIN', strategy: 'stop' }, { op: 'PLUGIN', strategy: 'alpha' }] },
        registry,
        buildOptions(),
    );
    const first = evaluator(0);
    assert.strictEqual(first.enter, true);
    assert.strictEqual(first.stopLossPercent, 5);
    const second = evaluator(1);
    assert.strictEqual(second.enter, true);
    assert.strictEqual(second.stopLossPercent, null);
});

runTest('NOT 組合反轉子規則結果', () => {
    const registry = createFakeRegistry();
    const evaluator = StrategyComposer.buildComposite(
        { op: 'NOT', rule: { op: 'PLUGIN', strategy: 'invert' } },
        registry,
        buildOptions(),
    );
    const first = evaluator(0);
    assert.strictEqual(first.enter, true);
    const second = evaluator(1);
    assert.strictEqual(second.enter, false);
});

runTest('套用參數預設值並遵守 schema 範圍', () => {
    const registry = createFakeRegistry();
    const evaluator = StrategyComposer.buildComposite(
        { op: 'PLUGIN', strategy: 'defaults' },
        registry,
        buildOptions(),
    );
    const result = evaluator(0);
    assert.strictEqual(result.meta.threshold, 25);
    const firstLog = registry.__log.defaults[0];
    assert.strictEqual(firstLog.params.threshold, 25);

    const evaluatorWithOverrides = StrategyComposer.buildComposite(
        { op: 'PLUGIN', strategy: 'defaults', params: { threshold: 200 } },
        registry,
        buildOptions(),
    );
    evaluatorWithOverrides(0);
    const secondLog = registry.__log.defaults[1];
    assert.strictEqual(secondLog.params.threshold, 100);
});

runTest('傳入 runtime 附加資訊會寫入 __runtime', () => {
    const registry = createFakeRegistry();
    const evaluator = StrategyComposer.buildComposite(
        { op: 'PLUGIN', strategy: 'runtime' },
        registry,
        buildOptions(),
    );
    const result = evaluator(0, { stage: 0 });
    assert.strictEqual(result.enter, true);
    const logEntry = registry.__log.runtime[0];
    assert.deepStrictEqual(logEntry.params.__runtime, { stage: 0 });
});

if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
}
