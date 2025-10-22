#!/usr/bin/env node
// Patch Tag: LB-PLUGIN-ATOMS-20250710A — Strategy plugin parity verification for extracted atomic rules.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectRoot = path.resolve(__dirname, '..');
const sandbox = {
  console,
};

sandbox.self = sandbox;
sandbox.globalThis = sandbox;

const context = vm.createContext(sandbox);

function loadScript(relativePath) {
  const filePath = path.join(projectRoot, relativePath);
  const code = fs.readFileSync(filePath, 'utf8');
  const script = new vm.Script(code, { filename: relativePath });
  script.runInContext(context);
}

[
  'js/strategy-plugin-contract.js',
  'js/strategy-plugin-registry.js',
  'js/strategy-plugins/rsi-threshold.js',
  'js/strategy-plugins/kd-cross.js',
  'js/strategy-plugins/bollinger-band.js',
  'js/strategy-plugins/moving-average-cross.js',
  'js/strategy-plugins/atr-stop.js',
].forEach(loadScript);

const registry = context.StrategyPluginRegistry;
const contract = context.StrategyPluginContract;

if (!registry || !contract) {
  throw new Error('Strategy plugin contract 或 registry 載入失敗');
}

const check = (value) => typeof value === 'number' && Number.isFinite(value);

function computeRsiCross(series, direction, threshold) {
  const result = [];
  if (!Array.isArray(series)) return result;
  const t = Number(threshold);
  for (let i = 1; i < series.length; i += 1) {
    const current = series[i];
    const previous = series[i - 1];
    if (!check(current) || !check(previous)) continue;
    if (direction === 'above') {
      if (current > t && previous <= t) result.push(i);
    } else if (direction === 'below') {
      if (current < t && previous >= t) result.push(i);
    }
  }
  return result;
}

function computeKdCross(kSeries, dSeries, cross, thresholdDirection, thresholdValue) {
  const result = [];
  if (!Array.isArray(kSeries) || !Array.isArray(dSeries)) return result;
  const limit = Math.min(kSeries.length, dSeries.length);
  const threshold = Number.isFinite(Number(thresholdValue))
    ? Number(thresholdValue)
    : null;
  for (let i = 1; i < limit; i += 1) {
    const kNow = kSeries[i];
    const dNow = dSeries[i];
    const kPrev = kSeries[i - 1];
    const dPrev = dSeries[i - 1];
    if (!check(kNow) || !check(dNow) || !check(kPrev) || !check(dPrev)) continue;
    const crossed =
      cross === 'kAboveD'
        ? kNow > dNow && kPrev <= dPrev
        : kNow < dNow && kPrev >= dPrev;
    if (!crossed) continue;
    let thresholdPassed = true;
    if (thresholdDirection === 'lt' && threshold !== null) {
      thresholdPassed = dNow < threshold;
    } else if (thresholdDirection === 'gt' && threshold !== null) {
      thresholdPassed = dNow > threshold;
    }
    if (thresholdPassed) {
      result.push(i);
    }
  }
  return result;
}

function computeBollingerCross(priceSeries, bandSeries, comparison) {
  const result = [];
  if (!Array.isArray(priceSeries) || !Array.isArray(bandSeries)) return result;
  const limit = Math.min(priceSeries.length, bandSeries.length);
  for (let i = 1; i < limit; i += 1) {
    const price = priceSeries[i];
    const prevPrice = priceSeries[i - 1];
    const band = bandSeries[i];
    const prevBand = bandSeries[i - 1];
    if (!check(price) || !check(prevPrice) || !check(band) || !check(prevBand)) {
      continue;
    }
    const crossed =
      comparison === 'priceCrossAbove'
        ? price > band && prevPrice <= prevBand
        : price < band && prevPrice >= prevBand;
    if (crossed) {
      result.push(i);
    }
  }
  return result;
}

