const assert = require('assert');
const path = require('path');

const editorModule = require(path.join('..', 'js', 'strategies', 'dsl-editor.js'));

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
            period: { type: 'integer', minimum: 1, maximum: 200, default: 20 },
            threshold: { type: 'number', minimum: 0, maximum: 100, default: 30 },
          },
        },
      };
    },
  };
}

function testAddAndSerialize() {
  const registry = createRegistry();
  const editor = editorModule.createDslEditor({ registry, role: 'longEntry' });

  editor.setOperator('AND');
  const first = editor.addPlugin('alpha');
  assert.strictEqual(first.id, 'alpha');

  editor.addPlugin('beta', { period: 50, threshold: 70 });
  const nodes = editor.listNodes();
  assert.strictEqual(nodes.length, 2, '應有兩個節點');

  const dsl = editor.serialize();
  assert.strictEqual(dsl.type, 'AND');
  assert.strictEqual(dsl.nodes.length, 2);
  assert.deepStrictEqual(dsl.nodes[0], { type: 'plugin', id: 'alpha', params: { period: 20, threshold: 30 } });
  assert.deepStrictEqual(dsl.nodes[1], { type: 'plugin', id: 'beta', params: { period: 50, threshold: 70 } });
}

function testToggleNotAndReorder() {
  const registry = createRegistry();
  const editor = editorModule.createDslEditor({ registry, role: 'longEntry' });
  editor.setOperator('OR');
  editor.addPlugin('alpha');
  editor.addPlugin('beta');
  editor.toggleNot(1, true);

  let dsl = editor.serialize();
  assert.strictEqual(dsl.type, 'OR');
  assert.strictEqual(dsl.nodes.length, 2);
  assert.strictEqual(dsl.nodes[1].type, 'NOT');
  assert.strictEqual(dsl.nodes[1].node.id, 'beta');

  editor.reorderNode(1, 0);
  dsl = editor.serialize();
  assert.strictEqual(dsl.nodes[0].type, 'NOT', '重新排序後 NOT 應留在對應節點');
}

function testReplaceAndLoadDefinition() {
  const registry = createRegistry();
  const editor = editorModule.createDslEditor({ registry, role: 'longEntry' });
  editor.setOperator('AND');
  editor.addPlugin('alpha', { period: 30 });
  editor.replaceNode(0, 'gamma', { period: 10, threshold: 50 });

  let nodes = editor.listNodes();
  assert.strictEqual(nodes[0].id, 'gamma');
  assert.strictEqual(nodes[0].params.period, 10);

  editor.loadDefinition({
    type: 'OR',
    nodes: [
      { type: 'plugin', id: 'alpha', params: { period: 15 } },
      { type: 'NOT', node: { type: 'plugin', id: 'beta', params: { threshold: 80 } } },
    ],
  });

  nodes = editor.listNodes();
  assert.strictEqual(editor.getOperator(), 'OR');
  assert.strictEqual(nodes.length, 2);
  assert.strictEqual(nodes[1].negated, true);
  assert.strictEqual(nodes[1].params.threshold, 80);
}

function testLoadDefinitionWithVersionMetadata() {
  const registry = createRegistry();
  const editor = editorModule.createDslEditor({ registry, role: 'longEntry' });

  editor.loadDefinition({
    version: 'LB-STRATEGY-DSL-20260916A',
    type: 'OR',
    nodes: [
      { type: 'plugin', id: 'alpha', params: { period: 12 } },
      { type: 'NOT', node: { type: 'plugin', id: 'beta', params: { threshold: 65 } } },
    ],
    description: 'legacy definition',
  });

  const nodes = editor.listNodes();
  assert.strictEqual(editor.getOperator(), 'OR');
  assert.strictEqual(nodes.length, 2);
  assert.strictEqual(nodes[0].id, 'alpha');
  assert.strictEqual(nodes[0].params.period, 12);
  assert.strictEqual(nodes[1].id, 'beta');
  assert.strictEqual(nodes[1].negated, true);
  assert.strictEqual(nodes[1].params.threshold, 65);

  const serialized = editor.serialize();
  assert.strictEqual(serialized.type, 'OR');
  assert.strictEqual(serialized.nodes.length, 2);
  assert.strictEqual(serialized.nodes[1].type, 'NOT');
  assert.strictEqual(serialized.nodes[1].node.id, 'beta');
}

function run() {
  testAddAndSerialize();
  testToggleNotAndReorder();
  testReplaceAndLoadDefinition();
  testLoadDefinitionWithVersionMetadata();
  console.log('strategy-dsl-editor tests passed');
}

run();
