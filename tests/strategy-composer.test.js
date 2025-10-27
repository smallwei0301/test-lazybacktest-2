// Patch Tag: LB-COMPOSER-TEST-20260305B
const assert = require('assert');

const paramUtilsModule = require('../js/strategy-param-utils.js');
const composerModule = require('../js/strategy-composer.js');

const composer =
  global.StrategyComposer ||
  (composerModule && composerModule.StrategyComposer) ||
  composerModule;
assert.ok(composer, 'StrategyComposer 應該已經載入');
const paramUtils =
  global.StrategyParamUtils ||
  (paramUtilsModule && paramUtilsModule.StrategyParamUtils) ||
  paramUtilsModule;

function createMockRegistry() {
  return {
    getStrategyMetaById(id) {
      return {
        id,
        label: id,
        paramsSchema: {
          type: 'object',
          properties: {
            threshold: { type: 'number', default: 10 },
          },
        },
      };
    },
  };
}

function runAndAssert(label, fn) {
  try {
    fn();
    console.log(`✅ ${label}`);
  } catch (error) {
    console.error(`❌ ${label}`);
    throw error;
  }
}

runAndAssert('AND 組合應該同時回傳多個策略為真', () => {
  const registry = createMockRegistry();
  const calls = [];
  const evaluator = composer.buildComposite(
    {
      op: 'AND',
      rules: [
        { strategy: 'alpha', params: { threshold: 5 } },
        { strategy: 'beta', params: { threshold: 15 } },
      ],
    },
    registry,
    {
      invoke(strategyId) {
        calls.push(strategyId);
        if (strategyId === 'alpha') {
          return { enter: true, stopLossPercent: 7, meta: { note: 'A' } };
        }
        if (strategyId === 'beta') {
          return { enter: true, takeProfitPercent: 12 };
        }
        return { enter: false };
      },
    },
  );
  const result = evaluator({ role: 'longEntry', index: 3 }, null);
  assert.deepStrictEqual(calls, ['alpha', 'beta']);
  assert.strictEqual(result.enter, true);
  assert.strictEqual(result.stopLossPercent, 7);
  assert.strictEqual(result.takeProfitPercent, 12);
  assert.strictEqual(result.exit, false);
  assert.strictEqual(result.short, false);
  assert.ok(result.meta);
  assert.strictEqual(result.meta.note, 'A');
});

runAndAssert('AND 組合其中一個為 false 時應該清除風險設定', () => {
  const registry = createMockRegistry();
  const evaluator = composer.buildComposite(
    {
      op: 'AND',
      rules: [
        { strategy: 'alpha' },
        { strategy: 'beta' },
      ],
    },
    registry,
    {
      invoke(strategyId) {
        if (strategyId === 'alpha') {
          return { enter: true, stopLossPercent: 4 };
        }
        return { enter: false };
      },
    },
  );
  const result = evaluator({ role: 'longEntry', index: 0 }, null);
  assert.strictEqual(result.enter, false);
  assert.strictEqual(result.stopLossPercent, null);
});

runAndAssert('OR 組合應該使用第一個成立的結果', () => {
  const registry = createMockRegistry();
  const evaluator = composer.buildComposite(
    {
      op: 'OR',
      rules: [
        { strategy: 'alpha' },
        { strategy: 'beta' },
      ],
    },
    registry,
    {
      invoke(strategyId) {
        if (strategyId === 'alpha') {
          return { exit: false };
        }
        return { exit: true, takeProfitPercent: 20, meta: { tag: strategyId } };
      },
    },
  );
  const result = evaluator({ role: 'longExit', index: 10 }, null);
  assert.strictEqual(result.exit, true);
  assert.strictEqual(result.takeProfitPercent, 20);
  assert.strictEqual(result.meta.tag, 'beta');
});

runAndAssert('NOT 運算子應該反轉布林值', () => {
  const registry = createMockRegistry();
  const evaluator = composer.buildComposite(
    {
      op: 'NOT',
      rule: { strategy: 'alpha' },
    },
    registry,
    {
      invoke() {
        return { short: true };
      },
    },
  );
  const result = evaluator({ role: 'shortEntry', index: 1 }, null);
  assert.strictEqual(result.short, false);
  assert.strictEqual(result.enter, true);
  assert.strictEqual(result.exit, true);
  assert.strictEqual(result.cover, true);
});

