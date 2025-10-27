const assert = require('assert');
require('../js/strategy-plugin-contract.js');
const { buildComposite } = require('../js/lib/strategy-dsl.js');

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
    ensureStrategyLoaded(id) {
      return map.get(id) || null;
    },
  };
}

function makeContext(role, index) {
  return {
    role,
    index,
    series: {
      close: [],
      open: [],
      high: [],
      low: [],
      volume: [],
      date: [],
    },
    helpers: {},
    runtime: {
      warmupStartIndex: 0,
      effectiveStartIndex: 0,
      length: 10,
    },
  };
}

const registry = createRegistry();

registry.registerStrategy({
  meta: {
    id: 'alpha_entry',
    label: 'Alpha Entry',
    paramsSchema: {
      type: 'object',
      properties: {
        threshold: { type: 'integer', minimum: 0, maximum: 10, default: 1 },
      },
      additionalProperties: false,
    },
  },
  run(context, params) {
    return {
      enter: context.index >= params.threshold,
      exit: false,
      short: false,
      cover: false,
      meta: { observed: params.threshold },
    };
  },
});

registry.registerStrategy({
  meta: {
    id: 'beta_entry',
    label: 'Beta Entry',
    paramsSchema: {
      type: 'object',
      properties: {
        threshold: { type: 'integer', minimum: 0, maximum: 10, default: 2 },
      },
      additionalProperties: false,
    },
  },
  run(context, params) {
    return {
      enter: context.index >= params.threshold,
      exit: false,
      short: false,
      cover: false,
      meta: { observed: params.threshold },
    };
  },
});

let observedGammaParams = null;
registry.registerStrategy({
  meta: {
    id: 'gamma_exit',
    label: 'Gamma Exit',
    paramsSchema: {
      type: 'object',
      properties: {
        stopLoss: { type: 'number', minimum: 0, maximum: 20, default: 7 },
      },
      additionalProperties: false,
    },
  },
  run(context, params) {
    observedGammaParams = params;
    return {
      enter: false,
      exit: context.index >= 2,
      short: false,
      cover: false,
      stopLossPercent: params.stopLoss,
      meta: { stopLoss: params.stopLoss },
    };
  },
});

registry.registerStrategy({
  meta: {
    id: 'delta_exit',
    label: 'Delta Exit',
    paramsSchema: {
      type: 'object',
      properties: {
        threshold: { type: 'integer', minimum: 0, maximum: 5, default: 3 },
      },
      additionalProperties: false,
    },
  },
  run(context, params) {
    return {
      enter: false,
      exit: context.index >= params.threshold,
      short: false,
      cover: false,
      meta: { threshold: params.threshold },
    };
  },
});

runTest('AND 組合需雙方同時觸發才進場', () => {
  const dsl = {
    op: 'AND',
    rules: [
      { plugin: 'alpha_entry', params: { threshold: 1 } },
      { plugin: 'beta_entry', params: { threshold: 2 } },
    ],
  };

  const evaluate = buildComposite(dsl, registry);
  const resultIdx2 = evaluate(makeContext('longEntry', 2));
  assert.strictEqual(resultIdx2.enter, true);
  assert.strictEqual(resultIdx2.exit, false);

  const resultIdx1 = evaluate(makeContext('longEntry', 1));
  assert.strictEqual(resultIdx1.enter, false);
});

runTest('OR 組合可回傳停損百分比', () => {
  const dsl = {
    op: 'OR',
    rules: [
      { plugin: 'delta_exit', params: { threshold: 5 } },
      { plugin: 'gamma_exit', params: { stopLoss: 5 } },
    ],
  };
  const evaluate = buildComposite(dsl, registry);
  const result = evaluate(makeContext('longExit', 2));
  assert.strictEqual(result.exit, true);
  assert.strictEqual(result.stopLossPercent, 5);
  assert.ok(result.meta);
});

runTest('NOT 可反轉子節點的布林結果', () => {
  const dsl = {
    op: 'NOT',
    rule: { plugin: 'alpha_entry', params: { threshold: 1 } },
  };
  const evaluate = buildComposite(dsl, registry);
  const result = evaluate(makeContext('longEntry', 0));
  assert.strictEqual(result.enter, true);
  assert.strictEqual(result.stopLossPercent, null);
});

runTest('buildComposite 會依 paramsSchema 夾限數值', () => {
  const dsl = {
    plugin: 'gamma_exit',
    params: { stopLoss: 999 },
  };
  observedGammaParams = null;
  const evaluate = buildComposite(dsl, registry);
  const result = evaluate(makeContext('longExit', 3));
  assert.strictEqual(result.exit, true);
  assert.ok(observedGammaParams);
  assert.strictEqual(observedGammaParams.stopLoss, 20);
});

if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode);
}
