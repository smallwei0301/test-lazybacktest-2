const assert = require('assert');
const path = require('path');

const paramsSchema = require(path.join('..', 'js', 'lib', 'params-schema.js'));

function testExtractDefaults() {
  const schema = {
    type: 'object',
    properties: {
      period: { type: 'integer', default: 20 },
      threshold: { type: 'number', default: 1.5 },
      enabled: { type: 'boolean', default: true },
      mode: { type: 'string', enum: ['fast', 'slow'], default: 'slow' },
    },
  };
  const defaults = paramsSchema.extractDefaults(schema);
  assert.deepStrictEqual(defaults, {
    period: 20,
    threshold: 1.5,
    enabled: true,
    mode: 'slow',
  });
}

function testSanitizeRespectBoundaries() {
  const schema = {
    type: 'object',
    properties: {
      period: { type: 'integer', minimum: 5, maximum: 60, default: 14 },
      threshold: { type: 'number', minimum: 0.5, maximum: 5, default: 1.5 },
    },
  };
  const { values, errors } = paramsSchema.sanitizeValues(schema, {
    period: '120',
    threshold: -1,
  });
  assert.deepStrictEqual(values, {
    period: 60,
    threshold: 0.5,
  });
  assert.strictEqual(errors.period, 'out_of_range');
  assert.strictEqual(errors.threshold, 'out_of_range');
}

function testSanitizeBooleanAndEnum() {
  const schema = {
    type: 'object',
    properties: {
      enabled: { type: 'boolean', default: false },
      mode: { type: 'string', enum: ['fast', 'slow'], default: 'fast' },
    },
  };
  const result = paramsSchema.sanitizeValues(schema, {
    enabled: 'true',
    mode: 'invalid',
  });
  assert.deepStrictEqual(result.values, { enabled: true, mode: 'fast' });
  assert.strictEqual(result.errors.mode, 'enum');
}

function run() {
  testExtractDefaults();
  testSanitizeRespectBoundaries();
  testSanitizeBooleanAndEnum();
  console.log('params-schema tests passed');
}

run();
