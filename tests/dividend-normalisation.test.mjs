import assert from 'node:assert/strict';
import { __TESTING__ } from '../netlify/functions/calculateAdjustedPrice.js';

const {
  normaliseDividendRecord,
  prepareDividendEvents,
  computeAdjustmentRatio,
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

console.log('Dividend normalisation tests passed');