function computeMaCross(fastSeries, slowSeries, comparison) {
  const result = [];
  if (!Array.isArray(fastSeries) || !Array.isArray(slowSeries)) return result;
  const limit = Math.min(fastSeries.length, slowSeries.length);
  for (let i = 1; i < limit; i += 1) {
    const fastNow = fastSeries[i];
    const slowNow = slowSeries[i];
    const fastPrev = fastSeries[i - 1];
    const slowPrev = slowSeries[i - 1];
    if (!check(fastNow) || !check(slowNow) || !check(fastPrev) || !check(slowPrev)) {
      continue;
    }
    const crossed =
      comparison === 'fastAboveSlow'
        ? fastNow > slowNow && fastPrev <= slowPrev
        : fastNow < slowNow && fastPrev >= slowPrev;
    if (crossed) {
      result.push(i);
    }
  }
  return result;
}

function computeAtrCross(priceSeries, stopSeries, comparison) {
  const result = [];
  if (!Array.isArray(priceSeries) || !Array.isArray(stopSeries)) return result;
  const limit = Math.min(priceSeries.length, stopSeries.length);
  for (let i = 1; i < limit; i += 1) {
    const price = priceSeries[i];
    const prevPrice = priceSeries[i - 1];
    const stop = stopSeries[i];
    const prevStop = stopSeries[i - 1];
    if (!check(price) || !check(prevPrice) || !check(stop) || !check(prevStop)) {
      continue;
    }
    const crossed =
      comparison === 'priceBelowStop'
        ? price < stop && prevPrice >= prevStop
        : price > stop && prevPrice <= prevStop;
    if (crossed) {
      result.push(i);
    }
  }
  return result;
}

function resolveLength(series) {
  const keys = Object.keys(series);
  for (const key of keys) {
    if (Array.isArray(series[key])) {
      return series[key].length;
    }
  }
  return 0;
}

function normaliseSeriesArray(length, maybeArray) {
  if (!Array.isArray(maybeArray)) {
    return new Array(length).fill(null);
  }
  if (maybeArray.length === length) {
    return maybeArray.slice();
  }
  const padded = new Array(length).fill(null);
  for (let i = 0; i < length && i < maybeArray.length; i += 1) {
    padded[i] = maybeArray[i];
  }
  return padded;
}

function collectPluginTriggers(testCase) {
  const { alias, role, params, field, series } = testCase;
  const resolution = registry.resolve(role, alias);
  if (!resolution || !resolution.plugin) {
    throw new Error(`無法解析插件 ${alias} (${role})`);
  }
  const plugin = resolution.plugin;
  const mappedParams =
    typeof resolution.mapParams === 'function'
      ? resolution.mapParams(params || {}, { role, strategyKey: alias })
      : params || {};
  const length = resolveLength(series) || 10;
  const pluginSeries = {
    close: normaliseSeriesArray(length, series.close),
    open: normaliseSeriesArray(length, series.open),
    high: normaliseSeriesArray(length, series.high),
    low: normaliseSeriesArray(length, series.low),
    volume: normaliseSeriesArray(length, series.volume),
    date: normaliseSeriesArray(length, series.date),
  };
  const helperCache = new Map();
  const helpers = {
    getIndicator(key) {
      return Array.isArray(series[key]) ? series[key] : [];
    },
    log() {},
    setCache(key, value) {
      helperCache.set(key, value);
    },
    getCache(key) {
      return helperCache.get(key);
    },
  };
  const runtime = {
    warmupStartIndex: Math.min(2, length - 1),
    effectiveStartIndex: Math.min(2, length - 1),
    length,
  };
  const triggers = [];
  for (let index = 0; index < length; index += 1) {
    const ctx = {
      role,
      index,
      series: pluginSeries,
      helpers,
      runtime,
    };
    const result = plugin.run(ctx, mappedParams);
    const ensured = contract.ensureRuleResult(result, {
      pluginId: plugin.meta.id,
      role,
      index,
    });
    if (ensured[field] === true) {
      triggers.push(index);
    }
  }
  return triggers;
}

