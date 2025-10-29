const assert = require('assert');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

function runTest(name, fn) {
  try {
    fn();
    console.log(`\u2713 ${name}`);
  } catch (error) {
    console.error(`\u2717 ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

function loadModule() {
  const filePath = path.join(__dirname, '..', 'js', 'lib', 'strategy-dsl-editor.js');
  const code = fs.readFileSync(filePath, 'utf8');
  const context = {
    window: {},
    document: undefined,
    console,
  };
  context.globalThis = context;
  const script = new vm.Script(code, { filename: 'strategy-dsl-editor.js' });
  const ctx = vm.createContext(context);
  script.runInContext(ctx);
  return ctx.window.lazybacktestStrategyDslEditor || ctx.lazybacktestStrategyDslEditor;
}

runTest('serializePlugin node preserves params', () => {
  const editor = loadModule();
  const { serializeNode } = editor.__test__;
  const node = {
    kind: 'plugin',
    strategyId: 'rsi_oversold',
    params: { period: 14, threshold: 30 },
  };
  const serialized = serializeNode(node);
  const normalized = JSON.parse(JSON.stringify(serialized));
  assert.deepStrictEqual(normalized, {
    type: 'plugin',
    id: 'rsi_oversold',
    params: { period: 14, threshold: 30 },
  });
});

runTest('serializeNode builds nested logical groups', () => {
  const editor = loadModule();
  const { serializeNode } = editor.__test__;
  const node = {
    kind: 'group',
    operator: 'AND',
    children: [
      {
        kind: 'group',
        operator: 'OR',
        children: [
          { kind: 'plugin', strategyId: 'alpha', params: { foo: 1 } },
          { kind: 'plugin', strategyId: 'beta', params: { bar: 2 } },
        ],
      },
      {
        kind: 'group',
        operator: 'NOT',
        children: [
          { kind: 'plugin', strategyId: 'gamma', params: { baz: 3 } },
        ],
      },
    ],
  };
  const serialized = serializeNode(node);
  const normalized = JSON.parse(JSON.stringify(serialized));
  assert.deepStrictEqual(normalized, {
    type: 'AND',
    nodes: [
      {
        type: 'OR',
        nodes: [
          { type: 'plugin', id: 'alpha', params: { foo: 1 } },
          { type: 'plugin', id: 'beta', params: { bar: 2 } },
        ],
      },
      {
        type: 'NOT',
        node: { type: 'plugin', id: 'gamma', params: { baz: 3 } },
      },
    ],
  });
});

if (process.exitCode && process.exitCode !== 0) {
  process.exit(process.exitCode);
}
