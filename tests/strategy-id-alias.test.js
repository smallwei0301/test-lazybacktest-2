const assert = require('assert');

let helper;
try {
  helper = require('../js/strategy-id-alias.js');
} catch (error) {
  console.error('Failed to load strategy-id-alias helper:', error.message);
  process.exit(1);
}

const fakeDescriptions = {
  ma_cross: {},
  ma_cross_exit: {},
  macd_cross: {},
  macd_cross_exit: {},
  short_ma_cross: {},
  cover_ma_cross: {},
};

function ensure(role, id) {
  return helper.ensureStrategyRoleId(id, role, fakeDescriptions);
}

assert.strictEqual(
  ensure('entry', 'ma_cross_exit'),
  'ma_cross',
  'Entry strategies should strip _exit suffix back to base ID.'
);

assert.strictEqual(
  ensure('entry', 'ma_cross'),
  'ma_cross',
  'Entry strategies should keep valid base IDs intact.'
);

assert.strictEqual(
  ensure('shortEntry', 'cover_ma_cross'),
  'short_ma_cross',
  'Short entry strategies should normalise cover_* aliases back to short_* variants.'
);

assert.strictEqual(
  ensure('shortExit', 'short_ma_cross'),
  'cover_ma_cross',
  'Short exit strategies should normalise short_* aliases to cover_* variants.'
);

console.log('strategy-id-alias tests passed');
