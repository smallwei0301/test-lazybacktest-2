import fs from 'fs';
import vm from 'vm';

const workerSource = fs.readFileSync(new URL('../js/worker.js', import.meta.url), 'utf-8');
const sandbox = {
  self: {
    addEventListener() {},
    removeEventListener() {},
    postMessage() {},
  },
  console,
  fetch: async () => { throw new Error('fetch not stubbed'); },
  URLSearchParams,
  Map,
  Set,
};
vm.createContext(sandbox);
vm.runInContext(workerSource, sandbox);

const { computeRangeCoverageMeta, shouldTriggerFallbackRangeSwitch } = sandbox;

if (typeof computeRangeCoverageMeta !== 'function' || typeof shouldTriggerFallbackRangeSwitch !== 'function') {
  throw new Error('Required helpers were not initialised from worker.js');
}

const buildRows = (startISO, count) => {
  const rows = [];
  let current = new Date(startISO);
  while (rows.length < count) {
    const day = current.getUTCDay();
    if (day !== 0 && day !== 6) {
      rows.push({ date: current.toISOString().split('T')[0] });
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return rows;
};

const startISO = '2024-01-01';
const endISO = '2024-01-31';
const partialRows = buildRows(startISO, 10); // roughly前半段

const coverage = computeRangeCoverageMeta(partialRows, startISO, endISO);
const decision = shouldTriggerFallbackRangeSwitch(coverage, {
  trailingGapThreshold: sandbox.RANGE_FALLBACK_CONFIG?.TRAILING_GAP_WEEKDAYS_THRESHOLD ?? 5,
  densityThreshold: sandbox.RANGE_FALLBACK_CONFIG?.DENSITY_THRESHOLD ?? 0.7,
  minWeekdays: sandbox.RANGE_FALLBACK_CONFIG?.MIN_REQUESTED_WEEKDAYS ?? 5,
});

console.log('[Fallback Check] Coverage:', coverage);
console.log('[Fallback Check] Decision:', decision);

const denseRows = buildRows(startISO, 15);
const denseCoverage = computeRangeCoverageMeta(denseRows, startISO, endISO);
const denseDecision = shouldTriggerFallbackRangeSwitch(denseCoverage, {
  trailingGapThreshold: sandbox.RANGE_FALLBACK_CONFIG?.TRAILING_GAP_WEEKDAYS_THRESHOLD ?? 5,
  densityThreshold: sandbox.RANGE_FALLBACK_CONFIG?.DENSITY_THRESHOLD ?? 0.7,
  minWeekdays: sandbox.RANGE_FALLBACK_CONFIG?.MIN_REQUESTED_WEEKDAYS ?? 5,
});

console.log('[Fallback Check] Dense coverage:', denseCoverage);
console.log('[Fallback Check] Dense decision:', denseDecision);
