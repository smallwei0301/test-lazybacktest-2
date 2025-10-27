const assert = require('assert');
const path = require('path');

const composer = require(path.join('..', 'js', 'strategies', 'composer.js'));

function createRegistry() {
  return {
    getStrategyMetaById(id) {
      if (!id) return null;
      return { id, label: id.toUpperCase() };
    },
  };
}

function testAndCombination() {
  const registry = createRegistry();
  const calls = [];
  const composite = composer.buildComposite(
    {
      type: 'AND',
      nodes: [
        { type: 'plugin', id: 'alpha', params: { threshold: 70 } },
        { type: 'plugin', id: 'beta', params: { window: 5 } },
      ],
    },
    registry,
    {
      role: 'longEntry',
      invoke({ id, role, index, params }) {
        calls.push({ id, role, index, params });
        if (id === 'alpha') {
          return { enter: true, stopLossPercent: 3, meta: { alpha: true } };
        }
        if (id === 'beta') {
          return { enter: true, takeProfitPercent: 10, meta: { beta: true } };
        }
        return { enter: false };
      },
    },
  );

  const result = composite.evaluate(15, { foo: 'bar' });
  assert.strictEqual(result.enter, true, 'AND 應該同時通過兩個節點');
  assert.strictEqual(result.stopLossPercent, 3, '應保留第一個節點的停損設定');
  assert.strictEqual(result.takeProfitPercent, 10, '應保留第二個節點的停利設定');
  assert.strictEqual(result.meta.operator, 'AND');
  assert.strictEqual(calls.length, 2, '應該呼叫兩次 invoke');
}

function testOrCombinationStopLoss() {
  const registry = createRegistry();
  const composite = composer.buildComposite(
    {
      op: 'or',
      nodes: [
        { type: 'plugin', id: 'gamma', params: { length: 20 } },
        { type: 'plugin', id: 'delta', params: { length: 55 } },
      ],
    },
    registry,
    {
      role: 'longEntry',
      invoke({ id }) {
        if (id === 'gamma') {
          return { enter: false, meta: { gamma: true } };
        }
        if (id === 'delta') {
          return { enter: true, stopLossPercent: 8, meta: { delta: true } };
        }
        return { enter: false };
      },
    },
  );

  const result = composite.evaluate(5, {});
  assert.strictEqual(result.enter, true, 'OR 應該採用任一子節點');
  assert.strictEqual(result.stopLossPercent, 8, '停損應採用第一個觸發的子節點');
  assert.strictEqual(result.meta.operator, 'OR');
}

function testNotInversion() {
  const registry = createRegistry();
  let receivedParams = null;
  const composite = composer.buildComposite(
    {
      type: 'NOT',
      node: { type: 'plugin', id: 'theta' },
    },
    registry,
    {
      role: 'longExit',
      baseParams: { period: 14 },
      invoke({ params }) {
        receivedParams = params;
        return { exit: true, meta: { raw: true } };
      },
    },
  );

  const result = composite.evaluate(2, {});
  assert.strictEqual(result.exit, false, 'NOT 應反轉子節點的結果');
  assert.strictEqual(result.meta.operator, 'NOT');
  assert(receivedParams && receivedParams.period === 14, '未提供 params 時應套用 baseParams');
}

function testNestedComposition() {
  const registry = createRegistry();
  const composite = composer.buildComposite(
    {
      type: 'AND',
      nodes: [
        {
          type: 'OR',
          nodes: [
            { type: 'plugin', id: 'rsi', params: { period: 14 } },
            { type: 'plugin', id: 'macd', params: { signalPeriod: 9 } },
          ],
        },
        {
          type: 'NOT',
          node: { type: 'plugin', id: 'filter', params: { window: 3 } },
        },
      ],
    },
    registry,
    {
      role: 'shortEntry',
      invoke({ id }) {
        if (id === 'rsi') {
          return { short: true };
        }
        if (id === 'macd') {
          return { short: false };
        }
        if (id === 'filter') {
          return { short: true };
        }
        return { short: false };
      },
    },
  );

  const result = composite.evaluate(30, {});
  assert.strictEqual(result.short, false, '短單應被 NOT 節點反轉為 false');
  assert.strictEqual(result.meta.operator, 'AND');
  const ids = composite.collectPluginIds().sort();
  assert.deepStrictEqual(ids, ['filter', 'macd', 'rsi'], '應收集所有插件識別碼');
}

function run() {
  testAndCombination();
  testOrCombinationStopLoss();
  testNotInversion();
  testNestedComposition();
  console.log('strategy-composer tests passed');
}

run();
