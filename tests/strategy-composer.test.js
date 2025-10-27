const assert = require('assert');

require('../js/strategy-plugin-contract.js');
const StrategyComposer = require('../js/strategy-composer.js');

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

runTest('AND 節點同時滿足時回傳共同停損最小值', () => {
  const pluginCalls = [];
  const composite = StrategyComposer.buildComposite(
    {
      op: 'AND',
      rules: [
        { op: 'PLUGIN', id: 'alpha' },
        { op: 'PLUGIN', id: 'beta' },
      ],
    },
    null,
    {
      evaluatePlugin(pluginId) {
        pluginCalls.push(pluginId);
        if (pluginId === 'alpha') {
          return { enter: true, stopLossPercent: 7, meta: { label: 'alpha' } };
        }
        return { enter: true, stopLossPercent: 12, meta: { label: 'beta' } };
      },
    },
  );

  const result = composite({ role: 'longEntry', index: 5 });

  assert.deepStrictEqual(pluginCalls, ['alpha', 'beta']);
  assert.strictEqual(result.enter, true);
  assert.strictEqual(result.stopLossPercent, 7);
  assert.strictEqual(result.exit, false);
  assert.ok(result.meta && result.meta.operator === 'AND');
});

runTest('OR 節點保留第一個觸發訊號的停利設定', () => {
  const composite = StrategyComposer.buildComposite(
    {
      op: 'OR',
      rules: [
        { op: 'PLUGIN', id: 'gamma' },
        { op: 'PLUGIN', id: 'delta' },
      ],
    },
    null,
    {
      evaluatePlugin(pluginId) {
        if (pluginId === 'gamma') {
          return { exit: true, takeProfitPercent: 15 };
        }
        return { exit: false, takeProfitPercent: 20 };
      },
    },
  );

  const result = composite({ role: 'longExit', index: 9 });

  assert.strictEqual(result.exit, true);
  assert.strictEqual(result.takeProfitPercent, 15);
  assert.strictEqual(result.enter, false);
});

runTest('NOT 節點反轉布林結果', () => {
  const composite = StrategyComposer.buildComposite(
    {
      op: 'NOT',
      rules: [{ op: 'PLUGIN', id: 'negate' }],
    },
    null,
    {
      evaluatePlugin() {
        return { short: true };
      },
    },
  );

  const result = composite({ role: 'shortEntry', index: 2 });

  assert.strictEqual(result.short, false);
});

runTest('節點參數會併入基礎設定傳給插件', () => {
  const receivedParams = [];
  const composite = StrategyComposer.buildComposite(
    {
      op: 'PLUGIN',
      id: 'configurable',
      params: { threshold: 20 },
    },
    null,
    {
      baseParams: { threshold: 30, lookback: 14 },
      evaluatePlugin(pluginId, context, params) {
        assert.strictEqual(pluginId, 'configurable');
        assert.deepStrictEqual(context, { role: 'longEntry', index: 1 });
        receivedParams.push({ ...params });
        return { enter: true };
      },
    },
  );

  const result = composite({ role: 'longEntry', index: 1 });

  assert.strictEqual(result.enter, true);
  assert.deepStrictEqual(receivedParams[0], { threshold: 20, lookback: 14 });
});

if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode);
}

