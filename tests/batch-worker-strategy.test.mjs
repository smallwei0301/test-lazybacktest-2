import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

function createElementStub() {
  return new Proxy(function () {}, {
    apply() {
      return undefined;
    },
    get(target, prop) {
      if (prop === 'classList') {
        return {
          add() {},
          remove() {},
          toggle() {},
          contains() { return false; }
        };
      }
      if (prop === 'style') {
        return {};
      }
      if (prop === 'addEventListener' || prop === 'removeEventListener' || prop === 'dispatchEvent') {
        return () => {};
      }
      if (prop === 'querySelector' || prop === 'closest') {
        return () => createElementStub();
      }
      if (prop === 'querySelectorAll') {
        return () => [];
      }
      if (prop === Symbol.iterator) {
        return function* iterator() {};
      }
      return createElementStub();
    },
    set() {
      return true;
    }
  });
}

function installDomStubs() {
  const element = createElementStub();
  const documentStub = new Proxy({}, {
    get(target, prop) {
      if (prop === 'body' || prop === 'documentElement') {
        return element;
      }
      if (prop === 'createElement') {
        return () => element;
      }
      if (prop === 'getElementById' || prop === 'querySelector') {
        return () => element;
      }
      if (prop === 'querySelectorAll') {
        return () => [];
      }
      if (prop === 'addEventListener' || prop === 'removeEventListener') {
        return () => {};
      }
      return () => element;
    },
    set() {
      return true;
    }
  });

  globalThis.document = documentStub;
  const navigatorStub = { hardwareConcurrency: 2 };
  Object.defineProperty(globalThis, 'navigator', {
    value: navigatorStub,
    configurable: true,
    writable: true
  });
  globalThis.window = {
    addEventListener() {},
    removeEventListener() {},
    document: documentStub,
    navigator: navigatorStub
  };
  globalThis.localStorage = {
    getItem() { return null; },
    setItem() {},
    removeItem() {},
    clear() {}
  };
  globalThis.Worker = class {
    constructor() {}
    postMessage() {}
    terminate() {}
  };
}

function installStrategyStubs() {
  const descriptions = {
    ma_cross: { name: 'MA Entry' },
    ma_cross_exit: { name: 'MA Exit' },
    macd_cross_exit: { name: 'MACD Exit' },
    k_d_cross_exit: { name: 'KD Exit' }
  };
  globalThis.strategyDescriptions = descriptions;

  globalThis.normaliseStrategyIdForRole = function (role, strategyId) {
    if (role === 'exit') {
      if (strategyId === 'ma_cross') return 'ma_cross_exit';
      if (strategyId === 'macd_cross') return 'macd_cross_exit';
      if (strategyId === 'k_d_cross') return 'k_d_cross_exit';
    }
    return strategyId;
  };

  globalThis.normaliseStrategyIdAny = function (strategyId) {
    return globalThis.normaliseStrategyIdForRole('exit', strategyId);
  };

  globalThis.resolveStrategyLookupKey = function (strategyId, roleHint) {
    if (roleHint === 'exit') {
      return globalThis.normaliseStrategyIdForRole('exit', strategyId);
    }
    if (descriptions[strategyId]) {
      return strategyId;
    }
    return globalThis.normaliseStrategyIdForRole('exit', strategyId);
  };

  globalThis.recordBatchDebug = () => {};
  globalThis.showError = () => {};
  globalThis.updateBatchProgress = () => {};
  globalThis.restoreBatchOptimizationUI = () => {};
}

test('batch worker mapping keeps entry IDs and migrates exit aliases', async () => {
  installDomStubs();
  installStrategyStubs();

  const scriptPath = path.resolve('js/batch-optimization.js');
  const code = fs.readFileSync(scriptPath, 'utf8');
  vm.runInThisContext(code, { filename: scriptPath });

  assert.equal(typeof globalThis.normaliseBatchStrategyId, 'function');
  assert.equal(typeof globalThis.resolveWorkerStrategyName, 'function');
  assert.equal(typeof globalThis.getWorkerStrategyName, 'function');

  const entryId = globalThis.resolveWorkerStrategyName('ma_cross', 'entry');
  assert.equal(entryId, 'ma_cross', 'entry strategy should retain original ID');

  const legacyExit = globalThis.resolveWorkerStrategyName('ma_cross', 'exit');
  assert.equal(legacyExit, 'ma_cross_exit', 'legacy exit ID should migrate to new ID');

  const exitId = globalThis.resolveWorkerStrategyName('ma_cross_exit', 'exit');
  assert.equal(exitId, 'ma_cross_exit', 'new exit ID should remain unchanged');
});
