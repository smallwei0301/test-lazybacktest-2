// Patch Tag: LB-STRATEGY-UI-20260926B
(function (root) {
  const globalScope = root || (typeof self !== 'undefined' ? self : this);
  if (!globalScope) {
    return;
  }

  const PATCH_VERSION = 'LB-STRATEGY-UI-20260926B';
  const STORAGE_KEY = 'lazybacktest.strategy-form.v20260926A';

  if (
    globalScope.lazybacktestStrategyForm &&
    typeof globalScope.lazybacktestStrategyForm.__version__ === 'string' &&
    globalScope.lazybacktestStrategyForm.__version__ >= PATCH_VERSION
  ) {
    return;
  }

  const registry = () => globalScope.StrategyPluginRegistry || null;
  const roleCatalog = () => globalScope.lazybacktestStrategyRoleCatalog || {};

  const ROLE_CONFIGS = [
    {
      type: 'entry',
      selectId: 'entryStrategy',
      paramsContainerId: 'entryParams',
      dslContainerId: 'entryStrategyDsl',
      operatorSelectId: 'entryDslOperator',
      addButtonId: 'entryDslAddRule',
      ruleListId: 'entryDslRuleList',
      primaryNotId: 'entryDslPrimaryNot',
      label: '做多進場',
    },
    {
      type: 'exit',
      selectId: 'exitStrategy',
      paramsContainerId: 'exitParams',
      dslContainerId: 'exitStrategyDsl',
      operatorSelectId: 'exitDslOperator',
      addButtonId: 'exitDslAddRule',
      ruleListId: 'exitDslRuleList',
      primaryNotId: 'exitDslPrimaryNot',
      label: '做多出場',
    },
    {
      type: 'shortEntry',
      selectId: 'shortEntryStrategy',
      paramsContainerId: 'shortEntryParams',
      dslContainerId: 'shortEntryStrategyDsl',
      operatorSelectId: 'shortEntryDslOperator',
      addButtonId: 'shortEntryDslAddRule',
      ruleListId: 'shortEntryDslRuleList',
      primaryNotId: 'shortEntryDslPrimaryNot',
      label: '做空進場',
    },
    {
      type: 'shortExit',
      selectId: 'shortExitStrategy',
      paramsContainerId: 'shortExitParams',
      dslContainerId: 'shortExitStrategyDsl',
      operatorSelectId: 'shortExitDslOperator',
      addButtonId: 'shortExitDslAddRule',
      ruleListId: 'shortExitDslRuleList',
      primaryNotId: 'shortExitDslPrimaryNot',
      label: '回補出場',
    },
  ];

  const stateByRole = new Map();
  let initialized = false;

  function normaliseString(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function normaliseType(value) {
    const raw = normaliseString(value);
    return raw ? raw.toUpperCase() : '';
  }

  function toNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : NaN;
  }

  function cloneParams(params) {
    if (!params || typeof params !== 'object') {
      return {};
    }
    return JSON.parse(JSON.stringify(params));
  }

  function resolveParamPresentation(type, strategyId, paramName) {
    let label = paramName;
    let idSuffix = paramName.charAt(0).toUpperCase() + paramName.slice(1);

    if (strategyId === 'k_d_cross') {
      if (paramName === 'period') {
        label = 'KD週期';
      } else if (paramName === 'thresholdX') {
        label = 'D值上限(X)';
        idSuffix = 'KdThresholdX';
      }
    } else if (strategyId === 'k_d_cross_exit') {
      if (paramName === 'period') {
        label = 'KD週期';
      } else if (paramName === 'thresholdY') {
        label = 'D值下限(Y)';
        idSuffix = 'KdThresholdY';
      }
    } else if (strategyId === 'turtle_stop_loss' && paramName === 'stopLossPeriod') {
      label = '停損週期';
      idSuffix = 'StopLossPeriod';
    } else if ((strategyId === 'macd_cross' || strategyId === 'macd_cross_exit') && paramName === 'signalPeriod') {
      label = 'DEA週期(x)';
      idSuffix = 'SignalPeriod';
    } else if ((strategyId === 'macd_cross' || strategyId === 'macd_cross_exit') && paramName === 'shortPeriod') {
      label = 'DI短EMA(n)';
    } else if ((strategyId === 'macd_cross' || strategyId === 'macd_cross_exit') && paramName === 'longPeriod') {
      label = 'DI長EMA(m)';
    } else if (strategyId === 'short_k_d_cross') {
      if (paramName === 'period') {
        label = 'KD週期';
      } else if (paramName === 'thresholdY') {
        label = 'D值下限(Y)';
        idSuffix = 'ShortKdThresholdY';
      }
    } else if (strategyId === 'cover_k_d_cross') {
      if (paramName === 'period') {
        label = 'KD週期';
      } else if (paramName === 'thresholdX') {
        label = 'D值上限(X)';
        idSuffix = 'CoverKdThresholdX';
      }
    } else if (strategyId === 'short_macd_cross') {
      if (paramName === 'shortPeriod') {
        label = 'DI短EMA(n)';
      } else if (paramName === 'longPeriod') {
        label = 'DI長EMA(m)';
      } else if (paramName === 'signalPeriod') {
        label = 'DEA週期(x)';
        idSuffix = 'ShortSignalPeriod';
      }
    } else if (strategyId === 'cover_macd_cross') {
      if (paramName === 'shortPeriod') {
        label = 'DI短EMA(n)';
      } else if (paramName === 'longPeriod') {
        label = 'DI長EMA(m)';
      } else if (paramName === 'signalPeriod') {
        label = 'DEA週期(x)';
        idSuffix = 'CoverSignalPeriod';
      }
    } else if (strategyId === 'trailing_stop' || strategyId === 'cover_trailing_stop') {
      if (paramName === 'percentage') {
        label = '停損百分比';
      }
    } else if (paramName === 'threshold') {
      label = '閾值';
    } else if (paramName === 'signalPeriod') {
      label = '信號週期';
    } else if (paramName === 'deviations') {
      label = '標準差';
    } else if (paramName === 'multiplier') {
      label = '倍數';
    } else if (paramName === 'breakoutPeriod') {
      label = '突破週期';
    }

    return {
      label,
      inputId: `${type}${idSuffix}`,
    };
  }

  function ensureRoleState(type) {
    if (stateByRole.has(type)) {
      return stateByRole.get(type);
    }
    const state = {
      strategyId: null,
      params: {},
      cachedParams: new Map(),
      paramInputs: new Map(),
      operator: 'AND',
      primaryNot: false,
      extras: [],
    };
    stateByRole.set(type, state);
    return state;
  }

  function ensureMeta(strategyId) {
    const reg = registry();
    if (!reg || typeof reg.getStrategyMetaById !== 'function') {
      return null;
    }
    try {
      return reg.getStrategyMetaById(strategyId) || null;
    } catch (error) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[StrategyForm] 無法取得策略 Meta：', strategyId, error);
      }
      return null;
    }
  }

  function getSchema(strategyId) {
    const meta = ensureMeta(strategyId);
    return meta && meta.paramsSchema && typeof meta.paramsSchema === 'object'
      ? meta.paramsSchema
      : null;
  }

  function getDefaultParamsFromSchema(schema) {
    const defaults = {};
    if (!schema || typeof schema !== 'object') {
      return defaults;
    }
    const properties = schema.properties && typeof schema.properties === 'object'
      ? schema.properties
      : {};
    Object.keys(properties).forEach((key) => {
      const descriptor = properties[key];
      if (descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'default')) {
        defaults[key] = descriptor.default;
      }
    });
    return defaults;
  }

  function ensureParamsForStrategy(roleType, strategyId) {
    const state = ensureRoleState(roleType);
    const cached = state.cachedParams.get(strategyId);
    if (cached) {
      return cloneParams(cached);
    }
    const schema = getSchema(strategyId);
    const defaults = getDefaultParamsFromSchema(schema);
    state.cachedParams.set(strategyId, cloneParams(defaults));
    return cloneParams(defaults);
  }

  function createNumberInput(descriptor, defaultValue) {
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'w-full px-3 py-2 border border-border rounded-md shadow-sm text-sm focus:ring-accent focus:border-accent bg-input text-foreground';
    if (Number.isFinite(descriptor.minimum)) {
      input.min = descriptor.minimum;
    }
    if (Number.isFinite(descriptor.maximum)) {
      input.max = descriptor.maximum;
    }
    if (Number.isFinite(descriptor.multipleOf)) {
      input.step = descriptor.multipleOf;
    } else if (descriptor.type === 'integer') {
      input.step = 1;
    } else {
      input.step = 0.1;
    }
    if (defaultValue !== undefined && defaultValue !== null && defaultValue !== '') {
      input.value = defaultValue;
    }
    return input;
  }

  function createCheckboxInput(defaultValue) {
    const wrapper = document.createElement('label');
    wrapper.className = 'inline-flex items-center gap-2 text-xs';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'h-4 w-4 rounded border-border focus:ring-accent';
    checkbox.checked = Boolean(defaultValue);
    wrapper.appendChild(checkbox);
    const span = document.createElement('span');
    span.textContent = '啟用';
    wrapper.appendChild(span);
    return { wrapper, checkbox };
  }

  function createTextInput(defaultValue) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'w-full px-3 py-2 border border-border rounded-md shadow-sm text-sm focus:ring-accent focus:border-accent bg-input text-foreground';
    if (defaultValue !== undefined && defaultValue !== null) {
      input.value = defaultValue;
    }
    return input;
  }

  function renderParams(roleConfig, strategyId, params, container, stateMap, prefix) {
    container.innerHTML = '';
    stateMap.clear();
    if (!strategyId) {
      const empty = document.createElement('p');
      empty.className = 'text-xs text-muted';
      empty.textContent = '請先選擇策略';
      container.appendChild(empty);
      return;
    }

    const schema = getSchema(strategyId);
    if (!schema || typeof schema !== 'object') {
      const info = document.createElement('p');
      info.className = 'text-xs text-muted';
      info.textContent = '此策略沒有額外參數設定。';
      container.appendChild(info);
      return;
    }

    const properties = schema.properties && typeof schema.properties === 'object'
      ? schema.properties
      : {};
    Object.keys(properties).forEach((paramName) => {
      const descriptor = properties[paramName] || {};
      const presentation = resolveParamPresentation(roleConfig.type, strategyId, paramName);
      const fieldWrapper = document.createElement('div');
      fieldWrapper.className = 'space-y-1';
      const label = document.createElement('label');
      label.className = 'block text-xs font-medium text-foreground';
      label.textContent = presentation.label;
      label.htmlFor = `${prefix}-${presentation.inputId}`;
      fieldWrapper.appendChild(label);

      const defaultValue = params && Object.prototype.hasOwnProperty.call(params, paramName)
        ? params[paramName]
        : descriptor.default;

      let inputElement = null;
      if (descriptor.type === 'integer' || descriptor.type === 'number') {
        inputElement = createNumberInput(descriptor, defaultValue);
      } else if (descriptor.type === 'boolean') {
        const { wrapper, checkbox } = createCheckboxInput(defaultValue);
        fieldWrapper.appendChild(wrapper);
        stateMap.set(paramName, checkbox);
        container.appendChild(fieldWrapper);
        return;
      } else {
        inputElement = createTextInput(defaultValue);
      }

      const elementId = prefix && prefix.endsWith('-primary')
        ? presentation.inputId
        : `${prefix}-${presentation.inputId}`;
      inputElement.id = elementId;
      fieldWrapper.appendChild(inputElement);
      stateMap.set(paramName, inputElement);
      container.appendChild(fieldWrapper);
    });
  }

  function collectParamsFromInputs(stateMap, descriptorMap) {
    const params = {};
    stateMap.forEach((input, key) => {
      const descriptor = descriptorMap[key] || {};
      if (input instanceof HTMLInputElement) {
        if (input.type === 'checkbox') {
          params[key] = input.checked;
        } else if (input.type === 'number') {
          const numeric = toNumber(input.value);
          if (!Number.isNaN(numeric)) {
            params[key] = descriptor.type === 'integer' ? Math.round(numeric) : numeric;
          }
        } else {
          params[key] = input.value;
        }
      }
    });
    return params;
  }

  const INPUT_LISTENER_DATASET_FLAG = 'lazybacktestParamBound';

  function attachParamInputHandlers(targetMap, handler) {
    if (typeof handler !== 'function') {
      return;
    }
    targetMap.forEach((input) => {
      if (!(input instanceof HTMLInputElement)) {
        return;
      }
      const dataset = input.dataset || {};
      const attributeKey = `data-${INPUT_LISTENER_DATASET_FLAG}`;
      if (dataset[INPUT_LISTENER_DATASET_FLAG] === 'true' || input.getAttribute(attributeKey) === 'true') {
        return;
      }
      const commit = () => handler();
      input.addEventListener('change', commit);
      input.addEventListener('input', commit);
      try {
        input.dataset[INPUT_LISTENER_DATASET_FLAG] = 'true';
      } catch (error) {
        input.setAttribute(attributeKey, 'true');
      }
    });
  }

  function bindRoleParamInputs(roleConfig, state) {
    if (!roleConfig || !state) {
      return;
    }
    attachParamInputHandlers(state.paramInputs, () => {
      updateStateFromInputs(roleConfig);
      dispatchChangeEvent(roleConfig.type);
      persistStateToStorage();
    });
  }

  function bindRuleParamInputs(roleConfig, rule) {
    if (!roleConfig || !rule) {
      return;
    }
    attachParamInputHandlers(rule.paramInputs, () => {
      updateRuleStateFromInputs(roleConfig.type, rule);
      dispatchChangeEvent(roleConfig.type);
      persistStateToStorage();
    });
  }

  function persistStateToStorage() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    const payload = {};
    stateByRole.forEach((state, roleType) => {
      payload[roleType] = {
        strategyId: state.strategyId,
        params: cloneParams(state.params),
        operator: state.operator,
        primaryNot: state.primaryNot,
        extras: state.extras.map((rule) => ({
          id: rule.id,
          strategyId: rule.strategyId,
          params: cloneParams(rule.params),
          not: rule.not === true,
        })),
      };
    });
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[StrategyForm] 無法寫入策略狀態：', error);
      }
    }
  }

  function restoreStateFromStorage() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    let restored = false;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return false;
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        return false;
      }
      ROLE_CONFIGS.forEach((config) => {
        const saved = parsed[config.type];
        if (!saved || typeof saved !== 'object') {
          return;
        }
        applyRoleState(config, saved);
        restored = true;
      });
      if (restored) {
        persistStateToStorage();
      }
      return restored;
    } catch (error) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[StrategyForm] 還原策略狀態失敗：', error);
      }
      return false;
    }
  }

  function updateStateFromInputs(roleConfig) {
    const state = ensureRoleState(roleConfig.type);
    if (!state.strategyId) {
      state.params = {};
      return;
    }
    const schema = getSchema(state.strategyId);
    const descriptorMap = schema && schema.properties && typeof schema.properties === 'object'
      ? schema.properties
      : {};
    state.params = collectParamsFromInputs(state.paramInputs, descriptorMap);
    state.cachedParams.set(state.strategyId, cloneParams(state.params));
  }

  function updateRuleStateFromInputs(roleType, rule) {
    const schema = getSchema(rule.strategyId);
    const descriptorMap = schema && schema.properties && typeof schema.properties === 'object'
      ? schema.properties
      : {};
    rule.params = collectParamsFromInputs(rule.paramInputs, descriptorMap);
    rule.cachedParams.set(rule.strategyId, cloneParams(rule.params));
  }

  function createRuleElement(roleConfig, state, initial) {
    const rule = {
      id: `rule-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      strategyId: initial?.strategyId || null,
      params: cloneParams(initial?.params),
      not: initial?.not === true,
      element: null,
      select: null,
      notCheckbox: null,
      paramsContainer: null,
      paramInputs: new Map(),
      cachedParams: new Map(),
    };

    if (rule.strategyId) {
      rule.cachedParams.set(rule.strategyId, cloneParams(rule.params));
    }

    const item = document.createElement('div');
    item.className = 'border border-border rounded-md p-3 space-y-3';

    const topRow = document.createElement('div');
    topRow.className = 'flex flex-wrap items-center gap-3 justify-between';

    const selectWrapper = document.createElement('div');
    selectWrapper.className = 'flex-1 min-w-[160px]';
    const select = document.createElement('select');
    select.className = 'w-full px-3 py-2 border border-border rounded-md bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm';
    populateStrategyOptions(roleConfig.type, select, rule.strategyId);
    selectWrapper.appendChild(select);
    topRow.appendChild(selectWrapper);

    const checkboxWrapper = document.createElement('label');
    checkboxWrapper.className = 'inline-flex items-center gap-2 text-xs text-foreground';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'h-4 w-4 rounded border-border focus:ring-accent';
    checkbox.checked = rule.not;
    const checkboxText = document.createElement('span');
    checkboxText.textContent = 'NOT 取反';
    checkboxWrapper.appendChild(checkbox);
    checkboxWrapper.appendChild(checkboxText);
    topRow.appendChild(checkboxWrapper);

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'text-xs px-2 py-1 border border-destructive text-destructive rounded-md hover:bg-destructive hover:text-white transition-colors';
    removeButton.textContent = '移除此規則';
    topRow.appendChild(removeButton);

    item.appendChild(topRow);

    const paramsContainer = document.createElement('div');
    paramsContainer.className = 'space-y-2';
    item.appendChild(paramsContainer);

    rule.element = item;
    rule.select = select;
    rule.notCheckbox = checkbox;
    rule.paramsContainer = paramsContainer;

    select.addEventListener('change', () => {
      const nextId = select.value;
      if (!nextId) {
        rule.strategyId = null;
        rule.params = {};
        rule.paramInputs.clear();
        paramsContainer.innerHTML = '<p class="text-xs text-muted">請先選擇策略</p>';
        persistStateToStorage();
        return;
      }
      if (rule.strategyId) {
        updateRuleStateFromInputs(roleConfig.type, rule);
      }
      rule.strategyId = nextId;
      const params = rule.cachedParams.get(nextId) || ensureParamsForStrategy(roleConfig.type, nextId);
      renderParams(roleConfig, nextId, params, paramsContainer, rule.paramInputs, `${rule.id}`);
      rule.params = collectParamsFromInputs(rule.paramInputs, getSchema(nextId)?.properties || {});
      rule.cachedParams.set(nextId, cloneParams(rule.params));
      bindRuleParamInputs(roleConfig, rule);
      dispatchChangeEvent(roleConfig.type);
      persistStateToStorage();
    });

    checkbox.addEventListener('change', () => {
      rule.not = checkbox.checked;
      dispatchChangeEvent(roleConfig.type);
      persistStateToStorage();
    });

    removeButton.addEventListener('click', () => {
      const index = state.extras.findIndex((itemRule) => itemRule.id === rule.id);
      if (index >= 0) {
        state.extras.splice(index, 1);
      }
      if (item.parentElement) {
        item.parentElement.removeChild(item);
      }
      dispatchChangeEvent(roleConfig.type);
      persistStateToStorage();
    });

    if (rule.strategyId) {
      const params = ensureParamsForStrategy(roleConfig.type, rule.strategyId);
      const merged = { ...params, ...rule.params };
      renderParams(roleConfig, rule.strategyId, merged, paramsContainer, rule.paramInputs, `${rule.id}`);
      bindRuleParamInputs(roleConfig, rule);
    } else {
      paramsContainer.innerHTML = '<p class="text-xs text-muted">請先選擇策略</p>';
    }

    state.extras.push(rule);
    return item;
  }

  function populateStrategyOptions(roleType, selectElement, selectedId) {
    selectElement.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '選擇策略';
    selectElement.appendChild(placeholder);

    const catalog = roleCatalog();
    const ids = Array.isArray(catalog[roleType]) ? catalog[roleType].slice() : [];
    ids.forEach((strategyId) => {
      const option = document.createElement('option');
      option.value = strategyId;
      const meta = ensureMeta(strategyId);
      option.textContent = meta && meta.label ? meta.label : strategyId;
      if (selectedId && selectedId === strategyId) {
        option.selected = true;
      }
      selectElement.appendChild(option);
    });
  }

  function dispatchChangeEvent(roleType) {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('lazybacktest:strategy-form-change', { detail: { role: roleType } }));
    }
  }

  function initRole(roleConfig) {
    const state = ensureRoleState(roleConfig.type);
    const selectElement = document.getElementById(roleConfig.selectId);
    if (!selectElement) {
      return;
    }
    populateStrategyOptions(roleConfig.type, selectElement, state.strategyId);

    const paramsContainer = document.getElementById(roleConfig.paramsContainerId);
    if (paramsContainer) {
      paramsContainer.innerHTML = '';
      const strategyId = selectElement.value || state.strategyId || '';
      if (strategyId) {
        state.strategyId = strategyId;
        const params = ensureParamsForStrategy(roleConfig.type, strategyId);
        const merged = { ...params, ...state.params };
        renderParams(roleConfig, strategyId, merged, paramsContainer, state.paramInputs, `${roleConfig.type}-primary`);
        state.params = collectParamsFromInputs(state.paramInputs, getSchema(strategyId)?.properties || {});
        state.cachedParams.set(strategyId, cloneParams(state.params));
        bindRoleParamInputs(roleConfig, state);
      } else {
        paramsContainer.innerHTML = '<p class="text-xs text-muted">請先選擇策略</p>';
      }
    }

    selectElement.addEventListener('change', () => {
      const nextStrategyId = selectElement.value;
      if (state.strategyId) {
        updateStateFromInputs(roleConfig);
      }
      state.strategyId = nextStrategyId || null;
      if (!nextStrategyId) {
        if (paramsContainer) {
          paramsContainer.innerHTML = '<p class="text-xs text-muted">請先選擇策略</p>';
        }
        state.params = {};
        dispatchChangeEvent(roleConfig.type);
        persistStateToStorage();
        return;
      }
      const params = ensureParamsForStrategy(roleConfig.type, nextStrategyId);
      const merged = { ...params, ...state.params };
      if (paramsContainer) {
        renderParams(roleConfig, nextStrategyId, merged, paramsContainer, state.paramInputs, `${roleConfig.type}-primary`);
      }
      state.params = collectParamsFromInputs(state.paramInputs, getSchema(nextStrategyId)?.properties || {});
      state.cachedParams.set(nextStrategyId, cloneParams(state.params));
      bindRoleParamInputs(roleConfig, state);
      dispatchChangeEvent(roleConfig.type);
      persistStateToStorage();
    });

    bindRoleParamInputs(roleConfig, state);

    const dslContainer = document.getElementById(roleConfig.dslContainerId);
    const operatorSelect = document.getElementById(roleConfig.operatorSelectId);
    const addButton = document.getElementById(roleConfig.addButtonId);
    const ruleList = document.getElementById(roleConfig.ruleListId);
    const primaryNotToggle = document.getElementById(roleConfig.primaryNotId);

    if (primaryNotToggle) {
      primaryNotToggle.checked = state.primaryNot === true;
      primaryNotToggle.addEventListener('change', () => {
        state.primaryNot = primaryNotToggle.checked;
        dispatchChangeEvent(roleConfig.type);
        persistStateToStorage();
      });
    }

    if (operatorSelect) {
      operatorSelect.value = state.operator || 'AND';
      operatorSelect.addEventListener('change', () => {
        state.operator = operatorSelect.value || 'AND';
        dispatchChangeEvent(roleConfig.type);
        persistStateToStorage();
      });
    }

    if (ruleList) {
      ruleList.innerHTML = '';
      if (Array.isArray(state.extras) && state.extras.length > 0) {
        const existingRules = state.extras.slice();
        state.extras.length = 0;
        existingRules.forEach((rule) => {
          const element = createRuleElement(roleConfig, state, rule);
          ruleList.appendChild(element);
        });
      }
    }

    if (addButton && ruleList) {
      addButton.addEventListener('click', () => {
        const element = createRuleElement(roleConfig, state, null);
        ruleList.appendChild(element);
        persistStateToStorage();
      });
    }

    if (dslContainer) {
      dslContainer.classList.remove('hidden');
    }
  }

  function applyRoleState(roleConfig, saved) {
    const selectElement = document.getElementById(roleConfig.selectId);
    const paramsContainer = document.getElementById(roleConfig.paramsContainerId);
    const state = ensureRoleState(roleConfig.type);

    state.strategyId = saved.strategyId || null;
    state.params = cloneParams(saved.params);
    state.operator = saved.operator || 'AND';
    state.primaryNot = saved.primaryNot === true;
    state.extras = [];

    if (selectElement) {
      populateStrategyOptions(roleConfig.type, selectElement, state.strategyId);
      if (state.strategyId) {
        selectElement.value = state.strategyId;
      }
    }

    if (paramsContainer) {
      paramsContainer.innerHTML = '';
      if (state.strategyId) {
        const params = ensureParamsForStrategy(roleConfig.type, state.strategyId);
        const merged = { ...params, ...state.params };
        renderParams(roleConfig, state.strategyId, merged, paramsContainer, state.paramInputs, `${roleConfig.type}-primary`);
        state.params = collectParamsFromInputs(state.paramInputs, getSchema(state.strategyId)?.properties || {});
        state.cachedParams.set(state.strategyId, cloneParams(state.params));
        bindRoleParamInputs(roleConfig, state);
      } else {
        paramsContainer.innerHTML = '<p class="text-xs text-muted">請先選擇策略</p>';
      }
    }

    const operatorSelect = document.getElementById(roleConfig.operatorSelectId);
    if (operatorSelect) {
      operatorSelect.value = state.operator;
    }

    const primaryNotToggle = document.getElementById(roleConfig.primaryNotId);
    if (primaryNotToggle) {
      primaryNotToggle.checked = state.primaryNot;
    }

    const ruleList = document.getElementById(roleConfig.ruleListId);
    if (ruleList) {
      ruleList.innerHTML = '';
      const extras = Array.isArray(saved.extras) ? saved.extras : [];
      extras.forEach((ruleSaved) => {
        const restoredRule = {
          strategyId: ruleSaved.strategyId || null,
          params: cloneParams(ruleSaved.params),
          not: ruleSaved.not === true,
        };
        const element = createRuleElement(roleConfig, state, restoredRule);
        ruleList.appendChild(element);
      });
    }
  }

  function normaliseNode(node) {
    if (!node || typeof node !== 'object') {
      return null;
    }
    const type = normaliseType(node.type || node.operator || node.op);
    if (type === 'NOT') {
      const child = node.node || (Array.isArray(node.nodes) ? node.nodes[0] : null);
      const parsedChild = normaliseNode(child);
      if (!parsedChild) {
        return null;
      }
      parsedChild.not = !parsedChild.not;
      return parsedChild;
    }
    if (type === 'PLUGIN') {
      const id = normaliseString(node.id);
      if (!id) {
        return null;
      }
      return {
        type: 'PLUGIN',
        operator: 'SINGLE',
        not: node.not === true,
        strategyId: id,
        params: cloneParams(node.params),
      };
    }
    if (type === 'AND' || type === 'OR') {
      const nodes = Array.isArray(node.nodes) ? node.nodes : [];
      const rules = [];
      nodes.forEach((child) => {
        const rawType = normaliseType(child && child.type);
        if (rawType === 'NOT') {
          const inner = child.node || (Array.isArray(child.nodes) ? child.nodes[0] : null);
          const parsedInner = normaliseNode(inner);
          if (parsedInner && parsedInner.type === 'PLUGIN') {
            parsedInner.not = !parsedInner.not;
            rules.push(parsedInner);
          }
        } else {
          const parsed = normaliseNode(child);
          if (parsed && parsed.type === 'PLUGIN') {
            rules.push(parsed);
          }
        }
      });
      return {
        type: 'COMPOSITE',
        operator: type,
        not: false,
        rules,
      };
    }
    return null;
  }

  function deriveRoleStateFromDsl(roleConfig, dslNode) {
    if (!dslNode) {
      return;
    }
    const normalized = normaliseNode(dslNode);
    if (!normalized) {
      return;
    }
    const state = ensureRoleState(roleConfig.type);
    if (normalized.type === 'PLUGIN') {
      state.strategyId = normalized.strategyId;
      state.primaryNot = normalized.not === true;
      state.params = cloneParams(normalized.params);
      state.extras = [];
      state.operator = 'AND';
      state.cachedParams.set(state.strategyId, cloneParams(state.params));
      return;
    }
    if (normalized.type === 'COMPOSITE') {
      const rules = normalized.rules || [];
      if (rules.length > 0) {
        const [first, ...rest] = rules;
        state.strategyId = first.strategyId;
        state.primaryNot = first.not === true;
        state.params = cloneParams(first.params);
        state.cachedParams.set(state.strategyId, cloneParams(state.params));
        state.operator = normalized.operator || 'AND';
        state.extras = rest.map((rule) => ({
          strategyId: rule.strategyId,
          params: cloneParams(rule.params),
          not: rule.not === true,
        }));
      }
    }
  }

  function buildNodeFromRule(rule, baseParams) {
    if (!rule || !rule.strategyId) {
      return null;
    }
    const node = {
      type: 'PLUGIN',
      id: rule.strategyId,
    };
    const params = cloneParams(rule.params);
    const combined = baseParams ? { ...baseParams, ...params } : params;
    if (combined && Object.keys(combined).length > 0) {
      node.params = combined;
    }
    return rule.not ? { type: 'NOT', node } : node;
  }

  function buildDslForRole(roleType) {
    const state = ensureRoleState(roleType);
    if (!state.strategyId) {
      return null;
    }
    const primaryRule = {
      strategyId: state.strategyId,
      params: cloneParams(state.params),
      not: state.primaryNot,
    };
    const extras = Array.isArray(state.extras) ? state.extras : [];
    if (extras.length === 0) {
      return buildNodeFromRule(primaryRule);
    }
    const nodes = [];
    const primaryNode = buildNodeFromRule(primaryRule);
    if (primaryNode) {
      nodes.push(primaryNode);
    }
    extras.forEach((rule) => {
      const node = buildNodeFromRule(rule);
      if (node) {
        nodes.push(node);
      }
    });
    if (nodes.length === 1) {
      return nodes[0];
    }
    return {
      type: state.operator || 'AND',
      nodes,
    };
  }

  function gatherRoleState() {
    const snapshot = {};
    stateByRole.forEach((state, roleType) => {
      snapshot[roleType] = {
        strategyId: state.strategyId,
        params: cloneParams(state.params),
        operator: state.operator,
        primaryNot: state.primaryNot,
        extras: state.extras.map((rule) => ({
          strategyId: rule.strategyId,
          params: cloneParams(rule.params),
          not: rule.not === true,
        })),
      };
    });
    return snapshot;
  }

  function applyRoleSnapshots(snapshots) {
    if (!snapshots || typeof snapshots !== 'object') {
      return;
    }
    ROLE_CONFIGS.forEach((config) => {
      if (snapshots[config.type]) {
        applyRoleState(config, snapshots[config.type]);
      }
    });
    persistStateToStorage();
  }

  function initialise() {
    if (initialized) {
      return;
    }
    initialized = true;
    ROLE_CONFIGS.forEach((config) => initRole(config));
    restoreStateFromStorage();
  }

  document.addEventListener('DOMContentLoaded', () => {
    initialise();
  });

  const api = {
    __version__: PATCH_VERSION,
    init: initialise,
    resolveParamPresentation,
    getStrategy(roleType) {
      return ensureRoleState(roleType).strategyId || null;
    },
    getParams(roleType) {
      const state = ensureRoleState(roleType);
      if (!state.strategyId) {
        return {};
      }
      updateStateFromInputs(ROLE_CONFIGS.find((config) => config.type === roleType));
      return cloneParams(state.params);
    },
    getDslNode(roleType) {
      return buildDslForRole(roleType);
    },
    exportState: gatherRoleState,
    importState: applyRoleSnapshots,
    persistState: persistStateToStorage,
    restoreState: restoreStateFromStorage,
    applySettings(settings) {
      if (!settings || typeof settings !== 'object') {
        return;
      }
      ROLE_CONFIGS.forEach((config) => {
        const strategyKey = `${config.type}Strategy`;
        const paramsKey = `${config.type === 'entry' ? 'entry' : config.type === 'exit' ? 'exit' : config.type}Params`;
        const base = {
          strategyId: settings[strategyKey] || null,
          params: cloneParams(settings[paramsKey]),
          operator: 'AND',
          primaryNot: false,
          extras: [],
        };
        const dsl = settings.strategyDsl;
        if (dsl && typeof dsl === 'object') {
          if (config.type === 'entry' && dsl.longEntry) {
            deriveRoleStateFromDsl(config, dsl.longEntry);
          } else if (config.type === 'exit' && dsl.longExit) {
            deriveRoleStateFromDsl(config, dsl.longExit);
          } else if (config.type === 'shortEntry' && dsl.shortEntry) {
            deriveRoleStateFromDsl(config, dsl.shortEntry);
          } else if (config.type === 'shortExit' && dsl.shortExit) {
            deriveRoleStateFromDsl(config, dsl.shortExit);
          } else {
            applyRoleState(config, base);
          }
        } else {
          applyRoleState(config, base);
        }
      });
      persistStateToStorage();
    },
  };

  Object.defineProperty(globalScope, 'lazybacktestStrategyForm', {
    value: api,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(typeof self !== 'undefined' ? self : this);
