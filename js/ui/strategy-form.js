// Patch Tag: LB-UI-STRATEGY-FORM-20250922A
(function (root) {
  const globalScope = root || (typeof self !== 'undefined' ? self : this);
  if (!globalScope) {
    return;
  }

  const MODULE_VERSION = 'LB-UI-STRATEGY-FORM-20250922A';
  if (
    globalScope.lazybacktestStrategyForm &&
    typeof globalScope.lazybacktestStrategyForm.__version__ === 'string' &&
    globalScope.lazybacktestStrategyForm.__version__ >= MODULE_VERSION
  ) {
    return;
  }

  const STRATEGY_DSL_VERSION =
    (globalScope.lazybacktestStrategyDsl && globalScope.lazybacktestStrategyDsl.version) ||
    'LB-STRATEGY-DSL-20260916A';

  const ROLE_CONFIGS = {
    longEntry: {
      type: 'entry',
      selectId: 'entryStrategy',
      paramsId: 'entryParams',
      label: '做多進場策略',
      icon: 'arrow-up-circle',
    },
    longExit: {
      type: 'exit',
      selectId: 'exitStrategy',
      paramsId: 'exitParams',
      label: '做多出場策略',
      icon: 'arrow-down-circle',
    },
    shortEntry: {
      type: 'shortEntry',
      selectId: 'shortEntryStrategy',
      paramsId: 'shortEntryParams',
      label: '做空進場策略',
      icon: 'trending-down',
    },
    shortExit: {
      type: 'shortExit',
      selectId: 'shortExitStrategy',
      paramsId: 'shortExitParams',
      label: '回補出場策略',
      icon: 'repeat-2',
    },
  };

  const TYPE_TO_ROLE = {
    entry: 'longEntry',
    exit: 'longExit',
    shortEntry: 'shortEntry',
    shortExit: 'shortExit',
  };

  const LONG_EXIT_EXTRA_IDS = new Set([
    'ma_below',
    'rsi_overbought',
    'bollinger_reversal',
    'k_d_cross_exit',
    'price_breakdown',
    'williams_overbought',
    'turtle_stop_loss',
    'trailing_stop',
    'fixed_stop_loss',
  ]);

  const DUAL_ROLE_IDS = new Set(['volume_spike']);

  let nodeIdCounter = 0;

  function createElement(tag, attrs, children) {
    const el = document.createElement(tag);
    if (attrs && typeof attrs === 'object') {
      Object.keys(attrs).forEach((key) => {
        const value = attrs[key];
        if (value === undefined || value === null) {
          return;
        }
        if (key === 'className') {
          el.className = value;
        } else if (key === 'dataset' && typeof value === 'object') {
          Object.keys(value).forEach((dataKey) => {
            el.dataset[dataKey] = value[dataKey];
          });
        } else if (key in el) {
          try {
            el[key] = value;
          } catch (assignError) {
            el.setAttribute(key, value);
          }
        } else {
          el.setAttribute(key, value);
        }
      });
    }
    if (children !== undefined && children !== null) {
      const append = (child) => {
        if (child === null || child === undefined) {
          return;
        }
        if (Array.isArray(child)) {
          child.forEach(append);
          return;
        }
        el.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
      };
      append(children);
    }
    return el;
  }

  function cloneParams(value) {
    if (value === null || typeof value !== 'object') {
      return value;
    }
    const clone = Array.isArray(value) ? [] : {};
    Object.keys(value).forEach((key) => {
      const item = value[key];
      if (item === undefined) {
        return;
      }
      if (typeof item === 'object' && item !== null) {
        clone[key] = cloneParams(item);
      } else {
        clone[key] = item;
      }
    });
    return clone;
  }

  function nextNodeId() {
    nodeIdCounter += 1;
    return `dsl-node-${nodeIdCounter}`;
  }

  function toNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : NaN;
  }

  function applyDescriptorBounds(value, descriptor) {
    if (!Number.isFinite(value)) {
      return value;
    }
    let output = value;
    if (descriptor.type === 'integer') {
      output = Math.round(output);
    }
    if (Number.isFinite(descriptor.minimum)) {
      output = Math.max(descriptor.minimum, output);
    }
    if (Number.isFinite(descriptor.maximum)) {
      output = Math.min(descriptor.maximum, output);
    }
    if (descriptor.multipleOf && Number.isFinite(descriptor.multipleOf) && descriptor.multipleOf > 0) {
      const multiplier = Math.max(1, Math.round(1 / descriptor.multipleOf));
      output = Math.round(output * multiplier) / multiplier;
    }
    return output;
  }

  function normaliseParamValue(descriptor, raw) {
    if (!descriptor || typeof descriptor !== 'object') {
      return raw;
    }
    if (descriptor.enum && Array.isArray(descriptor.enum)) {
      return descriptor.enum.includes(raw) ? raw : descriptor.enum[0];
    }
    if (descriptor.type === 'boolean') {
      if (typeof raw === 'string') {
        return raw === 'true' || raw === '1';
      }
      return Boolean(raw);
    }
    if (descriptor.type === 'integer' || descriptor.type === 'number') {
      const numeric = toNumber(raw);
      if (!Number.isFinite(numeric)) {
        return descriptor.default !== undefined ? descriptor.default : null;
      }
      return applyDescriptorBounds(numeric, descriptor);
    }
    if (descriptor.type === 'string') {
      return raw === undefined || raw === null ? '' : String(raw);
    }
    return raw;
  }

  function buildDefaultsFromSchema(schema) {
    if (!schema || typeof schema !== 'object') {
      return {};
    }
    const properties = schema.properties && typeof schema.properties === 'object' ? schema.properties : {};
    const defaults = {};
    Object.keys(properties).forEach((key) => {
      const descriptor = properties[key];
      if (descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'default')) {
        defaults[key] = descriptor.default;
      }
    });
    return defaults;
  }

  function sanitizeParamsAgainstSchema(schema, params) {
    const properties = schema && schema.properties && typeof schema.properties === 'object'
      ? schema.properties
      : {};
    const result = {};
    const source = params && typeof params === 'object' ? params : {};
    Object.keys(properties).forEach((key) => {
      const descriptor = properties[key];
      const value = normaliseParamValue(descriptor, source[key]);
      if (value !== undefined) {
        result[key] = value;
      }
    });
    Object.keys(source).forEach((key) => {
      if (!properties[key]) {
        result[key] = source[key];
      }
    });
    return result;
  }

  function ensureArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function inferRolesFromId(strategyId) {
    const roles = new Set();
    if (typeof strategyId !== 'string' || !strategyId) {
      return roles;
    }
    if (strategyId.startsWith('short_')) {
      roles.add('shortEntry');
    }
    if (strategyId.startsWith('cover_')) {
      roles.add('shortExit');
    }
    if (strategyId.endsWith('_exit') || LONG_EXIT_EXTRA_IDS.has(strategyId)) {
      roles.add('longExit');
    }
    if (DUAL_ROLE_IDS.has(strategyId)) {
      roles.add('longEntry');
      roles.add('longExit');
    }
    if (roles.size === 0) {
      roles.add('longEntry');
    }
    return roles;
  }

  function createPluginNode(strategyId, params) {
    return {
      id: nextNodeId(),
      type: 'PLUGIN',
      strategyId,
      params: cloneParams(params || {}),
    };
  }

  function createGroupNode(operator, children) {
    const upper = typeof operator === 'string' ? operator.toUpperCase() : 'AND';
    return {
      id: nextNodeId(),
      type: upper === 'OR' ? 'OR' : 'AND',
      nodes: ensureArray(children).map((child) => child || null).filter(Boolean),
    };
  }

  function createNotNode(child) {
    return {
      id: nextNodeId(),
      type: 'NOT',
      node: child || null,
    };
  }

  function ensureLucideIcons() {
    if (typeof globalScope.lucide !== 'undefined' && globalScope.lucide && typeof globalScope.lucide.createIcons === 'function') {
      try {
        globalScope.lucide.createIcons();
      } catch (error) {
        // ignore lucide errors
      }
    }
  }

  class StrategyFormManager {
    constructor(registry) {
      this.registry = registry;
      this.metaMap = new Map();
      this.roleOptions = {
        longEntry: [],
        longExit: [],
        shortEntry: [],
        shortExit: [],
      };
      this.roleStates = new Map();
      this.changeListeners = new Set();
      this.initialised = false;
    }

    init() {
      if (this.initialised) {
        return;
      }
      this.initialised = true;
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          this.setup();
        });
      } else {
        this.setup();
      }
    }

    setup() {
      this.collectMetas();
      this.buildForms();
      ensureLucideIcons();
    }

    collectMetas() {
      this.metaMap.clear();
      this.roleOptions.longEntry = [];
      this.roleOptions.longExit = [];
      this.roleOptions.shortEntry = [];
      this.roleOptions.shortExit = [];

      const listFn = this.registry && typeof this.registry.list === 'function'
        ? this.registry.list.bind(this.registry)
        : null;
      const metas = listFn ? listFn({ includeLazy: true }) : [];
      ensureArray(metas).forEach((meta) => {
        if (!meta || typeof meta !== 'object' || typeof meta.id !== 'string') {
          return;
        }
        this.metaMap.set(meta.id, meta);
        const roles = inferRolesFromId(meta.id);
        roles.forEach((roleKey) => {
          if (this.roleOptions[roleKey]) {
            this.roleOptions[roleKey].push(meta);
          }
        });
      });
      Object.keys(this.roleOptions).forEach((roleKey) => {
        this.roleOptions[roleKey].sort((a, b) => {
          const labelA = (a && a.label) || a.id || '';
          const labelB = (b && b.label) || b.id || '';
          return labelA.localeCompare(labelB, 'zh-Hant');
        });
      });
    }

    buildForms() {
      const containers = document.querySelectorAll('.strategy-form-slot');
      containers.forEach((container) => {
        const roleKey = container.dataset.role && ROLE_CONFIGS[container.dataset.role]
          ? container.dataset.role
          : null;
        if (!roleKey) {
          return;
        }
        const roleConfig = ROLE_CONFIGS[roleKey];
        const options = this.roleOptions[roleKey] || [];
        const state = {
          roleKey,
          roleType: roleConfig.type,
          container,
          options,
          selectEl: null,
          paramsContainer: null,
          paramsSchema: null,
          paramsState: {},
          dslRoot: null,
          dslContainer: null,
          hiddenInput: null,
        };
        this.renderRoleContainer(state, roleConfig);
        this.roleStates.set(roleKey, state);
        this.roleStates.set(roleConfig.type, state);
      });
    }

    renderRoleContainer(state, config) {
      const { container, roleKey } = state;
      container.innerHTML = '';
      container.classList.add('space-y-3');

      const header = createElement('div', { className: 'flex items-center justify-between' }, [
        createElement('div', { className: 'flex items-center gap-2 text-xs font-medium strategy-form-header' }, [
          createElement('i', {
            'data-lucide': config.icon || container.dataset.icon || 'target',
            className: 'lucide-sm text-primary',
          }),
          createElement('span', null, container.dataset.label || config.label || ''),
        ]),
        createElement('div', { className: 'text-[11px] text-muted-foreground strategy-form-hint' }, '同步組裝 DSL'),
      ]);

      const primaryField = createElement('div', { className: 'space-y-1' }, [
        createElement('label', {
          for: config.selectId,
          className: 'block text-xs font-medium',
        }, '主策略'),
      ]);

      const selectEl = createElement('select', {
        id: config.selectId,
        className:
          'w-full px-3 py-2 border border-border rounded-md bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm',
      });
      ensureArray(state.options).forEach((meta) => {
        const option = createElement('option', { value: meta.id }, meta.label || meta.id);
        selectEl.appendChild(option);
      });
      primaryField.appendChild(selectEl);

      const paramsContainer = createElement('div', {
        id: config.paramsId,
        className: 'space-y-2',
      });

      const dslCard = createElement('div', {
        className:
          'strategy-dsl-card border border-border rounded-lg bg-card/60 text-xs',
      }, [
        createElement('div', { className: 'strategy-dsl-card__header flex items-center justify-between px-3 py-2 border-b border-border text-[11px] font-medium uppercase tracking-wide' }, [
          createElement('span', null, '策略 DSL 組合'),
          createElement('div', { className: 'space-x-2 flex items-center' }, [
            createElement('button', {
              type: 'button',
              className: 'strategy-dsl-btn text-[11px]',
              'data-action': 'add-plugin',
            }, '新增規則'),
            createElement('button', {
              type: 'button',
              className: 'strategy-dsl-btn text-[11px]',
              'data-action': 'add-group',
            }, '新增群組'),
            createElement('button', {
              type: 'button',
              className: 'strategy-dsl-btn text-[11px]',
              'data-action': 'reset',
            }, '重設'),
          ]),
        ]),
        createElement('div', { className: 'strategy-dsl-card__body px-3 py-2 space-y-2' }),
      ]);

      const hiddenInput = createElement('input', {
        type: 'hidden',
        id: `${config.selectId}DslJson`,
      });

      container.appendChild(header);
      container.appendChild(primaryField);
      container.appendChild(paramsContainer);
      container.appendChild(dslCard);
      container.appendChild(hiddenInput);

      state.selectEl = selectEl;
      state.paramsContainer = paramsContainer;
      state.dslContainer = dslCard.querySelector('.strategy-dsl-card__body');
      state.hiddenInput = hiddenInput;

      selectEl.addEventListener('change', () => {
        this.handlePrimaryStrategyChange(state);
      });

      dslCard.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }
        const action = target.dataset.action;
        if (action === 'add-plugin') {
          this.addPluginNodeToDsl(state);
        } else if (action === 'add-group') {
          this.addGroupNodeToDsl(state);
        } else if (action === 'reset') {
          this.resetDslToPrimary(state);
        }
      });

      this.handlePrimaryStrategyChange(state, { suppressDslReset: false });
    }

    handlePrimaryStrategyChange(state, options) {
      const { selectEl } = state;
      if (!selectEl) {
        return;
      }
      const strategyId = selectEl.value || (state.options[0] && state.options[0].id) || '';
      const meta = this.metaMap.get(strategyId) || null;
      state.paramsSchema = meta && meta.paramsSchema ? meta.paramsSchema : null;
      const defaults = buildDefaultsFromSchema(state.paramsSchema);
      state.paramsState = sanitizeParamsAgainstSchema(state.paramsSchema, defaults);
      this.renderParamsForm(state);
      if (!options || options.suppressDslReset !== true) {
        this.resetDslToPrimary(state);
      } else {
        this.updateHiddenDsl(state);
      }
      this.notifyChange();
    }

    renderParamsForm(state) {
      const { paramsContainer, paramsSchema, paramsState } = state;
      if (!paramsContainer) {
        return;
      }
      paramsContainer.innerHTML = '';
      if (!paramsSchema || !paramsSchema.properties || typeof paramsSchema.properties !== 'object') {
        return;
      }
      const properties = paramsSchema.properties;
      Object.keys(properties).forEach((key) => {
        const descriptor = properties[key];
        const fieldId = `${state.roleKey}-${key}`;
        const fieldWrapper = createElement('div', { className: 'strategy-param-field space-y-1' });
        fieldWrapper.appendChild(createElement('label', {
          for: fieldId,
          className: 'block text-[11px] font-medium text-muted-foreground uppercase tracking-wide',
        }, key));
        let inputEl;
        if (descriptor && descriptor.enum && Array.isArray(descriptor.enum)) {
          inputEl = createElement('select', {
            id: fieldId,
            className: 'w-full px-2 py-1 border border-border rounded-md bg-input text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring',
          });
          descriptor.enum.forEach((option) => {
            inputEl.appendChild(createElement('option', { value: option }, option));
          });
          inputEl.value = paramsState[key];
        } else if (descriptor && (descriptor.type === 'integer' || descriptor.type === 'number')) {
          inputEl = createElement('input', {
            id: fieldId,
            type: 'number',
            step: descriptor.type === 'integer' ? 1 : 'any',
            className: 'w-full px-2 py-1 border border-border rounded-md bg-input text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring',
          });
          if (descriptor.minimum !== undefined) {
            inputEl.min = descriptor.minimum;
          }
          if (descriptor.maximum !== undefined) {
            inputEl.max = descriptor.maximum;
          }
          inputEl.value = paramsState[key] !== undefined ? paramsState[key] : '';
        } else if (descriptor && descriptor.type === 'boolean') {
          inputEl = createElement('input', {
            id: fieldId,
            type: 'checkbox',
            className: 'h-3 w-3 text-primary border-border rounded',
            checked: Boolean(paramsState[key]),
          });
        } else {
          inputEl = createElement('input', {
            id: fieldId,
            type: 'text',
            className: 'w-full px-2 py-1 border border-border rounded-md bg-input text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring',
            value: paramsState[key] !== undefined ? paramsState[key] : '',
          });
        }
        inputEl.addEventListener('change', () => {
          this.handlePrimaryParamChange(state, key, descriptor, inputEl);
        });
        inputEl.addEventListener('input', () => {
          this.handlePrimaryParamChange(state, key, descriptor, inputEl);
        });
        fieldWrapper.appendChild(inputEl);
        paramsContainer.appendChild(fieldWrapper);
      });
    }

    handlePrimaryParamChange(state, key, descriptor, inputEl) {
      let value;
      if (descriptor && descriptor.type === 'boolean') {
        value = Boolean(inputEl.checked);
      } else if (inputEl.type === 'number') {
        value = inputEl.value === '' ? null : toNumber(inputEl.value);
      } else {
        value = inputEl.value;
      }
      const normalized = normaliseParamValue(descriptor, value);
      state.paramsState[key] = normalized;
      this.syncPluginNodesForPrimary(state, key, normalized);
      this.updateHiddenDsl(state);
      this.notifyChange();
    }

    syncPluginNodesForPrimary(state, key, value) {
      if (!state.dslRoot) {
        return;
      }
      const propagate = (node) => {
        if (!node || typeof node !== 'object') {
          return;
        }
        if (node.type === 'PLUGIN' && node.strategyId === state.selectEl.value) {
          if (!node.params || typeof node.params !== 'object') {
            node.params = {};
          }
          node.params[key] = value;
        }
        if (node.type === 'AND' || node.type === 'OR') {
          node.nodes.forEach((child) => propagate(child));
        } else if (node.type === 'NOT' && node.node) {
          propagate(node.node);
        }
      };
      propagate(state.dslRoot);
    }

    resetDslToPrimary(state) {
      const strategyId = state.selectEl && state.selectEl.value ? state.selectEl.value : (state.options[0] && state.options[0].id);
      state.dslRoot = createPluginNode(strategyId, state.paramsState);
      this.renderDsl(state);
      this.updateHiddenDsl(state);
      this.notifyChange();
    }

    addPluginNodeToDsl(state) {
      if (!state.dslRoot || state.dslRoot.type === 'PLUGIN') {
        const original = state.dslRoot && state.dslRoot.type === 'PLUGIN' ? state.dslRoot : null;
        const group = createGroupNode('AND', []);
        if (original) {
          group.nodes.push(original);
        } else {
          group.nodes.push(createPluginNode(state.selectEl.value, state.paramsState));
        }
        group.nodes.push(createPluginNode(state.selectEl.value, state.paramsState));
        state.dslRoot = group;
      } else if (state.dslRoot.type === 'AND' || state.dslRoot.type === 'OR') {
        state.dslRoot.nodes.push(createPluginNode(state.selectEl.value, state.paramsState));
      } else if (state.dslRoot.type === 'NOT') {
        if (!state.dslRoot.node) {
          state.dslRoot.node = createPluginNode(state.selectEl.value, state.paramsState);
        } else {
          const group = createGroupNode('AND', [state.dslRoot.node, createPluginNode(state.selectEl.value, state.paramsState)]);
          state.dslRoot.node = group;
        }
      }
      this.renderDsl(state);
      this.updateHiddenDsl(state);
      this.notifyChange();
    }

    addGroupNodeToDsl(state) {
      if (!state.dslRoot) {
        state.dslRoot = createGroupNode('AND', [createPluginNode(state.selectEl.value, state.paramsState)]);
      } else if (state.dslRoot.type === 'PLUGIN') {
        const group = createGroupNode('AND', [state.dslRoot, createPluginNode(state.selectEl.value, state.paramsState)]);
        state.dslRoot = group;
      } else if (state.dslRoot.type === 'AND' || state.dslRoot.type === 'OR') {
        state.dslRoot.nodes.push(createGroupNode('AND', [createPluginNode(state.selectEl.value, state.paramsState)]));
      } else if (state.dslRoot.type === 'NOT') {
        if (!state.dslRoot.node) {
          state.dslRoot.node = createGroupNode('AND', [createPluginNode(state.selectEl.value, state.paramsState)]);
        } else if (state.dslRoot.node.type === 'PLUGIN') {
          state.dslRoot.node = createGroupNode('AND', [state.dslRoot.node, createPluginNode(state.selectEl.value, state.paramsState)]);
        } else if (state.dslRoot.node.type === 'AND' || state.dslRoot.node.type === 'OR') {
          state.dslRoot.node.nodes.push(createGroupNode('AND', [createPluginNode(state.selectEl.value, state.paramsState)]));
        }
      }
      this.renderDsl(state);
      this.updateHiddenDsl(state);
      this.notifyChange();
    }

    renderDsl(state) {
      if (!state.dslContainer) {
        return;
      }
      state.dslContainer.innerHTML = '';
      const root = state.dslRoot || createPluginNode(state.selectEl.value, state.paramsState);
      state.dslRoot = root;
      const rendered = this.renderDslNode(state, root, null, true);
      state.dslContainer.appendChild(rendered);
    }

    renderDslNode(state, node, parent, isRoot) {
      if (!node) {
        return createElement('div', { className: 'text-[11px] text-muted-foreground' }, '尚未設定節點');
      }
      const wrapper = createElement('div', { className: 'strategy-dsl-node border border-border rounded-md p-2 space-y-2' });

      const typeOptions = [
        { value: 'PLUGIN', label: '插件' },
        { value: 'AND', label: 'AND' },
        { value: 'OR', label: 'OR' },
        { value: 'NOT', label: 'NOT' },
      ];

      const typeControl = createElement('div', { className: 'flex items-center justify-between gap-2' }, [
        createElement('div', { className: 'flex items-center gap-2' }, [
          createElement('span', { className: 'text-[11px] font-medium text-muted-foreground uppercase tracking-wide' }, isRoot ? '根節點' : '節點'),
          createElement('select', {
            className: 'text-[11px] px-2 py-1 border border-border rounded-md bg-input text-foreground focus:outline-none focus:ring-1 focus:ring-ring',
            value: node.type,
          }, typeOptions.map((option) => createElement('option', {
            value: option.value,
          }, option.label))),
        ]),
        !isRoot
          ? createElement('button', {
            type: 'button',
            className: 'strategy-dsl-btn text-[11px]',
            'data-node-action': 'remove',
            'data-node-id': node.id,
          }, '刪除')
          : null,
      ]);

      typeControl.querySelector('select').addEventListener('change', (event) => {
        const target = event.target;
        const selectedType = target.value;
        this.changeNodeType(state, node, selectedType, parent);
      });

      wrapper.appendChild(typeControl);

      if (node.type === 'PLUGIN') {
        wrapper.appendChild(this.renderPluginNodeContent(state, node));
      } else if (node.type === 'AND' || node.type === 'OR') {
        wrapper.appendChild(this.renderGroupNodeContent(state, node));
      } else if (node.type === 'NOT') {
        wrapper.appendChild(this.renderNotNodeContent(state, node));
      }

      wrapper.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }
        const action = target.dataset.nodeAction;
        if (action === 'remove' && parent) {
          this.removeChildNode(state, parent, node);
        } else if (action === 'add-child') {
          this.addChildNode(state, node, target.dataset.childType);
        }
      });

      return wrapper;
    }

    renderPluginNodeContent(state, node) {
      const meta = this.metaMap.get(node.strategyId) || null;
      const select = createElement('select', {
        className: 'w-full px-2 py-1 border border-border rounded-md bg-input text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring',
        value: node.strategyId,
      });
      ensureArray(state.options).forEach((optionMeta) => {
        select.appendChild(createElement('option', { value: optionMeta.id }, optionMeta.label || optionMeta.id));
      });
      select.addEventListener('change', () => {
        node.strategyId = select.value;
        const nextMeta = this.metaMap.get(node.strategyId) || null;
        const schema = nextMeta && nextMeta.paramsSchema ? nextMeta.paramsSchema : null;
        node.params = sanitizeParamsAgainstSchema(schema, node.params);
        this.renderDsl(state);
        this.updateHiddenDsl(state);
        this.notifyChange();
      });

      const paramSchema = meta && meta.paramsSchema ? meta.paramsSchema : null;
      const params = sanitizeParamsAgainstSchema(paramSchema, node.params || {});
      node.params = params;
      const paramsWrapper = createElement('div', { className: 'space-y-1' });
      if (paramSchema && paramSchema.properties && typeof paramSchema.properties === 'object') {
        Object.keys(paramSchema.properties).forEach((key) => {
          const descriptor = paramSchema.properties[key];
          const inputId = `${node.id}-${key}`;
          const field = createElement('div', { className: 'space-y-1' }, [
            createElement('label', {
              for: inputId,
              className: 'block text-[11px] text-muted-foreground',
            }, key),
          ]);
          let inputEl;
          if (descriptor && descriptor.enum && Array.isArray(descriptor.enum)) {
            inputEl = createElement('select', {
              id: inputId,
              className: 'w-full px-2 py-1 border border-border rounded-md bg-input text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring',
            });
            descriptor.enum.forEach((value) => {
              inputEl.appendChild(createElement('option', { value }, value));
            });
            inputEl.value = params[key];
          } else if (descriptor && (descriptor.type === 'integer' || descriptor.type === 'number')) {
            inputEl = createElement('input', {
              id: inputId,
              type: 'number',
              step: descriptor.type === 'integer' ? 1 : 'any',
              className: 'w-full px-2 py-1 border border-border rounded-md bg-input text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring',
            });
            if (descriptor.minimum !== undefined) inputEl.min = descriptor.minimum;
            if (descriptor.maximum !== undefined) inputEl.max = descriptor.maximum;
            inputEl.value = params[key] !== undefined ? params[key] : '';
          } else if (descriptor && descriptor.type === 'boolean') {
            inputEl = createElement('input', {
              id: inputId,
              type: 'checkbox',
              className: 'h-3 w-3 text-primary border-border rounded',
              checked: Boolean(params[key]),
            });
          } else {
            inputEl = createElement('input', {
              id: inputId,
              type: 'text',
              className: 'w-full px-2 py-1 border border-border rounded-md bg-input text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring',
              value: params[key] !== undefined ? params[key] : '',
            });
          }
          inputEl.addEventListener('change', () => {
            if (descriptor && descriptor.type === 'boolean') {
              node.params[key] = Boolean(inputEl.checked);
            } else if (inputEl.type === 'number') {
              node.params[key] = inputEl.value === '' ? null : toNumber(inputEl.value);
            } else {
              node.params[key] = inputEl.value;
            }
            node.params[key] = normaliseParamValue(descriptor, node.params[key]);
            this.updateHiddenDsl(state);
            this.notifyChange();
          });
          inputEl.addEventListener('input', () => {
            if (descriptor && (descriptor.type === 'integer' || descriptor.type === 'number')) {
              node.params[key] = inputEl.value === '' ? null : toNumber(inputEl.value);
              node.params[key] = normaliseParamValue(descriptor, node.params[key]);
              this.updateHiddenDsl(state);
              this.notifyChange();
            }
          });
          field.appendChild(inputEl);
          paramsWrapper.appendChild(field);
        });
      } else {
        paramsWrapper.appendChild(createElement('div', { className: 'text-[11px] text-muted-foreground' }, '此策略無額外參數'));
      }

      return createElement('div', { className: 'space-y-2' }, [
        createElement('div', null, select),
        paramsWrapper,
      ]);
    }

    renderGroupNodeContent(state, node) {
      const childrenWrapper = createElement('div', { className: 'space-y-2' });
      node.nodes.forEach((child) => {
        childrenWrapper.appendChild(this.renderDslNode(state, child, node, false));
      });
      if (node.nodes.length === 0) {
        childrenWrapper.appendChild(createElement('div', { className: 'text-[11px] text-muted-foreground' }, '尚無子節點'));
      }
      const actions = createElement('div', { className: 'flex items-center gap-2 pt-1' }, [
        createElement('button', {
          type: 'button',
          className: 'strategy-dsl-btn text-[11px]',
          'data-node-action': 'add-child',
          'data-child-type': 'plugin',
          'data-node-id': node.id,
        }, '新增規則'),
        createElement('button', {
          type: 'button',
          className: 'strategy-dsl-btn text-[11px]',
          'data-node-action': 'add-child',
          'data-child-type': 'group',
          'data-node-id': node.id,
        }, '新增群組'),
        createElement('button', {
          type: 'button',
          className: 'strategy-dsl-btn text-[11px]',
          'data-node-action': 'add-child',
          'data-child-type': 'not',
          'data-node-id': node.id,
        }, '新增 NOT'),
      ]);
      return createElement('div', { className: 'space-y-2' }, [childrenWrapper, actions]);
    }

    renderNotNodeContent(state, node) {
      const child = node.node || createPluginNode(state.selectEl.value, state.paramsState);
      node.node = child;
      const childWrapper = createElement('div', { className: 'space-y-2' });
      childWrapper.appendChild(this.renderDslNode(state, child, node, false));
      return childWrapper;
    }

    changeNodeType(state, node, nextType, parent) {
      const normalized = typeof nextType === 'string' ? nextType.toUpperCase() : 'PLUGIN';
      if (normalized === node.type) {
        return;
      }
      if (normalized === 'PLUGIN') {
        node.type = 'PLUGIN';
        node.strategyId = state.selectEl.value;
        node.params = cloneParams(state.paramsState);
        delete node.nodes;
        delete node.node;
      } else if (normalized === 'AND' || normalized === 'OR') {
        const existingChildren = [];
        if (node.type === 'PLUGIN') {
          existingChildren.push(createPluginNode(node.strategyId, node.params));
        } else if (node.type === 'NOT' && node.node) {
          existingChildren.push(node.node);
        } else if (node.type === 'AND' || node.type === 'OR') {
          ensureArray(node.nodes).forEach((child) => existingChildren.push(child));
        }
        node.type = normalized;
        node.nodes = existingChildren.length > 0
          ? existingChildren
          : [createPluginNode(state.selectEl.value, state.paramsState)];
        delete node.node;
      } else if (normalized === 'NOT') {
        let childNode = null;
        if (node.type === 'PLUGIN') {
          childNode = createPluginNode(node.strategyId, node.params);
        } else if (node.type === 'AND' || node.type === 'OR') {
          childNode = node.nodes && node.nodes[0] ? node.nodes[0] : createPluginNode(state.selectEl.value, state.paramsState);
        } else if (node.type === 'NOT' && node.node) {
          childNode = node.node;
        }
        node.type = 'NOT';
        node.node = childNode || createPluginNode(state.selectEl.value, state.paramsState);
        delete node.nodes;
      }
      this.renderDsl(state);
      this.updateHiddenDsl(state);
      this.notifyChange();
    }

    addChildNode(state, parentNode, childType) {
      if (!parentNode) {
        return;
      }
      if (parentNode.type === 'AND' || parentNode.type === 'OR') {
        if (childType === 'group') {
          parentNode.nodes.push(createGroupNode('AND', [createPluginNode(state.selectEl.value, state.paramsState)]));
        } else if (childType === 'not') {
          parentNode.nodes.push(createNotNode(createPluginNode(state.selectEl.value, state.paramsState)));
        } else {
          parentNode.nodes.push(createPluginNode(state.selectEl.value, state.paramsState));
        }
      } else if (parentNode.type === 'NOT') {
        if (childType === 'group') {
          parentNode.node = createGroupNode('AND', [parentNode.node || createPluginNode(state.selectEl.value, state.paramsState)]);
        } else if (childType === 'not') {
          parentNode.node = createNotNode(parentNode.node || createPluginNode(state.selectEl.value, state.paramsState));
        } else {
          parentNode.node = createPluginNode(state.selectEl.value, state.paramsState);
        }
      }
      this.renderDsl(state);
      this.updateHiddenDsl(state);
      this.notifyChange();
    }

    removeChildNode(state, parentNode, childNode) {
      if (!parentNode || !childNode) {
        return;
      }
      if (parentNode.type === 'AND' || parentNode.type === 'OR') {
        parentNode.nodes = ensureArray(parentNode.nodes).filter((node) => node !== childNode);
        if (parentNode.nodes.length === 1 && parentNode === state.dslRoot) {
          state.dslRoot = parentNode.nodes[0];
        }
      } else if (parentNode.type === 'NOT') {
        parentNode.node = null;
      }
      this.renderDsl(state);
      this.updateHiddenDsl(state);
      this.notifyChange();
    }

    updateHiddenDsl(state) {
      if (!state.hiddenInput) {
        return;
      }
      const dslNode = this.serializeNode(state.dslRoot);
      if (dslNode) {
        state.hiddenInput.value = JSON.stringify({ version: STRATEGY_DSL_VERSION, node: dslNode });
      } else {
        state.hiddenInput.value = '';
      }
    }

    serializeNode(node) {
      if (!node || typeof node !== 'object') {
        return null;
      }
      if (node.type === 'PLUGIN') {
        const meta = this.metaMap.get(node.strategyId) || null;
        const schema = meta && meta.paramsSchema ? meta.paramsSchema : null;
        const params = sanitizeParamsAgainstSchema(schema, node.params || {});
        const cleanParams = Object.keys(params).length > 0 ? params : undefined;
        const result = { type: 'plugin', id: node.strategyId };
        if (cleanParams) {
          result.params = cleanParams;
        }
        return result;
      }
      if (node.type === 'AND' || node.type === 'OR') {
        const children = ensureArray(node.nodes)
          .map((child) => this.serializeNode(child))
          .filter(Boolean);
        if (children.length === 0) {
          return null;
        }
        return { type: node.type, nodes: children };
      }
      if (node.type === 'NOT') {
        const child = this.serializeNode(node.node);
        if (!child) {
          return null;
        }
        return { type: 'NOT', node: child };
      }
      return null;
    }

    deserializeNode(definition) {
      if (!definition || typeof definition !== 'object') {
        return null;
      }
      const type = typeof definition.type === 'string'
        ? definition.type.toUpperCase()
        : typeof definition.op === 'string'
          ? definition.op.toUpperCase()
          : typeof definition.operator === 'string'
            ? definition.operator.toUpperCase()
            : definition.id
              ? 'PLUGIN'
              : null;
      if (!type) {
        return null;
      }
      if (type === 'PLUGIN') {
        const strategyId = typeof definition.id === 'string' ? definition.id : null;
        if (!strategyId) {
          return null;
        }
        const meta = this.metaMap.get(strategyId) || null;
        const schema = meta && meta.paramsSchema ? meta.paramsSchema : null;
        const params = sanitizeParamsAgainstSchema(schema, definition.params || {});
        return createPluginNode(strategyId, params);
      }
      if (type === 'AND' || type === 'OR') {
        const nodes = ensureArray(definition.nodes).map((child) => this.deserializeNode(child)).filter(Boolean);
        if (nodes.length === 0) {
          return null;
        }
        return createGroupNode(type, nodes);
      }
      if (type === 'NOT') {
        const child = this.deserializeNode(definition.node || (definition.nodes && definition.nodes[0]));
        if (!child) {
          return null;
        }
        return createNotNode(child);
      }
      return null;
    }

    getRoleState(roleTypeOrKey) {
      return this.roleStates.get(roleTypeOrKey) || null;
    }

    getRoleSelection(type) {
      const roleKey = TYPE_TO_ROLE[type] || type;
      const state = this.getRoleState(roleKey);
      if (!state) {
        return { strategyId: null, params: {} };
      }
      return {
        strategyId: state.selectEl ? state.selectEl.value : null,
        params: cloneParams(state.paramsState),
      };
    }

    getRoleParams(type) {
      const selection = this.getRoleSelection(type);
      return selection.params || {};
    }

    getDslSnapshot() {
      const snapshot = { version: STRATEGY_DSL_VERSION };
      let hasNode = false;
      ['longEntry', 'longExit', 'shortEntry', 'shortExit'].forEach((roleKey) => {
        const state = this.getRoleState(roleKey);
        if (!state) {
          return;
        }
        const serialized = this.serializeNode(state.dslRoot);
        if (serialized) {
          snapshot[roleKey] = serialized;
          hasNode = true;
        }
      });
      return hasNode ? snapshot : null;
    }

    loadDslSnapshot(snapshot) {
      if (!snapshot || typeof snapshot !== 'object') {
        return;
      }
      ['longEntry', 'longExit', 'shortEntry', 'shortExit'].forEach((roleKey) => {
        const state = this.getRoleState(roleKey);
        if (!state) {
          return;
        }
        const definition = snapshot[roleKey];
        if (!definition) {
          this.resetDslToPrimary(state);
          return;
        }
        const node = this.deserializeNode(definition);
        if (!node) {
          this.resetDslToPrimary(state);
          return;
        }
        state.dslRoot = node;
        this.renderDsl(state);
        this.updateHiddenDsl(state);
      });
      this.notifyChange();
    }

    loadPrimarySelections(selections) {
      if (!selections || typeof selections !== 'object') {
        return;
      }
      Object.keys(TYPE_TO_ROLE).forEach((typeKey) => {
        const roleKey = TYPE_TO_ROLE[typeKey];
        const state = this.getRoleState(roleKey);
        if (!state) {
          return;
        }
        const payload = selections[typeKey] || selections[roleKey];
        if (!payload || typeof payload !== 'object') {
          return;
        }
        if (payload.strategyId && state.selectEl) {
          state.selectEl.value = payload.strategyId;
        }
        if (payload.params && typeof payload.params === 'object') {
          state.paramsState = sanitizeParamsAgainstSchema(state.paramsSchema, payload.params);
        }
        this.renderParamsForm(state);
        this.resetDslToPrimary(state);
      });
      this.notifyChange();
    }

    registerChangeListener(listener) {
      if (typeof listener === 'function') {
        this.changeListeners.add(listener);
      }
    }

    notifyChange() {
      ensureLucideIcons();
      this.changeListeners.forEach((listener) => {
        try {
          listener();
        } catch (error) {
          // ignore listener errors
        }
      });
    }
  }

  const registry = globalScope.StrategyPluginRegistry || null;
  const manager = new StrategyFormManager(registry);
  manager.init();

  function syncFromBacktestParams() {
    if (typeof globalScope.getBacktestParams !== 'function') {
      return;
    }
    try {
      const params = globalScope.getBacktestParams();
      if (!params || typeof params !== 'object') {
        return;
      }
      const selections = {
        entry: {
          strategyId: params.entryStrategy || null,
          params: params.entryParams || {},
        },
        exit: {
          strategyId: params.exitStrategy || null,
          params: params.exitParams || {},
        },
      };
      if (params.enableShorting) {
        selections.shortEntry = {
          strategyId: params.shortEntryStrategy || null,
          params: params.shortEntryParams || {},
        };
        selections.shortExit = {
          strategyId: params.shortExitStrategy || null,
          params: params.shortExitParams || {},
        };
      }
      manager.loadPrimarySelections(selections);
      if (params.strategyDsl && typeof manager.loadDslSnapshot === 'function') {
        manager.loadDslSnapshot(params.strategyDsl);
      }
    } catch (error) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[StrategyForm] 無法從回測參數同步 DSL', error);
      }
    }
  }

  function attachLegacyHooks() {
    const wrap = (fnName) => {
      if (!globalScope || typeof globalScope[fnName] !== 'function') {
        return;
      }
      const original = globalScope[fnName];
      globalScope[fnName] = function patchedLegacyHook() {
        const result = original.apply(this, arguments); // eslint-disable-line prefer-rest-params
        syncFromBacktestParams();
        return result;
      };
    };
    wrap('loadStrategy');
    wrap('resetSettings');
    syncFromBacktestParams();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachLegacyHooks);
  } else {
    attachLegacyHooks();
  }

  const api = {
    __version__: MODULE_VERSION,
    init: () => manager.init(),
    getRoleParams: (type) => manager.getRoleParams(type),
    getRoleSelection: (type) => manager.getRoleSelection(type),
    getDslSnapshot: () => manager.getDslSnapshot(),
    loadDslSnapshot: (snapshot) => manager.loadDslSnapshot(snapshot),
    loadPrimarySelections: (selections) => manager.loadPrimarySelections(selections),
    registerChangeListener: (listener) => manager.registerChangeListener(listener),
    syncFromBacktestParams,
  };

  Object.defineProperty(globalScope, 'lazybacktestStrategyForm', {
    value: api,
    writable: false,
    enumerable: true,
    configurable: false,
  });
})(typeof self !== 'undefined' ? self : this);
