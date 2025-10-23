const assert = require('assert');
const migration = require('../js/strategy-id-migration.js');

function run() {
    const legacySettings = {
        exitStrategy: 'ma_cross',
        shortEntryStrategy: 'ma_cross',
        shortExitStrategy: 'ma_cross',
    };
    const { settings: migratedLegacy, changed: legacyChanged } = migration.migrateSettings(legacySettings);
    assert.strictEqual(legacyChanged, true, 'Legacy settings should trigger migration');
    assert.strictEqual(migratedLegacy.exitStrategy, 'ma_cross_exit');
    assert.strictEqual(migratedLegacy.shortEntryStrategy, 'short_ma_cross');
    assert.strictEqual(migratedLegacy.shortExitStrategy, 'cover_ma_cross');

    const modernSettings = {
        exitStrategy: 'ma_cross_exit',
        shortEntryStrategy: 'short_ma_cross',
        shortExitStrategy: 'cover_ma_cross',
    };
    const { settings: migratedModern, changed: modernChanged } = migration.migrateSettings(modernSettings);
    assert.strictEqual(modernChanged, false, 'Modern settings should remain unchanged');
    assert.deepStrictEqual(migratedModern, modernSettings, 'Modern settings should stay identical after migration');

    const legacySelection = {
        longExit: { strategyId: 'ma_cross', configKey: 'ma_cross' },
        shortEntry: { strategyId: 'ma_cross', configKey: 'ma_cross' },
        shortExit: { strategyId: 'ma_cross', configKey: 'ma_cross' },
    };
    const { selection: migratedSelection, changed: selectionChanged } = migration.migrateStrategySelection(legacySelection);
    assert.strictEqual(selectionChanged, true, 'Legacy selection should migrate');
    assert.strictEqual(migratedSelection.longExit.strategyId, 'ma_cross_exit');
    assert.strictEqual(migratedSelection.longExit.configKey, 'ma_cross_exit');
    assert.strictEqual(migratedSelection.shortEntry.strategyId, 'short_ma_cross');
    assert.strictEqual(migratedSelection.shortExit.strategyId, 'cover_ma_cross');

    const aliasList = migration.collectLegacyIds('ma_cross_exit', 'exit');
    assert(aliasList.includes('ma_cross'), 'Alias list should include legacy exit ID');

    console.log('Strategy ID migration tests passed.');
}

try {
    run();
} catch (error) {
    console.error('Strategy ID migration tests failed:', error);
    process.exitCode = 1;
}
