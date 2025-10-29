// Strategy Param Schema Helpers - LB-PARAMS-SCHEMA-20260918A
(function (root) {
  const globalScope = root || (typeof self !== 'undefined' ? self : this);
  const VERSION = 'LB-PARAMS-SCHEMA-20260918A';

  function ensureObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function getProperties(schema) {
    const normalized = ensureObject(schema);
    const type = typeof normalized.type === 'string' ? normalized.type : 'object';
    if (type !== 'object') {
      return {};
    }
    return ensureObject(normalized.properties);
  }

  function extractDefaults(schema) {
    const properties = getProperties(schema);
    const defaults = {};
    Object.keys(properties).forEach((key) => {
      const descriptor = properties[key] || {};
      if (Object.prototype.hasOwnProperty.call(descriptor, 'default')) {
        defaults[key] = descriptor.default;
      }
    });
    return defaults;
  }

  function clampNumeric(value, descriptor, errors) {
    if (typeof descriptor.minimum === 'number' && value < descriptor.minimum) {
      value = descriptor.minimum;
      if (errors && !errors.includes('out_of_range')) {
        errors.push('out_of_range');
      }
    }
    if (typeof descriptor.maximum === 'number' && value > descriptor.maximum) {
      value = descriptor.maximum;
      if (errors && !errors.includes('out_of_range')) {
        errors.push('out_of_range');
      }
    }
    if (typeof descriptor.exclusiveMinimum === 'number' && value <= descriptor.exclusiveMinimum) {
      value = Math.nextUp ? Math.nextUp(descriptor.exclusiveMinimum) : descriptor.exclusiveMinimum + Number.EPSILON;
      if (errors && !errors.includes('out_of_range')) {
        errors.push('out_of_range');
      }
    }
    if (typeof descriptor.exclusiveMaximum === 'number' && value >= descriptor.exclusiveMaximum) {
      value = Math.nextDown ? Math.nextDown(descriptor.exclusiveMaximum) : descriptor.exclusiveMaximum - Number.EPSILON;
      if (errors && !errors.includes('out_of_range')) {
        errors.push('out_of_range');
      }
    }
    return value;
  }

  function applyMultipleOf(value, descriptor, errors) {
    const step = typeof descriptor.multipleOf === 'number' && descriptor.multipleOf > 0 ? descriptor.multipleOf : null;
    if (!step) {
      return value;
    }
    const quotient = value / step;
    const rounded = Math.round(quotient) * step;
    if (Math.abs(rounded - value) > 1e-9) {
      value = rounded;
      if (errors && !errors.includes('multiple_of')) {
        errors.push('multiple_of');
      }
    }
    return value;
  }

  function sanitizeNumeric(descriptor, rawValue, fallback) {
    const errors = [];
    let value;
    if (typeof rawValue === 'number') {
      value = rawValue;
    } else if (typeof rawValue === 'string') {
      const trimmed = rawValue.trim();
      if (trimmed !== '') {
        const parsed = Number(trimmed);
        if (Number.isFinite(parsed)) {
          value = parsed;
        }
      }
    }
    if (value === undefined && Number.isFinite(fallback)) {
      value = fallback;
    }
    if (value === undefined) {
      return { value: undefined, error: fallback !== undefined ? null : 'missing' };
    }
    if (descriptor.type === 'integer') {
      value = Math.round(value);
    }
    value = clampNumeric(value, descriptor, errors);
    value = applyMultipleOf(value, descriptor, errors);
    if (!Number.isFinite(value)) {
      if (Number.isFinite(fallback)) {
        value = fallback;
      } else {
        return { value: undefined, error: 'invalid' };
      }
    }
    return { value, error: errors[0] || null };
  }

  function sanitizeBoolean(descriptor, rawValue, fallback) {
    if (typeof rawValue === 'boolean') {
      return { value: rawValue, error: null };
    }
    if (typeof rawValue === 'string') {
      const normalized = rawValue.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
        return { value: true, error: null };
      }
      if (normalized === 'false' || normalized === '0' || normalized === 'no') {
        return { value: false, error: null };
      }
    }
    if (typeof rawValue === 'number') {
      return { value: rawValue !== 0, error: null };
    }
    if (typeof fallback === 'boolean') {
      return { value: fallback, error: null };
    }
    return { value: false, error: fallback === undefined ? 'missing' : null };
  }

  function sanitizeString(descriptor, rawValue, fallback) {
    let value;
    if (rawValue === null || rawValue === undefined) {
      value = fallback !== undefined ? fallback : '';
    } else if (typeof rawValue === 'string') {
      value = rawValue;
    } else {
      value = String(rawValue);
    }
    if (Array.isArray(descriptor.enum) && descriptor.enum.length > 0) {
      if (!descriptor.enum.includes(value)) {
        const replacement = descriptor.enum.includes(fallback) ? fallback : descriptor.enum[0];
        return { value: replacement, error: 'enum' };
      }
    }
    return { value, error: null };
  }

  function sanitizeValues(schema, rawValues, options) {
    const properties = getProperties(schema);
    const defaults = extractDefaults(schema);
    const source = ensureObject(rawValues);
    const sanitized = {};
    const errors = {};
    Object.keys(properties).forEach((key) => {
      const descriptor = properties[key] || {};
      const fallback = defaults[key];
      const raw = source[key];
      let result;
      if (descriptor.type === 'integer' || descriptor.type === 'number') {
        result = sanitizeNumeric(descriptor, raw, fallback);
      } else if (descriptor.type === 'boolean') {
        result = sanitizeBoolean(descriptor, raw, fallback);
      } else if (descriptor.type === 'string') {
        result = sanitizeString(descriptor, raw, fallback);
      } else {
        const value = raw !== undefined ? raw : fallback;
        result = { value, error: null };
      }
      if (result.value !== undefined) {
        sanitized[key] = result.value;
      }
      if (result.error) {
        errors[key] = result.error;
      }
    });

    const normalizedSchema = ensureObject(schema);
    if (normalizedSchema.additionalProperties === true) {
      Object.keys(source).forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(properties, key)) {
          const value = source[key];
          if (value !== undefined && typeof value !== 'function') {
            sanitized[key] = value;
          }
        }
      });
    }

    return { values: sanitized, errors, defaults };
  }

  function resolveStep(descriptor) {
    if (typeof descriptor.multipleOf === 'number' && descriptor.multipleOf > 0) {
      return descriptor.multipleOf;
    }
    if (descriptor.type === 'integer') {
      return 1;
    }
    return undefined;
  }

  function createFieldDefinitions(schema, options = {}) {
    const properties = getProperties(schema);
    const defaults = extractDefaults(schema);
    const labelResolver = typeof options.labelResolver === 'function' ? options.labelResolver : null;
    const enumLabelResolver = typeof options.enumLabelResolver === 'function' ? options.enumLabelResolver : null;
    const fields = Object.keys(properties).map((key) => {
      const descriptor = properties[key] || {};
      const base = {
        name: key,
        schema: descriptor,
        defaultValue: defaults[key],
        label: key,
        inputId: null,
      };
      if (labelResolver) {
        try {
          const resolved = labelResolver(key, descriptor) || {};
          if (resolved.label) {
            base.label = resolved.label;
          }
          if (resolved.inputId) {
            base.inputId = resolved.inputId;
          }
          if (resolved.description) {
            base.description = resolved.description;
          }
        } catch (error) {
          console.warn('[ParamsSchema] labelResolver failed for %s', key, error);
        }
      }
      if (descriptor.type === 'integer' || descriptor.type === 'number') {
        base.kind = 'number';
        if (typeof descriptor.minimum === 'number') base.min = descriptor.minimum;
        if (typeof descriptor.maximum === 'number') base.max = descriptor.maximum;
        const step = resolveStep(descriptor);
        if (step !== undefined) base.step = step;
      } else if (descriptor.type === 'boolean') {
        base.kind = 'boolean';
      } else if (descriptor.type === 'string' && Array.isArray(descriptor.enum) && descriptor.enum.length > 0) {
        base.kind = 'enum';
        base.options = descriptor.enum.map((value) => ({
          value,
          label: enumLabelResolver ? enumLabelResolver(key, value, descriptor) : String(value),
        }));
      } else {
        base.kind = 'text';
      }
      return base;
    });
    return { fields, defaults };
  }

  const api = Object.freeze({
    __version__: VERSION,
    extractDefaults,
    sanitizeValues,
    createFieldDefinitions,
  });

  if (globalScope && typeof globalScope === 'object') {
    globalScope.lazybacktestParamsSchema = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this);
