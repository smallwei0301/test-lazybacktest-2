// Strategy Parameter Form Controller - LB-STRATEGY-PARAM-FORM-20260921A
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    const globalScope = root || (typeof self !== 'undefined' ? self : this);
    if (globalScope) {
      Object.defineProperty(globalScope, 'lazybacktestStrategyParamsForm', {
        value: factory(),
        configurable: false,
        enumerable: true,
        writable: false,
      });
    }
  }
})(typeof self !== 'undefined' ? self : this, function strategyParamsFormFactory() {
  const VERSION = 'LB-STRATEGY-PARAM-FORM-20260921A';

  function noop() {}

  function defaultLabelResolver(strategyId, paramName) {
    return {
      label: paramName,
      inputId: `${strategyId || 'strategy'}-${paramName}`,
    };
  }

  function ensureSchemaUtils(schemaUtils) {
    if (schemaUtils && typeof schemaUtils.describeFields === 'function') {
      return schemaUtils;
    }
    if (typeof window !== 'undefined' && window.lazybacktestStrategySchema) {
      return window.lazybacktestStrategySchema;
    }
    throw new Error('StrategyParamsForm 需要提供 schema utilities');
  }

  function createController(options) {
    const container = options?.container;
    if (!container || typeof container !== 'object') {
      throw new TypeError('StrategyParamsForm.createController 需要 container 元素');
    }
    const prefix = typeof options.prefix === 'string' && options.prefix.trim() ? options.prefix.trim() : 'strategy';
    const schemaUtils = ensureSchemaUtils(options?.schemaUtils);
    const resolveLabel = typeof options?.labelResolver === 'function' ? options.labelResolver : defaultLabelResolver;
    const onChange = typeof options?.onChange === 'function' ? options.onChange : noop;
    const getSchema = typeof options?.schemaProvider === 'function' ? options.schemaProvider : null;

    let currentStrategyId = null;
    let currentSchema = null;
    let fieldDescriptors = [];
    let values = {};
    const inputMap = new Map();

    function sanitize(valuesCandidate) {
      return schemaUtils.sanitizeParams(currentSchema, valuesCandidate || {});
    }

    function setInputValue(field, element, value) {
      if (!element) return;
      if (field.inputType === 'checkbox') {
        element.checked = Boolean(value);
        return;
      }
      if (field.inputType === 'select') {
        element.value = value !== undefined ? value : '';
        return;
      }
      if (field.inputType === 'number') {
        element.value = value !== undefined && value !== null ? String(value) : '';
        return;
      }
      element.value = value !== undefined && value !== null ? String(value) : '';
    }

    function collectRawValues() {
      const output = {};
      inputMap.forEach((element, name) => {
        if (!element) return;
        if (element.type === 'checkbox') {
          output[name] = element.checked;
        } else {
          output[name] = element.value;
        }
      });
      return output;
    }

    function applySanitizedValues(nextValues) {
      values = nextValues;
      fieldDescriptors.forEach((field) => {
        const element = inputMap.get(field.name);
        if (!element) return;
        const nextValue = Object.prototype.hasOwnProperty.call(values, field.name)
          ? values[field.name]
          : field.defaultValue;
        setInputValue(field, element, nextValue);
      });
      onChange({ ...values });
    }

    function handleInputChange() {
      const raw = collectRawValues();
      const sanitized = sanitize(raw);
      // Update UI immediately to reflect clamped values
      fieldDescriptors.forEach((field) => {
        const element = inputMap.get(field.name);
        if (!element) return;
        const nextValue = Object.prototype.hasOwnProperty.call(sanitized, field.name)
          ? sanitized[field.name]
          : field.defaultValue;
        setInputValue(field, element, nextValue);
      });
      values = sanitized;
      onChange({ ...values });
    }

    function clearContainer(message) {
      inputMap.clear();
      fieldDescriptors = [];
      currentSchema = null;
      values = {};
      container.innerHTML = '';
      if (message) {
        const placeholder = document.createElement('div');
        placeholder.className = 'text-xs text-muted';
        placeholder.style.color = 'var(--muted-foreground)';
        placeholder.textContent = message;
        container.appendChild(placeholder);
      }
    }

    function render(strategyId, initialValues) {
      currentStrategyId = strategyId || null;
      const schema = getSchema ? getSchema(strategyId) : options?.schema;
      if (!schema || typeof schema !== 'object') {
        clearContainer('此策略無需額外參數');
        return;
      }
      currentSchema = schema;
      container.innerHTML = '';
      inputMap.clear();
      fieldDescriptors = schemaUtils.describeFields(schema);
      values = sanitize(initialValues);

      if (fieldDescriptors.length === 0) {
        const placeholder = document.createElement('div');
        placeholder.className = 'text-xs text-muted';
        placeholder.style.color = 'var(--muted-foreground)';
        placeholder.textContent = '此策略不需要自訂參數';
        container.appendChild(placeholder);
        return;
      }

      fieldDescriptors.forEach((field) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'space-y-1';

        const labelEl = document.createElement('label');
        labelEl.className = 'block text-xs font-medium';
        labelEl.style.color = 'var(--foreground)';
        const { label, inputId } = resolveLabel(currentStrategyId, field.name) || {};
        const elementId = `${prefix}-${inputId || `${field.name}`}`;
        labelEl.setAttribute('for', elementId);
        labelEl.textContent = label || field.name;

        let inputEl = null;
        if (field.inputType === 'select') {
          const select = document.createElement('select');
          select.id = elementId;
          select.className = 'w-full px-3 py-2 border border-border rounded-md bg-input text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring';
          select.style.borderColor = 'var(--border)';
          select.style.backgroundColor = 'var(--input)';
          select.style.color = 'var(--foreground)';
          (field.enumValues || []).forEach((optionValue) => {
            const option = document.createElement('option');
            option.value = optionValue;
            option.textContent = String(optionValue);
            select.appendChild(option);
          });
          inputEl = select;
        } else if (field.inputType === 'checkbox') {
          const checkboxWrapper = document.createElement('div');
          checkboxWrapper.className = 'flex items-center gap-2';
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.id = elementId;
          checkbox.className = 'w-4 h-4';
          checkboxWrapper.appendChild(checkbox);
          const checkboxLabel = document.createElement('span');
          checkboxLabel.className = 'text-xs';
          checkboxLabel.style.color = 'var(--muted-foreground)';
          checkboxLabel.textContent = '啟用';
          checkboxWrapper.appendChild(checkboxLabel);
          inputEl = checkbox;
          wrapper.appendChild(labelEl);
          wrapper.appendChild(checkboxWrapper);
        } else {
          const input = document.createElement('input');
          input.type = field.inputType === 'number' ? 'number' : 'text';
          input.id = elementId;
          input.className = 'w-full px-3 py-2 border border-border rounded-md bg-input text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring';
          input.style.borderColor = 'var(--border)';
          input.style.backgroundColor = 'var(--input)';
          input.style.color = 'var(--foreground)';
          if (field.minimum !== null) {
            input.min = String(field.minimum);
          }
          if (field.maximum !== null) {
            input.max = String(field.maximum);
          }
          if (field.step !== null) {
            input.step = String(field.step);
          } else if (field.inputType === 'number') {
            input.step = '1';
          }
          inputEl = input;
        }

        if (!wrapper.contains(labelEl)) {
          wrapper.appendChild(labelEl);
        }
        if (!wrapper.contains(inputEl)) {
          wrapper.appendChild(inputEl);
        }

        container.appendChild(wrapper);
        inputMap.set(field.name, inputEl);
      });

      applySanitizedValues(values);

      inputMap.forEach((element) => {
        if (!element) return;
        element.addEventListener('change', handleInputChange);
        if (element.tagName === 'INPUT' && element.type === 'number') {
          element.addEventListener('blur', handleInputChange);
        }
      });
    }

    function getValues() {
      return { ...values };
    }

    function setValues(nextValues) {
      if (!currentSchema) {
        values = nextValues && typeof nextValues === 'object' ? { ...nextValues } : {};
        return;
      }
      applySanitizedValues(sanitize(nextValues));
    }

    return {
      version: VERSION,
      render,
      getValues,
      setValues,
    };
  }

  return Object.freeze({
    version: VERSION,
    createController,
  });
});
