// Strategy Param Schema Utilities - LB-STRATEGY-SCHEMA-20260921A
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    const globalScope = root || (typeof self !== 'undefined' ? self : this);
    if (globalScope) {
      Object.defineProperty(globalScope, 'lazybacktestStrategySchema', {
        value: factory(),
        configurable: false,
        enumerable: true,
        writable: false,
      });
    }
  }
})(typeof self !== 'undefined' ? self : this, function strategySchemaFactory() {
  const VERSION = 'LB-STRATEGY-SCHEMA-20260921A';

  function normaliseSchema(schema) {
    if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
      return { properties: {}, required: [] };
    }
    const type = typeof schema.type === 'string' ? schema.type.toLowerCase() : 'object';
    if (type !== 'object') {
      return { properties: {}, required: [] };
    }
    const properties = schema.properties && typeof schema.properties === 'object' && !Array.isArray(schema.properties)
      ? schema.properties
      : {};
    const required = Array.isArray(schema.required) ? schema.required.slice() : [];
    return { properties, required };
  }

  function resolveInputType(descriptor) {
    if (!descriptor || typeof descriptor !== 'object') {
      return { inputType: 'text', type: 'string' };
    }
    if (Array.isArray(descriptor.enum) && descriptor.enum.length > 0) {
      return { inputType: 'select', type: descriptor.type || 'string' };
    }
    const type = typeof descriptor.type === 'string' ? descriptor.type.toLowerCase() : 'number';
    if (type === 'boolean') {
      return { inputType: 'checkbox', type: 'boolean' };
    }
    if (type === 'integer' || type === 'number') {
      return { inputType: 'number', type };
    }
    return { inputType: 'text', type };
  }

  function getDefaultValue(descriptor) {
    if (!descriptor || typeof descriptor !== 'object') {
      return undefined;
    }
    if (Object.prototype.hasOwnProperty.call(descriptor, 'default')) {
      return descriptor.default;
    }
    if (Array.isArray(descriptor.enum) && descriptor.enum.length > 0) {
      return descriptor.enum[0];
    }
    if (descriptor.type === 'boolean') {
      return false;
    }
    return undefined;
  }

  function describeFields(schema) {
    const { properties } = normaliseSchema(schema);
    return Object.keys(properties).map((name) => {
      const descriptor = properties[name] || {};
      const { inputType, type } = resolveInputType(descriptor);
      return {
        name,
        inputType,
        type,
        enumValues: Array.isArray(descriptor.enum) ? descriptor.enum.slice() : null,
        minimum: Number.isFinite(descriptor.minimum) ? Number(descriptor.minimum) : null,
        maximum: Number.isFinite(descriptor.maximum) ? Number(descriptor.maximum) : null,
        step: Number.isFinite(descriptor.multipleOf) ? Number(descriptor.multipleOf) : null,
        defaultValue: getDefaultValue(descriptor),
        descriptor,
      };
    });
  }

  function toFiniteNumber(value) {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : NaN;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return NaN;
      }
      const parsed = Number(trimmed);
      return Number.isFinite(parsed) ? parsed : NaN;
    }
    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }
    return NaN;
  }

  function clampNumeric(value, descriptor) {
    if (!Number.isFinite(value)) {
      return value;
    }
    let output = value;
    if (descriptor.type === 'integer') {
      output = Math.round(output);
    }
    if (Number.isFinite(descriptor.minimum)) {
      output = Math.max(descriptor.minimum, output);
    }
    if (Number.isFinite(descriptor.maximum)) {
      output = Math.min(descriptor.maximum, output);
    }
    if (Number.isFinite(descriptor.multipleOf) && descriptor.multipleOf > 0) {
      const factor = descriptor.multipleOf;
      output = Math.round(output / factor) * factor;
    }
    return output;
  }

  function sanitizeFieldValue(descriptor, rawValue, fallback) {
    if (!descriptor || typeof descriptor !== 'object') {
      return rawValue !== undefined ? rawValue : fallback;
    }
    const { inputType, type } = resolveInputType(descriptor);
    if (inputType === 'checkbox' || type === 'boolean') {
      if (rawValue === undefined) {
        return fallback !== undefined ? Boolean(fallback) : false;
      }
      if (typeof rawValue === 'string') {
        const normalised = rawValue.trim().toLowerCase();
        if (normalised === 'false' || normalised === '0' || normalised === 'no') {
          return false;
        }
        if (normalised === 'true' || normalised === '1' || normalised === 'yes') {
          return true;
        }
      }
      return Boolean(rawValue);
    }
    if (inputType === 'select' && Array.isArray(descriptor.enum) && descriptor.enum.length > 0) {
      if (rawValue !== undefined && descriptor.enum.includes(rawValue)) {
        return rawValue;
      }
      if (fallback !== undefined && descriptor.enum.includes(fallback)) {
        return fallback;
      }
      return descriptor.enum[0];
    }
    if (inputType === 'number') {
      const fallbackNumber = toFiniteNumber(fallback);
      const candidate = rawValue !== undefined ? toFiniteNumber(rawValue) : fallbackNumber;
      if (Number.isFinite(candidate)) {
        return clampNumeric(candidate, descriptor);
      }
      if (Number.isFinite(fallbackNumber)) {
        return clampNumeric(fallbackNumber, descriptor);
      }
      if (Object.prototype.hasOwnProperty.call(descriptor, 'default')) {
        const numericDefault = toFiniteNumber(descriptor.default);
        if (Number.isFinite(numericDefault)) {
          return clampNumeric(numericDefault, descriptor);
        }
      }
      return undefined;
    }
    return rawValue !== undefined ? rawValue : fallback;
  }

  function sanitizeParams(schema, rawValues) {
    const { properties } = normaliseSchema(schema);
    const output = {};
    Object.keys(properties).forEach((key) => {
      const descriptor = properties[key] || {};
      const fallback = getDefaultValue(descriptor);
      const rawValue = rawValues && Object.prototype.hasOwnProperty.call(rawValues, key)
        ? rawValues[key]
        : undefined;
      const sanitized = sanitizeFieldValue(descriptor, rawValue, fallback);
      if (sanitized !== undefined) {
        output[key] = sanitized;
      } else if (fallback !== undefined) {
        output[key] = fallback;
      }
    });
    return output;
  }

  return Object.freeze({
    version: VERSION,
    normaliseSchema,
    describeFields,
    sanitizeFieldValue,
    sanitizeParams,
    getDefaultValue,
  });
});
