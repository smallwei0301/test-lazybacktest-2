const assert = require('assert');
const path = require('path');

const dslState = require(path.join('..', 'js', 'lib', 'strategy-dsl-state.js'));

function testBuildDslWithNegation() {
  const state = {
    version: 'LB-STRATEGY-DSL-20260916A',
    longEntry: {
      operator: 'AND',
      nodes: [
        { id: 'alpha', params: { period: 14 }, negate: false },
        { id: 'beta', params: { threshold: 30 }, negate: true },
      ],
    },
  };

  const dsl = dslState.buildDslFromState(state);
  assert(dsl, '應建立 DSL');
  assert.strictEqual(dsl.version, 'LB-STRATEGY-DSL-20260916A');
  assert.strictEqual(dsl.longEntry.type, 'AND');
  assert.strictEqual(dsl.longEntry.nodes.length, 2);
  const notNode = dsl.longEntry.nodes[1];
  assert.strictEqual(notNode.type, 'NOT', '第二個節點應被包裝為 NOT');
  assert.strictEqual(notNode.node.id, 'beta');
}

function testRootNotOperator() {
  const state = {
    longExit: {
      operator: 'NOT',
      nodes: [
        { id: 'gamma', params: { signalPeriod: 9 }, negate: false },
      ],
    },
  };

  const dsl = dslState.buildDslFromState(state, { version: 'LB-STRATEGY-DSL-20260916A' });
  assert(dsl.longExit, '應建立回補節點');
  assert.strictEqual(dsl.longExit.type, 'NOT');
  assert.strictEqual(dsl.longExit.node.id, 'gamma');
  assert.deepStrictEqual(dsl.longExit.node.params, { signalPeriod: 9 });
}

function testEmptyRolesProduceNull() {
  const dsl = dslState.buildDslFromState({ version: 'LB-STRATEGY-DSL-20260916A' });
  assert.strictEqual(dsl, null, '沒有節點時不應建立 DSL');
}

function run() {
  testBuildDslWithNegation();
  testRootNotOperator();
  testEmptyRolesProduceNull();
  console.log('strategy-dsl-state tests passed');
}

run();
