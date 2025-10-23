const fs = require('fs');
const vm = require('vm');

const backtestCode = fs.readFileSync('js/backtest.js', 'utf8');
const strategySectionStart = backtestCode.indexOf('const STRATEGY_ROLE_LEGACY_ID_MAP');
const strategySectionEnd = backtestCode.indexOf('const STRATEGY_COMPARISON_VERSION');
if (strategySectionStart === -1 || strategySectionEnd === -1) {
    throw new Error('Unable to locate strategy role legacy mapping section in js/backtest.js');
}
const strategySection = backtestCode.slice(strategySectionStart, strategySectionEnd);

const normaliseHelperStart = backtestCode.indexOf('function normaliseStrategySettingsFromStorage');
const normaliseHelperEnd = backtestCode.indexOf('function saveStrategyToLocalStorage');
if (normaliseHelperStart === -1 || normaliseHelperEnd === -1) {
    throw new Error('Unable to locate normalization helpers in js/backtest.js');
}
const normaliseHelpers = backtestCode.slice(normaliseHelperStart, normaliseHelperEnd);

const getSavedStart = backtestCode.indexOf('function getSavedStrategies()');
const getSavedEnd = backtestCode.indexOf('function saveStrategyToLocalStorage');
if (getSavedStart === -1 || getSavedEnd === -1) {
    throw new Error('Unable to locate getSavedStrategies in js/backtest.js');
}
const getSavedBody = backtestCode.slice(getSavedStart, getSavedEnd);

const context = {
    console,
    localStorage: (() => {
        const store = new Map();
        return {
            getItem(key) {
                return store.has(key) ? store.get(key) : null;
            },
            setItem(key, value) {
                store.set(key, String(value));
            },
            removeItem(key) {
                store.delete(key);
            },
            dump() {
                return Array.from(store.entries());
            }
        };
    })(),
    SAVED_STRATEGIES_KEY: 'stockBacktestStrategies_v3.4',
};

vm.createContext(context);
vm.runInContext(`${strategySection}\n${normaliseHelpers}\n${getSavedBody}`, context);

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

// Prepare legacy and modern strategy payloads
const legacySettings = {
    stockNo: '2330',
    entryStrategy: 'ma_cross',
    exitStrategy: 'ma_cross',
    enableShorting: true,
    shortEntryStrategy: 'ma_cross',
    shortExitStrategy: 'ma_cross',
};

const modernSettings = {
    stockNo: '2330',
    entryStrategy: 'ma_cross',
    exitStrategy: 'ma_cross_exit',
    enableShorting: true,
    shortEntryStrategy: 'short_ma_cross',
    shortExitStrategy: 'cover_ma_cross',
};

const strategies = {
    Legacy: { settings: legacySettings },
    Modern: { settings: modernSettings },
};

context.localStorage.setItem(context.SAVED_STRATEGIES_KEY, JSON.stringify(strategies));

const loaded = context.getSavedStrategies();

assert(loaded.Legacy.settings.exitStrategy === 'ma_cross_exit', 'Legacy exit strategy should normalize to ma_cross_exit');
assert(loaded.Legacy.settings.shortEntryStrategy === 'short_ma_cross', 'Legacy short entry strategy should normalize to short_ma_cross');
assert(loaded.Legacy.settings.shortExitStrategy === 'cover_ma_cross', 'Legacy short exit strategy should normalize to cover_ma_cross');
assert(loaded.Modern.settings.exitStrategy === 'ma_cross_exit', 'Modern exit strategy should remain ma_cross_exit');
assert(loaded.Modern.settings.shortEntryStrategy === 'short_ma_cross', 'Modern short entry strategy should remain unchanged');
assert(loaded.Modern.settings.shortExitStrategy === 'cover_ma_cross', 'Modern short exit strategy should remain unchanged');

const persisted = context.localStorage.getItem(context.SAVED_STRATEGIES_KEY);
const persistedData = JSON.parse(persisted);
assert(persistedData.Legacy.settings.exitStrategy === 'ma_cross_exit', 'Persisted legacy exit strategy should be updated to new ID');
assert(persistedData.Legacy.settings.shortEntryStrategy === 'short_ma_cross', 'Persisted legacy short entry should be updated to new ID');
assert(persistedData.Legacy.settings.shortExitStrategy === 'cover_ma_cross', 'Persisted legacy short exit should be updated to new ID');

console.log('Strategy ID normalization tests passed.');