function buildFlatClose() {
  return [
    100, 100, 100, 100, 100, 100, 100, 100, 100, 100,
  ];
}

const cases = [
  {
    description: 'RSI 低檔反彈觸發多頭進場',
    alias: 'rsi_oversold',
    role: 'longEntry',
    params: { threshold: 30 },
    field: 'enter',
    series: {
      close: buildFlatClose(),
      rsiEntry: [45, 40, 28, 27, 33, 45, 50, 48, 47, 46],
    },
    expected(series) {
      return computeRsiCross(series.rsiEntry, 'above', 30);
    },
  },
  {
    description: 'RSI 高檔回落觸發多頭出場',
    alias: 'rsi_overbought',
    role: 'longExit',
    params: { threshold: 70 },
    field: 'exit',
    series: {
      close: buildFlatClose(),
      rsiExit: [65, 68, 72, 71, 69, 65, 60, 58, 55, 54],
    },
    expected(series) {
      return computeRsiCross(series.rsiExit, 'below', 70);
    },
  },
  {
    description: 'RSI 高檔反轉觸發放空進場',
    alias: 'short_rsi_overbought',
    role: 'shortEntry',
    params: { threshold: 70 },
    field: 'short',
    series: {
      close: buildFlatClose(),
      rsiShortEntry: [75, 78, 74, 73, 71, 68, 65, 64, 63, 62],
    },
    expected(series) {
      return computeRsiCross(series.rsiShortEntry, 'below', 70);
    },
  },
  {
    description: 'RSI 低檔翻揚觸發空單回補',
    alias: 'cover_rsi_oversold',
    role: 'shortExit',
    params: { threshold: 30 },
    field: 'cover',
    series: {
      close: buildFlatClose(),
      rsiCover: [35, 33, 28, 29, 31, 35, 40, 45, 42, 38],
    },
    expected(series) {
      return computeRsiCross(series.rsiCover, 'above', 30);
    },
  },
  {
    description: 'KD 黃金交叉觸發多頭進場',
    alias: 'k_d_cross',
    role: 'longEntry',
    params: { thresholdX: 30 },
    field: 'enter',
    series: {
      close: buildFlatClose(),
      kEntry: [20, 25, 26, 32, 36, 40, 45, 50, 48, 46],
      dEntry: [30, 28, 27, 29, 31, 33, 35, 38, 40, 42],
    },
    expected(series) {
      return computeKdCross(series.kEntry, series.dEntry, 'kAboveD', 'lt', 30);
    },
  },
  {
    description: 'KD 死亡交叉觸發多頭出場',
    alias: 'k_d_cross',
    role: 'longExit',
    params: { thresholdY: 70 },
    field: 'exit',
    series: {
      close: buildFlatClose(),
      kExit: [80, 85, 83, 78, 72, 68, 65, 60, 58, 55],
      dExit: [78, 80, 82, 79, 74, 70, 68, 66, 64, 62],
    },
    expected(series) {
      return computeKdCross(series.kExit, series.dExit, 'kBelowD', 'gt', 70);
    },
  },
  {
    description: 'KD 死亡交叉觸發放空進場',
    alias: 'short_k_d_cross',
    role: 'shortEntry',
    params: { thresholdY: 70 },
    field: 'short',
    series: {
      close: buildFlatClose(),
      kShortEntry: [85, 88, 86, 80, 74, 70, 68, 66, 64, 62],
      dShortEntry: [82, 84, 85, 82, 78, 74, 72, 70, 68, 66],
    },
    expected(series) {
      return computeKdCross(series.kShortEntry, series.dShortEntry, 'kBelowD', 'gt', 70);
    },
  },
  {
    description: 'KD 黃金交叉觸發空單回補',
    alias: 'cover_k_d_cross',
    role: 'shortExit',
    params: { thresholdX: 30 },
    field: 'cover',
    series: {
      close: buildFlatClose(),
      kCover: [25, 28, 32, 35, 38, 40, 42, 44, 43, 42],
      dCover: [35, 32, 29, 27, 26, 25, 24, 23, 24, 25],
    },
    expected(series) {
      return computeKdCross(series.kCover, series.dCover, 'kAboveD', 'lt', 30);
    },
  },
  {
    description: '布林帶突破觸發多頭進場',
    alias: 'bollinger_breakout',
    role: 'longEntry',
    params: {},
    field: 'enter',
    series: {
      close: [98, 99, 100, 101, 102, 104, 103, 102, 101, 100],
      bollingerUpperEntry: [100, 100, 100, 101, 102, 103, 103, 103, 103, 103],
    },
    expected(series) {
      return computeBollingerCross(
        series.close,
        series.bollingerUpperEntry,
        'priceCrossAbove',
      );
    },
  },
  {
    description: '布林帶跌破中軌觸發多頭出場',
    alias: 'bollinger_reversal',
    role: 'longExit',
    params: {},
    field: 'exit',
    series: {
      close: [105, 104, 103, 98, 96, 95, 94, 93, 92, 91],
      bollingerMiddleExit: [103, 103, 102, 101, 100, 99, 98, 97, 96, 95],
    },
    expected(series) {
      return computeBollingerCross(
        series.close,
        series.bollingerMiddleExit,
        'priceCrossBelow',
      );
    },
  },
  {
    description: '布林帶跌破中軌觸發放空進場',
    alias: 'short_bollinger_reversal',
    role: 'shortEntry',
    params: {},
    field: 'short',
    series: {
      close: [100, 101, 103, 99, 98, 97, 96, 95, 94, 93],
      bollingerMiddleShortEntry: [99, 100, 102, 100, 99, 98, 97, 96, 95, 94],
    },
    expected(series) {
      return computeBollingerCross(
        series.close,
        series.bollingerMiddleShortEntry,
        'priceCrossBelow',
      );
    },
  },
  {
    description: '布林帶突破上軌觸發空單回補',
    alias: 'cover_bollinger_breakout',
    role: 'shortExit',
    params: {},
    field: 'cover',
    series: {
      close: [105, 104, 103, 102, 101, 103, 105, 106, 104, 103],
      bollingerUpperCover: [107, 106, 105, 104, 103, 102, 102, 102, 102, 102],
    },
    expected(series) {
      return computeBollingerCross(
        series.close,
        series.bollingerUpperCover,
        'priceCrossAbove',
      );
    },
  },
  {
    description: '均線黃金交叉觸發多頭進場',
    alias: 'ma_cross',
    role: 'longEntry',
    params: {},
    field: 'enter',
    series: {
      close: buildFlatClose(),
      maShort: [10, 9, 8, 9, 10, 12, 13, 14, 13, 12],
      maLong: [11, 10, 9, 9, 9, 10, 11, 11, 11, 11],
    },
    expected(series) {
      return computeMaCross(series.maShort, series.maLong, 'fastAboveSlow');
    },
  },
  {
    description: '均線死亡交叉觸發多頭出場',
    alias: 'ma_cross',
    role: 'longExit',
    params: {},
    field: 'exit',
    series: {
      close: buildFlatClose(),
      maShortExit: [14, 13, 12, 11, 9, 8, 7, 6, 7, 8],
      maLongExit: [12, 12, 11, 11, 10, 9, 8, 7, 7, 7],
    },
    expected(series) {
      return computeMaCross(
        series.maShortExit,
        series.maLongExit,
        'fastBelowSlow',
      );
    },
  },
  {
    description: 'EMA 黃金交叉別名驗證',
    alias: 'ema_cross',
    role: 'longEntry',
    params: {},
    field: 'enter',
    series: {
      close: buildFlatClose(),
      maShort: [10, 9, 8, 9, 10, 12, 13, 14, 13, 12],
      maLong: [11, 10, 9, 9, 9, 10, 11, 11, 11, 11],
    },
    expected(series) {
      return computeMaCross(series.maShort, series.maLong, 'fastAboveSlow');
    },
  },
  {
    description: '均線死亡交叉觸發放空進場',
    alias: 'short_ma_cross',
    role: 'shortEntry',
    params: {},
    field: 'short',
    series: {
      close: buildFlatClose(),
      maShortShortEntry: [16, 15, 14, 13, 11, 9, 8, 7, 6, 5],
      maLongShortEntry: [14, 14, 13, 13, 12, 11, 10, 9, 8, 7],
    },
    expected(series) {
      return computeMaCross(
        series.maShortShortEntry,
        series.maLongShortEntry,
        'fastBelowSlow',
      );
    },
  },
  {
    description: 'EMA 死亡交叉別名驗證',
    alias: 'short_ema_cross',
    role: 'shortEntry',
    params: {},
    field: 'short',
    series: {
      close: buildFlatClose(),
      maShortShortEntry: [16, 15, 14, 13, 11, 9, 8, 7, 6, 5],
      maLongShortEntry: [14, 14, 13, 13, 12, 11, 10, 9, 8, 7],
    },
    expected(series) {
      return computeMaCross(
        series.maShortShortEntry,
        series.maLongShortEntry,
        'fastBelowSlow',
      );
    },
  },
  {
    description: '均線黃金交叉觸發空單回補',
    alias: 'cover_ma_cross',
    role: 'shortExit',
    params: {},
    field: 'cover',
    series: {
      close: buildFlatClose(),
      maShortCover: [8, 8, 9, 10, 12, 14, 15, 16, 15, 14],
      maLongCover: [10, 10, 10, 10, 11, 12, 12, 12, 12, 12],
    },
    expected(series) {
      return computeMaCross(
        series.maShortCover,
        series.maLongCover,
        'fastAboveSlow',
      );
    },
  },
  {
    description: 'EMA 黃金交叉回補別名驗證',
    alias: 'cover_ema_cross',
    role: 'shortExit',
    params: {},
    field: 'cover',
    series: {
      close: buildFlatClose(),
      maShortCover: [8, 8, 9, 10, 12, 14, 15, 16, 15, 14],
      maLongCover: [10, 10, 10, 10, 11, 12, 12, 12, 12, 12],
    },
    expected(series) {
      return computeMaCross(
        series.maShortCover,
        series.maLongCover,
        'fastAboveSlow',
      );
    },
  },
  {
    description: 'ATR 停損線跌破觸發多頭出場',
    alias: 'atr_stop_loss',
    role: 'longExit',
    params: { atrPeriod: 14, atrMultiplier: 3 },
    field: 'exit',
    series: {
      close: [100, 102, 103, 105, 104, 100, 98, 97, 99, 101],
      atrStopLongExit: [90, 95, 97, 99, 100, 101, 100, 99, 98, 97],
    },
    expected(series) {
      return computeAtrCross(
        series.close,
        series.atrStopLongExit,
        'priceBelowStop',
      );
    },
  },
  {
    description: 'ATR 停損線突破觸發空單回補',
    alias: 'cover_atr_stop_loss',
    role: 'shortExit',
    params: { atrPeriod: 14, atrMultiplier: 3 },
    field: 'cover',
    series: {
      close: [105, 104, 103, 102, 101, 100, 98, 95, 97, 99],
      atrStopShortCover: [120, 115, 110, 105, 102, 100, 98, 96, 96, 97],
    },
    expected(series) {
      return computeAtrCross(
        series.close,
        series.atrStopShortCover,
        'priceAboveStop',
      );
    },
  },
];

let passed = 0;
for (const testCase of cases) {
  const actual = collectPluginTriggers(testCase);
  const expected = testCase.expected(testCase.series);
  const actualKey = JSON.stringify(actual);
  const expectedKey = JSON.stringify(expected);
  if (actualKey !== expectedKey) {
    throw new Error(
      `${testCase.description} 觸發索引不符，預期 ${expectedKey} 實際 ${actualKey}`,
    );
  }
  passed += 1;
}

console.log(`Strategy plugin parity checks passed: ${passed}/${cases.length}`);
