// Patch Tag: LB-STRATEGY-DSL-20250914A
const assert = require('assert');

require('../js/strategy-plugin-contract.js');
require('../js/strategy-dsl.js');

const { StrategyDSL } = global;

function createRegistry(strategies) {
  const map = new Map();
  strategies.forEach((strategy) => {
    map.set(strategy.meta.id, strategy);
  });
  return {
    getStrategyById(id) {
      return map.get(id) || null;
    },
    getStrategyMetaById(id) {
      const entry = map.get(id);
      return entry ? entry.meta : null;
    },
  };
}

(function testAndComposition() {
  const captures = [];
  const registry = createRegistry([
    {
      meta: {
        id: 'enter_true',
        label: 'Enter True',
        paramsSchema: {
          type: 'object',
          properties: {
            stopLoss: { type: 'number', minimum: 0, maximum: 100, default: 15 },
          },
          additionalProperties: false,
        },
      },
      run(context, params) {
        captures.push({ plugin: 'enter_true', params });
        return { enter: true, stopLossPercent: params.stopLoss, meta: { sample: 'A' } };
      },
    },
    {
      meta: {
        id: 'confirm_entry',
        label: 'Confirm Entry',
        paramsSchema: {
          type: 'object',
          properties: {
            confirm: { type: 'boolean', default: true },
          },
          additionalProperties: false,
        },
      },
      run(context, params) {
        captures.push({ plugin: 'confirm_entry', params });
        return { enter: params.confirm === true };
      },
    },
  ]);

  const dsl = {
    op: 'AND',
    rules: [
      { plugin: 'enter_true', params: { stopLoss: 8 } },
      { plugin: 'confirm_entry', params: { confirm: true } },
    ],
  };
  const composite = StrategyDSL.buildComposite(dsl, registry);
  const result = composite.evaluate({ role: 'longEntry', index: 5 });
  assert.strictEqual(result.enter, true, 'AND 組合應回傳進場訊號');
  assert.strictEqual(result.stopLossPercent, 8, '應採用子策略中最小的停損');
  assert.strictEqual(result.meta.type, 'composite');
  assert.strictEqual(result.meta.children.length, 2);
  assert.strictEqual(Object.isFrozen(captures[0].params), true, '策略參數需為凍結物件');
})();

(function testOrComposition() {
  const registry = createRegistry([
    {
      meta: {
        id: 'exit_false',
        label: 'Exit False',
        paramsSchema: { type: 'object', properties: {}, additionalProperties: true },
      },
      run() {
        return { exit: false };
      },
    },
    {
      meta: {
        id: 'exit_true',
        label: 'Exit True',
        paramsSchema: {
          type: 'object',
          properties: {
            takeProfit: { type: 'number', minimum: 0, maximum: 200, default: 10 },
          },
          additionalProperties: false,
        },
      },
      run(context, params) {
        return { exit: true, takeProfitPercent: params.takeProfit };
      },
    },
  ]);

  const dsl = {
    op: 'OR',
    rules: [
      { plugin: 'exit_false' },
      { plugin: 'exit_true', params: { takeProfit: 12 } },
    ],
  };

  const composite = StrategyDSL.buildComposite(dsl, registry);
  const result = composite.evaluate({ role: 'longExit', index: 10 });
  assert.strictEqual(result.exit, true, 'OR 組合應回傳出場訊號');
  assert.strictEqual(result.takeProfitPercent, 12, '應沿用子策略的停利設定');
})();

(function testNotComposition() {
  const registry = createRegistry([
    {
      meta: { id: 'negated', label: 'Negated', paramsSchema: { type: 'object', properties: {}, additionalProperties: true } },
      run() {
        return { enter: false, exit: true };
      },
    },
  ]);
  const dsl = { op: 'NOT', rule: { plugin: 'negated' } };
  const composite = StrategyDSL.buildComposite(dsl, registry);
  const result = composite.evaluate({ role: 'longEntry', index: 0 });
  assert.strictEqual(result.enter, true, 'NOT 組合需反轉布林值');
  assert.strictEqual(result.exit, false, 'NOT 組合需反轉所有欄位');
  assert.strictEqual(result.stopLossPercent, null, 'NOT 組合不應攜帶停損資訊');
})();

(function testSchemaValidation() {
  const registry = createRegistry([
    {
      meta: {
        id: 'bounded',
        label: 'Bounded',
        paramsSchema: {
          type: 'object',
          properties: {
            threshold: { type: 'number', minimum: 0, maximum: 100 },
          },
          required: ['threshold'],
          additionalProperties: false,
        },
      },
      run() {
        return { enter: true };
      },
    },
  ]);

  const dsl = { plugin: 'bounded', params: { threshold: 150 } };
  assert.throws(() => {
    StrategyDSL.buildComposite(dsl, registry);
  }, /threshold/);
})();

(function testDefaultsApplied() {
  let receivedParams = null;
  const registry = createRegistry([
    {
      meta: {
        id: 'defaulted',
        label: 'Defaulted',
        paramsSchema: {
          type: 'object',
          properties: {
            period: { type: 'integer', minimum: 1, maximum: 200, default: 10 },
          },
          additionalProperties: false,
        },
      },
      run(context, params) {
        receivedParams = params;
        return { enter: true };
      },
    },
  ]);

  const dsl = { plugin: 'defaulted' };
  const composite = StrategyDSL.buildComposite(dsl, registry);
  composite.evaluate({ role: 'longEntry', index: 1 });
  assert.deepStrictEqual(receivedParams, { period: 10 });
})();

console.log('strategy-dsl.test.js ✅');
