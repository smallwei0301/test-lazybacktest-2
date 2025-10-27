const assert = require('assert');
const path = require('path');

const composer = require(path.resolve(__dirname, '../js/strategies/composer.js'));

function createRegistry(stubMap) {
    return {
        invoke(pluginId, context) {
            const handler = stubMap[pluginId];
            if (!handler) {
                throw new Error(`Missing plugin handler for ${pluginId}`);
            }
            return handler(context);
        },
    };
}

(function testAndOrNot() {
    const registry = createRegistry({
        alpha: () => ({ enter: true, stopLossPercent: 5 }),
        beta: () => ({ enter: true, meta: { source: 'beta' } }),
        gamma: () => ({ enter: false }),
    });
    const dsl = {
        type: 'and',
        children: [
            { type: 'plugin', pluginId: 'alpha' },
            {
                type: 'or',
                children: [
                    { type: 'plugin', pluginId: 'beta' },
                    { type: 'plugin', pluginId: 'gamma' },
                ],
            },
        ],
    };
    const evaluate = composer.buildComposite(dsl, registry);
    const result = evaluate({ role: 'longEntry', index: 12 });
    assert.strictEqual(result.enter, true, 'AND 應為 true');
    assert.strictEqual(result.stopLossPercent, 5, '應帶出 stopLossPercent');
    assert.strictEqual(result.meta.source, 'beta', '應合併子節點 meta');
})();

(function testNot() {
    const registry = createRegistry({
        alpha: () => ({ exit: true }),
    });
    const dsl = {
        type: 'not',
        child: { type: 'plugin', pluginId: 'alpha' },
    };
    const evaluate = composer.buildComposite(dsl, registry);
    const result = evaluate({ role: 'longExit', index: 0 });
    assert.strictEqual(result.exit, false, 'NOT 應反轉布林值');
})();

(function testNestedStopLoss() {
    const registry = createRegistry({
        alpha: () => ({ enter: true, stopLossPercent: 3 }),
        beta: () => ({ enter: false, stopLossPercent: 1 }),
    });
    const dsl = {
        type: 'or',
        children: [
            { type: 'plugin', pluginId: 'beta' },
            { type: 'plugin', pluginId: 'alpha' },
        ],
    };
    const evaluate = composer.buildComposite(dsl, registry);
    const result = evaluate({ role: 'longEntry', index: 5 });
    assert.strictEqual(result.enter, true, 'OR 應為 true');
    assert.strictEqual(result.stopLossPercent, 1, 'OR 應保留第一個子節點 stopLoss');
})();

(function testInvalidNodeThrows() {
    assert.throws(() => composer.buildComposite({ type: 'plugin' }, createRegistry({})), /pluginId/);
})();

console.log('StrategyComposer tests passed');
