import assert from 'node:assert/strict';
import { handler, __TESTING__ } from '../netlify/functions/calculateAdjustedPrice.js';

const {
  computeAdjustmentRatio,
  buildAdjustedRowsFromFactorMap,
  classifyFinMindOutcome,
  applyBackwardAdjustments,
  normaliseDividendResultRecord,
  buildDividendResultEvents,
  normaliseSplitRecord,
  buildSplitEvents,
  setFetchImplementation,
  resetFetchImplementation,
} = __TESTING__;

function approxEqual(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} ≠ ${expected}`);
}

const baseSeries = [
  { date: '2024-07-10', open: 100, high: 102, low: 99, close: 100, volume: 5000 },
  { date: '2024-07-11', open: 98, high: 99, low: 96, close: 97, volume: 4200 },
  { date: '2024-07-12', open: 95, high: 96, low: 94, close: 95, volume: 3900 },
];

const primaryResultRecord = {
  date: '2024-07-11',
  before_price: '100',
  after_price: '97',
  stock_and_cache_dividend: '3',
};

const fallbackResultRecord = {
  date: '2024-09-18',
  before_price: '50',
  after_price: '48',
  stock_and_cache_dividend: '2',
};

const missingAfterPriceRecord = {
  date: '2024-11-05',
  before_price: '80',
  stock_and_cache_dividend: '1.5',
};

const normalisedPrimary = normaliseDividendResultRecord(primaryResultRecord);
assert.ok(normalisedPrimary, 'Primary result record should normalise');
assert.equal(normalisedPrimary.date, '2024-07-11');
approxEqual(normalisedPrimary.beforePrice, 100);
approxEqual(normalisedPrimary.afterPrice, 97);
approxEqual(normalisedPrimary.ratio, 0.97, 1e-6);
approxEqual(normalisedPrimary.dividendTotal, 3);

const normalisedFallback = normaliseDividendResultRecord(fallbackResultRecord);
assert.ok(normalisedFallback, 'Fallback result record should normalise when after_price exists');
assert.equal(normalisedFallback.date, '2024-09-18');
approxEqual(normalisedFallback.beforePrice, 50);
approxEqual(normalisedFallback.afterPrice, 48);
approxEqual(normalisedFallback.ratio, 0.96, 1e-6);
approxEqual(normalisedFallback.dividendTotal, 2);

const missingAfter = normaliseDividendResultRecord(missingAfterPriceRecord);
assert.equal(missingAfter, null, 'Record without after_price should be ignored');

const combinedEvents = buildDividendResultEvents([
  primaryResultRecord,
  { ...primaryResultRecord, after_price: '96.5' },
  fallbackResultRecord,
]);
assert.equal(combinedEvents.length, 2, 'Events should merge by date');
const mergedPrimary = combinedEvents.find((event) => event.date === '2024-07-11');
assert.ok(mergedPrimary);
approxEqual(mergedPrimary.manualRatio, 0.965, 1e-6);
approxEqual(mergedPrimary.beforePrice, 100);
approxEqual(mergedPrimary.afterPrice, 96.5);
approxEqual(mergedPrimary.dividendTotal, 3);

const adjusted = applyBackwardAdjustments(baseSeries, [], { preparedEvents: combinedEvents });
assert.equal(adjusted.adjustments.length, 2);
const primaryAdjustment = adjusted.adjustments.find((event) => event.date === '2024-07-11');
assert.ok(primaryAdjustment);
approxEqual(primaryAdjustment.ratio, 0.965, 1e-6);
approxEqual(adjusted.rows[0].close, 96.5, 1e-6);
approxEqual(adjusted.rows[1].close, 97, 1e-6);
approxEqual(adjusted.rows[1].adjustedFactor, 1, 1e-6);

const splitPrimaryRecord = {
  date: '2024-07-11',
  before_price: '100',
  after_price: '50',
};

const splitSecondaryRecord = {
  split_date: '113/07/11',
  split_ratio: '1/2',
};

const splitNormalized = normaliseSplitRecord(splitPrimaryRecord);
assert.ok(splitNormalized, 'Split primary record should normalise');
assert.equal(splitNormalized.date, '2024-07-11');
approxEqual(splitNormalized.beforePrice, 100);
approxEqual(splitNormalized.afterPrice, 50);
approxEqual(splitNormalized.ratio, 0.5, 1e-6);

const splitNormalizedSecondary = normaliseSplitRecord(splitSecondaryRecord);
assert.ok(splitNormalizedSecondary, 'Split secondary ratio should normalise');
assert.equal(splitNormalizedSecondary.date, '2024-07-11');
approxEqual(splitNormalizedSecondary.ratio, 0.5, 1e-6);

const splitEvents = buildSplitEvents([
  splitPrimaryRecord,
  splitSecondaryRecord,
  { split_day: '2024/09/18', before_split_price: '80', after_split_price: '40' },
]);
assert.equal(splitEvents.length, 2, 'Split events should merge by date');
const mergedSplit = splitEvents.find((event) => event.date === '2024-07-11');
assert.ok(mergedSplit, 'Merged split event should exist');
approxEqual(mergedSplit.manualRatio, 0.5, 1e-6);
approxEqual(mergedSplit.beforePrice, 100);
approxEqual(mergedSplit.afterPrice, 50);
assert.equal(Array.isArray(mergedSplit.rawRecords) ? mergedSplit.rawRecords.length : 0, 2);

const factorMap = new Map([
  ['2024-07-10', 0.95],
  ['2024-07-11', 0.97],
  ['2024-07-12', 1],
]);
const fallbackSeries = buildAdjustedRowsFromFactorMap(baseSeries, factorMap, { label: 'FinMind 還原序列' });
assert.equal(fallbackSeries.rows.length, 3);
approxEqual(fallbackSeries.rows[0].close, 95);
approxEqual(fallbackSeries.rows[1].close, 94.09, 1e-2);
approxEqual(fallbackSeries.rows[2].close, 95);
assert.equal(fallbackSeries.adjustments.length, 2);
approxEqual(fallbackSeries.adjustments[0].ratio, 0.97938, 1e-4);
approxEqual(fallbackSeries.adjustments[1].ratio, 0.97, 1e-4);
assert.equal(fallbackSeries.adjustments[0].source, 'FinMind 還原序列');

const descendingFactorMap = new Map([
  ['2024-07-10', 1],
  ['2024-07-11', 0.95],
  ['2024-07-12', 0.92],
]);
const descendingSeries = buildAdjustedRowsFromFactorMap(baseSeries, descendingFactorMap, { label: 'FinMind 還原序列' });
assert.equal(descendingSeries.adjustments.length, 2);
approxEqual(descendingSeries.adjustments[0].ratio, 0.95, 1e-6);
approxEqual(descendingSeries.adjustments[1].ratio, 0.968421, 1e-6);
assert.equal(descendingSeries.adjustments[0].factorDirection, 'down');

const classifyPermission = classifyFinMindOutcome({
  tokenPresent: true,
  dataset: 'TaiwanStockDividendResult',
  statusCode: 403,
  message: 'Your level is Register, subscribe plan to download data',
  dataCount: 0,
});
assert.equal(classifyPermission.status, 'permissionDenied');

const classifyParameter = classifyFinMindOutcome({
  tokenPresent: true,
  dataset: 'TaiwanStockDividendResult',
  statusCode: 422,
  message: 'parameter start_date format error',
  dataCount: 0,
});
assert.equal(classifyParameter.status, 'parameterError');

const classifyNoData = classifyFinMindOutcome({
  tokenPresent: true,
  dataset: 'TaiwanStockDividendResult',
  statusCode: 200,
  message: 'No data found',
  dataCount: 0,
});
assert.equal(classifyNoData.status, 'noData');

const classifySuccess = classifyFinMindOutcome({
  tokenPresent: true,
  dataset: 'TaiwanStockDividendResult',
  statusCode: 200,
  message: '',
  dataCount: 3,
});
assert.equal(classifySuccess.status, 'success');

const originalToken = process.env.FINMIND_TOKEN;
process.env.FINMIND_TOKEN = 'test-token';

const twsePayload = {
  stat: 'OK',
  title: '公司 2330 台積電 股票',
  data: [
    ['113/07/10', '1,000', '100,000', '100', '101', '99', '100', '0', '0'],
    ['113/07/11', '1,200', '110,000', '98', '99', '96', '97', '0', '-3'],
    ['113/07/12', '900', '90,000', '95', '96', '94', '95', '0', '-2'],
  ],
};

const finmindDividendPayload = {
  msg: 'success',
  status: 200,
  data: [
    {
      date: '2024-07-11',
      before_price: '100',
      after_price: '97',
      stock_and_cache_dividend: '3',
    },
  ],
};

const finmindSplitPayload = {
  msg: 'success',
  status: 200,
  data: [
    {
      date: '2024-07-11',
      before_price: '100',
      after_price: '50',
      split_ratio: '1/2',
    },
  ],
};

function createJsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  };
}

process.env.FINMIND_TOKEN = 'test-token';

setFetchImplementation(async (url) => {
  if (url.includes('twse.com.tw')) {
    return createJsonResponse(twsePayload);
  }
  if (url.includes('finmindtrade')) {
    const parsed = new URL(url);
    const dataset = parsed.searchParams.get('dataset');
    if (dataset === 'TaiwanStockDividendResult') {
      return createJsonResponse(finmindDividendPayload);
    }
    if (dataset === 'TaiwanStockSplitPrice') {
      return createJsonResponse(finmindSplitPayload);
    }
  }
  throw new Error(`Unexpected fetch URL in test: ${url}`);
});

try {
  const response = await handler({
    queryStringParameters: {
      stockNo: '2330',
      startDate: '2024-07-10',
      endDate: '2024-07-12',
      market: 'TWSE',
    },
  });
  assert.equal(response.statusCode, 200);
  const payload = JSON.parse(response.body);
  assert.ok(Array.isArray(payload.data));
  assert.equal(payload.data.length, 3);
  const adjustedRow = payload.data.find((row) => row.date === '2024-07-10');
  assert.ok(adjustedRow, 'Should include July 10 price row');
  approxEqual(adjustedRow.close, 97, 1e-6);
  const appliedAdjustment = payload.adjustments.find((event) => event.date === '2024-07-11' && !event.skipped);
  assert.ok(appliedAdjustment, 'Dividend result adjustment should be applied');
  approxEqual(appliedAdjustment.ratio, 0.97, 1e-6);
  assert.equal(payload.dividendDiagnostics?.eventPreviewTotal, 1);
  assert.equal(payload.dividendDiagnostics?.eventPreviewMore, 0);
  assert.ok(Array.isArray(payload.dividendDiagnostics?.responseLog));
  assert.ok(payload.dividendDiagnostics.responseLog.length >= 1);
} finally {
  resetFetchImplementation();
}

setFetchImplementation(async (url) => {
  if (url.includes('twse.com.tw')) {
    return createJsonResponse(twsePayload);
  }
  if (url.includes('finmindtrade')) {
    const parsed = new URL(url);
    const dataset = parsed.searchParams.get('dataset');
    if (dataset === 'TaiwanStockDividendResult') {
      return createJsonResponse(finmindDividendPayload);
    }
    if (dataset === 'TaiwanStockSplitPrice') {
      return createJsonResponse(finmindSplitPayload);
    }
  }
  throw new Error(`Unexpected fetch URL in test: ${url}`);
});

try {
  const response = await handler({
    queryStringParameters: {
      stockNo: '2330',
      startDate: '2024-07-10',
      endDate: '2024-07-12',
      market: 'TWSE',
      split: '1',
    },
  });
  assert.equal(response.statusCode, 200);
  const payload = JSON.parse(response.body);
  assert.ok(Array.isArray(payload.data));
  assert.equal(payload.summary?.splitEvents, 1);
  assert.equal(payload.splitDiagnostics?.splitResult?.totalRecords, 3);
  assert.equal(payload.finmindStatus?.splitPrice?.dataset, 'TaiwanStockSplitPrice');
  const splitAdjustment = payload.adjustments.find((event) => event?.source === 'FinMind 股票拆分');
  assert.ok(splitAdjustment, 'Split adjustment should be applied when enabled');
  approxEqual(splitAdjustment.ratio, 0.5, 1e-6);
  assert.ok(Array.isArray(payload.adjustmentDebugLog), 'Adjustment debug log should be present');
  const splitLogEntry = payload.adjustmentDebugLog.find((entry) =>
    entry?.title?.includes('股票拆分') || entry?.source?.includes('股票拆分'),
  );
  assert.ok(splitLogEntry, 'Split debug log entry should exist');
  assert.ok(
    Array.isArray(splitLogEntry.lines) &&
      splitLogEntry.lines.some((line) => line.includes('after_price ÷ before_price')),
    'Split debug log should include ratio calculation details',
  );
  assert.ok(
    Array.isArray(payload.splitDiagnostics?.debugLog) && payload.splitDiagnostics.debugLog.length > 0,
    'Split diagnostics should expose debug log entries',
  );
} finally {
  resetFetchImplementation();
  if (originalToken === undefined) {
    delete process.env.FINMIND_TOKEN;
  } else {
    process.env.FINMIND_TOKEN = originalToken;
  }
}

console.log('Dividend & split normalisation tests passed');
