#!/usr/bin/env node
'use strict';

const assert = require('assert');

require('../js/strategy-plugin-contract.js');
require('../js/strategy-plugin-registry.js');
require('../js/lib/strategy-composer.js');

const { StrategyComposer } = globalThis;
if (!StrategyComposer || typeof StrategyComposer.buildComposite !== 'function') {
  throw new Error('StrategyComposer.buildComposite 未載入');
}

const metaMap = new Map([
  [
    'alpha_entry',
    {
      id: 'alpha_entry',
      label: 'Alpha Entry',
      paramsSchema: {
        type: 'object',
        properties: {
          threshold: { type: 'number', default: 42 },
        },
      },
    },
  ],
  [
    'beta_guard',
    {
      id: 'beta_guard',
      label: 'Beta Guard',
      paramsSchema: {
        type: 'object',
        properties: {
          stopLossPercent: { type: 'number', default: 5 },
        },
      },
    },
  ],
  [
    'gamma_exit',
    {
      id: 'gamma_exit',
      label: 'Gamma Exit',
      paramsSchema: {
        type: 'object',
        properties: {
          takeProfitPercent: { type: 'number', default: 12 },
        },
      },
    },
  ],
]);

const registry = {
  getStrategyMetaById(id) {
    return metaMap.get(id) || null;
  },
};

(function testAndComposition() {
  const evaluateLog = [];
  const composite = StrategyComposer.buildComposite(
    {
      op: 'AND',
      rules: [
        { op: 'PLUGIN', id: 'alpha_entry' },
        { op: 'PLUGIN', id: 'beta_guard', params: { stopLossPercent: 8 } },
      ],
    },
    registry,
    {
      evaluatePlugin(pluginId, context, params) {
        evaluateLog.push({ pluginId, context, params });
        if (pluginId === 'alpha_entry') {
          return {
            enter: true,
            meta: {
              indicatorValues: {
                Alpha: [1, 2, 3],
              },
            },
          };
        }
        if (pluginId === 'beta_guard') {
          return {
            enter: true,
            stopLossPercent: params.stopLossPercent,
            meta: {
              indicatorValues: {
                Beta: [4, 5, 6],
              },
            },
          };
        }
        return null;
      },
    },
  );
  const result = composite({ role: 'longEntry', index: 10 });
  assert.strictEqual(result.enter, true, 'AND 應回傳進場訊號');
  assert.strictEqual(result.stopLossPercent, 8, '停損值應沿用子節點輸出');
  assert.deepStrictEqual(result.meta.indicatorValues, { Alpha: [1, 2, 3], Beta: [4, 5, 6] });
  assert.strictEqual(evaluateLog.length, 2, '應呼叫兩個子節點');
  assert.strictEqual(evaluateLog[0].params.threshold, 42, '應套用 paramsSchema default');
})();

(function testOrComposition() {
  const composite = StrategyComposer.buildComposite(
    {
      op: 'OR',
      rules: [
        { op: 'PLUGIN', id: 'alpha_entry' },
        { op: 'PLUGIN', id: 'beta_guard' },
      ],
    },
    registry,
    {
      evaluatePlugin(pluginId) {
        if (pluginId === 'alpha_entry') {
          return { enter: false };
        }
        return { enter: true };
      },
    },
  );
  const result = composite({ role: 'longEntry', index: 5 });
  assert.strictEqual(result.enter, true, 'OR 組合應回傳任一子節點為真');
})();

(function testNotComposition() {
  const composite = StrategyComposer.buildComposite(
    {
      op: 'NOT',
      rule: { op: 'PLUGIN', id: 'gamma_exit' },
    },
    registry,
    {
      evaluatePlugin() {
        return { exit: true, takeProfitPercent: 30, meta: { reason: 'tp' } };
      },
    },
  );
  const result = composite({ role: 'longExit', index: 1 });
  assert.strictEqual(result.exit, false, 'NOT 應反轉布林欄位');
  assert.strictEqual(result.takeProfitPercent, null, 'NOT 組合不保留停利設定');
  assert.deepStrictEqual(result.meta, { not: { reason: 'tp' } });
})();

(function testInvalidDslThrows() {
  let threw = false;
  try {
    StrategyComposer.buildComposite({}, registry);
  } catch (error) {
    threw = true;
  }
  assert.strictEqual(threw, true, '缺少 op 的 DSL 應丟出例外');
})();

console.log('strategy-composer.test.js passed');
