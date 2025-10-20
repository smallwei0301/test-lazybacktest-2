const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

class WorkerStub {
  constructor(url) {
    this.url = url;
    this.onmessage = null;
    this.onerror = null;
    this.terminated = false;
    this.postedMessages = [];
    WorkerStub.lastInstance = this;
  }

  postMessage(message) {
    this.postedMessages.push(message);
    WorkerStub.lastMessage = message;
    const respond = () => {
      if (!this.onmessage) return;
      if (message.type === 'runOptimization') {
        this.onmessage({
          data: {
            type: 'result',
            data: {
              results: [
                {
                  paramValue: message.optimizeRange.from,
                  annualizedReturn: 1,
                },
              ],
            },
          },
        });
      } else if (message.type === 'runBacktest') {
        this.onmessage({ data: { type: 'result', data: { annualizedReturn: 0 } } });
      }
    };
    setImmediate(respond);
  }

  terminate() {
    this.terminated = true;
  }
}
WorkerStub.lastMessage = null;

function createDataset(startISO, lengthDays) {
  const rows = [];
  const start = new Date(`${startISO}T00:00:00Z`);
  for (let i = 0; i < lengthDays; i += 1) {
    const date = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const iso = date.toISOString().slice(0, 10);
    rows.push({ date: iso, close: 100 + i });
  }
  return rows;
}

function buildCoverage(startISO, endISO) {
  return [{ start: startISO, end: endISO }];
}

