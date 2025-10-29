// Strategy DSL Editor - LB-DSL-FORM-20260920A
(function (root) {
  const globalScope = root || (typeof self !== 'undefined' ? self : this);
  const schemaUtils = globalScope && globalScope.LazyStrategyParamsSchema;
  const dslStateUtils = globalScope && globalScope.LazyStrategyDslState;

  if (!schemaUtils || !dslStateUtils) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[StrategyDslEditor] 缺少必要的 Schema/Dsl 工具，略過 DSL 編輯器初始化');
    }
    return;
  }

  const ROLE_CONFIGS = [
    { key: 'entry', dslKey: 'longEntry', label: '做多進場', selectId: 'entryStrategy' },
    { key: 'exit', dslKey: 'longExit', label: '做多出場', selectId: 'exitStrategy' },
    { key: 'shortEntry', dslKey: 'shortEntry', label: '做空進場', selectId: 'shortEntryStrategy' },
    { key: 'shortExit', dslKey: 'shortExit', label: '回補出場', selectId: 'shortExitStrategy' },
  ];

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
      return null;
    }
  }

  function ensureElement(id) {
    if (!id) return null;
    return typeof document !== 'undefined' ? document.getElementById(id) : null;
  }

  function createRoleSection(label) {
    const section = document.createElement('section');
    section.className = 'lb-dsl-role space-y-3 border rounded-md p-3';
    section.style.borderColor = 'var(--border)';
    section.style.backgroundColor = 'var(--card)';

    const header = document.createElement('div');
    header.className = 'flex items-center justify-between gap-3';

    const title = document.createElement('h4');
    title.className = 'text-sm font-semibold';
    title.style.color = 'var(--foreground)';
    title.textContent = label;

    const operatorWrapper = document.createElement('div');
    operatorWrapper.className = 'flex items-center gap-2 text-[11px]';
    operatorWrapper.style.color = 'var(--muted-foreground)';

    const operatorLabel = document.createElement('span');
    operatorLabel.textContent = '組合方式';

    const operatorSelect = document.createElement('select');
    operatorSelect.className = 'px-2 py-1 border rounded-md text-[11px]';
    operatorSelect.style.borderColor = 'var(--border)';
    const andOption = document.createElement('option');
    andOption.value = 'AND';
    andOption.textContent = '全部符合 (AND)';
    const orOption = document.createElement('option');
    orOption.value = 'OR';
    orOption.textContent = '符合任一 (OR)';
    const notOption = document.createElement('option');
    notOption.value = 'NOT';
    notOption.textContent = '取反 (NOT)';
    operatorSelect.appendChild(andOption);
    operatorSelect.appendChild(orOption);
    operatorSelect.appendChild(notOption);

    operatorWrapper.appendChild(operatorLabel);
    operatorWrapper.appendChild(operatorSelect);

    header.appendChild(title);
    header.appendChild(operatorWrapper);

    const list = document.createElement('div');
    list.className = 'lb-dsl-node-list space-y-2';

    const empty = document.createElement('p');
    empty.className = 'text-[11px]';
    empty.style.color = 'var(--muted-foreground)';
    empty.textContent = '拖放或新增規則以建立 DSL。';

    const actions = document.createElement('div');
    actions.className = 'flex items-center gap-2';

    const addSelect = document.createElement('select');
    addSelect.className = 'flex-1 px-3 py-2 border rounded-md bg-input text-foreground text-sm';
    addSelect.style.borderColor = 'var(--border)';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '選擇策略以新增';
    addSelect.appendChild(placeholder);

    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'px-3 py-2 text-sm rounded-md border';
    addButton.style.borderColor = 'var(--primary)';
    addButton.style.color = 'var(--primary)';
    addButton.textContent = '新增規則';

    actions.appendChild(addSelect);
    actions.appendChild(addButton);

    section.appendChild(header);
    section.appendChild(list);
    section.appendChild(empty);
    section.appendChild(actions);

    return { section, header, list, empty, actions, operatorSelect, addSelect, addButton };
  }

  function createNodeElement(node) {
    const item = document.createElement('div');
    item.className = 'lb-dsl-node border rounded-md p-2 space-y-2';
    item.style.borderColor = 'var(--border)';
    item.draggable = true;
    item.setAttribute('data-lb-node-uid', node.uid);

    const row = document.createElement('div');
    row.className = 'flex items-center justify-between gap-2';

    const title = document.createElement('div');
    title.className = 'text-sm font-medium';
    title.style.color = 'var(--foreground)';
    title.textContent = node.label || node.strategyId;

    const controls = document.createElement('div');
    controls.className = 'flex items-center gap-2';

    const negateLabel = document.createElement('label');
    negateLabel.className = 'flex items-center gap-1 text-[11px]';
    negateLabel.style.color = 'var(--muted-foreground)';
    const negateInput = document.createElement('input');
    negateInput.type = 'checkbox';
    negateInput.className = 'lb-dsl-node-negate';
    negateInput.checked = Boolean(node.negate);
    negateLabel.appendChild(negateInput);
    const negateSpan = document.createElement('span');
    negateSpan.textContent = 'NOT';
    negateLabel.appendChild(negateSpan);

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'px-2 py-1 text-[11px] border rounded-md';
    removeButton.style.borderColor = 'var(--border)';
    removeButton.style.color = 'var(--destructive)';
    removeButton.textContent = '刪除';

    controls.appendChild(negateLabel);
    controls.appendChild(removeButton);

    row.appendChild(title);
    row.appendChild(controls);

    const form = document.createElement('div');
    form.className = 'lb-dsl-node-form space-y-2';

    item.appendChild(row);
    item.appendChild(form);

    return { item, negateInput, removeButton, form };
  }

  function StrategyDslEditor(options) {
    this.registry = globalScope && globalScope.StrategyPluginRegistry;
    this.strategyDescriptions = options && options.strategyDescriptions ? options.strategyDescriptions : null;
    this.version = options && options.version ? options.version : dslStateUtils.DEFAULT_VERSION;
    this.containerId = options && options.containerId ? options.containerId : null;
    this.containerEl = null;
    this.roleStates = new Map();
    this.dragState = null;
    this.nodeCounter = 0;
  }

  StrategyDslEditor.prototype.init = function init() {
    this.containerEl = ensureElement(this.containerId);
    if (!this.containerEl) {
      return;
    }
    this.containerEl.innerHTML = '';
    this.containerEl.classList.add('space-y-4');

    ROLE_CONFIGS.forEach((config) => {
      const sectionParts = createRoleSection(config.label);
      this.containerEl.appendChild(sectionParts.section);
      const options = this.collectOptions(config);
      options.forEach((option) => {
        const opt = document.createElement('option');
        opt.value = option.value;
        opt.textContent = option.label;
        sectionParts.addSelect.appendChild(opt);
      });
      const roleState = {
        key: config.key,
        dslKey: config.dslKey,
        label: config.label,
        selectId: config.selectId,
        operator: 'AND',
        nodes: [],
        elements: sectionParts,
        options,
      };
      this.roleStates.set(config.key, roleState);
      sectionParts.operatorSelect.addEventListener('change', () => {
        roleState.operator = sectionParts.operatorSelect.value || 'AND';
        this.renderRole(roleState);
      });
      sectionParts.addButton.addEventListener('click', () => {
        this.handleAddNode(roleState);
      });
    });

    const shortToggle = ensureElement('enableShortSelling');
    if (shortToggle) {
      shortToggle.addEventListener('change', () => {
        this.renderAllRoles();
      });
    }

    this.renderAllRoles();
  };

  StrategyDslEditor.prototype.collectOptions = function collectOptions(config) {
    const select = ensureElement(config.selectId);
    if (!select || !select.options) {
      return [];
    }
    const seen = new Set();
    const options = [];
    Array.from(select.options).forEach((option) => {
      const value = option.value;
      if (!value || seen.has(value)) {
        return;
      }
      seen.add(value);
      const label = option.textContent ? option.textContent.trim() : value;
      options.push({ value, label });
    });
    return options;
  };

  StrategyDslEditor.prototype.findLabel = function findLabel(roleState, strategyId) {
    if (!strategyId) {
      return '';
    }
    const option = roleState.options.find((entry) => entry.value === strategyId);
    if (option && option.label) {
      return option.label;
    }
    if (this.strategyDescriptions && this.strategyDescriptions[strategyId]?.name) {
      return this.strategyDescriptions[strategyId].name;
    }
    const meta = resolveRegistryMeta(this.registry, strategyId);
    if (meta && meta.label) {
      return meta.label;
    }
    return strategyId;
  };

  StrategyDslEditor.prototype.createNodeState = function createNodeState(roleState, strategyId) {
    const normalizedId = normalizeStrategyId(roleState.key, strategyId) || strategyId;
    if (!normalizedId) {
      return null;
    }
    const meta = resolveRegistryMeta(this.registry, normalizedId);
    const fallbackDefaults = this.strategyDescriptions && this.strategyDescriptions[normalizedId]
      ? this.strategyDescriptions[normalizedId].defaultParams
      : {};
    const fields = schemaUtils.buildParamFields(meta && meta.paramsSchema ? meta.paramsSchema : {}, fallbackDefaults || {});
    const defaults = schemaUtils.createDefaultValues(fields);
    const sanitized = schemaUtils.sanitizeParamValues(fields, defaults);
    return {
      uid: `${roleState.key}_${Date.now()}_${this.nodeCounter++}`,
      strategyId: normalizedId,
      label: this.findLabel(roleState, normalizedId),
      fields,
      values: sanitized,
      negate: false,
    };
  };

  StrategyDslEditor.prototype.handleAddNode = function handleAddNode(roleState) {
    const addSelect = roleState.elements.addSelect;
    if (!addSelect) {
      return;
    }
    const strategyId = addSelect.value;
    if (!strategyId) {
      return;
    }
    const node = this.createNodeState(roleState, strategyId);
    if (!node) {
      return;
    }
    roleState.nodes.push(node);
    addSelect.value = '';
    this.renderRole(roleState);
  };

  StrategyDslEditor.prototype.renderNodeForm = function renderNodeForm(roleState, node, formContainer) {
    formContainer.innerHTML = '';
    if (!node.fields || node.fields.length === 0) {
      const placeholder = document.createElement('p');
      placeholder.className = 'text-[11px]';
      placeholder.style.color = 'var(--muted-foreground)';
      placeholder.textContent = '此規則無需額外參數。';
      formContainer.appendChild(placeholder);
      node.values = {};
      return;
    }

    node.fields.forEach((field) => {
      const fieldWrapper = document.createElement('div');
      fieldWrapper.className = 'space-y-1';
      const label = document.createElement('label');
      label.className = 'block text-[11px] font-medium';
      label.style.color = 'var(--muted-foreground)';
      label.textContent = field.label || field.name;
      const inputId = `${node.uid}_${field.name}`;
      let input;
      if (field.inputType === 'checkbox') {
        input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = Boolean(node.values[field.name]);
        input.className = 'lb-dsl-node-input';
      } else if (field.inputType === 'select') {
        input = document.createElement('select');
        input.className = 'w-full px-3 py-2 border rounded-md bg-input text-foreground text-sm lb-dsl-node-input';
        input.style.borderColor = 'var(--border)';
        const opts = Array.isArray(field.options) ? field.options : [];
        opts.forEach((option) => {
          const opt = document.createElement('option');
          opt.value = option;
          opt.textContent = option;
          input.appendChild(opt);
        });
        if (node.values[field.name] !== undefined && node.values[field.name] !== null) {
          input.value = String(node.values[field.name]);
        }
      } else {
        input = document.createElement('input');
        input.type = field.inputType === 'number' ? 'number' : 'text';
        input.className = 'w-full px-3 py-2 border rounded-md bg-input text-foreground text-sm lb-dsl-node-input';
        input.style.borderColor = 'var(--border)';
        if (field.inputType === 'number') {
          if (Number.isFinite(field.min)) input.min = String(field.min);
          if (Number.isFinite(field.max)) input.max = String(field.max);
          if (Number.isFinite(field.step)) input.step = String(field.step);
        }
        input.value = node.values[field.name] === undefined || node.values[field.name] === null
          ? ''
          : String(node.values[field.name]);
      }
      input.id = inputId;
      input.setAttribute('data-lb-param', field.name);
      input.addEventListener('change', () => {
        this.handleNodeFieldChange(roleState, node, formContainer);
      });
      if (field.inputType === 'number') {
        input.addEventListener('input', () => {
          this.handleNodeFieldChange(roleState, node, formContainer);
        });
      }
      fieldWrapper.appendChild(label);
      fieldWrapper.appendChild(input);
      formContainer.appendChild(fieldWrapper);
    });
  };

  StrategyDslEditor.prototype.handleNodeFieldChange = function handleNodeFieldChange(roleState, node, formContainer) {
    const raw = {};
    node.fields.forEach((field) => {
      const selector = `[data-lb-param="${field.name}"]`;
      const input = formContainer.querySelector(selector);
      if (!input) return;
      if (field.inputType === 'checkbox') {
        raw[field.name] = input.checked;
      } else {
        raw[field.name] = input.value;
      }
    });
    node.values = schemaUtils.sanitizeParamValues(node.fields, raw);
    this.renderNodeForm(roleState, node, formContainer);
  };

  StrategyDslEditor.prototype.renderRole = function renderRole(roleState) {
    const { list, empty, operatorSelect, section } = roleState.elements;
    const shortToggle = ensureElement('enableShortSelling');
    const shortDisabled = (roleState.key === 'shortEntry' || roleState.key === 'shortExit')
      && shortToggle && !shortToggle.checked;

    operatorSelect.value = roleState.operator || 'AND';

    list.innerHTML = '';
    if (shortDisabled) {
      empty.textContent = '需啟用做空設定後，回測才會套用此組合。';
      empty.style.color = 'var(--warning, #d97706)';
      empty.classList.remove('hidden');
      section.classList.add('opacity-70');
      return;
    }
    section.classList.remove('opacity-70');

    if (!roleState.nodes || roleState.nodes.length === 0) {
      empty.textContent = '拖放或新增規則以建立 DSL。';
      empty.style.color = 'var(--muted-foreground)';
      empty.classList.remove('hidden');
      return;
    }

    empty.classList.add('hidden');

    roleState.nodes.forEach((node) => {
      const nodeParts = createNodeElement(node);
      this.renderNodeForm(roleState, node, nodeParts.form);

      nodeParts.negateInput.addEventListener('change', () => {
        node.negate = Boolean(nodeParts.negateInput.checked);
      });
      nodeParts.removeButton.addEventListener('click', () => {
        this.removeNode(roleState, node.uid);
      });

      nodeParts.item.addEventListener('dragstart', (event) => {
        this.dragState = { roleKey: roleState.key, uid: node.uid };
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', node.uid);
        }
        nodeParts.item.classList.add('opacity-60');
      });
      nodeParts.item.addEventListener('dragend', () => {
        this.dragState = null;
        nodeParts.item.classList.remove('opacity-60');
        nodeParts.item.classList.remove('lb-dsl-node-dragover');
      });
      nodeParts.item.addEventListener('dragover', (event) => {
        if (this.dragState && this.dragState.roleKey === roleState.key) {
          event.preventDefault();
          nodeParts.item.classList.add('lb-dsl-node-dragover');
        }
      });
      nodeParts.item.addEventListener('dragleave', () => {
        nodeParts.item.classList.remove('lb-dsl-node-dragover');
      });
      nodeParts.item.addEventListener('drop', (event) => {
        event.preventDefault();
        nodeParts.item.classList.remove('lb-dsl-node-dragover');
        this.reorderNode(roleState, node.uid);
      });

      list.appendChild(nodeParts.item);
    });
  };

  StrategyDslEditor.prototype.reorderNode = function reorderNode(roleState, targetUid) {
    if (!this.dragState || this.dragState.roleKey !== roleState.key) {
      return;
    }
    const fromIndex = roleState.nodes.findIndex((node) => node.uid === this.dragState.uid);
    const toIndex = roleState.nodes.findIndex((node) => node.uid === targetUid);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
      return;
    }
    const [moved] = roleState.nodes.splice(fromIndex, 1);
    roleState.nodes.splice(toIndex, 0, moved);
    this.dragState = null;
    this.renderRole(roleState);
  };

  StrategyDslEditor.prototype.removeNode = function removeNode(roleState, uid) {
    const index = roleState.nodes.findIndex((node) => node.uid === uid);
    if (index === -1) {
      return;
    }
    roleState.nodes.splice(index, 1);
    this.renderRole(roleState);
  };

  StrategyDslEditor.prototype.renderAllRoles = function renderAllRoles() {
    this.roleStates.forEach((roleState) => {
      this.renderRole(roleState);
    });
  };

  StrategyDslEditor.prototype.buildDsl = function buildDsl() {
    const state = { version: this.version };
    let hasNode = false;
    this.roleStates.forEach((roleState) => {
      if (!roleState.nodes || roleState.nodes.length === 0) {
        return;
      }
      const nodes = roleState.nodes.map((node) => {
        node.values = schemaUtils.sanitizeParamValues(node.fields, node.values);
        return {
          id: node.strategyId,
          params: node.values,
          negate: Boolean(node.negate),
        };
      });
      if (nodes.length === 0) {
        return;
      }
      state[roleState.dslKey] = {
        operator: roleState.operator || 'AND',
        nodes,
      };
      hasNode = true;
    });
    if (!hasNode) {
      return null;
    }
    return dslStateUtils.buildDslFromState(state, { version: this.version });
  };

  function createEditor(config) {
    const editor = new StrategyDslEditor(config || {});
    editor.init();
    return editor;
  }

  const api = Object.freeze({
    createEditor,
  });

  if (globalScope && typeof globalScope === 'object') {
    globalScope.lazybacktestStrategyDslEditor = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this);
