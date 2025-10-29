const assert = require('assert');
const path = require('path');

const formUtils = require(path.join('..', 'js', 'lib', 'strategy-params-form.js'));

function createSchema() {
  return {
    type: 'object',
    required: ['period', 'mode'],
    properties: {
      period: { type: 'integer', minimum: 1, maximum: 250, default: 20 },
      threshold: { type: 'number', minimum: -100, maximum: 100, default: 30 },
      enableFilter: { type: 'boolean', default: false },
      mode: { type: 'string', enum: ['close', 'open'], default: 'close' },
    },
  };
}

function testFieldDerivation() {
  const schema = createSchema();
  const fields = formUtils.buildFieldDescriptors(schema, {
    role: 'entry',
    strategyId: 'rsi_oversold',
  });

  assert(Array.isArray(fields), 'fields 應該為陣列');
  assert.strictEqual(fields.length, 4, '應產生四個欄位');

  const periodField = fields.find((field) => field.name === 'period');
  assert(periodField, '應包含 period 欄位');
  assert.strictEqual(periodField.type, 'number');
  assert.strictEqual(periodField.attributes.min, 1);
  assert.strictEqual(periodField.attributes.max, 250);
  assert.strictEqual(periodField.attributes.step, 1);
  assert.strictEqual(typeof periodField.label, 'string');
  assert(periodField.inputId.startsWith('entry'));

  const modeField = fields.find((field) => field.name === 'mode');
  assert.strictEqual(modeField.type, 'select');
  assert.deepStrictEqual(modeField.enum, ['close', 'open']);

  const boolField = fields.find((field) => field.name === 'enableFilter');
  assert.strictEqual(boolField.type, 'boolean');
}

function testDefaultValues() {
  const schema = createSchema();
  const defaults = formUtils.buildInitialValues(schema, {
    period: 14,
    threshold: 25,
  });

  assert.strictEqual(defaults.period, 14, '應優先採用提供的預設值');
  assert.strictEqual(defaults.threshold, 25, '應沿用傳入的 threshold 預設值');
  assert.strictEqual(defaults.enableFilter, false, '布林預設應取自 schema');
  assert.strictEqual(defaults.mode, 'close', '應使用 schema enum 預設值');
}

function testValidationAndClamping() {
  const schema = createSchema();
  const fields = formUtils.buildFieldDescriptors(schema, {
    role: 'entry',
    strategyId: 'rsi_oversold',
  });
  const result = formUtils.validateValues(schema, fields, {
    period: '9999',
    threshold: '-120',
    enableFilter: 'true',
    mode: 'invalid',
  });

  assert(result.errors.length >= 2, '應標示不合法輸入');
  assert.strictEqual(result.values.period, 250, '超出範圍應被夾限');
  assert.strictEqual(result.values.threshold, -100, '下限應被套用');
  assert.strictEqual(result.values.enableFilter, true, '布林值應正確轉換');
  assert.strictEqual(result.values.mode, 'close', '未知選項應回退至預設');
}

function run() {
  testFieldDerivation();
  testDefaultValues();
  testValidationAndClamping();
  console.log('strategy-params-form tests passed');
}

run();
