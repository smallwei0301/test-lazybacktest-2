// Patch Tag: LB-STRATEGY-FORM-20260930A
(function initializeStrategyForm(root) {
  const globalScope = root || (typeof window !== 'undefined' ? window : globalThis);
  if (!globalScope) {
    return;
  }

  const EXISTING = globalScope.lazyStrategyForm;
  const MODULE_VERSION = 'LB-STRATEGY-FORM-20260930A';
  if (EXISTING && typeof EXISTING.__version__ === 'string' && EXISTING.__version__ >= MODULE_VERSION) {
    return;
  }

  const registry = globalScope.StrategyPluginRegistry;
  const strategyDescriptions = globalScope.strategyDescriptions || {};

  const ROLE_CONFIGS = [
    {
      type: 'entry',
      selectId: 'entryStrategy',
      containerId: 'entryStrategyControl',
      paramsId: 'entryParams',
      builderId: 'entryDslBuilder',
      dslKey: 'longEntry',
      label: '做多進場',
      settingsKey: 'entryStrategy',
      paramsKey: 'entryParams',
    },
    {
      type: 'exit',
      selectId: 'exitStrategy',
      containerId: 'exitStrategyControl',
      paramsId: 'exitParams',
      builderId: 'exitDslBuilder',
      dslKey: 'longExit',
      label: '做多出場',
      settingsKey: 'exitStrategy',
      paramsKey: 'exitParams',
    },
    {
      type: 'shortEntry',
      selectId: 'shortEntryStrategy',
      containerId: 'shortEntryStrategyControl',
      paramsId: 'shortEntryParams',
      builderId: 'shortEntryDslBuilder',
      dslKey: 'shortEntry',
      label: '做空進場',
      settingsKey: 'shortEntryStrategy',
      paramsKey: 'shortEntryParams',
    },
    {
      type: 'shortExit',
      selectId: 'shortExitStrategy',
      containerId: 'shortExitStrategyControl',
      paramsId: 'shortExitParams',
      builderId: 'shortExitDslBuilder',
      dslKey: 'shortExit',
      label: '回補出場',
      settingsKey: 'shortExitStrategy',
      paramsKey: 'shortExitParams',
    },
  ];

  function getLazyStrategyNormaliser() {
    const helper = globalScope.LazyStrategyId;
    if (helper && typeof helper.normalise === 'function') {
      return helper.normalise.bind(helper);
    }
    return function fallbackNormalise(role, strategyId) {
      if (!strategyId) {
        return strategyId;
      }
      if (role === 'exit' && !/_(?:exit)$/.test(strategyId)) {
        return `${strategyId}_exit`;
      }
      if (role === 'shortEntry' && !/^short_/.test(strategyId)) {
        return `short_${strategyId}`;
      }
      if (role === 'shortExit' && !/^cover_/.test(strategyId)) {
        return `cover_${strategyId}`;
      }
      return strategyId;
    };
  }

  const normaliseStrategyId = getLazyStrategyNormaliser();

  function uniqueArray(values) {
    const seen = new Set();
    const list = [];
    values.forEach((value) => {
      if (!value || seen.has(value)) {
        return;
      }
      seen.add(value);
      list.push(value);
    });
    return list;
  }

  function resolveAllowedStrategyIds(role) {
    try {
      if (role === 'entry' && typeof globalScope.longEntryToCoverMap === 'object' && globalScope.longEntryToCoverMap) {
        return uniqueArray(Object.keys(globalScope.longEntryToCoverMap));
      }
      if (role === 'exit' && typeof globalScope.longExitToShortMap === 'object' && globalScope.longExitToShortMap) {
        const keys = Object.keys(globalScope.longExitToShortMap).map((key) => normaliseStrategyId('exit', key));
        return uniqueArray(keys);
      }
      if (role === 'shortEntry' && typeof globalScope.longExitToShortMap === 'object' && globalScope.longExitToShortMap) {
        return uniqueArray(Object.values(globalScope.longExitToShortMap).filter(Boolean));
      }
      if (role === 'shortExit' && typeof globalScope.longEntryToCoverMap === 'object' && globalScope.longEntryToCoverMap) {
        return uniqueArray(Object.values(globalScope.longEntryToCoverMap).filter(Boolean));
      }
    } catch (error) {
      console.warn('[StrategyForm] 無法解析允許的策略 ID', role, error);
    }
    return [];
  }

  function buildMetaIndex() {
    const metaIndex = new Map();
    if (!registry || typeof registry.listStrategies !== 'function') {
      return metaIndex;
    }
    try {
      const metas = registry.listStrategies({ includeLazy: true }) || [];
      metas.forEach((meta) => {
        if (meta && typeof meta.id === 'string') {
          metaIndex.set(meta.id, meta);
        }
      });
    } catch (error) {
      console.warn('[StrategyForm] 無法列出策略 meta', error);
    }
    return metaIndex;
  }

  const metaIndex = buildMetaIndex();

  function resolveStrategyLabel(strategyId) {
    if (!strategyId) {
      return '未命名策略';
    }
    const descriptor = strategyDescriptions[strategyId];
    if (descriptor && typeof descriptor.name === 'string') {
      return descriptor.name;
    }
    const meta = metaIndex.get(strategyId);
    if (meta && typeof meta.label === 'string') {
      return meta.label;
    }
    return strategyId;
  }

  function resolveStrategySchema(strategyId) {
    const meta = metaIndex.get(strategyId);
    if (meta && meta.paramsSchema) {
      return meta.paramsSchema;
    }
    const descriptor = strategyDescriptions[strategyId];
    if (descriptor && descriptor.defaultParams) {
      const properties = {};
      Object.keys(descriptor.defaultParams).forEach((key) => {
        properties[key] = { type: 'number', default: descriptor.defaultParams[key] };
      });
      return { type: 'object', properties, additionalProperties: true };
    }
    return null;
  }

  function resolveDefaultParamValue(strategyId, paramName) {
    const meta = metaIndex.get(strategyId);
    if (meta && meta.paramsSchema && meta.paramsSchema.properties && meta.paramsSchema.properties[paramName]) {
      const descriptor = meta.paramsSchema.properties[paramName];
      if (descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'default')) {
        return descriptor.default;
      }
    }
    const fallback = strategyDescriptions[strategyId];
    if (fallback && fallback.defaultParams && Object.prototype.hasOwnProperty.call(fallback.defaultParams, paramName)) {
      return fallback.defaultParams[paramName];
    }
    return undefined;
  }

  function normaliseRoleStrategy(role, strategyId) {
    if (!strategyId) {
      return null;
    }
    return normaliseStrategyId(role, strategyId);
  }

  function sanitizeParamValue(value, descriptor) {
    if (!descriptor) {
      return value;
    }
    if (descriptor.type === 'integer' || descriptor.type === 'number') {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) {
        if (descriptor.type === 'integer') {
          return Math.round(numeric);
        }
        return numeric;
      }
      return undefined;
    }
    if (descriptor.type === 'boolean') {
      return Boolean(value);
    }
    return value;
  }

  function cloneParamsForDsl(value, path = 'params') {
    if (value === null) {
      return null;
    }
    if (value === undefined) {
      return undefined;
    }
    if (typeof value === 'function') {
      return undefined;
    }
    if (typeof value !== 'object') {
      return value;
    }
    if (Array.isArray(value)) {
      return value
        .map((item, index) => cloneParamsForDsl(item, `${path}[${index}]`))
        .filter((item) => item !== undefined);
    }
    const clone = {};
    Object.keys(value).forEach((key) => {
      const cloned = cloneParamsForDsl(value[key], `${path}.${key}`);
      if (cloned !== undefined) {
        clone[key] = cloned;
      }
    });
    return clone;
  }

  function resolveParamPresentation(role, strategyId, paramName) {
    let label = paramName;
    let idSuffix = paramName.charAt(0).toUpperCase() + paramName.slice(1);

    const baseStrategyId = strategyId || '';
    const normalised = baseStrategyId.replace(/^short_/, '').replace(/^cover_/, '').replace(/_exit$/, '');

    if (baseStrategyId === 'k_d_cross') {
      if (paramName === 'period') {
        label = 'KD週期';
      } else if (paramName === 'thresholdX') {
        label = 'D值上限(X)';
        idSuffix = 'KdThresholdX';
      }
    } else if (baseStrategyId === 'k_d_cross_exit') {
      if (paramName === 'period') {
        label = 'KD週期';
      } else if (paramName === 'thresholdY') {
        label = 'D值下限(Y)';
        idSuffix = 'KdThresholdY';
      }
    } else if (baseStrategyId === 'turtle_stop_loss' && paramName === 'stopLossPeriod') {
      label = '停損週期';
      idSuffix = 'StopLossPeriod';
    } else if ((baseStrategyId === 'macd_cross' || baseStrategyId === 'macd_cross_exit') && paramName === 'signalPeriod') {
      label = 'DEA週期(x)';
      idSuffix = 'SignalPeriod';
    } else if ((baseStrategyId === 'macd_cross' || baseStrategyId === 'macd_cross_exit') && paramName === 'shortPeriod') {
      label = 'DI短EMA(n)';
    } else if ((baseStrategyId === 'macd_cross' || baseStrategyId === 'macd_cross_exit') && paramName === 'longPeriod') {
      label = 'DI長EMA(m)';
    } else if (baseStrategyId === 'short_k_d_cross') {
      if (paramName === 'period') {
        label = 'KD週期';
      } else if (paramName === 'thresholdY') {
        label = 'D值下限(Y)';
        idSuffix = 'ShortKdThresholdY';
      }
    } else if (baseStrategyId === 'cover_k_d_cross') {
      if (paramName === 'period') {
        label = 'KD週期';
      } else if (paramName === 'thresholdX') {
        label = 'D值上限(X)';
        idSuffix = 'CoverKdThresholdX';
      }
    } else if (baseStrategyId === 'short_macd_cross') {
      if (paramName === 'shortPeriod') {
        label = 'DI短EMA(n)';
      } else if (paramName === 'longPeriod') {
        label = 'DI長EMA(m)';
      } else if (paramName === 'signalPeriod') {
        label = 'DEA週期(x)';
        idSuffix = 'ShortSignalPeriod';
      }
    } else if (baseStrategyId === 'cover_macd_cross') {
      if (paramName === 'shortPeriod') {
        label = 'DI短EMA(n)';
      } else if (paramName === 'longPeriod') {
        label = 'DI長EMA(m)';
      } else if (paramName === 'signalPeriod') {
        label = 'DEA週期(x)';
        idSuffix = 'CoverSignalPeriod';
      }
    } else if (baseStrategyId === 'short_turtle_stop_loss' && paramName === 'stopLossPeriod') {
      label = '觀察週期';
      idSuffix = 'ShortStopLossPeriod';
    } else if (baseStrategyId === 'cover_turtle_breakout' && paramName === 'breakoutPeriod') {
      label = '突破週期';
      idSuffix = 'CoverBreakoutPeriod';
    } else if (baseStrategyId === 'cover_trailing_stop' && paramName === 'percentage') {
      label = '百分比(%)';
      idSuffix = 'CoverTrailingStopPercentage';
    } else if (normalised === 'ma_cross' || normalised === 'ema_cross') {
      if (paramName === 'shortPeriod') {
        label = '短期SMA';
      } else if (paramName === 'longPeriod') {
        label = '長期SMA';
      }
    } else if (normalised === 'ma_above' || normalised === 'ma_below') {
      if (paramName === 'period') {
        label = 'SMA週期';
      }
    } else if (paramName === 'period') {
      label = '週期';
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
      inputId: `${role}${idSuffix}`,
    };
  }

  function createElement(tag, options = {}) {
    const el = globalScope.document.createElement(tag);
    if (options.className) {
      el.className = options.className;
    }
    if (options.textContent !== undefined) {
      el.textContent = options.textContent;
    }
    if (options.html !== undefined) {
      el.innerHTML = options.html;
    }
    if (options.attrs) {
      Object.keys(options.attrs).forEach((key) => {
        if (options.attrs[key] !== undefined) {
          el.setAttribute(key, options.attrs[key]);
        }
      });
    }
    return el;
  }

  function clearElement(el) {
    if (!el) {
      return;
    }
    while (el.firstChild) {
      el.removeChild(el.firstChild);
    }
  }

  function getStepForDescriptor(descriptor) {
    if (!descriptor) {
      return undefined;
    }
    if (descriptor.multipleOf && Number.isFinite(Number(descriptor.multipleOf))) {
      return Number(descriptor.multipleOf);
    }
    if (descriptor.type === 'integer') {
      return 1;
    }
    if (descriptor.type === 'number') {
      return 0.1;
    }
    return undefined;
  }

  function createParamInput(role, strategyId, paramName, descriptor, initialValue) {
    const { label, inputId } = resolveParamPresentation(role, strategyId, paramName);
    const wrapper = createElement('div', { className: 'space-y-1' });
    const labelEl = createElement('label', {
      className: 'block text-[11px] font-medium',
      textContent: label,
      attrs: { for: inputId, style: 'color: var(--foreground);' },
    });
    wrapper.appendChild(labelEl);

    let control;
    const type = descriptor?.type;
    if (descriptor && Array.isArray(descriptor.enum)) {
      control = createElement('select', {
        className: 'w-full px-3 py-2 border border-border rounded-md bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring',
        attrs: { id: inputId, style: 'border-color: var(--border); background-color: var(--input); color: var(--foreground);' },
      });
      descriptor.enum.forEach((optionValue) => {
        const optionEl = createElement('option', { textContent: String(optionValue), attrs: { value: optionValue } });
        control.appendChild(optionEl);
      });
    } else if (type === 'boolean') {
      control = createElement('input', {
        className: 'rounded border-border',
        attrs: {
          id: inputId,
          type: 'checkbox',
        },
      });
      control.checked = Boolean(initialValue);
    } else if (type === 'integer' || type === 'number') {
      control = createElement('input', {
        className: 'w-full px-3 py-2 border border-border rounded-md shadow-sm text-sm focus:ring-accent focus:border-accent bg-input text-foreground',
        attrs: {
          id: inputId,
          type: 'number',
          min: descriptor && descriptor.minimum !== undefined ? descriptor.minimum : undefined,
          max: descriptor && descriptor.maximum !== undefined ? descriptor.maximum : undefined,
          step: getStepForDescriptor(descriptor),
          style: 'border-color: var(--border); background-color: var(--input); color: var(--foreground);',
        },
      });
      const value = initialValue !== undefined ? initialValue : resolveDefaultParamValue(strategyId, paramName);
      if (value !== undefined && value !== null && value !== '') {
        control.value = value;
      } else {
        control.value = '';
      }
    } else {
      control = createElement('input', {
        className: 'w-full px-3 py-2 border border-border rounded-md shadow-sm text-sm focus:ring-accent focus:border-accent bg-input text-foreground',
        attrs: {
          id: inputId,
          type: 'text',
          style: 'border-color: var(--border); background-color: var(--input); color: var(--foreground);',
        },
      });
      if (initialValue !== undefined && initialValue !== null) {
        control.value = initialValue;
      } else {
        control.value = '';
      }
    }

    control.dataset.paramName = paramName;
    control.dataset.paramType = type || 'string';
    wrapper.appendChild(control);
    return wrapper;
  }

  function collectParams(container, strategyId) {
    if (!container) {
      return {};
    }
    const schema = resolveStrategySchema(strategyId);
    if (!schema || !schema.properties) {
      return {};
    }
    const params = {};
    Object.keys(schema.properties).forEach((paramName) => {
      const descriptor = schema.properties[paramName];
      const input = container.querySelector(`[data-param-name="${paramName}"]`);
      if (!input) {
        params[paramName] = resolveDefaultParamValue(strategyId, paramName);
        return;
      }
      if (input.type === 'checkbox') {
        params[paramName] = input.checked;
        return;
      }
      if (input.tagName === 'SELECT') {
        params[paramName] = input.value;
        return;
      }
      if (input.type === 'number') {
        params[paramName] = sanitizeParamValue(input.value, descriptor);
        if (params[paramName] === undefined) {
          params[paramName] = resolveDefaultParamValue(strategyId, paramName);
        }
        return;
      }
      params[paramName] = input.value;
    });
    return params;
  }

  function renderParams(container, role, strategyId, initialValues) {
    if (!container) {
      return;
    }
    clearElement(container);
    const schema = resolveStrategySchema(strategyId);
    if (!schema || !schema.properties || Object.keys(schema.properties).length === 0) {
      const emptyState = createElement('p', {
        className: 'text-[11px]',
        textContent: '此策略不需要額外參數。',
        attrs: { style: 'color: var(--muted-foreground);' },
      });
      container.appendChild(emptyState);
      return;
    }
    Object.keys(schema.properties).forEach((paramName) => {
      const descriptor = schema.properties[paramName];
      const initial = initialValues && Object.prototype.hasOwnProperty.call(initialValues, paramName)
        ? initialValues[paramName]
        : resolveDefaultParamValue(strategyId, paramName);
      const control = createParamInput(role, strategyId, paramName, descriptor, initial);
      container.appendChild(control);
    });
  }

  function createModeSelect(role) {
    return createElement('select', {
      className: 'w-full px-3 py-2 border border-border rounded-md bg-input text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring',
      attrs: {
        style: 'border-color: var(--border); background-color: var(--input); color: var(--foreground);',
        'data-role-mode': role,
      },
      html: [
        '<option value="single">單一條件</option>',
        '<option value="and">AND (全部成立)</option>',
        '<option value="or">OR (任一成立)</option>',
        '<option value="not">NOT (反向)</option>',
      ].join(''),
    });
  }

  function createRuleSelect(role, options) {
    const select = createElement('select', {
      className: 'w-full px-3 py-2 border border-border rounded-md bg-input text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring',
      attrs: {
        style: 'border-color: var(--border); background-color: var(--input); color: var(--foreground);',
      },
    });
    options.forEach((option) => {
      const optionEl = createElement('option', {
        textContent: option.label,
        attrs: { value: option.id },
      });
      select.appendChild(optionEl);
    });
    return select;
  }

  function buildOptionCatalog(role, allowedIds) {
    const options = [];
    allowedIds.forEach((id) => {
      const label = resolveStrategyLabel(id);
      options.push({ id, label });
    });
    options.sort((a, b) => a.label.localeCompare(b.label, 'zh-Hant'));
    return options;
  }

  const roleStates = new Map();

  function createDslRule(roleState, options, initial) {
    const role = roleState.config.type;
    const ruleId = `dsl-${role}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const ruleWrapper = createElement('div', {
      className: 'border border-border rounded-lg p-3 space-y-3',
      attrs: { 'data-dsl-rule': ruleId, style: 'border-color: var(--border); background-color: var(--card);' },
    });

    const headerRow = createElement('div', { className: 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3' });
    const selectWrapper = createElement('div', { className: 'flex-1 space-y-1' });
    const selectLabel = createElement('span', {
      className: 'text-[11px] font-medium',
      textContent: '策略',
      attrs: { style: 'color: var(--foreground);' },
    });
    selectWrapper.appendChild(selectLabel);
    const select = createRuleSelect(role, options);
    selectWrapper.appendChild(select);
    headerRow.appendChild(selectWrapper);

    const controlGroup = createElement('div', { className: 'flex items-center gap-3' });
    const notWrapper = createElement('label', { className: 'flex items-center gap-1 text-[11px]', attrs: { style: 'color: var(--muted-foreground);' } });
    const notCheckbox = createElement('input', { attrs: { type: 'checkbox', 'data-dsl-not': 'true' } });
    notWrapper.appendChild(notCheckbox);
    notWrapper.appendChild(createElement('span', { textContent: 'NOT' }));
    controlGroup.appendChild(notWrapper);
    const removeBtn = createElement('button', {
      className: 'px-2 py-1 border border-border rounded-md text-[11px] hover:bg-muted/30 transition-colors',
      textContent: '刪除',
      attrs: { type: 'button', style: 'border-color: var(--border); color: var(--muted-foreground);' },
    });
    controlGroup.appendChild(removeBtn);
    headerRow.appendChild(controlGroup);
    ruleWrapper.appendChild(headerRow);

    const paramsContainer = createElement('div', { className: 'space-y-2', attrs: { 'data-dsl-rule-params': ruleId } });
    ruleWrapper.appendChild(paramsContainer);

    const ruleState = {
      id: ruleId,
      elements: {
        wrapper: ruleWrapper,
        select,
        paramsContainer,
        notCheckbox,
        removeBtn,
      },
      getStrategyId() {
        return select.value || null;
      },
      getParams() {
        return collectParams(paramsContainer, select.value);
      },
      setStrategyId(value) {
        if (!value) {
          return;
        }
        const existingOption = Array.from(select.options).some((option) => option.value === value);
        if (!existingOption) {
          const optionLabel = resolveStrategyLabel(value);
          const optionEl = createElement('option', { textContent: optionLabel, attrs: { value } });
          select.appendChild(optionEl);
        }
        select.value = value;
        renderParams(paramsContainer, role, value, initial && initial.params);
      },
    };

    removeBtn.addEventListener('click', () => {
      roleState.builder.rules = roleState.builder.rules.filter((entry) => entry !== ruleState);
      ruleWrapper.remove();
      roleState.notifyChange();
    });

    select.addEventListener('change', () => {
      renderParams(paramsContainer, role, select.value, {});
      roleState.notifyChange();
    });

    notCheckbox.addEventListener('change', () => {
      roleState.notifyChange();
    });

    if (initial && initial.strategyId) {
      ruleState.setStrategyId(initial.strategyId);
    } else if (options.length > 0) {
      select.value = options[0].id;
      renderParams(paramsContainer, role, select.value, {});
    }

    if (initial && initial.not === true) {
      notCheckbox.checked = true;
    }

    roleState.builder.rules.push(ruleState);
    roleState.builder.rulesContainer.appendChild(ruleWrapper);
    roleState.notifyChange();
  }

  function setModeUiState(roleState, mode) {
    const { builder } = roleState;
    if (!builder) {
      return;
    }
    builder.mode = mode;
    const composite = mode === 'and' || mode === 'or' || mode === 'not';
    if (composite) {
      builder.rulesContainer.classList.remove('hidden');
    } else {
      builder.rulesContainer.classList.add('hidden');
    }
    if (mode === 'not') {
      builder.addButton.classList.add('hidden');
      builder.rules.forEach((rule, index) => {
        rule.elements.notCheckbox.disabled = true;
        if (index === 0) {
          return;
        }
        rule.elements.wrapper.remove();
      });
      if (builder.rules.length > 1) {
        builder.rules = builder.rules.slice(0, 1);
      }
    } else if (mode === 'single') {
      builder.addButton.classList.add('hidden');
    } else {
      builder.addButton.classList.remove('hidden');
      builder.rules.forEach((rule) => {
        rule.elements.notCheckbox.disabled = false;
      });
    }
    builder.modeSelect.value = mode;
  }

  function createBuilder(roleState, options) {
    const builderContainer = roleState.builder.container;
    clearElement(builderContainer);

    const description = createElement('p', {
      className: 'text-[11px] leading-relaxed',
      textContent: '可選擇多個指標並設定 AND / OR / NOT，動態組裝複合策略。若不需要複合條件，保持「單一條件」即可。',
      attrs: { style: 'color: var(--muted-foreground);' },
    });
    builderContainer.appendChild(description);

    const modeSelect = createModeSelect(roleState.config.type);
    const modeWrapper = createElement('div', { className: 'space-y-1' });
    const modeLabel = createElement('label', {
      className: 'text-[11px] font-medium',
      textContent: '組合模式',
      attrs: { style: 'color: var(--foreground);' },
    });
    modeWrapper.appendChild(modeLabel);
    modeWrapper.appendChild(modeSelect);
    builderContainer.appendChild(modeWrapper);

    const rulesContainer = createElement('div', {
      className: 'space-y-3 hidden',
      attrs: { 'data-dsl-rules': roleState.config.type },
    });
    builderContainer.appendChild(rulesContainer);

    const addButton = createElement('button', {
      className: 'px-3 py-2 text-xs border border-dashed border-border rounded-md text-foreground hover:bg-muted/20 transition-colors',
      textContent: '新增條件',
      attrs: { type: 'button', style: 'border-color: var(--border); color: var(--foreground);' },
    });
    builderContainer.appendChild(addButton);

    roleState.builder.modeSelect = modeSelect;
    roleState.builder.rulesContainer = rulesContainer;
    roleState.builder.addButton = addButton;
    roleState.builder.rules = [];

    modeSelect.addEventListener('change', (event) => {
      const selectedMode = event.target.value;
      setModeUiState(roleState, selectedMode);
      if (selectedMode !== 'single' && roleState.builder.rules.length === 0) {
        createDslRule(roleState, options, {
          strategyId: roleState.select.value,
          params: collectParams(roleState.paramsContainer, roleState.select.value),
        });
      }
      roleState.notifyChange();
    });

    addButton.addEventListener('click', () => {
      createDslRule(roleState, options, {
        strategyId: roleState.select.value,
        params: collectParams(roleState.paramsContainer, roleState.select.value),
      });
    });

    setModeUiState(roleState, 'single');
  }

  function buildPluginNode(role, strategyId, params) {
    const normalisedId = normaliseRoleStrategy(role, strategyId);
    if (!normalisedId) {
      return null;
    }
    const sanitizedParams = cloneParamsForDsl(params);
    const node = { type: 'plugin', id: normalisedId };
    if (sanitizedParams && Object.keys(sanitizedParams).length > 0) {
      node.params = sanitizedParams;
    }
    return node;
  }

  function buildDslNodeFromState(roleState) {
    const role = roleState.config.type;
    const baseStrategyId = roleState.select ? roleState.select.value : null;
    const baseParams = collectParams(roleState.paramsContainer, baseStrategyId);
    const mode = roleState.builder.mode || 'single';

    if (!baseStrategyId) {
      return null;
    }

    if (mode === 'single') {
      return buildPluginNode(role, baseStrategyId, baseParams);
    }

    if (mode === 'not') {
      const rule = roleState.builder.rules[0];
      const ruleStrategy = rule ? rule.getStrategyId() : baseStrategyId;
      const ruleParams = rule ? rule.getParams() : baseParams;
      const child = buildPluginNode(role, ruleStrategy, ruleParams);
      if (!child) {
        return null;
      }
      return { type: 'NOT', node: child };
    }

    const nodes = [];
    const rules = roleState.builder.rules.length > 0 ? roleState.builder.rules : [];
    if (rules.length === 0) {
      const fallback = buildPluginNode(role, baseStrategyId, baseParams);
      return fallback;
    }
    rules.forEach((rule) => {
      const strategyId = rule.getStrategyId();
      const params = rule.getParams();
      const pluginNode = buildPluginNode(role, strategyId, params);
      if (!pluginNode) {
        return;
      }
      if (rule.elements.notCheckbox.checked) {
        nodes.push({ type: 'NOT', node: pluginNode });
      } else {
        nodes.push(pluginNode);
      }
    });
    if (nodes.length === 0) {
      return null;
    }
    if (mode === 'and') {
      return { type: 'AND', nodes };
    }
    if (mode === 'or') {
      return { type: 'OR', nodes };
    }
    return null;
  }

  function ensureContainer(id) {
    const el = globalScope.document.getElementById(id);
    if (!el) {
      console.warn('[StrategyForm] 找不到容器', id);
    }
    return el;
  }

  function initRole(roleConfig) {
    const container = ensureContainer(roleConfig.containerId);
    const paramsContainer = ensureContainer(roleConfig.paramsId);
    const builderContainer = ensureContainer(roleConfig.builderId);
    if (!container || !paramsContainer || !builderContainer) {
      return;
    }

    const allowedIds = resolveAllowedStrategyIds(roleConfig.type);
    const optionCatalog = buildOptionCatalog(roleConfig.type, allowedIds);
    if (optionCatalog.length === 0) {
      const warning = createElement('p', {
        className: 'text-[11px]',
        textContent: '尚未載入可用策略，請稍後重試。',
        attrs: { style: 'color: var(--muted-foreground);' },
      });
      container.appendChild(warning);
      return;
    }

    clearElement(container);
    const select = createElement('select', {
      className: 'w-full px-3 py-2 border border-border rounded-md bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm',
      attrs: {
        id: roleConfig.selectId,
        style: 'border-color: var(--border); background-color: var(--input); color: var(--foreground);',
      },
    });
    optionCatalog.forEach((option) => {
      const optionEl = createElement('option', { textContent: option.label, attrs: { value: option.id } });
      select.appendChild(optionEl);
    });
    container.appendChild(select);

    const state = {
      config: roleConfig,
      select,
      paramsContainer,
      builder: {
        container: builderContainer,
        mode: 'single',
        rules: [],
        modeSelect: null,
        rulesContainer: null,
        addButton: null,
      },
      optionCatalog,
      notifyChange() {
        // Placeholder for future subscribers.
      },
    };
    roleStates.set(roleConfig.type, state);

    renderParams(paramsContainer, roleConfig.type, select.value, {});
    createBuilder(state, optionCatalog);

    select.addEventListener('change', () => {
      renderParams(paramsContainer, roleConfig.type, select.value, {});
      if (state.builder.mode === 'single') {
        state.notifyChange();
        return;
      }
      if (state.builder.rules.length === 0) {
        createDslRule(state, optionCatalog, {
          strategyId: select.value,
          params: collectParams(paramsContainer, select.value),
        });
      }
      state.notifyChange();
    });
  }

  function initialiseAllRoles() {
    ROLE_CONFIGS.forEach((roleConfig) => {
      try {
        initRole(roleConfig);
      } catch (error) {
        console.error('[StrategyForm] 初始化策略表單失敗', roleConfig.type, error);
      }
    });
  }

  function ensureOptionExists(state, strategyId) {
    if (!strategyId || !state || !state.select) {
      return;
    }
    const exists = Array.from(state.select.options).some((option) => option.value === strategyId);
    if (!exists) {
      const label = resolveStrategyLabel(strategyId);
      const optionEl = createElement('option', { textContent: label, attrs: { value: strategyId } });
      state.select.appendChild(optionEl);
    }
  }

  function resetBuilderState(state) {
    if (!state || !state.builder) {
      return;
    }
    state.builder.rules = [];
    if (state.builder.rulesContainer) {
      clearElement(state.builder.rulesContainer);
    }
    setModeUiState(state, 'single');
  }

  function applyDslNodeToState(state, node) {
    if (!state || !node || typeof node !== 'object') {
      resetBuilderState(state);
      return;
    }
    const role = state.config.type;
    const type = typeof node.type === 'string' ? node.type.toUpperCase() : null;
    if (type === 'PLUGIN') {
      const strategyId = node.id;
      ensureOptionExists(state, strategyId);
      state.select.value = strategyId;
      renderParams(state.paramsContainer, role, strategyId, node.params || {});
      resetBuilderState(state);
      return;
    }
    if (type === 'NOT') {
      setModeUiState(state, 'not');
      clearElement(state.builder.rulesContainer);
      state.builder.rules = [];
      const child = node.node || (Array.isArray(node.nodes) ? node.nodes[0] : null);
      if (child && child.type && child.type.toUpperCase() === 'PLUGIN') {
        ensureOptionExists(state, child.id);
        createDslRule(state, state.optionCatalog, {
          strategyId: child.id,
          params: child.params || {},
          not: false,
        });
        state.builder.rules.forEach((rule) => {
          renderParams(rule.elements.paramsContainer, role, rule.getStrategyId(), child.params || {});
        });
      } else {
        resetBuilderState(state);
      }
      return;
    }
    if (type === 'AND' || type === 'OR') {
      setModeUiState(state, type === 'AND' ? 'and' : 'or');
      clearElement(state.builder.rulesContainer);
      state.builder.rules = [];
      if (Array.isArray(node.nodes) && node.nodes.length > 0) {
        node.nodes.forEach((child) => {
          if (!child) {
            return;
          }
          if (child.type && child.type.toUpperCase() === 'NOT') {
            const pluginChild = child.node;
            if (pluginChild && pluginChild.type && pluginChild.type.toUpperCase() === 'PLUGIN') {
              ensureOptionExists(state, pluginChild.id);
              createDslRule(state, state.optionCatalog, {
                strategyId: pluginChild.id,
                params: pluginChild.params || {},
                not: true,
              });
            }
          } else if (child.type && child.type.toUpperCase() === 'PLUGIN') {
            ensureOptionExists(state, child.id);
            createDslRule(state, state.optionCatalog, {
              strategyId: child.id,
              params: child.params || {},
              not: false,
            });
          }
        });
        state.builder.rules.forEach((rule, index) => {
          const targetNode = node.nodes[index];
          if (!targetNode) {
            return;
          }
          const plugin = targetNode.type && targetNode.type.toUpperCase() === 'NOT'
            ? targetNode.node
            : targetNode;
          if (plugin && plugin.type && plugin.type.toUpperCase() === 'PLUGIN') {
            renderParams(rule.elements.paramsContainer, role, plugin.id, plugin.params || {});
          }
        });
      }
      return;
    }
    resetBuilderState(state);
  }

  function applySettings(settings) {
    if (!settings || typeof settings !== 'object') {
      return;
    }
    ROLE_CONFIGS.forEach((config) => {
      const state = roleStates.get(config.type);
      if (!state) {
        return;
      }
      const strategyId = settings[config.settingsKey];
      if (strategyId) {
        ensureOptionExists(state, strategyId);
        state.select.value = strategyId;
        renderParams(state.paramsContainer, config.type, strategyId, settings[config.paramsKey] || {});
      }
      const dsl = settings.strategyDsl && settings.strategyDsl[config.dslKey];
      if (dsl) {
        applyDslNodeToState(state, dsl);
      } else {
        resetBuilderState(state);
      }
    });
  }

  function getDslDefinition(options = {}) {
    const definition = {};
    ROLE_CONFIGS.forEach((config) => {
      const state = roleStates.get(config.type);
      if (!state) {
        return;
      }
      if ((config.type === 'shortEntry' || config.type === 'shortExit') && options.enableShorting === false) {
        return;
      }
      const node = buildDslNodeFromState(state);
      if (node) {
        definition[config.dslKey] = node;
      }
    });
    return definition;
  }

  function getPrimaryStrategy(role) {
    const state = roleStates.get(role);
    if (!state || !state.select) {
      return null;
    }
    return state.select.value || null;
  }

  function getParams(role) {
    const state = roleStates.get(role);
    if (!state || !state.select) {
      return {};
    }
    return collectParams(state.paramsContainer, state.select.value);
  }

  function onDomReady() {
    initialiseAllRoles();
  }

  if (globalScope.document && typeof globalScope.document.addEventListener === 'function') {
    globalScope.document.addEventListener('DOMContentLoaded', onDomReady, { once: true });
  } else {
    onDomReady();
  }

  const api = {
    __version__: MODULE_VERSION,
    getParams,
    getPrimaryStrategy,
    getDslDefinition,
    applySettings,
    resolveParamPresentation,
  };

  Object.defineProperty(globalScope, 'lazyStrategyForm', {
    value: api,
    writable: false,
    enumerable: true,
    configurable: false,
  });
})(typeof window !== 'undefined' ? window : this);
