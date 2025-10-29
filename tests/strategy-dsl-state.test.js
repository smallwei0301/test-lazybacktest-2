const assert = require('assert');
const path = require('path');

const dslState = require(path.join('..', 'js', 'lib', 'strategy-dsl-state.js'));

function createSampleParams(idSuffix = '') {
  return { period: 10 + idSuffix.length, threshold: 20 + idSuffix.length };
}

function testSetPrimaryPlugin() {
  const state = dslState.createState();
  dslState.setPrimaryPlugin(state, 'longEntry', 'alpha', createSampleParams('a'));
  const serialized = dslState.serializeRole(state, 'longEntry');
  assert.deepStrictEqual(serialized, {
    type: 'plugin',
    id: 'alpha',
    params: { period: 11, threshold: 21 },
  });
}

function testAddNodeAndOperator() {
  const state = dslState.createState();
  dslState.setPrimaryPlugin(state, 'longEntry', 'alpha', createSampleParams('a'));
  dslState.addNode(state, 'longEntry', 'beta', createSampleParams('b'));
  dslState.setOperator(state, 'longEntry', 'OR');
  const serialized = dslState.serializeRole(state, 'longEntry');
  assert.strictEqual(serialized.type, 'OR');
  assert.strictEqual(serialized.nodes.length, 2);
  const ids = serialized.nodes.map((node) => node.type === 'plugin' ? node.id : node.node.id);
  assert.deepStrictEqual(ids, ['alpha', 'beta']);
}

function testToggleNegateAndReorder() {
  const state = dslState.createState();
  dslState.setPrimaryPlugin(state, 'longEntry', 'alpha', createSampleParams('a'));
  dslState.addNode(state, 'longEntry', 'beta', createSampleParams('b'));
  dslState.toggleNegate(state, 'longEntry', 0);
  dslState.reorderNode(state, 'longEntry', 0, 1);
  const serialized = dslState.serializeRole(state, 'longEntry');
  assert.strictEqual(serialized.type, 'AND');
  assert.strictEqual(serialized.nodes.length, 2);
  assert.deepStrictEqual(serialized.nodes[0], { type: 'plugin', id: 'beta', params: { period: 11, threshold: 21 } });
  assert.deepStrictEqual(serialized.nodes[1], { type: 'NOT', node: { type: 'plugin', id: 'alpha', params: { period: 11, threshold: 21 } } });
}

function run() {
  testSetPrimaryPlugin();
  testAddNodeAndOperator();
  testToggleNegateAndReorder();
  console.log('strategy-dsl-state tests passed');
}

run();