runAndAssert('NOT 運算子應該保留 meta 並清除風險欄位', () => {
  const registry = createMockRegistry();
  const evaluator = composer.buildComposite(
    {
      op: 'NOT',
      rule: { strategy: 'alpha' },
    },
    registry,
    {
      invoke() {
        return {
          enter: true,
          stopLossPercent: 12,
          takeProfitPercent: 25,
          meta: { origin: 'alpha' },
        };
      },
    },
  );
  const result = evaluator({ role: 'longEntry', index: 5 }, null);
  assert.strictEqual(result.enter, false);
  assert.strictEqual(result.stopLossPercent, null);
  assert.strictEqual(result.takeProfitPercent, null);
  assert.deepStrictEqual(result.meta, { origin: 'alpha' });
});

runAndAssert('prepareParams 應該套用 Schema 預設值', () => {
  const registry = createMockRegistry();
  const prepared = [];
  const evaluator = composer.buildComposite(
    { strategy: 'alpha', params: {} },
    registry,
    {
      prepareParams(strategyId, params) {
        const merged = paramUtils
          ? paramUtils.buildParamsWithSchema(registry, strategyId, params)
          : { ...params };
        const finalParams = { ...merged, prepared: true };
        prepared.push({ strategyId, params: finalParams });
        return finalParams;
      },
      invoke(_id, _context, params) {
        return { enter: params.prepared === true && params.threshold === 10 };
      },
    },
  );
  const result = evaluator({ role: 'longEntry', index: 2 }, null);
  assert.strictEqual(result.enter, true);
  assert.strictEqual(prepared.length, 1);
  assert.strictEqual(prepared[0].strategyId, 'alpha');
  assert.strictEqual(prepared[0].params.threshold, 10);
});

runAndAssert('巢狀 AND/OR 應該整合風險設定與 meta', () => {
  const registry = createMockRegistry();
  const evaluator = composer.buildComposite(
    {
      op: 'AND',
      rules: [
        { strategy: 'alpha' },
        {
          op: 'OR',
          rules: [
            { strategy: 'beta' },
            { strategy: 'gamma' },
          ],
        },
      ],
    },
    registry,
    {
      invoke(strategyId) {
        if (strategyId === 'alpha') {
          return { enter: true, stopLossPercent: 5 };
        }
        if (strategyId === 'beta') {
          return { enter: false };
        }
        return { enter: true, takeProfitPercent: 9, meta: { source: 'gamma' } };
      },
    },
  );
  const result = evaluator({ role: 'longEntry', index: 4 }, null);
  assert.strictEqual(result.enter, true);
  assert.strictEqual(result.stopLossPercent, 5);
  assert.strictEqual(result.takeProfitPercent, 9);
  assert.deepStrictEqual(result.meta, { source: 'gamma' });
});

runAndAssert('contract.ensureRuleResult 應優先於預設實作', () => {
  const registry = createMockRegistry();
  const contract = {
    calls: 0,
    ensureRuleResult(raw) {
      this.calls += 1;
      const next = raw && typeof raw === 'object' ? { ...raw } : {};
      next.meta = { ...(next.meta || {}), ensuredBy: 'contract' };
      return next;
    },
  };
  const evaluator = composer.buildComposite(
    { strategy: 'alpha', params: {} },
    registry,
    {
      contract,
      prepareParams(strategyId, params) {
        if (paramUtils && typeof paramUtils.buildParamsWithSchema === 'function') {
          return paramUtils.buildParamsWithSchema(registry, strategyId, params);
        }
        return params || {};
      },
      invoke(_id, _context, params) {
        return { enter: params.threshold === 10 };
      },
    },
  );
  const result = evaluator({ role: 'longEntry', index: 7 }, null);
  assert.strictEqual(result.enter, true);
  assert.deepStrictEqual(result.meta, { ensuredBy: 'contract' });
  assert.strictEqual(contract.calls, 1);
});

runAndAssert('無效的 DSL 定義應該拋出錯誤', () => {
  const registry = createMockRegistry();
  assert.throws(
    () => {
      composer.buildComposite({ foo: 'bar' }, registry, {});
    },
    /StrategyComposer 規則缺少 strategy 或 op 欄位/,
  );
});

console.log('Strategy Composer tests completed.');
