const fs = require('fs');
const vm = require('vm');

function loadStrategyUtils() {
    global.window = global;
    const source = fs.readFileSync('js/strategy-id-utils.js', 'utf8');
    vm.runInThisContext(source, { filename: 'strategy-id-utils.js' });
    return global.LB_STRATEGY_ID_UTILS;
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message} (expected: ${expected}, actual: ${actual})`);
    }
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

const utils = loadStrategyUtils();
if (!utils) {
    throw new Error('策略 ID 工具未正確載入');
}

const { normaliseStrategyIdForRole, resolveStrategyAliases, migrateStrategySettings } = utils;

assertEqual(normaliseStrategyIdForRole('ma_cross', 'exit'), 'ma_cross_exit', '多單出場舊 ID 應轉換成新 ID');
assertEqual(normaliseStrategyIdForRole('ma_cross_exit', 'exit'), 'ma_cross_exit', '多單出場新 ID 應保持不變');
assertEqual(normaliseStrategyIdForRole('short_k_d_cross', 'shortEntry'), 'short_k_d_cross', '做空進場新 ID 應保持不變');
assertEqual(normaliseStrategyIdForRole('k_d_cross', 'shortEntry'), 'short_k_d_cross', '做空進場舊 ID 應轉換成對應的新 ID');

const exitAliases = new Set(resolveStrategyAliases('ma_cross_exit', 'exit'));
assert(exitAliases.has('ma_cross'), '多單出場新 ID 應提供舊 ID 作為別名');
const shortAliases = new Set(resolveStrategyAliases('ma_cross', 'shortEntry'));
assert(shortAliases.has('short_ma_cross'), '做空進場舊 ID 應提供新 ID 作為別名');

const legacySettings = {
    exitStrategy: 'ma_cross',
    shortEntryStrategy: 'ma_cross',
    shortExitStrategy: 'ma_cross',
};
const migratedLegacy = migrateStrategySettings(legacySettings);
assert(migratedLegacy.changed, '舊版設定應觸發轉換');
assertEqual(migratedLegacy.settings.exitStrategy, 'ma_cross_exit', '多單出場應轉換至新 ID');
assertEqual(migratedLegacy.settings.shortEntryStrategy, 'short_ma_cross', '做空進場應轉換至新 ID');
assertEqual(migratedLegacy.settings.shortExitStrategy, 'cover_ma_cross', '回補出場應轉換至新 ID');

const modernSettings = {
    exitStrategy: 'ma_cross_exit',
    shortEntryStrategy: 'short_ma_cross',
    shortExitStrategy: 'cover_ma_cross',
};
const migratedModern = migrateStrategySettings(modernSettings);
assert(!migratedModern.changed, '新版設定不應觸發轉換');
assertEqual(migratedModern.settings.exitStrategy, 'ma_cross_exit', '新版設定出場 ID 應保持不變');

const partialLegacy = { exitStrategy: 'macd_cross' };
const migratedPartial = migrateStrategySettings(partialLegacy);
assert(migratedPartial.changed, '部分舊設定也應完成轉換');
assertEqual(migratedPartial.settings.exitStrategy, 'macd_cross_exit', 'MACD 出場舊 ID 應轉換');

console.log('Strategy ID utility tests passed.');
