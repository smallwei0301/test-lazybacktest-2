import assert from 'node:assert/strict';
import { __TESTING__ } from '../netlify/functions/calculateAdjustedPrice.js';

const {
  normaliseDividendRecord,
  prepareDividendEvents,
  computeAdjustmentRatio,
  buildAdjustedRowsFromFactorMap,
} = __TESTING__;

function approxEqual(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} ≠ ${expected}`);
}

const englishRecord = {
  stock_id: '2330',
  CashDividend: '2.75',
  cash_dividend_total: '0.25',
  stock_dividend_total_ratio: '10%',
  stock_dividend_from_capital_reserve: '0.05',
  cash_capital_increase_ratio: '5%',
  cash_capital_increase_subscription_price: '50',
  stock_capital_increase_total_ratio: '0.02',
  cash_dividend_ex_dividend_date: '2024-07-15',
};

const englishNormalised = normaliseDividendRecord(englishRecord);
assert.ok(englishNormalised, 'English record should produce a normalised event');
approxEqual(englishNormalised.cashDividend, 3.0);
approxEqual(englishNormalised.stockDividend, 0.15);
approxEqual(englishNormalised.cashCapitalIncrease, 0.05);
approxEqual(englishNormalised.stockCapitalIncrease, 0.02);
approxEqual(englishNormalised.subscriptionPrice, 50);
assert.equal(englishNormalised.date, '2024-07-15');

const chineseRecord = {
  stock_id: '2603',
  現金股利金額: '3.1元',
  股票股利配股比率: '0.2',
  現金增資配股比率: '15%',
  現金增資認購價: '35',
  盈餘轉增資配股比例: '0.05',
  股票增資比率: '0.05',
  現金股利發放日: '2024-07-30',
  cash_dividend_ex_dividend_date: '2024-07-30',
};

const chineseNormalised = normaliseDividendRecord(chineseRecord);
assert.ok(chineseNormalised, 'Chinese record should produce a normalised event');
approxEqual(chineseNormalised.cashDividend, 3.1);
approxEqual(chineseNormalised.stockDividend, 0.2);
approxEqual(chineseNormalised.cashCapitalIncrease, 0.15);
approxEqual(chineseNormalised.stockCapitalIncrease, 0.1);
approxEqual(chineseNormalised.subscriptionPrice, 35);
assert.equal(chineseNormalised.date, '2024-07-30');

const duplicateRecords = [
  englishRecord,
  {
    cash_dividend_total_amount: '1.5',
    stock_dividend_total: '0.05',
    cash_dividend_ex_dividend_date: '2024-07-15',
  },
  chineseRecord,
];

const events = prepareDividendEvents(duplicateRecords);
assert.equal(events.length, 2, 'Should produce two distinct events by date');

const firstEvent = events.find((event) => event.date === '2024-07-15');
assert.ok(firstEvent, 'First event should exist');
approxEqual(firstEvent.cashDividend, 4.5);
approxEqual(firstEvent.stockDividend, 0.2);
approxEqual(firstEvent.cashCapitalIncrease, 0.05);
approxEqual(firstEvent.stockCapitalIncrease, 0.02);
approxEqual(firstEvent.subscriptionPrice, 50);

const secondEvent = events.find((event) => event.date === '2024-07-30');
assert.ok(secondEvent, 'Second event should exist');
approxEqual(secondEvent.cashDividend, 3.1);
approxEqual(secondEvent.stockDividend, 0.2);
approxEqual(secondEvent.cashCapitalIncrease, 0.15);
approxEqual(secondEvent.stockCapitalIncrease, 0.1);
approxEqual(secondEvent.subscriptionPrice, 35);

const diagnostics = {
  totalRecords: 0,
  missingExDate: 0,
  zeroAmountRecords: 0,
  normalisedRecords: 0,
  aggregatedEvents: 0,
  zeroAmountSamples: [],
};

const diagEvents = prepareDividendEvents(
  [
    { cash_dividend_ex_dividend_date: '2024-09-10', cash_dividend: '1.2' },
    { cash_dividend_ex_dividend_date: '2024-09-12', cash_dividend: '0' },
    { cash_dividend: '1.5' },
  ],
  { diagnostics },
);

assert.equal(diagnostics.totalRecords, 3);
assert.equal(diagnostics.normalisedRecords, 1);
assert.equal(diagnostics.missingExDate, 1);
assert.equal(diagnostics.zeroAmountRecords, 1);
assert.equal(diagnostics.aggregatedEvents, 1);
assert.equal(diagEvents.length, 1);

const zeroAmountDiagnostics = {
  totalRecords: 0,
  missingExDate: 0,
  zeroAmountRecords: 0,
  normalisedRecords: 0,
  aggregatedEvents: 0,
  zeroAmountSamples: [],
};

prepareDividendEvents(
  [
    {
      cash_dividend_ex_dividend_date: '2024-09-15',
      cash_dividend: '0',
      cash_dividend_total_amount: '0',
      cash_dividend_from_earnings: '0',
      stock_dividend_total: '0',
      stock_capital_increase_ratio: '0',
      現金股利金額: '0.0',
    },
  ],
  { diagnostics: zeroAmountDiagnostics },
);

assert.equal(zeroAmountDiagnostics.zeroAmountRecords, 1);
assert.ok(Array.isArray(zeroAmountDiagnostics.zeroAmountSamples));
assert.equal(zeroAmountDiagnostics.zeroAmountSamples.length, 1);
const zeroSnapshot = zeroAmountDiagnostics.zeroAmountSamples[0];
assert.equal(zeroSnapshot.date, '2024-09-15');
assert.ok(Array.isArray(zeroSnapshot.cashDividendFields));
assert.ok(zeroSnapshot.cashDividendFields.length > 0);

// Mixed adjustment ratio sanity check
const baseClose = 50;
const mixedRatio = computeAdjustmentRatio(baseClose, {
  cashDividend: 2,
  stockDividend: 0.1,
  stockCapitalIncrease: 0.05,
  cashCapitalIncrease: 0.15,
  subscriptionPrice: 45,
});
const expectedDenominator = baseClose * (1 + 0.1 + 0.05 + 0.15) + 2 - 0.15 * 45;
approxEqual(mixedRatio, baseClose / expectedDenominator);

const cashOnlyRatio = computeAdjustmentRatio(97, { cashDividend: 3 });
approxEqual(cashOnlyRatio, 97 / (97 + 3));

const rawSeries = [
  { date: '2024-07-10', open: 100, high: 102, low: 99, close: 100, volume: 5000 },
  { date: '2024-07-11', open: 98, high: 99, low: 96, close: 97, volume: 4200 },
  { date: '2024-07-12', open: 95, high: 96, low: 94, close: 95, volume: 3900 },
];
const factorMap = new Map([
  ['2024-07-10', 0.95],
  ['2024-07-11', 0.97],
  ['2024-07-12', 1],
]);
const fallbackResult = buildAdjustedRowsFromFactorMap(rawSeries, factorMap, { label: 'FinMind 還原序列' });
assert.equal(fallbackResult.rows.length, 3);
approxEqual(fallbackResult.rows[0].close, 95);
approxEqual(fallbackResult.rows[1].close, 94.09, 1e-2);
approxEqual(fallbackResult.rows[2].close, 95);
assert.equal(fallbackResult.adjustments.length, 2);
approxEqual(fallbackResult.adjustments[0].ratio, 0.97938, 1e-4);
approxEqual(fallbackResult.adjustments[1].ratio, 0.97, 1e-4);
assert.equal(fallbackResult.adjustments[0].source, 'FinMind 還原序列');
approxEqual(fallbackResult.adjustments[0].factorBefore, 0.95, 1e-6);
approxEqual(fallbackResult.adjustments[0].factorAfter, 0.97, 1e-6);
approxEqual(fallbackResult.adjustments[0].factorDelta, 0.02, 1e-6);
assert.equal(fallbackResult.adjustments[0].factorDirection, 'up');

const descendingFactorMap = new Map([
  ['2024-07-10', 1],
  ['2024-07-11', 0.95],
  ['2024-07-12', 0.92],
]);
const descendingResult = buildAdjustedRowsFromFactorMap(rawSeries, descendingFactorMap, {
  label: 'FinMind 還原序列',
});
assert.equal(descendingResult.adjustments.length, 2);
approxEqual(descendingResult.adjustments[0].ratio, 0.95, 1e-6);
approxEqual(descendingResult.adjustments[1].ratio, 0.968421, 1e-6);
approxEqual(descendingResult.adjustments[0].factorBefore, 1, 1e-6);
approxEqual(descendingResult.adjustments[0].factorAfter, 0.95, 1e-6);
assert.equal(descendingResult.adjustments[0].factorDirection, 'down');

console.log('Dividend normalisation tests passed');
