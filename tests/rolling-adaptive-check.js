const fs = require('fs');
const path = require('path');
const vm = require('vm');

function createSandbox() {
  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    fetch: async () => ({ ok: true, json: async () => ({}), text: async () => '' }),
    Chart: {
      helpers: { getRelativePosition: () => ({ x: 0, y: 0 }) },
      registry: { plugins: { items: {} } },
    },
    document: {
      addEventListener() {},
      getElementById() { return null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      body: { classList: { add() {}, remove() {} } },
    },
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  return sandbox;
}

function buildSyntheticResult(months) {
  const dates = [];
  const returns = [];
  const start = new Date('2019-01-02');
  let cursor = 0;
  let equity = 100000;
  const targetLength = Math.max(5, Math.floor(months * 21));
  while (dates.length < targetLength) {
    const date = new Date(start.getTime() + cursor * 86400000);
    cursor += 1;
    const day = date.getDay();
    if (day === 0 || day === 6) {
      continue;
    }
    dates.push(date.toISOString().slice(0, 10));
    const drift = Math.sin(dates.length / 37) / 220 + 0.0006;
    equity *= 1 + drift;
    returns.push(((equity - 100000) / 100000) * 100);
  }
  return {
    dates,
    strategyReturns: returns,
    initialCapital: 100000,
  };
}

function main() {
  const sandbox = createSandbox();
  const code = fs.readFileSync(path.join(__dirname, '..', 'js', 'backtest.js'), 'utf8');
  vm.runInNewContext(code, sandbox, { filename: 'js/backtest.js' });

  const adaptiveAnalysis = sandbox.computeRollingAnalysis(buildSyntheticResult(12));
  if (adaptiveAnalysis.status !== 'ok') {
    throw new Error(`Expected adaptive analysis to succeed, got status ${adaptiveAnalysis.status}`);
  }
  if (!adaptiveAnalysis.summary?.usesAdaptivePresets) {
    throw new Error('Adaptive analysis did not flag use of short-term presets');
  }
  if ((adaptiveAnalysis.summary.availableAdaptiveConfigs || 0) === 0) {
    throw new Error('Adaptive analysis reported zero adaptive configs');
  }
  if (adaptiveAnalysis.windows.length === 0) {
    throw new Error('Adaptive analysis returned no windows');
  }

  const insufficientAnalysis = sandbox.computeRollingAnalysis(buildSyntheticResult(2));
  if (insufficientAnalysis.status !== 'insufficient') {
    throw new Error('Expected insufficient analysis for very short dataset');
  }

  console.log('[Rolling Adaptive Check] adaptive windows:', adaptiveAnalysis.windows.length);
  console.log('[Rolling Adaptive Check] adaptive score:', adaptiveAnalysis.summary.overallScore?.toFixed(2));
  console.log('[Rolling Adaptive Check] fallback message:', insufficientAnalysis.message);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('[Rolling Adaptive Check] failed:', error.message);
    process.exitCode = 1;
  }
}
