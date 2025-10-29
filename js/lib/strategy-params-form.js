(function (root, factory) {
  const exported = factory(root);
  if (typeof module === 'object' && module.exports) {
    module.exports = exported;
  }
  if (root) {
    root.LazyStrategyParamsForm = exported;
  }
})(typeof self !== 'undefined' ? self : this, function createParamsFormFactory(root) {
  const presentation = root && root.LazyStrategyParamPresentation;

  function ensureObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function inferStep(descriptor) {
    if (!descriptor) return undefined;
    if (typeof descriptor.multipleOf === 'number' && Number.isFinite(descriptor.multipleOf)) {
      return descriptor.multipleOf;
    }
    if (descriptor.type === 'integer') {
      return 1;
    }
    if (descriptor.type === 'number') {
      return 0.1;
    }
    return undefined;
  }

  function resolvePresentation(role, strategyId, paramName) {
    if (presentation && typeof presentation.resolve === 'function') {
      return presentation.resolve(role, strategyId, paramName);
    }
    const suffix = typeof paramName === 'string' && paramName
      ? paramName.charAt(0).toUpperCase() + paramName.slice(1)
      : 'Param';
    return {
      label: paramName || '',
      inputId: `${role || 'entry'}${suffix}`,
    };
  }

  function buildFieldDescriptors(schema, options = {}) {
    const role = options.role || 'entry';
    const strategyId = options.strategyId || '';
    const targetSchema = ensureObject(schema);
    const properties = ensureObject(targetSchema.properties);
    const requiredSet = new Set(Array.isArray(targetSchema.required) ? targetSchema.required : []);

    return Object.keys(properties).map((paramName) => {
      const descriptor = ensureObject(properties[paramName]);
      let fieldType = 'text';
      if (Array.isArray(descriptor.enum) && descriptor.enum.length > 0) {
        fieldType = 'select';
      } else if (descriptor.type === 'integer' || descriptor.type === 'number') {
        fieldType = 'number';
      } else if (descriptor.type === 'boolean') {
        fieldType = 'boolean';
      }

      const attributes = {};
      if (typeof descriptor.minimum === 'number') {
        attributes.min = descriptor.minimum;
      }
      if (typeof descriptor.maximum === 'number') {
        attributes.max = descriptor.maximum;
      }
      if (typeof descriptor.exclusiveMinimum === 'number') {
        attributes.min = descriptor.exclusiveMinimum;
        attributes.minExclusive = true;
      }
      if (typeof descriptor.exclusiveMaximum === 'number') {
        attributes.max = descriptor.exclusiveMaximum;
        attributes.maxExclusive = true;
      }
      const step = inferStep(descriptor);
      if (step !== undefined) {
        attributes.step = step;
      }

      const { label, inputId } = resolvePresentation(role, strategyId, paramName);

      return {
        name: paramName,
        type: fieldType,
        label,
        inputId,
        enum: Array.isArray(descriptor.enum) ? descriptor.enum.slice() : undefined,
        attributes,
        defaultValue: descriptor.default,
        required: requiredSet.has(paramName),
        schema: descriptor,
      };
    });
  }

  function buildInitialValues(schema, defaults = {}) {
    const targetSchema = ensureObject(schema);
    const properties = ensureObject(targetSchema.properties);
    const initial = {};
    Object.keys(properties).forEach((paramName) => {
      const descriptor = properties[paramName] || {};
      if (defaults[paramName] !== undefined) {
        initial[paramName] = defaults[paramName];
        return;
      }
      if (descriptor.default !== undefined) {
        initial[paramName] = descriptor.default;
        return;
      }
      if (descriptor.type === 'boolean') {
        initial[paramName] = false;
      } else if (descriptor.type === 'integer' || descriptor.type === 'number') {
        initial[paramName] = 0;
      } else {
        initial[paramName] = '';
      }
    });
    return initial;
  }

  function clampNumeric(value, descriptor, errors, paramName) {
    if (!descriptor) return value;
    let result = value;
    if (typeof descriptor.minimum === 'number' && result < descriptor.minimum) {
      result = descriptor.minimum;
      errors.push(`${paramName} 小於允許的最小值，已調整為 ${descriptor.minimum}`);
    }
    if (typeof descriptor.maximum === 'number' && result > descriptor.maximum) {
      result = descriptor.maximum;
      errors.push(`${paramName} 大於允許的最大值，已調整為 ${descriptor.maximum}`);
    }
    if (typeof descriptor.exclusiveMinimum === 'number' && result <= descriptor.exclusiveMinimum) {
      result = descriptor.exclusiveMinimum + (descriptor.type === 'integer' ? 1 : Number.EPSILON);
      errors.push(`${paramName} 必須大於 ${descriptor.exclusiveMinimum}`);
    }
    if (typeof descriptor.exclusiveMaximum === 'number' && result >= descriptor.exclusiveMaximum) {
      result = descriptor.exclusiveMaximum - (descriptor.type === 'integer' ? 1 : Number.EPSILON);
      errors.push(`${paramName} 必須小於 ${descriptor.exclusiveMaximum}`);
    }
    return result;
  }

  function coerceBoolean(raw) {
    if (typeof raw === 'boolean') return raw;
    if (typeof raw === 'string') {
      const trimmed = raw.trim().toLowerCase();
      if (trimmed === 'true' || trimmed === '1' || trimmed === 'yes') return true;
      if (trimmed === 'false' || trimmed === '0' || trimmed === 'no') return false;
    }
    if (typeof raw === 'number') {
      return raw !== 0;
    }
    return Boolean(raw);
  }

  function validateValues(schema, fields, rawValues = {}) {
    const errors = [];
    const values = {};
    const fieldMap = Array.isArray(fields)
      ? fields.reduce((map, field) => {
          map[field.name] = field;
          return map;
        }, {})
      : {};
    const descriptorMap = ensureObject(ensureObject(schema).properties);

    Object.keys(fieldMap).forEach((paramName) => {
      const field = fieldMap[paramName];
      const schemaDescriptor = descriptorMap[paramName] || {};
      const raw = rawValues[paramName];
      let value;

      if (field.type === 'number') {
        const parsed = raw === '' || raw === undefined ? NaN : Number(raw);
        if (!Number.isFinite(parsed)) {
          const fallback = field.defaultValue !== undefined ? field.defaultValue : schemaDescriptor.default;
          if (fallback !== undefined) {
            value = Number(fallback);
            errors.push(`${paramName} 不是有效數值，已回退預設值`);
          } else if (field.required) {
            value = 0;
            errors.push(`${paramName} 需要填寫有效數值`);
          } else {
            value = 0;
          }
        } else {
          value = parsed;
        }
        value = clampNumeric(value, schemaDescriptor, errors, paramName);
      } else if (field.type === 'boolean') {
        value = coerceBoolean(raw);
      } else if (field.type === 'select') {
        const options = Array.isArray(field.enum) ? field.enum : [];
        if (options.includes(raw)) {
          value = raw;
        } else if (schemaDescriptor.default !== undefined) {
          value = schemaDescriptor.default;
          errors.push(`${paramName} 不在可選項目內，已回退預設值`);
        } else if (options.length > 0) {
          value = options[0];
          errors.push(`${paramName} 不在可選項目內，已選用第一個選項`);
        } else {
          value = raw;
        }
      } else {
        value = raw === undefined ? schemaDescriptor.default || '' : raw;
      }

      if (field.required && (value === '' || value === undefined || value === null)) {
        errors.push(`${paramName} 為必填欄位`);
      }

      values[paramName] = value;
    });

    return { values, errors };
  }

  function renderFields(container, fields, values = {}) {
    if (!container || typeof container !== 'object') return;
    const doc = container.ownerDocument || (typeof document !== 'undefined' ? document : null);
    if (!doc) return;
    container.innerHTML = '';
    fields.forEach((field) => {
      const wrapper = doc.createElement('div');
      wrapper.className = 'space-y-1';

      const label = doc.createElement('label');
      label.className = 'block text-xs font-medium text-foreground';
      label.setAttribute('for', field.inputId);
      label.textContent = field.label || field.name;
      wrapper.appendChild(label);

      let input;
      if (field.type === 'select') {
        input = doc.createElement('select');
        input.className = 'w-full px-3 py-2 border border-border rounded-md bg-input text-foreground text-sm';
        (field.enum || []).forEach((optionValue) => {
          const option = doc.createElement('option');
          option.value = optionValue;
          option.textContent = optionValue;
          input.appendChild(option);
        });
      } else if (field.type === 'boolean') {
        input = doc.createElement('input');
        input.type = 'checkbox';
        input.className = 'h-4 w-4 rounded border-border text-primary focus:ring-primary';
      } else {
        input = doc.createElement('input');
        input.type = field.type === 'number' ? 'number' : 'text';
        input.className = 'w-full px-3 py-2 border border-border rounded-md text-sm focus:ring-accent focus:border-accent bg-input text-foreground';
        if (field.type === 'number') {
          if (field.attributes.min !== undefined) {
            input.min = String(field.attributes.min);
          }
          if (field.attributes.max !== undefined) {
            input.max = String(field.attributes.max);
          }
          if (field.attributes.step !== undefined) {
            input.step = String(field.attributes.step);
          }
        }
      }

      input.id = field.inputId;
      input.setAttribute('data-strategy-param', field.name);
      input.setAttribute('data-strategy-role', field.schema && field.schema.role ? field.schema.role : '');

      const value = values[field.name];
      if (field.type === 'boolean') {
        input.checked = Boolean(value);
      } else if (value !== undefined && value !== null) {
        input.value = String(value);
      }

      wrapper.appendChild(input);
      container.appendChild(wrapper);
    });
  }

  function readValues(container, fields) {
    if (!container || typeof container !== 'object') {
      return {};
    }
    const doc = container.ownerDocument || (typeof document !== 'undefined' ? document : null);
    if (!doc) return {};
    const values = {};
    fields.forEach((field) => {
      const input = doc.getElementById(field.inputId);
      if (!input) {
        return;
      }
      if (field.type === 'boolean') {
        values[field.name] = Boolean(input.checked);
      } else if (field.type === 'number') {
        values[field.name] = input.value === '' ? '' : Number(input.value);
      } else {
        values[field.name] = input.value;
      }
    });
    return values;
  }

  return {
    buildFieldDescriptors,
    buildInitialValues,
    validateValues,
    renderFields,
    readValues,
  };
});
