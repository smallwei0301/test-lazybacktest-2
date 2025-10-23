const fs = require('fs');
const vm = require('vm');

function loadScript(code, filename, context) {
    const script = new vm.Script(code, { filename });
    script.runInContext(context);
}

function extractSegment(source, startToken, endToken) {
    const start = source.indexOf(startToken);
    if (start === -1) throw new Error(`Token not found: ${startToken}`);
    const end = source.indexOf(endToken, start);
    if (end === -1) throw new Error(`End token not found after ${startToken}`);
    return source.slice(start, end);
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

const sandbox = {
    console,
    setTimeout: () => {},
};

sandbox.window = sandbox;
const elements = new Map();
const queryMap = new Map();

function createElement(id, initial = {}) {
    const element = {
        id,
        value: '',
        checked: false,
        style: {},
        type: 'text',
        ...initial,
    };
    elements.set(id, element);
    return element;
}

function registerQuery(selector, element) {
    queryMap.set(selector, element);
    return element;
}

const documentStub = {
    getElementById(id) {
        return elements.get(id) || null;
    },
    querySelector(selector) {
        if (queryMap.has(selector)) {
            return queryMap.get(selector);
        }
        const match = selector.match(/^input\[name="([^"]+)"\]\[value="([^"]+)"\]$/);
        if (!match) return null;
        const key = `${match[1]}::${match[2]}`;
        return queryMap.get(key) || null;
    },
    addEventListener: () => {},
};

sandbox.document = documentStub;

const localStorageStub = {
    store: {},
    getItem(key) {
        return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
    },
    setItem(key, value) {
        this.store[key] = String(value);
    },
    removeItem(key) {
        delete this.store[key];
    },
};

sandbox.localStorage = localStorageStub;

const infoLogs = [];
const errorLogs = [];
const successLogs = [];
const updateCalls = [];

sandbox.showInfo = (msg) => infoLogs.push(msg);
sandbox.showError = (msg) => errorLogs.push(msg);
sandbox.showSuccess = (msg) => successLogs.push(msg);
sandbox.setDefaultFees = () => {};
sandbox.updateStrategyParams = (type) => updateCalls.push(type);
sandbox.runBacktestInternal = () => { throw new Error('runBacktestInternal should not be invoked in tests'); };
sandbox.confirm = () => false;
sandbox.lastOverallResult = null;
sandbox.lastSubPeriodResults = null;

sandbox.window.lazybacktestStagedEntry = {
    setValues: () => {},
    resetToDefault: () => {},
};

sandbox.window.lazybacktestStagedExit = {
    setValues: () => {},
    resetToDefault: () => {},
};

sandbox.SAVED_STRATEGIES_KEY = 'test-strategies';

const context = vm.createContext(sandbox);

const strategyIdUtilsSource = fs.readFileSync('js/strategy-id-utils.js', 'utf8');
loadScript(strategyIdUtilsSource, 'strategy-id-utils.js', context);

const backtestSource = fs.readFileSync('js/backtest.js', 'utf8');
const strategyIdUtilsInit = extractSegment(
    backtestSource,
    'const strategyIdUtils =',
    '};\n\nconst ANNUALIZED_SENSITIVITY_THRESHOLDS'
) + '};';
loadScript(strategyIdUtilsInit, 'backtest-strategy-utils-snippet.js', context);

const getSavedStrategiesSource = extractSegment(
    backtestSource,
    'function getSavedStrategies()',
    'function saveStrategyToLocalStorage'
);
loadScript(getSavedStrategiesSource, 'backtest-getSavedStrategies.js', context);

const loadStrategySource = extractSegment(
    backtestSource,
    'function loadStrategy()',
    'function deleteStrategy()'
);
loadScript(loadStrategySource, 'backtest-loadStrategy.js', context);

function setupDomForTest() {
    elements.clear();
    queryMap.clear();

    createElement('loadStrategySelect', { value: '' });
    createElement('stockNo');
    createElement('startDate');
    createElement('endDate');
    createElement('initialCapital');
    createElement('recentYears');
    createElement('buyFee');
    createElement('sellFee');
    createElement('positionSize');
    createElement('stopLoss');
    createElement('takeProfit');
    createElement('entryStrategy');
    createElement('exitStrategy');
    createElement('shortEntryStrategy');
    createElement('shortExitStrategy');
    createElement('entryStagingMode');
    createElement('exitStagingMode');
    createElement('enableShortSelling', { checked: false });
    createElement('short-strategy-area', { style: { display: 'none' } });

    createElement('entryShortPeriod');
    createElement('exitShortPeriod');
    createElement('shortEntryShortPeriod');
    createElement('shortExitShortPeriod');

    const tradeTimingClose = createElement('tradeTiming-close', { type: 'radio', checked: false });
    registerQuery('input[name="tradeTiming"][value="close"]', tradeTimingClose);
    registerQuery('tradeTiming::close', tradeTimingClose);

    const positionBasisInitial = createElement('positionBasis-initial', { type: 'radio', checked: false });
    registerQuery('input[name="positionBasis"][value="initialCapital"]', positionBasisInitial);
    registerQuery('positionBasis::initialCapital', positionBasisInitial);
}

function populateSavedStrategies() {
    const baseSettings = {
        stockNo: '2330',
        startDate: '2020-01-01',
        endDate: '2021-01-01',
        initialCapital: 100000,
        tradeTiming: 'close',
        buyFee: 0.1425,
        sellFee: 0.4425,
        positionSize: 100,
        entryStrategy: 'ma_cross',
        entryParams: { shortPeriod: 5 },
        entryStages: [{ percentage: 50, days: 1 }],
        entryStagingMode: 'signal_repeat',
        exitStrategy: 'ma_cross',
        exitParams: { shortPeriod: 8 },
        exitStages: [{ percentage: 50, days: 1 }],
        exitStagingMode: 'signal_repeat',
        enableShorting: true,
        shortEntryStrategy: 'ma_cross',
        shortEntryParams: { shortPeriod: 7 },
        shortExitStrategy: 'ma_cross',
        shortExitParams: { shortPeriod: 9 },
        stopLoss: 0,
        takeProfit: 0,
        positionBasis: 'initialCapital',
    };

    const modernSettings = {
        ...baseSettings,
        exitStrategy: 'ma_cross_exit',
        shortEntryStrategy: 'short_ma_cross',
        shortExitStrategy: 'cover_ma_cross',
        enableShorting: false,
    };

    const payload = {
        Legacy: {
            settings: { ...baseSettings },
        },
        Modern: {
            settings: { ...modernSettings },
        },
    };

    localStorageStub.setItem(sandbox.SAVED_STRATEGIES_KEY, JSON.stringify(payload));
}

setupDomForTest();
populateSavedStrategies();

const loadSelect = elements.get('loadStrategySelect');
loadSelect.value = 'Legacy';

context.loadStrategy();

assert(elements.get('exitStrategy').value === 'ma_cross_exit', 'Legacy exit strategy should migrate to ma_cross_exit');
assert(elements.get('shortEntryStrategy').value === 'short_ma_cross', 'Legacy short entry should migrate to short_ma_cross');
assert(elements.get('shortExitStrategy').value === 'cover_ma_cross', 'Legacy short exit should migrate to cover_ma_cross');
assert(elements.get('short-strategy-area').style.display === 'grid', 'Short area should be visible for legacy strategy');

const storedAfterLegacy = JSON.parse(localStorageStub.getItem(sandbox.SAVED_STRATEGIES_KEY));
assert(storedAfterLegacy.Legacy.settings.exitStrategy === 'ma_cross_exit', 'Stored legacy exit should be canonical');
assert(storedAfterLegacy.Legacy.settings.shortEntryStrategy === 'short_ma_cross', 'Stored legacy short entry should be canonical');
assert(storedAfterLegacy.Legacy.settings.shortExitStrategy === 'cover_ma_cross', 'Stored legacy short exit should be canonical');

loadSelect.value = 'Modern';
context.loadStrategy();

assert(elements.get('short-strategy-area').style.display === 'none', 'Short area should be hidden when shorting disabled');
assert(elements.get('exitStrategy').value === 'ma_cross_exit', 'Modern exit strategy should remain canonical');
assert(elements.get('shortEntryStrategy').value === 'short_ma_cross', 'Modern short entry retains canonical value');
assert(elements.get('shortExitStrategy').value === 'cover_ma_cross', 'Modern short exit retains canonical value');

console.log('Strategy load compatibility tests passed.');
