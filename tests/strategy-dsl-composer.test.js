const assert = require('assert');
const { buildComposite } = require('../js/lib/strategy-dsl-composer.js');

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

function createRegistry() {
    const map = new Map();
    return {
        registerStrategy(plugin) {
            map.set(plugin.meta.id, plugin);
            return plugin;
        },
        getStrategyById(id) {
            return map.get(id) || null;
        },
        getStrategyMetaById(id) {
            const plugin = map.get(id);
            return plugin ? plugin.meta : null;
        },
        hasStrategy(id) {
            return map.has(id);
        },
    };
}

function createPlugin(id, label, paramsSchema, evaluator) {
    return {
        meta: {
            id,
            label,
            paramsSchema,
        },
        run: evaluator,
    };
}

const contract = {
    ensureRuleResult(raw) {
        if (!raw || typeof raw !== 'object') {
            throw new TypeError('RuleResult 必須為物件');
        }
        return {
            enter: raw.enter === true,
            exit: raw.exit === true,
            short: raw.short === true,
            cover: raw.cover === true,
            stopLossPercent: typeof raw.stopLossPercent === 'number' ? raw.stopLossPercent : null,
            takeProfitPercent: typeof raw.takeProfitPercent === 'number' ? raw.takeProfitPercent : null,
            meta: raw.meta && typeof raw.meta === 'object' ? raw.meta : {},
        };
    },
};

const registry = createRegistry();

registry.registerStrategy(
    createPlugin(
        'rsi_entry',
        'RSI 進場',
        {
            type: 'object',
            properties: {
                threshold: { type: 'number', minimum: 0, maximum: 100, default: 30 },
            },
        },
        (context, params) => ({
            enter: context?.metrics?.rsi < (params?.threshold ?? 30),
        }),
    ),
);

registry.registerStrategy(
    createPlugin(
        'kd_entry',
        'KD 進場',
        {
            type: 'object',
            properties: {
                thresholdX: { type: 'number', minimum: 0, maximum: 100, default: 20 },
            },
        },
        (context, params) => ({
            enter: context?.metrics?.kd < (params?.thresholdX ?? 20),
        }),
    ),
);

registry.registerStrategy(
    createPlugin(
        'rsi_exit',
        'RSI 出場',
        {
            type: 'object',
            properties: {
                threshold: { type: 'number', minimum: 0, maximum: 100, default: 70 },
            },
        },
        (context, params) => ({
            exit: context?.metrics?.rsi > (params?.threshold ?? 70),
        }),
    ),
);

registry.registerStrategy(
    createPlugin(
        'trailing_exit',
        '移動停損',
        {
            type: 'object',
            properties: {
                percentage: { type: 'number', minimum: 0, maximum: 100, default: 5 },
            },
        },
        (context, params) => {
            const pct = params?.percentage ?? 5;
            const triggered = (context?.metrics?.drawdown ?? 0) >= pct;
            return {
                exit: triggered,
                stopLossPercent: triggered ? pct : null,
            };
        },
    ),
);

registry.registerStrategy(
    createPlugin(
        'trend_entry',
        '趨勢進場',
        { type: 'object', properties: {} },
        (context) => ({ enter: Boolean(context?.metrics?.trend) }),
    ),
);

runTest('AND 組合同時滿足時觸發進場', () => {
    const definition = {
        op: 'AND',
        rules: [
            { plugin: 'rsi_entry', params: { threshold: 35 } },
            { plugin: 'kd_entry', params: { thresholdX: 25 } },
        ],
    };
    const evaluator = buildComposite(definition, registry, { contract });
    const context = { role: 'longEntry', metrics: { rsi: 30, kd: 20 } };
    const result = evaluator(context);
    assert.strictEqual(result.enter, true);
    assert.strictEqual(result.meta?.op, 'AND');
});

runTest('OR 組合沿用停損參數', () => {
    const definition = {
        op: 'OR',
        rules: [{ plugin: 'rsi_exit' }, { plugin: 'trailing_exit', params: { percentage: 5 } }],
    };
    const evaluator = buildComposite(definition, registry, { contract });
    const context = { role: 'longExit', metrics: { rsi: 60, drawdown: 6 } };
    const result = evaluator(context);
    assert.strictEqual(result.exit, true);
    assert.strictEqual(result.stopLossPercent, 5);
    assert.strictEqual(result.meta?.op, 'OR');
});

runTest('NOT 節點反向輸出結果', () => {
    const definition = {
        op: 'NOT',
        rule: { plugin: 'trend_entry' },
    };
    const evaluator = buildComposite(definition, registry, { contract });
    const context = { role: 'longEntry', metrics: { trend: true } };
    const result = evaluator(context);
    assert.strictEqual(result.enter, false);
    assert.strictEqual(result.meta?.op, 'NOT');
});

runTest('未知策略時拋出錯誤', () => {
    const definition = { plugin: 'missing_strategy' };
    assert.throws(() => {
        buildComposite(definition, registry, { contract });
    });
});

if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
}
