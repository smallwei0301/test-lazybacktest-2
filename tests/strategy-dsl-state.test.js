const assert = require('assert');
const path = require('path');

const paramApi = require(path.join('..', 'js', 'lib', 'strategy-param-schema.js'));
const dslStateFactory = require(path.join('..', 'js', 'lib', 'strategy-dsl-state.js'));

function createRegistry() {
  return {
    getStrategyMetaById(id) {
      if (!id) return null;
      return {
        id,
        label: id.toUpperCase(),
        paramsSchema: {
          type: 'object',
          properties: {
            threshold: { type: 'number', minimum: 0, maximum: 100, default: 20 },
          },
          additionalProperties: false,
        },
      };
    },
  };
}

function testAddAndBuildDsl() {
  const store = dslStateFactory.create({
    registry: createRegistry(),
    paramApi,
    version: 'TEST-DSL-V1',
  });

  store.setOperator('longEntry', 'AND');
  store.addNode('longEntry', 'extra_rule', { threshold: 120 });

  const state = store.getState();
  assert.strictEqual(state.longEntry.operator, 'AND');
  assert.strictEqual(state.longEntry.nodes.length, 1);
  assert.strictEqual(state.longEntry.nodes[0].params.threshold, 100, '應被最大值限制');

  const dsl = store.buildDsl({
    longEntry: { id: 'primary_rule', params: { threshold: -5 } },
  });

  assert(dsl, '應產生 DSL');
  assert.strictEqual(dsl.version, 'TEST-DSL-V1');
  assert.strictEqual(dsl.longEntry.type, 'AND');
  assert.strictEqual(dsl.longEntry.nodes.length, 2);
  assert.strictEqual(dsl.longEntry.nodes[0].id, 'primary_rule');
  assert.strictEqual(dsl.longEntry.nodes[0].params.threshold, 0, '主策略應套用下界');
}

function testNotOperatorIgnoresExtras() {
  const store = dslStateFactory.create({
    registry: createRegistry(),
    paramApi,
    version: 'TEST-DSL-V1',
  });

  store.setOperator('longExit', 'NOT');
  store.addNode('longExit', 'should_ignore');

  const dsl = store.buildDsl({
    longExit: { id: 'exit_rule', params: { threshold: 40 } },
  });

  assert.strictEqual(dsl.longExit.type, 'NOT');
  assert.strictEqual(dsl.longExit.node.id, 'exit_rule');
  assert(!dsl.longExit.node.nodes, 'NOT 節點僅包裹主策略');
}

function testRemoveAndReplaceNode() {
  const store = dslStateFactory.create({
    registry: createRegistry(),
    paramApi,
    version: 'TEST-DSL-V1',
  });

  store.setOperator('shortEntry', 'OR');
  store.addNode('shortEntry', 'first');
  store.addNode('shortEntry', 'second', { threshold: 5 });
  store.replaceNode('shortEntry', 0, 'replaced', { threshold: 70 });
  store.removeNode('shortEntry', 1);

  const state = store.getState();
  assert.strictEqual(state.shortEntry.nodes.length, 1, '應只剩一個節點');
  assert.strictEqual(state.shortEntry.nodes[0].id, 'replaced');
  assert.strictEqual(state.shortEntry.nodes[0].params.threshold, 70);

  const dsl = store.buildDsl({
    shortEntry: { id: 'primary_short', params: { threshold: 10 } },
  });
  assert.strictEqual(dsl.shortEntry.type, 'OR');
  assert.strictEqual(dsl.shortEntry.nodes.length, 2);
}

function run() {
  testAddAndBuildDsl();
  testNotOperatorIgnoresExtras();
  testRemoveAndReplaceNode();
  console.log('strategy-dsl-state tests passed');
}

run();
