const assert = require('assert');
const StrategyComposer = require('../js/strategy-composer.js');

function createRegistry() {
  const metaMap = new Map();
  return {
    register(id, schema = {}) {
      metaMap.set(id, {
        id,
        label: id,
        paramsSchema: schema,
      });
    },
    getStrategyMetaById(id) {
      return metaMap.get(id) || null;
    },
  };
}

function runAndTest() {
  const registry = createRegistry();
  registry.register('alpha_entry', {
    type: 'object',
    properties: {
      threshold: { type: 'number', minimum: 0, maximum: 100, default: 50 },
    },
    additionalProperties: true,
  });
  registry.register('beta_entry', {
    type: 'object',
    properties: {
      enabled: { type: 'integer', minimum: 0, maximum: 1, default: 1 },
    },
    additionalProperties: true,
  });

  const invocations = [];
  const composite = StrategyComposer.buildComposite(
    {
      op: 'AND',
      rules: [
        StrategyComposer.createLeaf('alpha_entry', { threshold: 45 }),
        StrategyComposer.createLeaf('beta_entry', { enabled: 1 }),
      ],
    },
    registry,
    {
      invokeLeaf({ strategyId, role, index, params, runtime }) {
        invocations.push({ strategyId, role, index, params, runtime });
        if (strategyId === 'alpha_entry') {
          return {
            enter: params.threshold < 50,
            stopLossPercent: 5,
            meta: { rule: 'alpha' },
          };
        }
        if (strategyId === 'beta_entry') {
          return {
            enter: params.enabled === 1,
            takeProfitPercent: 12,
            meta: { rule: 'beta' },
          };
        }
        return null;
      },
    },
  );

  const result = composite(
    { role: 'longEntry', index: 10 },
    { runtime: { stage: 1 }, paramsOverride: { alpha_entry: { threshold: 40 } } },
  );

  assert.strictEqual(invocations.length, 2, '應呼叫所有子策略');
  assert.strictEqual(result.enter, true, 'AND 應在兩者皆成立時為真');
  assert.strictEqual(result.stopLossPercent, 5, '應保留最後的停損值');
  assert.strictEqual(result.takeProfitPercent, 12, '應保留最後的停利值');
  assert.strictEqual(result.meta.op, 'AND');
}

function runOrTest() {
  const registry = createRegistry();
  registry.register('gamma_exit', {
    type: 'object',
    properties: {
      coolDown: { type: 'integer', minimum: 0, maximum: 10, default: 0 },
    },
    additionalProperties: true,
  });
  registry.register('delta_exit', {
    type: 'object',
    properties: {
      cooldown: { type: 'integer', minimum: 0, maximum: 10, default: 0 },
    },
    additionalProperties: true,
  });

  const composite = StrategyComposer.buildComposite(
    {
      op: 'OR',
      rules: [
        StrategyComposer.createLeaf('gamma_exit', { coolDown: 2 }),
        StrategyComposer.createLeaf('delta_exit', {}),
      ],
    },
    registry,
    {
      invokeLeaf({ strategyId }) {
        if (strategyId === 'gamma_exit') {
          return { exit: false };
        }
        if (strategyId === 'delta_exit') {
          return { exit: true };
        }
        return null;
      },
    },
  );

  const result = composite({ role: 'longExit', index: 3 });
  assert.strictEqual(result.exit, true, 'OR 應在任一子策略成立時為真');
}

function runNotTest() {
  const registry = createRegistry();
  registry.register('epsilon_short', {
    type: 'object',
    properties: {
      ratio: { type: 'number', minimum: 0, maximum: 1, default: 0.2 },
    },
    additionalProperties: true,
  });

  const composite = StrategyComposer.buildComposite(
    {
      op: 'NOT',
      rule: StrategyComposer.createLeaf('epsilon_short', { ratio: 0.1 }),
    },
    registry,
    {
      invokeLeaf() {
        return { short: true };
      },
    },
  );

  const result = composite({ role: 'shortEntry', index: 0 });
  assert.strictEqual(result.short, false, 'NOT 應反轉布林結果');
}

runAndTest();
runOrTest();
runNotTest();

console.log('strategy-composer.test.js passed');
