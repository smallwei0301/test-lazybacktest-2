const assert = require('assert');
const path = require('path');

const dslState = require(path.join('..', 'js', 'lib', 'strategy-dsl-state.js'));

const STATE_VERSION = 'LB-STRATEGY-DSL-STATE-20260922A';
const DSL_VERSION = 'LB-STRATEGY-DSL-20260916A';

function testAddRuleAndBuildDsl() {
  let state = dslState.createState(STATE_VERSION);
  state = dslState.addRule(state, 'longEntry', { id: 'ma_cross', params: { shortPeriod: 5 }, negated: false });
  let dsl = dslState.buildDsl(state);
  assert(dsl && dsl.longEntry, '應建立做多進場 DSL');
  assert.strictEqual(dsl.longEntry.id, 'ma_cross');
  assert.deepStrictEqual(dsl.longEntry.params, { shortPeriod: 5 });

  state = dslState.setOperator(state, 'longEntry', 'OR');
  state = dslState.addRule(state, 'longEntry', { id: 'rsi', params: { threshold: 30 }, negated: false });
  dsl = dslState.buildDsl(state);
  assert.strictEqual(dsl.longEntry.type, 'OR', '多條件時應使用 OR 結點');
  assert.strictEqual(dsl.longEntry.nodes.length, 2);
}

function testNegationAndReorder() {
  let state = dslState.createState(STATE_VERSION);
  state = dslState.addRule(state, 'longEntry', { id: 'ma_cross', params: {}, negated: false });
  state = dslState.addRule(state, 'longEntry', { id: 'rsi', params: {}, negated: false });
  state = dslState.toggleNegation(state, 'longEntry', 1);
  let dsl = dslState.buildDsl(state);
  const secondNode = dsl.longEntry.nodes[1];
  assert.strictEqual(secondNode.type, 'NOT', '切換 NOT 時應包裝為 NOT 結點');
  assert(secondNode.node && secondNode.node.id === 'rsi');

  state = dslState.reorderRules(state, 'longEntry', 1, 0);
  dsl = dslState.buildDsl(state);
  const firstNode = Array.isArray(dsl.longEntry.nodes) ? dsl.longEntry.nodes[0] : dsl.longEntry;
  if (Array.isArray(dsl.longEntry.nodes)) {
    assert.strictEqual(dsl.longEntry.nodes[0].node ? dsl.longEntry.nodes[0].node.id : dsl.longEntry.nodes[0].id, 'rsi');
  } else {
    assert.strictEqual(firstNode.node ? firstNode.node.id : firstNode.id, 'rsi');
  }
}

function testUpdateRuleParams() {
  let state = dslState.createState(STATE_VERSION);
  state = dslState.addRule(state, 'longEntry', { id: 'ma_cross', params: { shortPeriod: 5 }, negated: false });
  state = dslState.updateRule(state, 'longEntry', 0, { params: { shortPeriod: 10, longPeriod: 30 } });
  const dsl = dslState.buildDsl(state);
  assert.deepStrictEqual(dsl.longEntry.params, { shortPeriod: 10, longPeriod: 30 }, '應更新規則參數');
}

function testCreateStateFromDsl() {
  const dsl = {
    version: DSL_VERSION,
    longEntry: {
      type: 'OR',
      nodes: [
        { type: 'plugin', id: 'ma_cross', params: { shortPeriod: 5 } },
        { type: 'NOT', node: { type: 'plugin', id: 'rsi', params: { threshold: 70 } } },
      ],
    },
    longExit: { type: 'plugin', id: 'ma_cross_exit', params: { longPeriod: 20 } },
  };

  const state = dslState.fromDsl(dsl, dsl.version);
  assert(state.roles.longEntry.rules.length === 2, '應還原兩條做多進場規則');
  assert.strictEqual(state.roles.longEntry.operator, 'OR', '應還原 OR 結構');
  assert.strictEqual(state.roles.longEntry.rules[1].negated, true, '第二條規則應為 NOT');

  const rebuilt = dslState.buildDsl(state);
  assert(rebuilt.longEntry.type === 'OR', '重建後的 DSL 仍應為 OR');
  assert.strictEqual(rebuilt.longEntry.nodes[0].id, 'ma_cross', '第一條規則 ID 應為 ma_cross');
  assert.strictEqual(rebuilt.longEntry.nodes[1].type, 'NOT', '第二條規則應為 NOT 結點');
  assert.strictEqual(rebuilt.longExit.id, 'ma_cross_exit', '應還原多單出場規則');
}

function run() {
  testAddRuleAndBuildDsl();
  testNegationAndReorder();
  testUpdateRuleParams();
  testCreateStateFromDsl();
  console.log('strategy-dsl-state tests passed');
}

run();
