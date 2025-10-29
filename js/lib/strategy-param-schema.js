(function (root) {
  function cloneArray(value) {
    return Array.isArray(value) ? value.slice() : [];
  }

  function toNumber(value) {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : NaN;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return NaN;
      const parsed = Number(trimmed);
      return Number.isFinite(parsed) ? parsed : NaN;
    }
    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }
    return Number(value);
  }

  function toBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const normalised = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'y', 'on'].includes(normalised)) return true;
      if (['false', '0', 'no', 'n', 'off', ''].includes(normalised)) return false;
    }
    return Boolean(value);
  }

  function defaultForDescriptor(descriptor) {
    if (descriptor.defaultValue !== undefined) {
      return descriptor.defaultValue;
    }
    if (descriptor.enum && descriptor.enum.length > 0) {
      return descriptor.enum[0];
    }
    if (descriptor.type === 'integer' || descriptor.type === 'number') {
      if (Number.isFinite(descriptor.minimum)) {
        return descriptor.minimum;
      }
      if (descriptor.type === 'integer') {
        return 0;
      }
      return 0;
    }
    if (descriptor.type === 'boolean') {
      return false;
    }
    return '';
  }

  function normaliseDescriptor(name, descriptor) {
    const result = {
      name,
      type: 'number',
      title: name,
      enum: null,
      minimum: undefined,
      maximum: undefined,
      exclusiveMinimum: undefined,
      exclusiveMaximum: undefined,
      multipleOf: undefined,
      defaultValue: undefined,
    };

    if (!descriptor || typeof descriptor !== 'object') {
      result.defaultValue = defaultForDescriptor(result);
      return result;
    }

    if (typeof descriptor.title === 'string' && descriptor.title.trim()) {
      result.title = descriptor.title.trim();
    }

    if (typeof descriptor.type === 'string') {
      const lowered = descriptor.type.toLowerCase();
      if (['integer', 'number', 'boolean', 'string'].includes(lowered)) {
        result.type = lowered;
      } else {
        result.type = 'string';
      }
    }

    if (descriptor.enum && Array.isArray(descriptor.enum)) {
      result.enum = descriptor.enum.slice();
      if (result.type === 'number') {
        result.enum = result.enum.map((item) => {
          const num = toNumber(item);
          return Number.isFinite(num) ? num : item;
        });
      }
    }

    if (descriptor.minimum !== undefined) {
      const min = toNumber(descriptor.minimum);
      if (Number.isFinite(min)) {
        result.minimum = result.type === 'integer' ? Math.round(min) : min;
      }
    }
    if (descriptor.maximum !== undefined) {
      const max = toNumber(descriptor.maximum);
      if (Number.isFinite(max)) {
        result.maximum = result.type === 'integer' ? Math.round(max) : max;
      }
    }
    if (descriptor.exclusiveMinimum !== undefined) {
      const exMin = toNumber(descriptor.exclusiveMinimum);
      if (Number.isFinite(exMin)) {
        result.exclusiveMinimum = result.type === 'integer' ? Math.round(exMin) : exMin;
      }
    }
    if (descriptor.exclusiveMaximum !== undefined) {
      const exMax = toNumber(descriptor.exclusiveMaximum);
      if (Number.isFinite(exMax)) {
        result.exclusiveMaximum = result.type === 'integer' ? Math.round(exMax) : exMax;
      }
    }
    if (descriptor.multipleOf !== undefined) {
      const step = toNumber(descriptor.multipleOf);
      if (Number.isFinite(step) && step > 0) {
        result.multipleOf = result.type === 'integer' ? Math.max(1, Math.round(step)) : step;
      }
    }

    if (descriptor.default !== undefined) {
      if (result.type === 'boolean') {
        result.defaultValue = toBoolean(descriptor.default);
      } else if (result.type === 'integer') {
        const num = toNumber(descriptor.default);
        if (Number.isFinite(num)) {
          result.defaultValue = Math.round(num);
        }
      } else if (result.type === 'number') {
        const num = toNumber(descriptor.default);
        if (Number.isFinite(num)) {
          result.defaultValue = num;
        }
      } else if (result.enum && result.enum.includes(descriptor.default)) {
        result.defaultValue = descriptor.default;
      } else {
        result.defaultValue = descriptor.default;
      }
    }

    if (result.defaultValue === undefined && result.enum && result.enum.length > 0) {
      result.defaultValue = result.enum[0];
    }
    if (result.defaultValue === undefined && result.type === 'boolean') {
      result.defaultValue = false;
    }
    if (result.defaultValue === undefined && (result.type === 'integer' || result.type === 'number')) {
      if (Number.isFinite(result.minimum)) {
        result.defaultValue = result.minimum;
      } else {
        result.defaultValue = result.type === 'integer' ? 0 : 0;
      }
    }
    if (result.defaultValue === undefined && result.type === 'string') {
      result.defaultValue = '';
    }

    return result;
  }

  function normaliseSchema(schema) {
    if (schema && schema.__normalised === true) {
      return schema;
    }
    const base = {
      type: 'object',
      additionalProperties: true,
      required: [],
      properties: {},
      __normalised: true,
    };

    if (!schema || typeof schema !== 'object') {
      return base;
    }

    if (typeof schema.additionalProperties === 'boolean') {
      base.additionalProperties = schema.additionalProperties;
    }

    if (Array.isArray(schema.required)) {
      base.required = schema.required.filter((item) => typeof item === 'string' && item);
    }

    const props = schema.properties && typeof schema.properties === 'object' ? schema.properties : {};
    Object.keys(props).forEach((name) => {
      base.properties[name] = normaliseDescriptor(name, props[name]);
    });

    return base;
  }

  function deriveDefaults(schema) {
    const normalised = normaliseSchema(schema);
    const defaults = {};
    Object.keys(normalised.properties).forEach((name) => {
      const descriptor = normalised.properties[name];
      defaults[name] = defaultForDescriptor(descriptor);
    });
    return defaults;
  }

  function clampExclusive(value, exclusiveLimit, isUpper, type) {
    if (!Number.isFinite(exclusiveLimit)) {
      return value;
    }
    if (type === 'integer') {
      return isUpper ? exclusiveLimit - 1 : exclusiveLimit + 1;
    }
    const epsilon = 1e-9;
    return isUpper ? exclusiveLimit - epsilon : exclusiveLimit + epsilon;
  }

  function sanitiseNumeric(descriptor, raw, errors) {
    if (raw === null || raw === undefined || raw === '') {
      return { value: defaultForDescriptor(descriptor), changed: false };
    }
    const numeric = toNumber(raw);
    if (!Number.isFinite(numeric)) {
      errors.push(`${descriptor.title} 必須為數值`);
      return { value: defaultForDescriptor(descriptor), changed: true };
    }
    let value = descriptor.type === 'integer' ? Math.round(numeric) : numeric;
    let changed = value !== numeric;

    if (Number.isFinite(descriptor.exclusiveMinimum) && value <= descriptor.exclusiveMinimum) {
      const adjusted = clampExclusive(value, descriptor.exclusiveMinimum, false, descriptor.type);
      if (Number.isFinite(descriptor.minimum)) {
        value = Math.max(adjusted, descriptor.minimum);
      } else {
        value = adjusted;
      }
      changed = true;
      errors.push(`${descriptor.title} 必須大於 ${descriptor.exclusiveMinimum}`);
    }
    if (Number.isFinite(descriptor.minimum) && value < descriptor.minimum) {
      value = descriptor.minimum;
      changed = true;
      errors.push(`${descriptor.title} 不可小於 ${descriptor.minimum}`);
    }

    if (Number.isFinite(descriptor.exclusiveMaximum) && value >= descriptor.exclusiveMaximum) {
      const adjusted = clampExclusive(value, descriptor.exclusiveMaximum, true, descriptor.type);
      if (Number.isFinite(descriptor.maximum)) {
        value = Math.min(adjusted, descriptor.maximum);
      } else {
        value = adjusted;
      }
      changed = true;
      errors.push(`${descriptor.title} 必須小於 ${descriptor.exclusiveMaximum}`);
    }
    if (Number.isFinite(descriptor.maximum) && value > descriptor.maximum) {
      value = descriptor.maximum;
      changed = true;
      errors.push(`${descriptor.title} 不可大於 ${descriptor.maximum}`);
    }

    if (Number.isFinite(descriptor.multipleOf) && descriptor.multipleOf > 0) {
      const multiplier = Math.round(value / descriptor.multipleOf);
      const snapped = multiplier * descriptor.multipleOf;
      if (Math.abs(snapped - value) > 1e-9) {
        value = descriptor.type === 'integer' ? Math.round(snapped) : snapped;
        changed = true;
      }
    }

    return { value, changed };
  }

  function sanitiseEnum(descriptor, raw, errors) {
    const options = Array.isArray(descriptor.enum) ? descriptor.enum : [];
    if (options.length === 0) {
      const fallback = descriptor.defaultValue !== undefined ? descriptor.defaultValue : defaultForDescriptor(descriptor);
      return { value: fallback, changed: raw !== fallback };
    }
    if (raw === undefined || raw === null || raw === '') {
      const fallback = descriptor.defaultValue !== undefined ? descriptor.defaultValue : options[0];
      return { value: fallback, changed: false };
    }
    if (options.includes(raw)) {
      return { value: raw, changed: false };
    }
    const fallback = descriptor.defaultValue !== undefined ? descriptor.defaultValue : options[0];
    errors.push(`${descriptor.title} 必須為 ${options.join('、')} 之一`);
    return { value: fallback, changed: true };
  }

  function sanitiseValue(descriptor, raw, errors) {
    if (descriptor.enum && descriptor.enum.length > 0) {
      return sanitiseEnum(descriptor, raw, errors);
    }
    if (descriptor.type === 'boolean') {
      if (raw === undefined || raw === null || raw === '') {
        const fallback = descriptor.defaultValue !== undefined ? descriptor.defaultValue : false;
        return { value: fallback, changed: false };
      }
      const boolValue = toBoolean(raw);
      return { value: boolValue, changed: boolValue !== raw };
    }
    if (descriptor.type === 'string') {
      if (raw === undefined || raw === null) {
        const fallback = descriptor.defaultValue !== undefined ? descriptor.defaultValue : '';
        return { value: fallback, changed: false };
      }
      const stringValue = String(raw);
      return { value: stringValue, changed: stringValue !== raw };
    }
    return sanitiseNumeric(descriptor, raw, errors);
  }

  function sanitiseParams(schema, values) {
    const normalised = normaliseSchema(schema);
    const defaults = deriveDefaults(normalised);
    const input = values && typeof values === 'object' ? values : {};
    const errors = [];
    const result = { ...defaults };
    let changed = false;

    Object.keys(normalised.properties).forEach((name) => {
      const descriptor = normalised.properties[name];
      const raw = input[name];
      const { value, changed: fieldChanged } = sanitiseValue(descriptor, raw, errors);
      result[name] = value;
      changed = changed || fieldChanged;
    });

    if (!normalised.additionalProperties) {
      return { values: result, errors, changed };
    }

    Object.keys(input).forEach((name) => {
      if (!(name in normalised.properties)) {
        result[name] = input[name];
      }
    });

    return { values: result, errors, changed };
  }

  function createFieldDescriptors(schema) {
    const normalised = normaliseSchema(schema);
    const descriptors = [];
    Object.keys(normalised.properties).forEach((name) => {
      const descriptor = normalised.properties[name];
      const field = {
        name,
        label: descriptor.title || name,
        control: 'text',
        minimum: descriptor.minimum,
        maximum: descriptor.maximum,
        step: null,
        options: descriptor.enum ? descriptor.enum.slice() : null,
        defaultValue: descriptor.defaultValue !== undefined
          ? descriptor.defaultValue
          : defaultForDescriptor(descriptor),
      };

      if (descriptor.enum && descriptor.enum.length > 0) {
        field.control = 'select';
      } else if (descriptor.type === 'boolean') {
        field.control = 'checkbox';
      } else if (descriptor.type === 'integer' || descriptor.type === 'number') {
        field.control = 'number';
        if (Number.isFinite(descriptor.multipleOf) && descriptor.multipleOf > 0) {
          field.step = descriptor.multipleOf;
        } else if (descriptor.type === 'integer') {
          field.step = 1;
        }
      }

      descriptors.push(field);
    });
    return descriptors;
  }

  const api = Object.freeze({
    normaliseSchema,
    deriveDefaults,
    sanitiseParams,
    createFieldDescriptors,
  });

  if (root && typeof root === 'object') {
    root.lazybacktestParamSchema = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this);
