const assert = require('assert');
const composer = require('../js/strategy-composer.js');

function createRegistry() {
  const plugins = new Map();
  const metas = new Map();
  return {
    register(id, meta, run) {
      metas.set(id, meta);
      plugins.set(id, { run });
    },
    getStrategyById(id) {
      return plugins.get(id) || null;
    },
    ensureStrategyLoaded(id) {
      return plugins.get(id) || null;
    },
    getStrategyMetaById(id) {
      return metas.get(id) || null;
    },
  };
}

function buildContext(role, index) {
  return { role, index, series: {}, runtime: { warmupStartIndex: 0, effectiveStartIndex: 0, length: 0 } };
}

(function testAndOrNot() {
  const registry = createRegistry();
  registry.register(
    'alpha',
    { id: 'alpha', label: 'Alpha', paramsSchema: { type: 'object', properties: {} } },
    (context) => ({ enter: context.index % 2 === 0, meta: { alpha: context.index } }),
  );
  registry.register(
    'beta',
    {
      id: 'beta',
      label: 'Beta',
      paramsSchema: {
        type: 'object',
        properties: { threshold: { type: 'integer', default: 1, minimum: 0 } },
      },
    },
    (context, params) => ({ enter: context.index > params.threshold, meta: { threshold: params.threshold } }),
  );
  registry.register(
    'gamma',
    { id: 'gamma', label: 'Gamma', paramsSchema: { type: 'object', properties: {} } },
    () => ({ enter: false }),
  );

  const dsl = {
    op: 'OR',
    rules: [
      {
        op: 'AND',
        rules: [
          { plugin: 'alpha' },
          { plugin: 'beta', params: { threshold: 1 } },
        ],
      },
      {
        op: 'NOT',
        rule: { plugin: 'gamma' },
      },
    ],
  };

  const evaluator = composer.buildComposite(dsl, registry, {
    createPluginContext(_id, ctx) {
      return { ...ctx };
    },
  });

  const result0 = evaluator(buildContext('longEntry', 0));
  assert.strictEqual(result0.enter, true, 'index 0 應觸發 OR 中的 AND');

  const result1 = evaluator(buildContext('longEntry', 1));
  assert.strictEqual(result1.enter, true, 'index 1 應由 NOT gamma 觸發');

  const result3 = evaluator(buildContext('longEntry', 3));
  assert.strictEqual(result3.enter, true, 'index 3 應仍由 NOT gamma 觸發');
})();

(function testMetaAndStopLossMerge() {
  const registry = createRegistry();
  registry.register(
    'risk',
    {
      id: 'risk',
      label: 'Risk',
      paramsSchema: {
        type: 'object',
        properties: {
          stop: { type: 'number', default: 5, minimum: 0, maximum: 100 },
        },
      },
    },
    (_context, params) => ({ enter: true, stopLossPercent: params.stop, meta: { risk: params.stop } }),
  );
  registry.register(
    'signal',
    { id: 'signal', label: 'Signal', paramsSchema: { type: 'object', properties: {} } },
    () => ({ enter: true, meta: { indicatorValues: { foo: [1, 2, 3] } } }),
  );

  const evaluator = composer.buildComposite(
    { op: 'AND', rules: [{ plugin: 'risk', params: {} }, { plugin: 'signal' }] },
    registry,
    {
      createPluginContext(_id, ctx) {
        return { ...ctx };
      },
    },
  );

  const result = evaluator(buildContext('longEntry', 10));
  assert.strictEqual(result.enter, true, '應觸發 AND 條件');
  assert.strictEqual(result.stopLossPercent, 5, '應沿用風險策略預設停損');
  assert.ok(result.meta.indicatorValues, '應合併指標資訊');
  assert.strictEqual(result.meta.risk, 5, '應保留風險資訊');
})();

(function testNotConstant() {
  const registry = createRegistry();
  registry.register(
    'alwaysTrue',
    { id: 'alwaysTrue', label: 'Always True', paramsSchema: { type: 'object', properties: {} } },
    () => ({ exit: true }),
  );

  const evaluator = composer.buildComposite(
    { op: 'NOT', rule: { plugin: 'alwaysTrue' } },
    registry,
    {
      createPluginContext(_id, ctx) {
        return { ...ctx };
      },
    },
  );

  const result = evaluator(buildContext('longExit', 5));
  assert.strictEqual(result.exit, false, 'NOT 節點應反向布林值');
})();

console.log('composer tests passed');
