const assert = require('assert');
const path = require('path');

const paramApi = require(path.join('..', 'js', 'lib', 'strategy-param-schema.js'));

function testDefaultsAndSanitize() {
  const schema = {
    type: 'object',
    required: ['threshold', 'period'],
    properties: {
      threshold: { type: 'number', minimum: 0, maximum: 100, default: 25 },
      period: { type: 'integer', minimum: 1, maximum: 60, default: 14 },
      enabled: { type: 'boolean', default: false },
      mode: { type: 'string', enum: ['fast', 'slow'], default: 'fast' },
    },
  };

  const defaults = paramApi.deriveDefaults(schema);
  assert.deepStrictEqual(defaults, {
    threshold: 25,
    period: 14,
    enabled: false,
    mode: 'fast',
  }, '預設值應依 schema 產生');

  const sanitised = paramApi.sanitiseParams(schema, {
    threshold: 150,
    period: 0,
    enabled: 'true',
    mode: 'turbo',
  });

  assert.deepStrictEqual(sanitised.values, {
    threshold: 100,
    period: 1,
    enabled: true,
    mode: 'fast',
  }, '應套用界線並回退到 enum 預設值');

  assert(sanitised.errors.length >= 2, '應回報違反界線的錯誤');
  const errorMessage = sanitised.errors.join(' ');
  assert(/threshold/i.test(errorMessage) && /period/i.test(errorMessage), '錯誤訊息應提及對應欄位');
}

function testBooleanAndOptionalHandling() {
  const schema = {
    type: 'object',
    properties: {
      flag: { type: 'boolean' },
      ratio: { type: 'number', minimum: 0, maximum: 1, default: 0.5 },
    },
  };

  const sanitised = paramApi.sanitiseParams(schema, { flag: 'false', ratio: -1 });
  assert.deepStrictEqual(sanitised.values, { flag: false, ratio: 0 }, '布林值應轉為 false，數值應被限制在最小值');

  const sanitisedEmpty = paramApi.sanitiseParams(schema, {});
  assert.strictEqual(sanitisedEmpty.values.ratio, 0.5, '缺值時應回退至預設');
}

function testFieldDescriptors() {
  const schema = {
    type: 'object',
    properties: {
      multiplier: { type: 'number', minimum: 0, maximum: 10, default: 2, multipleOf: 0.5, title: '倍數' },
      confirm: { type: 'boolean', default: true, title: '啟用' },
      style: { type: 'string', enum: ['A', 'B'], default: 'A', title: '模式' },
    },
  };

  const fields = paramApi.createFieldDescriptors(schema);
  assert.strictEqual(fields.length, 3, '應生成三個欄位定義');
  const multiplierField = fields.find((field) => field.name === 'multiplier');
  assert(multiplierField, '應包含 multiplier 欄位');
  assert.strictEqual(multiplierField.control, 'number', '數值欄位應為 number 控制');
  assert.strictEqual(multiplierField.step, 0.5, '應帶入 multipleOf 作為 step');
  const confirmField = fields.find((field) => field.name === 'confirm');
  assert.strictEqual(confirmField.control, 'checkbox', '布林欄位應使用 checkbox');
  const styleField = fields.find((field) => field.name === 'style');
  assert.deepStrictEqual(styleField.options, ['A', 'B'], '列舉欄位應帶入選項');
}

function run() {
  testDefaultsAndSanitize();
  testBooleanAndOptionalHandling();
  testFieldDescriptors();
  console.log('strategy-param-schema tests passed');
}

run();
