// Strategy Params Form Manager - LB-DSL-FORM-20260920A
(function (root) {
  const globalScope = root || (typeof self !== 'undefined' ? self : this);
  const schemaUtils = globalScope && globalScope.LazyStrategyParamsSchema;

  if (!schemaUtils) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[StrategyParamsForm] LazyStrategyParamsSchema 未載入，略過參數表單生成器初始化');
    }
    return;
  }

  function normalizeStrategyId(roleType, strategyId) {
    if (!strategyId) {
      return null;
    }
    const trimmed = String(strategyId).trim();
    if (!trimmed) {
      return null;
    }
    if (globalScope && globalScope.LazyStrategyId && typeof globalScope.LazyStrategyId.normalise === 'function') {
      return globalScope.LazyStrategyId.normalise(roleType, trimmed);
    }
    return trimmed;
  }

  function resolveRegistryMeta(registry, strategyId) {
    if (!registry || typeof registry.getStrategyMetaById !== 'function') {
      return null;
    }
    try {
      return registry.getStrategyMetaById(strategyId);
    } catch (error) {
      if (typeof console !== 'undefined' && console.error) {
        console.error('[StrategyParamsForm] 取得策略 Meta 失敗', strategyId, error);
      }
      return null;
    }
  }

  function ensureElement(id) {
    if (!id) return null;
    return typeof document !== 'undefined' ? document.getElementById(id) : null;
  }

  function createFieldWrapper() {
    const wrapper = document.createElement('div');
    wrapper.className = 'space-y-1';
    return wrapper;
  }

  function createLabel(field, inputId) {
    const label = document.createElement('label');
    label.setAttribute('for', inputId);
    label.className = 'block text-[11px] font-medium';
    label.style.color = 'var(--muted-foreground)';
    label.textContent = field.label || field.name;
    return label;
  }

  function createNumberInput(field, inputId, value) {
    const input = document.createElement('input');
    input.type = 'number';
    input.id = inputId;
    input.className = 'w-full px-3 py-2 border rounded-md bg-input text-foreground text-sm';
    input.style.borderColor = 'var(--border)';
    if (Number.isFinite(field.min)) input.min = String(field.min);
    if (Number.isFinite(field.max)) input.max = String(field.max);
    if (Number.isFinite(field.step)) input.step = String(field.step);
    if (Number.isFinite(value)) input.value = String(value);
    return input;
  }

  function createCheckboxInput(field, inputId, value) {
    const wrapper = document.createElement('label');
    wrapper.className = 'flex items-center gap-2 text-xs';
    wrapper.style.color = 'var(--foreground)';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = inputId;
    input.checked = Boolean(value);
    const span = document.createElement('span');
    span.textContent = field.label || field.name;
    wrapper.appendChild(input);
    wrapper.appendChild(span);
    return { wrapper, input };
  }

  function createSelectInput(field, inputId, value) {
    const select = document.createElement('select');
    select.id = inputId;
    select.className = 'w-full px-3 py-2 border rounded-md bg-input text-foreground text-sm';
    select.style.borderColor = 'var(--border)';
    const options = Array.isArray(field.options) ? field.options : [];
    options.forEach((option) => {
      const opt = document.createElement('option');
      opt.value = option;
      opt.textContent = option;
      select.appendChild(opt);
    });
    if (value !== undefined && value !== null) {
      select.value = String(value);
    }
    return select;
  }

  function collectRawValues(container, fields) {
    const raw = {};
    fields.forEach((field) => {
      const selector = `[data-lb-param="${field.name}"]`;
      const input = container.querySelector(selector);
      if (!input) return;
      if (field.inputType === 'checkbox') {
        raw[field.name] = input.checked;
      } else {
        raw[field.name] = input.value;
      }
    });
    return raw;
  }

  function applySanitizedValues(container, fields, values) {
    fields.forEach((field) => {
      const selector = `[data-lb-param="${field.name}"]`;
      const input = container.querySelector(selector);
      if (!input) return;
      const nextValue = values[field.name];
      if (field.inputType === 'checkbox') {
        if (input.checked !== Boolean(nextValue)) {
          input.checked = Boolean(nextValue);
        }
      } else if (field.inputType === 'select') {
        if (nextValue !== undefined && nextValue !== null) {
          input.value = String(nextValue);
        }
      } else if (field.inputType === 'number') {
        if (Number.isFinite(nextValue)) {
          input.value = String(nextValue);
        } else {
          input.value = '';
        }
      } else {
        input.value = nextValue === undefined || nextValue === null ? '' : String(nextValue);
      }
    });
  }

  function StrategyParamsFormManager(options) {
    this.registry = globalScope && globalScope.StrategyPluginRegistry;
    this.strategyDescriptions = options && options.strategyDescriptions ? options.strategyDescriptions : null;
    this.roleStates = new Map();
    const roles = Array.isArray(options && options.roles) ? options.roles : [];
    roles.forEach((roleConfig) => {
      const roleKey = roleConfig.type || roleConfig.role;
      if (!roleKey) {
        return;
      }
      this.roleStates.set(roleKey, {
        role: roleKey,
        label: roleConfig.label || roleKey,
        selectId: roleConfig.selectId || null,
        containerId: roleConfig.containerId || null,
        selectEl: null,
        containerEl: null,
        currentStrategyId: null,
        fields: [],
        valuesByStrategy: new Map(),
      });
    });
  }

  StrategyParamsFormManager.prototype.init = function init() {
    this.roleStates.forEach((roleState) => {
      roleState.selectEl = ensureElement(roleState.selectId);
      roleState.containerEl = ensureElement(roleState.containerId);
      if (roleState.selectEl) {
        roleState.selectEl.addEventListener('change', () => {
          this.renderRole(roleState.role);
        });
      }
      this.renderRole(roleState.role);
    });
  };

  StrategyParamsFormManager.prototype.resolveFallbackDefaults = function resolveFallbackDefaults(strategyId) {
    if (!strategyId || !this.strategyDescriptions) {
      return {};
    }
    const entry = this.strategyDescriptions[strategyId];
    if (!entry || !entry.defaultParams) {
      return {};
    }
    try {
      return JSON.parse(JSON.stringify(entry.defaultParams));
    } catch (error) {
      return {};
    }
  };

  StrategyParamsFormManager.prototype.renderRole = function renderRole(roleKey) {
    const roleState = this.roleStates.get(roleKey);
    if (!roleState || !roleState.containerEl) {
      return;
    }
    const select = roleState.selectEl;
    let strategyId = null;
    if (select) {
      const normalized = normalizeStrategyId(roleKey, select.value);
      if (normalized && normalized !== select.value) {
        const hasOption = Array.from(select.options || []).some((option) => option.value === normalized);
        if (hasOption) {
          select.value = normalized;
        }
        strategyId = normalized;
      } else {
        strategyId = normalized || select.value || null;
      }
    }

    roleState.currentStrategyId = strategyId;

    while (roleState.containerEl.firstChild) {
      roleState.containerEl.removeChild(roleState.containerEl.firstChild);
    }

    if (!strategyId) {
      const placeholder = document.createElement('p');
      placeholder.className = 'text-[11px] text-muted';
      placeholder.style.color = 'var(--muted-foreground)';
      placeholder.textContent = '未選擇策略，無需設定參數。';
      roleState.containerEl.appendChild(placeholder);
      roleState.fields = [];
      return;
    }

    const meta = resolveRegistryMeta(this.registry, strategyId);
    const fallbackDefaults = this.resolveFallbackDefaults(strategyId);
    const fields = schemaUtils.buildParamFields(meta && meta.paramsSchema ? meta.paramsSchema : {}, fallbackDefaults);
    roleState.fields = fields;

    if (!fields || fields.length === 0) {
      const placeholder = document.createElement('p');
      placeholder.className = 'text-[11px] text-muted';
      placeholder.style.color = 'var(--muted-foreground)';
      placeholder.textContent = '此策略不需額外參數。';
      roleState.containerEl.appendChild(placeholder);
      roleState.valuesByStrategy.set(strategyId, {});
      return;
    }

    const defaults = schemaUtils.createDefaultValues(fields);
    const existing = roleState.valuesByStrategy.get(strategyId) || {};
    const merged = Object.assign({}, defaults, existing);
    const sanitized = schemaUtils.sanitizeParamValues(fields, merged);
    roleState.valuesByStrategy.set(strategyId, sanitized);

    fields.forEach((field) => {
      const inputId = `${roleKey}_${strategyId}_${field.name}`;
      if (field.inputType === 'checkbox') {
        const { wrapper, input } = createCheckboxInput(field, inputId, sanitized[field.name]);
        input.setAttribute('data-lb-param', field.name);
        input.addEventListener('change', () => {
          this.handleFieldChange(roleState, strategyId);
        });
        roleState.containerEl.appendChild(wrapper);
      } else {
        const wrapper = createFieldWrapper();
        const label = createLabel(field, inputId);
        let input = null;
        if (field.inputType === 'number') {
          input = createNumberInput(field, inputId, sanitized[field.name]);
        } else if (field.inputType === 'select') {
          input = createSelectInput(field, inputId, sanitized[field.name]);
        } else {
          input = document.createElement('input');
          input.type = 'text';
          input.id = inputId;
          input.className = 'w-full px-3 py-2 border rounded-md bg-input text-foreground text-sm';
          input.style.borderColor = 'var(--border)';
          input.value = sanitized[field.name] === undefined || sanitized[field.name] === null
            ? ''
            : String(sanitized[field.name]);
        }
        input.setAttribute('data-lb-param', field.name);
        input.addEventListener('change', () => {
          this.handleFieldChange(roleState, strategyId);
        });
        if (field.inputType === 'number') {
          input.addEventListener('input', () => {
            this.handleFieldChange(roleState, strategyId);
          });
        }
        wrapper.appendChild(label);
        wrapper.appendChild(input);
        roleState.containerEl.appendChild(wrapper);
      }
    });
  };

  StrategyParamsFormManager.prototype.handleFieldChange = function handleFieldChange(roleState, strategyId) {
    if (!roleState || !roleState.containerEl || !strategyId) {
      return;
    }
    const fields = roleState.fields || [];
    const raw = collectRawValues(roleState.containerEl, fields);
    const sanitized = schemaUtils.sanitizeParamValues(fields, raw);
    roleState.valuesByStrategy.set(strategyId, sanitized);
    applySanitizedValues(roleState.containerEl, fields, sanitized);
  };

  StrategyParamsFormManager.prototype.getParams = function getParams(roleKey) {
    const roleState = this.roleStates.get(roleKey);
    if (!roleState || !roleState.currentStrategyId) {
      return {};
    }
    const stored = roleState.valuesByStrategy.get(roleState.currentStrategyId);
    return stored ? Object.assign({}, stored) : {};
  };

  StrategyParamsFormManager.prototype.getCurrentStrategyId = function getCurrentStrategyId(roleKey) {
    const roleState = this.roleStates.get(roleKey);
    return roleState ? roleState.currentStrategyId : null;
  };

  function createManager(config) {
    return new StrategyParamsFormManager(config || {});
  }

  const api = Object.freeze({
    createManager,
  });

  if (globalScope && typeof globalScope === 'object') {
    globalScope.lazybacktestStrategyParams = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this);
