const assert = require('assert');
const path = require('path');

const schemaUtils = require(path.join('..', 'js', 'lib', 'strategy-param-schema.js'));

function testSanitizeNumericFields() {
  const schema = {
    type: 'object',
    properties: {
      period: { type: 'integer', minimum: 1, maximum: 200, default: 20 },
      threshold: { type: 'number', minimum: 0, maximum: 100, default: 30 },
    },
  };

  const sanitized = schemaUtils.sanitizeParams(schema, { period: 500, threshold: -5 });
  assert.strictEqual(sanitized.period, 200, '應套用最大上限');
  assert.strictEqual(sanitized.threshold, 0, '應套用最小下限');
}

function testDescriptorExtraction() {
  const schema = {
    type: 'object',
    properties: {
      enabled: { type: 'boolean', default: true },
      mode: { type: 'string', enum: ['fast', 'slow'], default: 'fast' },
    },
  };

  const fields = schemaUtils.describeFields(schema);
  const enabled = fields.find((field) => field.name === 'enabled');
  const mode = fields.find((field) => field.name === 'mode');

  assert(enabled, '應取得布林欄位描述');
  assert.strictEqual(enabled.inputType, 'checkbox', '布林欄位應使用核取方塊');
  assert.strictEqual(enabled.defaultValue, true, '布林欄位預設值應保留');

  assert(mode, '應取得選單欄位描述');
  assert.strictEqual(mode.inputType, 'select', '列舉欄位應使用下拉選單');
  assert.deepStrictEqual(mode.enumValues, ['fast', 'slow'], '列舉值應完整保留');
}

function testEnumAndBooleanSanitization() {
  const schema = {
    type: 'object',
    properties: {
      enabled: { type: 'boolean', default: false },
      mode: { type: 'string', enum: ['fast', 'slow'], default: 'slow' },
    },
  };

  const sanitized = schemaUtils.sanitizeParams(schema, { enabled: 'yes', mode: 'turbo' });
  assert.strictEqual(sanitized.enabled, true, '非布林字串應轉為 true');
  assert.strictEqual(sanitized.mode, 'slow', '未知列舉值應還原為預設值');
}

function run() {
  testSanitizeNumericFields();
  testDescriptorExtraction();
  testEnumAndBooleanSanitization();
  console.log('strategy-param-schema tests passed');
}

run();