async function run() {
  const context = {
    console,
    window: {},
    document: {
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => ({ appendChild: () => {} }),
    },
    setTimeout,
    clearTimeout,
    navigator: { hardwareConcurrency: 4 },
    Worker: WorkerStub,
    workerUrl: 'stub-worker.js',
    cachedDataStore: new Map(),
    Map,
    cachedStockData: null,
    normalizeMarketKeyForCache: (market) => (market || 'TWSE').toUpperCase(),
    buildCacheKey(cur) {
      if (!cur) return '';
      const market = (cur.market || 'TWSE').toUpperCase();
      const stockNo = (cur.stockNo || '').toString().toUpperCase();
      const priceModeKey = (cur.priceMode || (cur.adjustedPrice ? 'adjusted' : 'raw')).toLowerCase() === 'adjusted'
        ? 'ADJ'
        : 'RAW';
      const splitFlag = cur.splitAdjustment ? 'SPLIT' : 'NOSPLIT';
      const dataStart = cur.dataStartDate || cur.startDate || cur.effectiveStartDate || 'NA';
      const effectiveStart = cur.effectiveStartDate || cur.startDate || 'NA';
      const lookbackKey = Number.isFinite(cur.lookbackDays)
        ? `LB${Math.round(cur.lookbackDays)}`
        : 'LB-';
      return `${market}|${stockNo}|${priceModeKey}|${splitFlag}|${dataStart}|${effectiveStart}|${lookbackKey}`;
    },
    ensureDatasetCacheEntryFresh: (key, entry) => entry,
    computeCoverageFromRows: (rows) => {
      if (!Array.isArray(rows) || rows.length === 0) return [];
      const sorted = [...rows].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      return [{ start: sorted[0].date, end: sorted[sorted.length - 1].date }];
    },
    buildCachedMetaFromEntry: (entry) => ({
      priceMode: entry.priceMode,
      splitAdjustment: entry.splitAdjustment,
      coverage: entry.coverage,
    }),
    materializeSupersetCacheEntry: () => {},
    hydrateDatasetFromStorage: () => {},
    currentMarket: 'TWSE',
    cachedStockData: null,
    lastFetchSettings: null,
    getMetricFromResult: (result) => result.annualizedReturn || 0,
    getWorkerStrategyName: (name) => name,
    getStrategyChineseName: (name) => name,
    getStatusChineseText: (status) => status,
    renderBatchWorkerStatus: () => {},
    updateBatchProgress: () => {},
    showBatchResults: () => {},
    showLoading: () => {},
    hideLoading: () => {},
    showError: () => {},
    showSuccess: () => {},
    updateStrategyStatusLoading: () => {},
    updateStrategyStatusSuccess: () => {},
    updateStrategyStatusError: () => {},
    batchOptimizationResults: [],
  };

  const batchOptPath = path.join(__dirname, '..', 'js', 'batch-optimization.js');
  const scriptSource = fs.readFileSync(batchOptPath, 'utf8');
  const vmContext = vm.createContext(context);
  vm.runInContext(scriptSource, vmContext, { filename: 'batch-optimization.js' });

  // Override lookback enrichment to use provided params directly.
  vmContext.enrichParamsWithLookback = (params) => params;

  const shortDataset = createDataset('2024-02-01', 150);
  const longDataset = createDataset('2023-09-01', 300);

  const params = {
    stockNo: '2330',
    startDate: '2024-04-01',
    endDate: '2024-06-30',
    dataStartDate: '2023-12-01',
    effectiveStartDate: '2024-04-01',
    lookbackDays: 120,
    adjustedPrice: true,
    splitAdjustment: true,
    marketType: 'TWSE',
    entryParams: {},
    exitParams: {},
  };

  function setCacheEntry(dataset, coverage, priceMode = 'adjusted') {
    const key = context.buildCacheKey({
      stockNo: params.stockNo,
      dataStartDate: params.dataStartDate,
      startDate: params.dataStartDate,
      endDate: params.endDate,
      effectiveStartDate: params.effectiveStartDate,
      market: 'TWSE',
      adjustedPrice: params.adjustedPrice,
      splitAdjustment: params.splitAdjustment,
      priceMode,
      lookbackDays: params.lookbackDays,
    });
    context.cachedDataStore.clear();
    context.cachedDataStore.set(key, {
      data: dataset,
      coverage,
      priceMode,
      splitAdjustment: params.splitAdjustment,
    });
  }

  // Scenario 1: coverage insufficient should disable cache
  context.cachedStockData = shortDataset;
  context.lastFetchSettings = {
    stockNo: params.stockNo,
    startDate: params.startDate,
    dataStartDate: '2024-02-01',
    endDate: params.endDate,
    effectiveStartDate: params.effectiveStartDate,
    adjustedPrice: params.adjustedPrice,
    splitAdjustment: params.splitAdjustment,
    priceMode: 'adjusted',
    lookbackDays: 60,
  };
  setCacheEntry(shortDataset, buildCoverage('2024-02-01', '2024-06-30'));
  WorkerStub.lastMessage = null;
  const optimizeResult1 = await vmContext.optimizeSingleStrategyParameter(
    { ...params },
    { name: 'fast_ma', range: { from: 5, to: 10, step: 1 } },
    'entry',
    'annualizedReturn',
    5,
  );
  assert.strictEqual(WorkerStub.lastMessage.useCachedData, false, 'Expected cache disabled when coverage insufficient');
  assert.strictEqual(typeof optimizeResult1, 'object');

  // Scenario 2: coverage sufficient should reuse cache and include cachedMeta coverage
  context.cachedStockData = longDataset;
  context.lastFetchSettings = {
    stockNo: params.stockNo,
    startDate: params.startDate,
    dataStartDate: '2023-09-01',
    endDate: params.endDate,
    effectiveStartDate: params.effectiveStartDate,
    adjustedPrice: params.adjustedPrice,
    splitAdjustment: params.splitAdjustment,
    priceMode: 'adjusted',
    lookbackDays: params.lookbackDays,
  };
  setCacheEntry(longDataset, buildCoverage('2023-12-01', '2024-06-30'));
  WorkerStub.lastMessage = null;
  await vmContext.optimizeSingleStrategyParameter(
    { ...params },
    { name: 'fast_ma', range: { from: 5, to: 10, step: 1 } },
    'entry',
    'annualizedReturn',
    5,
  );
  assert.strictEqual(WorkerStub.lastMessage.useCachedData, true, 'Expected cache reused when coverage sufficient');
  assert.ok(
    Array.isArray(WorkerStub.lastMessage.cachedMeta?.coverage),
    'Expected cachedMeta coverage provided to worker',
  );

  // Scenario 3: price mode mismatch forces refetch
  setCacheEntry(longDataset, buildCoverage('2023-12-01', '2024-06-30'), 'raw');
  WorkerStub.lastMessage = null;
  await vmContext.optimizeSingleStrategyParameter(
    { ...params },
    { name: 'fast_ma', range: { from: 5, to: 10, step: 1 } },
    'entry',
    'annualizedReturn',
    5,
  );
  assert.strictEqual(
    WorkerStub.lastMessage.useCachedData,
    false,
    'Expected cache disabled when price mode mismatches',
  );

  // Scenario 4: combination backtest mirrors cache decision
  setCacheEntry(shortDataset, buildCoverage('2024-02-01', '2024-06-30'));
  context.cachedStockData = shortDataset;
  const combination = {
    buyStrategy: 'ma_cross',
    sellStrategy: 'ma_cross',
    buyParams: {},
    sellParams: {},
  };
  WorkerStub.lastMessage = null;
  await vmContext.executeBacktestForCombination(combination, {
    baseParamsOverride: { ...params },
  });
  assert.strictEqual(
    WorkerStub.lastMessage.useCachedData,
    false,
    'Expected combination backtest to disable cache when coverage insufficient',
  );

  console.log('All batch optimization cache tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
