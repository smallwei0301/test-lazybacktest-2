const assert = require('assert');
const path = require('path');

const dslEditor = require(path.join('..', 'js', 'lib', 'strategy-dsl-editor.js'));

function testAppendPlugin() {
  const state = dslEditor.createState();
  const afterFirst = dslEditor.appendPlugin(state, 'longEntry', {
    type: 'plugin',
    id: 'ma_cross',
    params: { shortPeriod: 5, longPeriod: 20 },
  });

  assert.strictEqual(afterFirst.roles.longEntry.type, 'plugin');

  const afterSecond = dslEditor.appendPlugin(afterFirst, 'longEntry', {
    type: 'plugin',
    id: 'rsi_oversold',
    params: { period: 14, threshold: 30 },
  });

  const root = afterSecond.roles.longEntry;
  assert.strictEqual(root.type, 'AND', '預設應轉換為 AND 節點');
  assert.strictEqual(root.nodes.length, 2);
}

function testOperatorToggle() {
  const base = dslEditor.createState({
    version: 'X',
    longEntry: {
      type: 'AND',
      nodes: [
        { type: 'plugin', id: 'ma_cross' },
        { type: 'plugin', id: 'rsi_oversold' },
      ],
    },
  });

  const toggled = dslEditor.setRootOperator(base, 'longEntry', 'OR');
  assert.strictEqual(toggled.roles.longEntry.type, 'OR');

  const wrapped = dslEditor.toggleRootNot(toggled, 'longEntry');
  assert.strictEqual(wrapped.roles.longEntry.type, 'NOT');
  assert.strictEqual(wrapped.roles.longEntry.node.type, 'OR');
}

function testRemovalCollapse() {
  let state = dslEditor.createState();
  state = dslEditor.appendPlugin(state, 'longExit', { type: 'plugin', id: 'ma_cross_exit' });
  state = dslEditor.appendPlugin(state, 'longExit', { type: 'plugin', id: 'trailing_stop' });

  const collapsed = dslEditor.removeNode(state, 'longExit', ['nodes', 0]);
  assert.strictEqual(collapsed.roles.longExit.type, 'plugin');
  assert.strictEqual(collapsed.roles.longExit.id, 'trailing_stop');
}

function testSerialization() {
  const state = dslEditor.createState();
  const withPlugin = dslEditor.appendPlugin(state, 'shortEntry', { type: 'plugin', id: 'short_ma_cross' });
  const dsl = dslEditor.toStrategyDsl(withPlugin, 'LB-TEST');
  assert.strictEqual(dsl.version, 'LB-TEST');
  assert.strictEqual(dsl.shortEntry.id, 'short_ma_cross');
  assert(!('longEntry' in dsl));
}

function testSetSinglePlugin() {
  const initial = dslEditor.createState({
    longEntry: { type: 'plugin', id: 'ma_cross', params: { shortPeriod: 5 } },
  });

  const replaced = dslEditor.setSinglePlugin(initial, 'longEntry', {
    type: 'plugin',
    id: 'breakout',
    params: { window: 20 },
  });

  assert.strictEqual(replaced.roles.longEntry.type, 'plugin');
  assert.strictEqual(replaced.roles.longEntry.id, 'breakout');
  assert.deepStrictEqual(replaced.roles.longEntry.params, { window: 20 });

  const cleared = dslEditor.setSinglePlugin(replaced, 'longEntry', null);
  assert.strictEqual(cleared.roles.longEntry, null);

  const untouched = dslEditor.setSinglePlugin(initial, 'shortEntry', {
    type: 'plugin',
    id: 'short_ma_cross',
  });
  assert.strictEqual(untouched.roles.shortEntry.id, 'short_ma_cross');
  assert.strictEqual(initial.roles.longEntry.id, 'ma_cross', '原始 state 不應被修改');
}

function run() {
  testAppendPlugin();
  testOperatorToggle();
  testRemovalCollapse();
  testSerialization();
  testSetSinglePlugin();
  console.log('strategy-dsl-editor tests passed');
}

run();
