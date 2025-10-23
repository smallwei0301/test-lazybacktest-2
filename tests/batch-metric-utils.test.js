const assert = require('assert');

const utils = require('../js/batch-metric-utils.js');

function expectEqual(actual, expected, message) {
  assert.strictEqual(actual, expected, message);
}

function expectApprox(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-9, message + ` (expected ${expected}, got ${actual})`);
}

function captureCallbacks() {
  const events = { resolved: [], missing: [] };
  const options = {
    onResolved(detail) {
      events.resolved.push(detail);
    },
    onMissing(detail) {
      events.missing.push(detail);
    },
  };
  return { events, options };
}

(function testDirectNumericMetric() {
  const { events, options } = captureCallbacks();
  const result = { annualizedReturn: 12.3456 };
  const value = utils.resolveMetric(result, 'annualizedReturn', options);
  expectApprox(value, 12.3456, 'Should return direct numeric metric');
  expectEqual(events.resolved.length, 1, 'Should record resolved event');
  expectEqual(events.resolved[0].source, 'direct', 'Resolved source should be direct');
})();

(function testStringPercentageMetric() {
  const { events, options } = captureCallbacks();
  const result = { annualizedReturn: '8.25%' };
  const value = utils.resolveMetric(result, 'annualizedReturn', options);
  expectApprox(value, 8.25, 'Should parse percentage string');
  expectEqual(events.resolved[0].source, 'direct', 'Percentage should still be direct source');
})();

(function testFallbackMetricsObject() {
  const { events, options } = captureCallbacks();
  const result = { metrics: { annualizedReturn: '5.1' } };
  const value = utils.resolveMetric(result, 'annualizedReturn', options);
  expectApprox(value, 5.1, 'Should resolve from metrics object');
  expectEqual(events.resolved[0].source, 'metrics', 'Resolved source should be metrics');
})();

(function testFallbackMetricLabel() {
  const { events, options } = captureCallbacks();
  const result = { metricLabel: 'annualizedReturn', metric: '7.77' };
  const value = utils.resolveMetric(result, 'annualizedReturn', options);
  expectApprox(value, 7.77, 'Should resolve from metric label/value pair');
  expectEqual(events.resolved[0].source, 'metric', 'Resolved source should be metric');
})();

(function testFallbackSummaryMetrics() {
  const { events, options } = captureCallbacks();
  const result = { summary: { metrics: { annualizedReturn: 9.3 } } };
  const value = utils.resolveMetric(result, 'annualizedReturn', options);
  expectApprox(value, 9.3, 'Should resolve from summary metrics');
  expectEqual(events.resolved[0].source, 'summary.metrics', 'Resolved source should be summary metrics');
})();

(function testFallbackFinalResult() {
  const { events, options } = captureCallbacks();
  const result = { __finalResult: { annualizedReturn: '11.2' } };
  const value = utils.resolveMetric(result, 'annualizedReturn', options);
  expectApprox(value, 11.2, 'Should resolve from __finalResult metrics');
  expectEqual(events.resolved[0].source, '__finalResult', 'Resolved source should be __finalResult');
})();

(function testMissingMetricTriggersCallback() {
  const { events, options } = captureCallbacks();
  const result = { unrelated: 1 };
  const value = utils.resolveMetric(result, 'annualizedReturn', options);
  assert.ok(Number.isNaN(value), 'Missing metric should return NaN');
  expectEqual(events.resolved.length, 0, 'No resolved events for missing metric');
  expectEqual(events.missing.length, 1, 'Should record missing metric event');
  expectEqual(events.missing[0].metric, 'annualizedReturn', 'Missing detail should include metric name');
})();

console.log('All batch metric utility tests passed.');
