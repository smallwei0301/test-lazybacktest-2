// Strategy Parameter Form Manager - Patch Tag: LB-STRATEGY-PARAM-FORM-20260917A
(function attachStrategyParamFormManager(root) {
  const globalScope = root || (typeof self !== 'undefined' ? self : this);
  if (!globalScope) {
    return;
  }

  const MANAGER_VERSION = 'LB-STRATEGY-PARAM-FORM-20260917A';
  const roleStateMap = new Map();

  function toFiniteNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : NaN;
  }

  function cloneSchema(schema) {
    if (!schema || typeof schema !== 'object') {
      return null;
    }
    if (Array.isArray(schema)) {
      return schema.map((item) => cloneSchema(item));
    }
    const clone = {};
    Object.keys(schema).forEach((key) => {
      const value = schema[key];
      if (value && typeof value === 'object') {
        clone[key] = cloneSchema(value);
      } else {
        clone[key] = value;
      }
    });
    return clone;
  }

  function createSchemaFromDefaults(strategyId, defaults) {
    const schema = {
      type: 'object',
      additionalProperties: true,
      properties: {},
    };
    if (!defaults || typeof defaults !== 'object') {
      return schema;
    }
    Object.entries(defaults).forEach(([key, value]) => {
      if (value === undefined) return;
      const descriptor = { default: value };
      if (typeof value === 'boolean') {
        descriptor.type = 'boolean';
      } else if (typeof value === 'number') {
        descriptor.type = Number.isInteger(value) ? 'integer' : 'number';
      } else if (value === null) {
        descriptor.type = 'number';
        descriptor.default = 0;
      } else {
        descriptor.type = 'string';
      }
      schema.properties[key] = descriptor;
    });
    return schema;
  }

  function mergeSchemaDefaults(schema, defaults) {
    if (!schema || !schema.properties || !defaults) {
      return schema;
    }
    const merged = cloneSchema(schema) || { type: 'object', properties: {} };
    Object.keys(defaults).forEach((key) => {
      if (!merged.properties[key]) {
        merged.properties[key] = {};
      }
      if (!('default' in merged.properties[key])) {
        merged.properties[key].default = defaults[key];
      }
    });
    return merged;
  }

  function getStrategySchema(strategyId) {
    if (!strategyId) {
      return null;
    }
    const registry = globalScope.StrategyPluginRegistry;
    if (registry && typeof registry.getStrategyMetaById === 'function') {
      try {
        const meta = registry.getStrategyMetaById(strategyId);
        if (meta && meta.paramsSchema) {
          return cloneSchema(meta.paramsSchema);
        }
      } catch (error) {
        console.warn('[StrategyParamForm] 無法從 Registry 取得 paramsSchema', error);
      }
    }
    const descriptions = globalScope.strategyDescriptions || globalScope.strategyDescriptions;
    if (descriptions && descriptions[strategyId]) {
      if (descriptions[strategyId].paramsSchema) {
        return cloneSchema(descriptions[strategyId].paramsSchema);
      }
      if (descriptions[strategyId].defaultParams) {
        return createSchemaFromDefaults(strategyId, descriptions[strategyId].defaultParams);
      }
    }
    return null;
  }

  function getSchemaWithDefaults(strategyId) {
    const baseSchema = getStrategySchema(strategyId);
    const descriptions = globalScope.strategyDescriptions || globalScope.strategyDescriptions;
    const defaults = descriptions && descriptions[strategyId] ? descriptions[strategyId].defaultParams : null;
    if (!baseSchema) {
      return defaults ? createSchemaFromDefaults(strategyId, defaults) : null;
    }
    return defaults ? mergeSchemaDefaults(baseSchema, defaults) : baseSchema;
  }

  function normalizeParamValue(descriptor, rawValue) {
    if (!descriptor || typeof descriptor !== 'object') {
      return rawValue;
    }
    const { type } = descriptor;
    const enumValues = Array.isArray(descriptor.enum) ? descriptor.enum.slice() : null;
    const fallback = descriptor.default !== undefined ? descriptor.default : enumValues ? enumValues[0] : undefined;

    if (enumValues && enumValues.length > 0) {
      if (enumValues.includes(rawValue)) {
        return rawValue;
      }
      const normalized = typeof rawValue === 'string' ? rawValue.trim() : rawValue;
      if (enumValues.includes(normalized)) {
        return normalized;
      }
      return fallback !== undefined ? fallback : enumValues[0];
    }

    if (type === 'boolean') {
      if (typeof rawValue === 'string') {
        const lowered = rawValue.trim().toLowerCase();
        if (['1', 'true', 'yes', 'on'].includes(lowered)) return true;
        if (['0', 'false', 'no', 'off'].includes(lowered)) return false;
      }
      return Boolean(rawValue);
    }

    if (type === 'integer' || type === 'number') {
      const numeric = toFiniteNumber(rawValue);
      if (!Number.isFinite(numeric)) {
        if (Number.isFinite(toFiniteNumber(fallback))) {
          return toFiniteNumber(fallback);
        }
        return type === 'integer' ? 0 : 0;
      }
      let value = numeric;
      if (type === 'integer') {
        value = Math.round(value);
      }
      const { minimum, maximum, exclusiveMinimum, exclusiveMaximum, multipleOf } = descriptor;
      if (Number.isFinite(minimum) && value < minimum) {
        value = minimum;
      }
      if (Number.isFinite(maximum) && value > maximum) {
        value = maximum;
      }
      if (Number.isFinite(exclusiveMinimum) && value <= exclusiveMinimum) {
        value = type === 'integer' ? Math.trunc(exclusiveMinimum) + 1 : exclusiveMinimum + Number.EPSILON;
      }
      if (Number.isFinite(exclusiveMaximum) && value >= exclusiveMaximum) {
        value = type === 'integer' ? Math.trunc(exclusiveMaximum) - 1 : exclusiveMaximum - Number.EPSILON;
      }
      if (Number.isFinite(multipleOf) && multipleOf > 0) {
        const steps = Math.round(value / multipleOf);
        value = steps * multipleOf;
      }
      return value;
    }

    if (type === 'string') {
      if (rawValue === undefined || rawValue === null) {
        return fallback !== undefined ? fallback : '';
      }
      return String(rawValue);
    }

    return rawValue;
  }

  function ensureRoleState(role) {
    const key = String(role || 'entry');
    if (!roleStateMap.has(key)) {
      roleStateMap.set(key, {
        role: key,
        containerId: null,
        selectId: null,
        optimizeSelectId: null,
        onParamsChange: null,
        fields: [],
        schema: null,
        strategyId: null,
      });
    }
    return roleStateMap.get(key);
  }

  function resolvePresentation(role, strategyId, paramName) {
    const resolver = globalScope.resolveStrategyParamPresentation;
    if (typeof resolver === 'function') {
      try {
        const presentation = resolver(role, strategyId, paramName);
        if (presentation && presentation.inputId) {
          return presentation;
        }
      } catch (error) {
        console.warn('[StrategyParamForm] resolveStrategyParamPresentation 失敗', error);
      }
    }
    const suffix = paramName.charAt(0).toUpperCase() + paramName.slice(1);
    return {
      label: paramName,
      inputId: `${role}${suffix}`,
    };
  }

  function updateOptimizeTargets(roleState, strategyId) {
    if (typeof document === 'undefined' || !roleState.optimizeSelectId) {
      return;
    }
    const select = document.getElementById(roleState.optimizeSelectId);
    if (!select) {
      return;
    }
    const descriptions = globalScope.strategyDescriptions || globalScope.strategyDescriptions;
    const descriptor = descriptions ? descriptions[strategyId] : null;
    const targets = Array.isArray(descriptor && descriptor.optimizeTargets) ? descriptor.optimizeTargets : [];
    select.innerHTML = '';
    if (targets.length === 0) {
      const opt = document.createElement('option');
      opt.value = 'null';
      opt.textContent = '無可優化';
      select.appendChild(opt);
      select.disabled = true;
      select.title = '此策略無可優化參數';
      return;
    }
    targets.forEach((target) => {
      const option = document.createElement('option');
      option.value = target.name;
      option.textContent = target.label || target.name;
      select.appendChild(option);
    });
    select.disabled = false;
    select.title = '選擇優化參數';
  }

  function createFieldElement(options) {
    if (typeof document === 'undefined') {
      return null;
    }
    const {
      role,
      strategyId,
      paramName,
      descriptor,
      value,
      onChange,
    } = options;
    const presentation = resolvePresentation(role, strategyId, paramName);
    const wrapper = document.createElement('div');
    wrapper.className = 'space-y-1';

    const label = document.createElement('label');
    label.className = 'block text-xs font-medium';
    label.style.color = 'var(--foreground)';
    label.textContent = presentation.label || paramName;
    label.htmlFor = presentation.inputId;
    wrapper.appendChild(label);

    let control = null;
    const hasEnum = Array.isArray(descriptor.enum) && descriptor.enum.length > 0;
    const defaultValue = value !== undefined ? value : descriptor.default;
    const normalizedDefault = normalizeParamValue(descriptor, defaultValue);

    if (hasEnum) {
      const select = document.createElement('select');
      select.id = presentation.inputId;
      select.className = 'w-full px-3 py-2 border border-border rounded-md bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring';
      descriptor.enum.forEach((entry) => {
        const option = document.createElement('option');
        option.value = entry;
        option.textContent = String(entry);
        select.appendChild(option);
      });
      select.value = normalizedDefault;
      select.addEventListener('change', () => {
        const sanitized = normalizeParamValue(descriptor, select.value);
        if (sanitized !== select.value) {
          select.value = sanitized;
        }
        if (typeof onChange === 'function') {
          onChange(sanitized);
        }
      });
      control = select;
    } else if (descriptor.type === 'boolean') {
      const container = document.createElement('div');
      container.className = 'flex items-center gap-2';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = presentation.inputId;
      checkbox.className = 'h-4 w-4 rounded border-border text-primary focus:ring-ring';
      checkbox.checked = Boolean(normalizedDefault);
      checkbox.addEventListener('change', () => {
        const sanitized = normalizeParamValue(descriptor, checkbox.checked);
        checkbox.checked = Boolean(sanitized);
        if (typeof onChange === 'function') {
          onChange(Boolean(sanitized));
        }
      });
      container.appendChild(checkbox);
      const labelText = document.createElement('span');
      labelText.className = 'text-xs';
      labelText.style.color = 'var(--muted-foreground)';
      labelText.textContent = '啟用';
      container.appendChild(labelText);
      wrapper.appendChild(container);
      control = checkbox;
    } else {
      const input = document.createElement('input');
      input.type = descriptor.type === 'integer' || descriptor.type === 'number' ? 'number' : 'text';
      input.id = presentation.inputId;
      input.className = 'w-full px-3 py-2 border border-border rounded-md bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring';
      if (Number.isFinite(descriptor.minimum)) {
        input.min = String(descriptor.minimum);
      }
      if (Number.isFinite(descriptor.maximum)) {
        input.max = String(descriptor.maximum);
      }
      if (Number.isFinite(descriptor.multipleOf) && descriptor.multipleOf > 0) {
        input.step = String(descriptor.multipleOf);
      } else if (descriptor.type === 'integer') {
        input.step = '1';
      }
      input.value = normalizedDefault !== undefined && normalizedDefault !== null ? String(normalizedDefault) : '';
      const syncValue = () => {
        const sanitized = normalizeParamValue(descriptor, input.value);
        if (sanitized !== undefined && sanitized !== null) {
          if (descriptor.type === 'integer' || descriptor.type === 'number') {
            if (input.value !== String(sanitized)) {
              input.value = String(sanitized);
            }
          }
        }
        if (typeof onChange === 'function') {
          onChange(sanitized);
        }
      };
      input.addEventListener('change', syncValue);
      input.addEventListener('blur', syncValue);
      control = input;
    }

    if (control && control !== wrapper.lastChild) {
      wrapper.appendChild(control);
    }

    return {
      element: wrapper,
      control,
      descriptor,
      paramName,
      presentation,
      getValue() {
        if (!control) return undefined;
        if (control instanceof HTMLInputElement) {
          if (control.type === 'checkbox') {
            return normalizeParamValue(descriptor, control.checked);
          }
          return normalizeParamValue(descriptor, control.value);
        }
        if (control instanceof HTMLSelectElement) {
          return normalizeParamValue(descriptor, control.value);
        }
        return undefined;
      },
      setValue(nextValue) {
        if (!control) return;
        const sanitized = normalizeParamValue(descriptor, nextValue);
        if (control instanceof HTMLInputElement) {
          if (control.type === 'checkbox') {
            control.checked = Boolean(sanitized);
            control.dispatchEvent(new Event('change'));
          } else {
            control.value = sanitized !== undefined && sanitized !== null ? String(sanitized) : '';
            control.dispatchEvent(new Event('change'));
          }
        } else if (control instanceof HTMLSelectElement) {
          control.value = sanitized !== undefined ? sanitized : control.value;
          control.dispatchEvent(new Event('change'));
        }
      },
    };
  }

  function collectValues(roleState) {
    const result = {};
    roleState.fields.forEach((field) => {
      if (!field) return;
      result[field.paramName] = field.getValue();
    });
    return result;
  }

  function renderRoleForm(role, strategyId, options = {}) {
    const roleState = ensureRoleState(role);
    roleState.strategyId = strategyId;
    roleState.schema = getSchemaWithDefaults(strategyId);
    roleState.fields = [];

    if (typeof document === 'undefined' || !roleState.containerId) {
      return;
    }
    const container = document.getElementById(roleState.containerId);
    if (!container) {
      return;
    }
    container.innerHTML = '';

    if (!roleState.schema || !roleState.schema.properties || Object.keys(roleState.schema.properties).length === 0) {
      const placeholder = document.createElement('p');
      placeholder.className = 'text-xs italic';
      placeholder.style.color = 'var(--muted-foreground)';
      placeholder.textContent = '此策略無需參數';
      container.appendChild(placeholder);
      updateOptimizeTargets(roleState, strategyId);
      if (typeof roleState.onParamsChange === 'function') {
        roleState.onParamsChange(role, {});
      }
      return;
    }

    const initialParams = options.initialParams && typeof options.initialParams === 'object'
      ? options.initialParams
      : null;

    Object.entries(roleState.schema.properties).forEach(([paramName, descriptor]) => {
      const value = initialParams && paramName in initialParams ? initialParams[paramName] : descriptor.default;
      const field = createFieldElement({
        role,
        strategyId,
        paramName,
        descriptor,
        value,
        onChange: () => {
          if (typeof roleState.onParamsChange === 'function') {
            roleState.onParamsChange(role, collectValues(roleState));
          }
        },
      });
      if (field && field.element) {
        roleState.fields.push(field);
        container.appendChild(field.element);
      }
    });

    updateOptimizeTargets(roleState, strategyId);
    if (typeof roleState.onParamsChange === 'function') {
      roleState.onParamsChange(role, collectValues(roleState));
    }
  }

  function registerRole(role, config = {}) {
    const roleState = ensureRoleState(role);
    roleState.containerId = config.containerId || roleState.containerId;
    roleState.selectId = config.selectId || roleState.selectId;
    roleState.optimizeSelectId = config.optimizeSelectId || roleState.optimizeSelectId;
    roleState.onParamsChange = typeof config.onParamsChange === 'function' ? config.onParamsChange : roleState.onParamsChange;
    return roleState;
  }

  function getValues(role) {
    const roleState = ensureRoleState(role);
    if (!roleState.fields || roleState.fields.length === 0) {
      return {};
    }
    return collectValues(roleState);
  }

  function setValues(role, params) {
    const roleState = ensureRoleState(role);
    if (!roleState.fields || roleState.fields.length === 0) {
      return;
    }
    roleState.fields.forEach((field) => {
      if (!field) return;
      if (params && Object.prototype.hasOwnProperty.call(params, field.paramName)) {
        field.setValue(params[field.paramName]);
      }
    });
    if (typeof roleState.onParamsChange === 'function') {
      roleState.onParamsChange(role, collectValues(roleState));
    }
  }

  const api = {
    registerRole,
    renderRoleForm,
    getValues,
    setValues,
    getSchemaForStrategy: getSchemaWithDefaults,
    createField: createFieldElement,
    normalizeParamValue,
    __version__: MANAGER_VERSION,
    __test__: {
      createSchemaFromDefaults,
      normalizeParamValue,
    },
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (typeof globalScope.lazybacktestStrategyParamForm !== 'object') {
    globalScope.lazybacktestStrategyParamForm = api;
  } else {
    Object.assign(globalScope.lazybacktestStrategyParamForm, api);
  }
})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
