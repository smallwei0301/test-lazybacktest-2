const fs = require('fs');
const path = require('path');
const vm = require('vm');

const repoRoot = path.resolve(__dirname, '..');
const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  Math,
};
sandbox.self = sandbox;
sandbox.window = sandbox;

function runScript(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  const code = fs.readFileSync(absolutePath, 'utf8');
  vm.runInNewContext(code, sandbox, { filename: relativePath });
}

runScript('js/strategy-plugin-contract.js');
runScript('js/strategy-plugin-registry.js');

const pluginsDir = path.join(repoRoot, 'js', 'strategy-plugins');
fs.readdirSync(pluginsDir)
  .filter((file) => file.endsWith('.js'))
  .sort()
  .forEach((file) => {
    runScript(path.join('js', 'strategy-plugins', file));
  });

const registry = sandbox.self.StrategyPluginRegistry;
if (!registry) {
  throw new Error('StrategyPluginRegistry 尚未載入');
}

const strategies =
  typeof registry.listStrategies === 'function'
    ? registry.listStrategies()
    : typeof registry.list === 'function'
    ? registry.list()
    : null;

if (!Array.isArray(strategies) || strategies.length === 0) {
  throw new Error('Registry 尚未註冊任何策略');
}

const seenIds = new Set();
strategies.forEach((plugin) => {
  if (!plugin || !plugin.meta) {
    throw new Error('策略插件缺少 meta');
  }
  if (seenIds.has(plugin.meta.id)) {
    throw new Error(`策略 ID 重複：${plugin.meta.id}`);
  }
  seenIds.add(plugin.meta.id);
});

const indicatorSeries = new Map(
  Object.entries({
    maShort: [99, 100, 101, 102, 103],
    maLong: [100, 100, 100, 101, 102],
    maShortExit: [102, 101, 100, 99, 98],
    maLongExit: [100, 100, 99, 98, 97],
    maShortShortEntry: [104, 103, 102, 101, 100],
    maLongShortEntry: [100, 100, 100, 100, 100],
    maShortCover: [100, 101, 102, 103, 104],
    maLongCover: [102, 101, 100, 99, 98],
    rsiEntry: [25, 28, 29, 32, 40],
    rsiExit: [80, 78, 75, 70, 65],
    rsiShortEntry: [75, 73, 72, 70, 68],
    rsiCover: [28, 30, 35, 40, 45],
    kEntry: [20, 25, 30, 35, 40],
    dEntry: [35, 32, 28, 26, 24],
    kExit: [70, 72, 74, 65, 60],
    dExit: [65, 68, 72, 75, 76],
    kShortEntry: [70, 72, 74, 65, 60],
    dShortEntry: [65, 68, 72, 75, 76],
    kCover: [20, 25, 28, 35, 40],
    dCover: [35, 32, 28, 25, 24],
    bollingerUpperEntry: [101, 102, 103, 104, 105],
    bollingerMiddleExit: [102, 101, 100, 99, 98],
    bollingerMiddleShortEntry: [102, 101, 100, 99, 98],
    bollingerUpperCover: [101, 102, 103, 104, 105],
  }),
);

const series = {
  close: [100, 101, 102, 103, 104],
  open: [99, 100, 101, 102, 103],
  high: [101, 102, 103, 104, 105],
  low: [98, 99, 100, 101, 102],
  date: ['2024-01-02', '2024-01-03', '2024-01-04', '2024-01-05', '2024-01-08'],
};

function inferRole(strategyId) {
  if (strategyId.startsWith('cover_')) return 'shortExit';
  if (strategyId.startsWith('short_')) return 'shortEntry';
  if (strategyId.endsWith('_exit') || strategyId.includes('stop')) return 'longExit';
  return 'longEntry';
}

function buildParams(meta) {
  const params = {};
  const schema = meta && meta.paramsSchema;
  if (schema && schema.properties) {
    Object.keys(schema.properties).forEach((key) => {
      const definition = schema.properties[key];
      if (definition && Object.prototype.hasOwnProperty.call(definition, 'default')) {
        params[key] = definition.default;
      }
    });
  }
  return params;
}

const uiOptions = strategies.map((plugin) => ({
  id: plugin.meta.id,
  label: plugin.meta.label,
}));
console.log('[registry] 已註冊策略', uiOptions.length);
console.log('[registry] 範例策略', uiOptions.slice(0, 3));

const randomIndex = Math.floor(Math.random() * strategies.length);
const randomPlugin = strategies[randomIndex];
const randomRole = inferRole(randomPlugin.meta.id);

const cache = new Map();
const helpers = {
  getIndicator(key) {
    return indicatorSeries.get(key);
  },
  log: () => {},
  setCache(key, value) {
    cache.set(key, value);
  },
  getCache(key) {
    return cache.get(key);
  },
};

const runtimeInfo = {
  warmupStartIndex: 0,
  effectiveStartIndex: 1,
  length: series.close.length,
};

const contextForRandom = {
  role: randomRole,
  index: 3,
  series,
  helpers,
  runtime: runtimeInfo,
};

const randomParams = buildParams(randomPlugin.meta);
const randomExtras = { __runtime: { currentPrice: 98, referencePrice: 100 } };
const randomResult = randomPlugin.run(contextForRandom, {
  ...randomParams,
  ...randomExtras,
});
console.log('[registry] 隨機策略執行結果', {
  id: randomPlugin.meta.id,
  role: randomRole,
  result: randomResult,
});

strategies.forEach((plugin) => {
  const role = inferRole(plugin.meta.id);
  const params = buildParams(plugin.meta);
  const extras = { __runtime: { currentPrice: 98, referencePrice: 100 } };
  const cacheStore = new Map();
  const localHelpers = {
    getIndicator(key) {
      return indicatorSeries.get(key);
    },
    log: () => {},
    setCache(key, value) {
      cacheStore.set(key, value);
    },
    getCache(key) {
      return cacheStore.get(key);
    },
  };
  const context = {
    role,
    index: 3,
    series,
    helpers: localHelpers,
    runtime: runtimeInfo,
  };
  plugin.run(context, { ...params, ...extras });
});

console.log('[registry] 全部策略執行完成');
