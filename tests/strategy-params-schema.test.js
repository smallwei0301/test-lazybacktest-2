const assert = require('assert');
const path = require('path');

const schemaUtils = require(path.join('..', 'js', 'lib', 'strategy-params-schema.js'));

function testBuildFieldsAndDefaults() {
  const schema = {
    type: 'object',
    properties: {
      period: { type: 'integer', minimum: 1, maximum: 365, default: 14, title: '週期' },
      threshold: { type: 'number', minimum: 0, maximum: 100, default: 30 },
      mode: { type: 'string', enum: ['close', 'open'], default: 'close' },
      enabled: { type: 'boolean', default: true },
    },
    required: ['period'],
  };

  const fields = schemaUtils.buildParamFields(schema, { threshold: 25 });
  assert.strictEqual(fields.length, 4, '應建立四個欄位');

  const periodField = fields.find((field) => field.name === 'period');
  assert(periodField, '應存在 period 欄位');
  assert.strictEqual(periodField.inputType, 'number');
  assert.strictEqual(periodField.step, 1, '整數欄位步進應為 1');
  assert.strictEqual(periodField.defaultValue, 14, '應採用 Schema 預設值');
  assert.strictEqual(periodField.required, true, 'required 應轉換為布林值');

  const thresholdField = fields.find((field) => field.name === 'threshold');
  assert.strictEqual(thresholdField.defaultValue, 30, '應採用 Schema 預設值而非後援');
  assert.strictEqual(thresholdField.inputType, 'number');
  assert.strictEqual(thresholdField.step, 0.01, '小數欄位預設步進應為 0.01');

  const modeField = fields.find((field) => field.name === 'mode');
  assert.strictEqual(modeField.inputType, 'select');
  assert.deepStrictEqual(modeField.options, ['close', 'open']);

  const enabledField = fields.find((field) => field.name === 'enabled');
  assert.strictEqual(enabledField.inputType, 'checkbox');
  assert.strictEqual(enabledField.defaultValue, true);
}

function testSanitizeValues() {
  const schema = {
    type: 'object',
    properties: {
      period: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
      threshold: { type: 'number', minimum: 0, maximum: 100, default: 40 },
      mode: { type: 'string', enum: ['close', 'open'], default: 'close' },
      enabled: { type: 'boolean', default: false },
    },
  };
  const fields = schemaUtils.buildParamFields(schema, {});
  const sanitized = schemaUtils.sanitizeParamValues(fields, {
    period: 0,
    threshold: 120,
    mode: 'open',
    enabled: 'false',
  });

  assert.strictEqual(sanitized.period, 1, '數值應套用最小值 1');
  assert.strictEqual(sanitized.threshold, 100, '數值應被限制於最大值 100');
  assert.strictEqual(sanitized.mode, 'open', 'enum 應接受有效值');
  assert.strictEqual(sanitized.enabled, false, '布林值應解讀為 false');
}

function testFallbackDefaults() {
  const schema = {
    type: 'object',
    properties: {
      lookback: { type: 'integer', minimum: 5 },
      basis: { type: 'string', enum: ['close', 'high'] },
    },
  };
  const fields = schemaUtils.buildParamFields(schema, { lookback: 21, basis: 'high' });
  const defaults = schemaUtils.createDefaultValues(fields);
  assert.strictEqual(defaults.lookback, 21, '缺少 Schema 預設時應採用後援預設值');
  assert.strictEqual(defaults.basis, 'high', 'enum 後援預設值應被接受');

  const sanitized = schemaUtils.sanitizeParamValues(fields, { basis: 'low' });
  assert.strictEqual(sanitized.basis, 'high', '不在 enum 列表中的值應退回預設選項');
  assert.strictEqual(sanitized.lookback, 21, '缺值時應使用預設值');
}

function run() {
  testBuildFieldsAndDefaults();
  testSanitizeValues();
  testFallbackDefaults();
  console.log('strategy-params-schema tests passed');
}

run();
