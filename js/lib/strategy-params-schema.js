// Strategy Params Schema Utilities - LB-DSL-FORM-20260920A
(function (root) {
  const globalScope = root || (typeof self !== 'undefined' ? self : this);

  function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function clampNumber(value, min, max) {
    if (typeof min === 'number' && Number.isFinite(min) && value < min) {
      return min;
    }
    if (typeof max === 'number' && Number.isFinite(max) && value > max) {
      return max;
    }
    return value;
  }

  function deriveStep(descriptor) {
    if (!descriptor || typeof descriptor !== 'object') {
      return 1;
    }
    if (typeof descriptor.multipleOf === 'number' && Number.isFinite(descriptor.multipleOf)) {
      return Math.abs(descriptor.multipleOf);
    }
    if (descriptor.type === 'integer') {
      return 1;
    }
    return 0.01;
  }

  function sanitizeEnumOptions(descriptor) {
    if (!descriptor || !Array.isArray(descriptor.enum)) {
      return undefined;
    }
    return descriptor.enum
      .map((item) => (item === null || item === undefined ? '' : String(item)))
      .filter((value) => value.length > 0);
  }

  function deriveDefaultValue(descriptor, fallbackDefaults, key) {
    if (descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'default')) {
      const value = descriptor.default;
      if (descriptor.type === 'integer' || descriptor.type === 'number') {
        const numeric = Number(value);
        if (Number.isFinite(numeric)) {
          return descriptor.type === 'integer' ? Math.round(numeric) : numeric;
        }
      } else if (descriptor.type === 'boolean') {
        return Boolean(value);
      } else if (descriptor.type === 'string') {
        return typeof value === 'string' ? value : String(value ?? '');
      } else {
        return value;
      }
    }
    if (fallbackDefaults && Object.prototype.hasOwnProperty.call(fallbackDefaults, key)) {
      return fallbackDefaults[key];
    }
    if (descriptor && descriptor.type === 'boolean') {
      return false;
    }
    return undefined;
  }

  function buildParamFields(schema, fallbackDefaults) {
    if (!isPlainObject(schema)) {
      return [];
    }
    const type = typeof schema.type === 'string' ? schema.type : 'object';
    if (type !== 'object') {
      return [];
    }
    const properties = isPlainObject(schema.properties) ? schema.properties : {};
    const requiredSet = new Set(Array.isArray(schema.required) ? schema.required : []);
    const keys = Object.keys(properties);
    return keys.map((key) => {
      const descriptor = isPlainObject(properties[key]) ? properties[key] : {};
      const propType = typeof descriptor.type === 'string' ? descriptor.type : undefined;
      const field = {
        name: key,
        type: propType,
        label: typeof descriptor.title === 'string' ? descriptor.title : key,
        required: requiredSet.has(key),
        options: sanitizeEnumOptions(descriptor),
        min: Number.isFinite(descriptor.minimum) ? Number(descriptor.minimum) : undefined,
        max: Number.isFinite(descriptor.maximum) ? Number(descriptor.maximum) : undefined,
        step: deriveStep(descriptor),
      };

      if (descriptor.type === 'boolean') {
        field.inputType = 'checkbox';
      } else if (field.options && field.options.length > 0) {
        field.inputType = 'select';
      } else if (descriptor.type === 'integer' || descriptor.type === 'number') {
        field.inputType = 'number';
      } else {
        field.inputType = 'text';
      }

      field.defaultValue = deriveDefaultValue(descriptor, fallbackDefaults, key);

      if (field.inputType === 'number' && typeof field.defaultValue === 'number') {
        field.defaultValue = clampNumber(field.defaultValue, field.min, field.max);
        if (descriptor.type === 'integer') {
          field.defaultValue = Math.round(field.defaultValue);
        }
      }

      if (field.inputType === 'select' && (!field.defaultValue || !field.options.includes(String(field.defaultValue)))) {
        field.defaultValue = field.options.length > 0 ? field.options[0] : undefined;
      }

      return field;
    });
  }

  function createDefaultValues(fields) {
    if (!Array.isArray(fields)) {
      return {};
    }
    return fields.reduce((acc, field) => {
      if (field && field.name) {
        acc[field.name] = field.defaultValue;
      }
      return acc;
    }, {});
  }

  function coerceBoolean(value, defaultValue) {
    if (value === undefined || value === null) {
      return defaultValue ?? false;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'number') {
      return value !== 0;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1') {
        return true;
      }
      if (normalized === 'false' || normalized === '0' || normalized === '') {
        return false;
      }
    }
    return Boolean(value);
  }

  function sanitizeParamValues(fields, rawValues) {
    if (!Array.isArray(fields)) {
      return {};
    }
    const result = {};
    const raw = isPlainObject(rawValues) ? rawValues : {};
    fields.forEach((field) => {
      if (!field || !field.name) {
        return;
      }
      const value = raw[field.name];
      if (field.inputType === 'number') {
        const parsed = value === '' || value === null || value === undefined ? NaN : Number(value);
        let numeric = Number.isFinite(parsed) ? parsed : field.defaultValue;
        if (!Number.isFinite(numeric)) {
          numeric = field.required ? 0 : undefined;
        }
        if (Number.isFinite(numeric)) {
          numeric = clampNumber(numeric, field.min, field.max);
          if (field.type === 'integer') {
            numeric = Math.round(numeric);
          }
        }
        if (numeric !== undefined) {
          result[field.name] = numeric;
        }
      } else if (field.inputType === 'checkbox') {
        result[field.name] = coerceBoolean(value, field.defaultValue);
      } else if (field.inputType === 'select') {
        const stringValue = value === null || value === undefined ? undefined : String(value);
        if (stringValue && field.options.includes(stringValue)) {
          result[field.name] = stringValue;
        } else if (field.defaultValue !== undefined) {
          result[field.name] = field.defaultValue;
        } else if (field.options.length > 0) {
          result[field.name] = field.options[0];
        }
      } else {
        if (value === undefined || value === null || value === '') {
          if (field.defaultValue !== undefined) {
            result[field.name] = field.defaultValue;
          }
        } else {
          result[field.name] = String(value);
        }
      }
    });
    return result;
  }

  const api = Object.freeze({
    buildParamFields,
    createDefaultValues,
    sanitizeParamValues,
  });

  if (globalScope && typeof globalScope === 'object') {
    globalScope.LazyStrategyParamsSchema = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this);
