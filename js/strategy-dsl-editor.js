// Strategy DSL Editor UI - LB-STRATEGY-DSL-EDITOR-20260922A
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    const globalScope = root || (typeof self !== 'undefined' ? self : this);
    if (globalScope) {
      Object.defineProperty(globalScope, 'lazybacktestStrategyDslEditor', {
        value: factory(),
        configurable: false,
        enumerable: true,
        writable: false,
      });
    }
  }
})(typeof self !== 'undefined' ? self : this, function strategyDslEditorFactory() {
  const VERSION = 'LB-STRATEGY-DSL-EDITOR-20260922A';
  const DEFAULT_ROLES = [
    { role: 'longEntry', label: '做多進場' },
    { role: 'longExit', label: '做多出場' },
    { role: 'shortEntry', label: '做空進場' },
    { role: 'shortExit', label: '回補出場' },
  ];

  function ensureStateFactory(stateFactory) {
    if (stateFactory && typeof stateFactory.createState === 'function') {
      return stateFactory;
    }
    if (typeof window !== 'undefined' && window.lazybacktestStrategyDslState) {
      return window.lazybacktestStrategyDslState;
    }
    throw new Error('StrategyDslEditor 需要 DSL state 工具');
  }

  function ensureFormFactory(formFactory) {
    if (formFactory && typeof formFactory.createController === 'function') {
      return formFactory;
    }
    if (typeof window !== 'undefined' && window.lazybacktestStrategyParamsForm) {
      return window.lazybacktestStrategyParamsForm;
    }
    throw new Error('StrategyDslEditor 需要參數表單工具');
  }

  function ensureSchemaUtils(schemaUtils) {
    if (schemaUtils && typeof schemaUtils.sanitizeParams === 'function') {
      return schemaUtils;
    }
    if (typeof window !== 'undefined' && window.lazybacktestStrategySchema) {
      return window.lazybacktestStrategySchema;
    }
    throw new Error('StrategyDslEditor 需要 schema 公用工具');
  }

  function defaultSchemaProvider(strategyId) {
    if (typeof window !== 'undefined' && window.StrategyPluginRegistry && typeof window.StrategyPluginRegistry.getStrategyMetaById === 'function') {
      const meta = window.StrategyPluginRegistry.getStrategyMetaById(strategyId);
      return meta && meta.paramsSchema ? meta.paramsSchema : null;
    }
    return null;
  }

  function createEditor(options) {
    const container = options?.container;
    if (!container || typeof container !== 'object') {
      throw new TypeError('StrategyDslEditor.init 需要 container 元素');
    }
    const roleConfigs = Array.isArray(options?.roleConfigs) && options.roleConfigs.length > 0
      ? options.roleConfigs
      : DEFAULT_ROLES;
    const strategyOptions = options?.strategyOptions || {};
    const schemaProvider = typeof options?.schemaProvider === 'function' ? options.schemaProvider : defaultSchemaProvider;
    const labelResolver = typeof options?.labelResolver === 'function' ? options.labelResolver : (() => null);
    const onStateChange = typeof options?.onStateChange === 'function' ? options.onStateChange : () => {};
    const formFactory = ensureFormFactory(options?.formFactory);
    const stateFactory = ensureStateFactory(options?.stateFactory);
    const schemaUtils = ensureSchemaUtils(options?.schemaUtils);
    const dslVersion = typeof options?.dslVersion === 'string' && options.dslVersion ? options.dslVersion : (stateFactory.version || VERSION);

    let state = stateFactory.createState(dslVersion);
    const roleElements = new Map();
    const formControllers = new Map();
    let dragState = null;

    function getRoleOptions(role) {
      if (Array.isArray(strategyOptions[role]) && strategyOptions[role].length > 0) {
        return strategyOptions[role];
      }
      return [];
    }

    function getDefaultStrategyForRole(role) {
      const optionsForRole = getRoleOptions(role);
      return optionsForRole.length > 0 ? optionsForRole[0].id : null;
    }

    function getSchema(strategyId) {
      if (!strategyId) return null;
      try {
        return schemaProvider(strategyId);
      } catch (error) {
        console.warn('[StrategyDslEditor] 取得 schema 失敗', error);
        return null;
      }
    }

    function getDefaultParams(strategyId) {
      const schema = getSchema(strategyId);
      if (!schema) return {};
      return schemaUtils.sanitizeParams(schema, {});
    }

    function updateState(nextState) {
      state = nextState;
      renderAll();
      onStateChange(state);
    }

    function buildStateFromPartial(partial) {
      if (!partial || typeof partial !== 'object') {
        return stateFactory.createState(dslVersion);
      }
      let working = stateFactory.createState(partial.version || dslVersion);
      if (partial.roles && typeof partial.roles === 'object') {
        Object.keys(partial.roles).forEach((role) => {
          try {
            const roleState = partial.roles[role];
            if (!roleState || !Array.isArray(roleState.rules)) {
              working = stateFactory.setOperator(working, role, roleState && roleState.operator);
              return;
            }
            let nextState = working;
            roleState.rules.forEach((rule) => {
              nextState = stateFactory.addRule(nextState, role, rule);
            });
            nextState = stateFactory.setOperator(nextState, role, roleState.operator);
            working = nextState;
          } catch (error) {
            console.warn('[StrategyDslEditor] 轉換角色狀態失敗', role, error);
          }
        });
      }
      return working;
    }

    function createRuleCard(role, rule, index) {
      const card = document.createElement('div');
      card.className = 'border border-border rounded-md p-3 space-y-3 bg-background';
      card.style.borderColor = 'var(--border)';
      card.style.backgroundColor = 'var(--input)';
      card.setAttribute('draggable', 'true');
      card.dataset.role = role;
      card.dataset.index = String(index);

      const header = document.createElement('div');
      header.className = 'flex items-center gap-2 justify-between';

      const leftControls = document.createElement('div');
      leftControls.className = 'flex items-center gap-2 flex-wrap';

      const dragHandle = document.createElement('span');
      dragHandle.className = 'cursor-move text-xs text-muted';
      dragHandle.style.color = 'var(--muted-foreground)';
      dragHandle.textContent = '⠿';
      leftControls.appendChild(dragHandle);

      const strategySelect = document.createElement('select');
      strategySelect.className = 'px-2 py-1 border border-border rounded text-xs bg-input text-foreground';
      strategySelect.style.borderColor = 'var(--border)';
      strategySelect.style.backgroundColor = 'var(--background)';
      strategySelect.style.color = 'var(--foreground)';
      const optionsForRole = getRoleOptions(role);
      optionsForRole.forEach((option) => {
        const opt = document.createElement('option');
        opt.value = option.id;
        opt.textContent = option.label || option.id;
        strategySelect.appendChild(opt);
      });
      if (rule.id) {
        strategySelect.value = rule.id;
      }
      leftControls.appendChild(strategySelect);

      const negateLabel = document.createElement('label');
      negateLabel.className = 'flex items-center gap-1 text-xs';
      negateLabel.style.color = 'var(--muted-foreground)';
      const negateInput = document.createElement('input');
      negateInput.type = 'checkbox';
      negateInput.checked = rule.negated === true;
      negateLabel.appendChild(negateInput);
      negateLabel.appendChild(document.createTextNode('NOT'));
      leftControls.appendChild(negateLabel);

      header.appendChild(leftControls);

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'text-xs px-2 py-1 border rounded text-destructive';
      deleteBtn.style.borderColor = 'var(--border)';
      deleteBtn.style.color = 'var(--destructive)';
      deleteBtn.textContent = '刪除';
      header.appendChild(deleteBtn);

      card.appendChild(header);

      const paramsContainer = document.createElement('div');
      paramsContainer.className = 'space-y-2 mt-2';
      card.appendChild(paramsContainer);

      function handleParamsChange(nextValues) {
        updateState(stateFactory.updateRule(state, role, index, { params: nextValues }));
      }

      const formController = formFactory.createController({
        container: paramsContainer,
        prefix: `dsl-${role}-${index}`,
        labelResolver(strategyId, paramName) {
          if (typeof labelResolver === 'function') {
            const resolved = labelResolver(strategyId, paramName, role);
            if (resolved) {
              return resolved;
            }
          }
          return { label: paramName, inputId: `${strategyId || 'strategy'}-${paramName}` };
        },
        schemaUtils,
        schemaProvider: (strategyId) => getSchema(strategyId),
        onChange: handleParamsChange,
      });
      formController.render(rule.id, rule.params);
      formControllers.set(`${role}:${index}`, formController);

      strategySelect.addEventListener('change', () => {
        const nextId = strategySelect.value || null;
        const nextParams = getDefaultParams(nextId);
        updateState(stateFactory.updateRule(state, role, index, { id: nextId, params: nextParams }));
      });

      negateInput.addEventListener('change', () => {
        updateState(stateFactory.toggleNegation(state, role, index));
      });

      deleteBtn.addEventListener('click', () => {
        updateState(stateFactory.removeRule(state, role, index));
      });

      card.addEventListener('dragstart', (event) => {
        dragState = { role, index };
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', `${role}:${index}`);
        card.classList.add('opacity-70');
      });

      card.addEventListener('dragend', () => {
        dragState = null;
        card.classList.remove('opacity-70');
      });

      card.addEventListener('dragover', (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        card.classList.add('ring-1');
        card.style.borderColor = 'var(--accent)';
      });

      card.addEventListener('dragleave', () => {
        card.classList.remove('ring-1');
        card.style.borderColor = 'var(--border)';
      });

      card.addEventListener('drop', (event) => {
        event.preventDefault();
        card.classList.remove('ring-1');
        card.style.borderColor = 'var(--border)';
        if (!dragState) return;
        if (dragState.role !== role) {
          console.warn('[StrategyDslEditor] 目前僅支援同角色拖曳');
          return;
        }
        const fromIndex = dragState.index;
        const toIndex = index;
        updateState(stateFactory.reorderRules(state, role, fromIndex, toIndex));
      });

      return card;
    }

    function renderRole(roleConfig) {
      let roleRoot = roleElements.get(roleConfig.role);
      if (!roleRoot) {
        roleRoot = document.createElement('div');
        roleRoot.className = 'space-y-3';
        roleElements.set(roleConfig.role, roleRoot);
        container.appendChild(roleRoot);
      }
      roleRoot.innerHTML = '';
      formControllers.forEach((controller, key) => {
        if (key.startsWith(`${roleConfig.role}:`)) {
          formControllers.delete(key);
        }
      });

      const header = document.createElement('div');
      header.className = 'flex items-center justify-between';

      const title = document.createElement('div');
      title.className = 'text-sm font-medium';
      title.style.color = 'var(--foreground)';
      title.textContent = roleConfig.label;
      header.appendChild(title);

      const controls = document.createElement('div');
      controls.className = 'flex items-center gap-2 flex-wrap';

      const operatorSelect = document.createElement('select');
      operatorSelect.className = 'px-2 py-1 border border-border rounded text-xs bg-input text-foreground';
      operatorSelect.style.borderColor = 'var(--border)';
      operatorSelect.style.backgroundColor = 'var(--background)';
      operatorSelect.style.color = 'var(--foreground)';
      operatorSelect.innerHTML = '<option value="AND">AND</option><option value="OR">OR</option>';
      operatorSelect.value = state.roles[roleConfig.role]?.operator === 'OR' ? 'OR' : 'AND';
      controls.appendChild(operatorSelect);

      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'text-xs px-2 py-1 border rounded text-primary';
      addBtn.style.borderColor = 'var(--border)';
      addBtn.style.color = 'var(--accent)';
      addBtn.textContent = '新增規則';
      controls.appendChild(addBtn);

      header.appendChild(controls);
      roleRoot.appendChild(header);

      const list = document.createElement('div');
      list.className = 'space-y-3';
      roleRoot.appendChild(list);

      const roleState = state.roles[roleConfig.role];
      if (roleState.rules.length === 0) {
        const placeholder = document.createElement('div');
        placeholder.className = 'text-xs text-muted border border-dashed rounded px-3 py-2';
        placeholder.style.borderColor = 'var(--border)';
        placeholder.style.color = 'var(--muted-foreground)';
        placeholder.textContent = '尚未新增規則，將沿用上方策略設定。';
        list.appendChild(placeholder);
      } else {
        roleState.rules.forEach((rule, index) => {
          const card = createRuleCard(roleConfig.role, rule, index);
          list.appendChild(card);
        });
      }

      operatorSelect.addEventListener('change', () => {
        updateState(stateFactory.setOperator(state, roleConfig.role, operatorSelect.value));
      });

      addBtn.addEventListener('click', () => {
        const defaultId = getDefaultStrategyForRole(roleConfig.role);
        const defaultParams = getDefaultParams(defaultId);
        updateState(stateFactory.addRule(state, roleConfig.role, { id: defaultId, params: defaultParams, negated: false }));
      });
    }

    function renderAll() {
      container.innerHTML = '';
      roleElements.clear();
      roleConfigs.forEach((config) => renderRole(config));
    }

    function importSelection(selection) {
      let nextState = stateFactory.createState(dslVersion);
      if (selection && typeof selection === 'object') {
        if (selection.entryStrategy) {
          nextState = stateFactory.addRule(nextState, 'longEntry', {
            id: selection.entryStrategy,
            params: selection.entryParams || {},
            negated: false,
          });
        }
        if (selection.exitStrategy) {
          nextState = stateFactory.addRule(nextState, 'longExit', {
            id: selection.exitStrategy,
            params: selection.exitParams || {},
            negated: false,
          });
        }
        if (selection.enableShorting) {
          if (selection.shortEntryStrategy) {
            nextState = stateFactory.addRule(nextState, 'shortEntry', {
              id: selection.shortEntryStrategy,
              params: selection.shortEntryParams || {},
              negated: false,
            });
          }
          if (selection.shortExitStrategy) {
            nextState = stateFactory.addRule(nextState, 'shortExit', {
              id: selection.shortExitStrategy,
              params: selection.shortExitParams || {},
              negated: false,
            });
          }
        }
      }
      updateState(nextState);
    }

    function getDsl() {
      const dsl = stateFactory.buildDsl(state);
      if (!dsl) {
        return null;
      }
      return { ...dsl, version: dsl.version || dslVersion };
    }

    renderAll();

    return Object.freeze({
      version: VERSION,
      getState: () => state,
      getDsl,
      importSelection,
      setState(nextState) {
        if (!nextState || typeof nextState !== 'object') {
          updateState(stateFactory.createState(dslVersion));
          return;
        }
        try {
          const hydrated = buildStateFromPartial(nextState);
          updateState(hydrated);
        } catch (error) {
          console.warn('[StrategyDslEditor] setState 失敗', error);
          updateState(stateFactory.createState(dslVersion));
        }
      },
      setDsl(dsl) {
        if (!stateFactory || typeof stateFactory.fromDsl !== 'function') {
          console.warn('[StrategyDslEditor] 無法載入 DSL：stateFactory 未支援 fromDsl');
          return;
        }
        if (!dsl || typeof dsl !== 'object') {
          updateState(stateFactory.createState(dslVersion));
          return;
        }
        try {
          const hydrated = stateFactory.fromDsl(dsl, dsl.version || dslVersion);
          updateState(hydrated);
        } catch (error) {
          console.warn('[StrategyDslEditor] 載入 DSL 失敗', error);
          updateState(stateFactory.createState(dslVersion));
        }
      },
      updateState,
    });
  }

  return Object.freeze({
    version: VERSION,
    init: createEditor,
  });
});
