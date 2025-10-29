const assert = require('assert');
const path = require('path');

const loader = require(path.join('..', 'js', 'lib', 'strategy-dsl-loader.js'));

function testApplyCallsUi() {
  const applied = [];
  const uiInstance = {
    applyDsl(def) {
      applied.push(def);
    },
  };
  const settings = {
    strategyDsl: {
      version: 'TEST',
      longEntry: { type: 'SINGLE', node: { id: 'ma_cross', params: {} } },
    },
  };

  const result = loader.applyStrategyDsl(settings, uiInstance);

  assert.strictEqual(result, true, '應回傳 true 表示已套用 DSL');
  assert.strictEqual(applied.length, 1, '應呼叫 applyDsl 一次');
  assert.strictEqual(applied[0], settings.strategyDsl, '應將原始 DSL 傳入 UI');
}

function testMissingDslDoesNotCallUi() {
  const uiInstance = {
    applyDsl() {
      throw new Error('不應被呼叫');
    },
  };

  const result = loader.applyStrategyDsl({}, uiInstance);
  assert.strictEqual(result, false, '無 DSL 時應回傳 false');
}

function testMissingUiIsSafe() {
  const settings = {
    strategyDsl: { version: 'TEST' },
  };

  const result = loader.applyStrategyDsl(settings, null);
  assert.strictEqual(result, false, 'UI 不存在時應回傳 false');
}

function run() {
  testApplyCallsUi();
  testMissingDslDoesNotCallUi();
  testMissingUiIsSafe();
  console.log('strategy-dsl-loader tests passed');
}

run();
