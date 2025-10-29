(function (root) {
  const paramApi = root && root.lazybacktestParamSchema;
  const stateFactory = root && root.lazybacktestStrategyDslState;

  const TYPE_CONFIGS = {
    entry: {
      roleKey: 'longEntry',
      selectId: 'entryStrategy',
      paramsContainerId: 'entryParams',
      operatorSelectId: 'entryDslOperator',
      nodeListId: 'entryDslNodes',
      addButtonId: 'entryDslAddButton',
    },
    exit: {
      roleKey: 'longExit',
      selectId: 'exitStrategy',
      paramsContainerId: 'exitParams',
      operatorSelectId: 'exitDslOperator',
      nodeListId: 'exitDslNodes',
      addButtonId: 'exitDslAddButton',
    },
    shortEntry: {
      roleKey: 'shortEntry',
      selectId: 'shortEntryStrategy',
      paramsContainerId: 'shortEntryParams',
      operatorSelectId: 'shortEntryDslOperator',
      nodeListId: 'shortEntryDslNodes',
      addButtonId: 'shortEntryDslAddButton',
    },
    shortExit: {
      roleKey: 'shortExit',
      selectId: 'shortExitStrategy',
      paramsContainerId: 'shortExitParams',
      operatorSelectId: 'shortExitDslOperator',
      nodeListId: 'shortExitDslNodes',
      addButtonId: 'shortExitDslAddButton',
    },
  };

  function createParamForm(container, schema, initialValues, options) {
    const api = options && options.paramApi;
    const resolvePresentation = options && options.resolvePresentation;
    const idPrefix = options && options.idPrefix ? String(options.idPrefix) : '';
    const onChange = options && options.onChange;
    const normalisedSchema = api.normaliseSchema(schema || {});
    const defaults = api.deriveDefaults(normalisedSchema);
    const starting = api.sanitiseParams(normalisedSchema, { ...defaults, ...(initialValues || {}) });
    let state = starting.values;
    const fields = api.createFieldDescriptors(normalisedSchema);
    const inputRefs = new Map();

    function updateInputs() {
      inputRefs.forEach((element, name) => {
        const value = state[name];
        if (element.type === 'checkbox') {
          element.checked = Boolean(value);
        } else if (element.tagName === 'SELECT') {
          element.value = value !== undefined && value !== null ? String(value) : '';
        } else {
          element.value = value !== undefined && value !== null ? value : '';
        }
      });
    }

    function applyChange(name, rawValue) {
      const nextState = { ...state, [name]: rawValue };
      const sanitised = api.sanitiseParams(normalisedSchema, nextState);
      state = sanitised.values;
      updateInputs();
      if (typeof onChange === 'function') {
        onChange(state, { name, rawValue, sanitised });
      }
    }

    function createFieldElement(field) {
      const wrapper = document.createElement('div');
      wrapper.className = 'space-y-1';

      const presentation = typeof resolvePresentation === 'function'
        ? resolvePresentation(field.name)
        : null;
      const labelText = presentation && presentation.label ? presentation.label : field.label;
      const inputId = presentation && presentation.inputId
        ? presentation.inputId
        : idPrefix
          ? `${idPrefix}${field.name}`
          : '';

      const label = document.createElement('label');
      label.className = 'block text-xs font-medium text-foreground';
      label.textContent = labelText;
      if (inputId) {
        label.setAttribute('for', inputId);
      }
      wrapper.appendChild(label);

      let input;
      if (field.control === 'select') {
        input = document.createElement('select');
        input.className = 'w-full px-3 py-2 border border-border rounded-md bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-xs';
        (field.options || []).forEach((optionValue) => {
          const optionEl = document.createElement('option');
          optionEl.value = String(optionValue);
          optionEl.textContent = String(optionValue);
          input.appendChild(optionEl);
        });
      } else if (field.control === 'checkbox') {
        input = document.createElement('input');
        input.type = 'checkbox';
        input.className = 'h-4 w-4 rounded border-border text-accent focus:ring-accent';
      } else {
        input = document.createElement('input');
        input.type = field.control === 'number' ? 'number' : 'text';
        input.className = 'w-full px-3 py-2 border border-border rounded-md bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-xs';
        if (field.minimum !== undefined) {
          input.min = field.minimum;
        }
        if (field.maximum !== undefined) {
          input.max = field.maximum;
        }
        if (field.step !== null && field.step !== undefined) {
          input.step = field.step;
        } else if (field.control === 'number') {
          input.step = field.step || 'any';
        }
      }

      if (inputId) {
        input.id = inputId;
      }

      const currentValue = state[field.name];
      if (input.type === 'checkbox') {
        input.checked = Boolean(currentValue);
      } else if (input.tagName === 'SELECT') {
        input.value = currentValue !== undefined && currentValue !== null ? String(currentValue) : '';
      } else {
        input.value = currentValue !== undefined && currentValue !== null ? currentValue : '';
      }

      const eventName = input.type === 'checkbox' ? 'change' : 'blur';
      input.addEventListener(eventName, (event) => {
        if (input.type === 'checkbox') {
          applyChange(field.name, input.checked);
        } else if (input.tagName === 'SELECT') {
          applyChange(field.name, input.value);
        } else if (input.type === 'number') {
          applyChange(field.name, input.value === '' ? '' : Number(input.value));
        } else {
          applyChange(field.name, input.value);
        }
      });
      if (input.tagName === 'SELECT') {
        input.addEventListener('change', (event) => {
          applyChange(field.name, input.value);
        });
      }

      wrapper.appendChild(input);
      inputRefs.set(field.name, input);
      return wrapper;
    }

    container.innerHTML = '';
    fields.forEach((field) => {
      container.appendChild(createFieldElement(field));
    });

    return {
      getValues() {
        return { ...state };
      },
      setValues(nextValues) {
        const sanitised = api.sanitiseParams(normalisedSchema, nextValues || {});
        state = sanitised.values;
        updateInputs();
      },
    };
  }

  function cloneOptionsFromSelect(select) {
    if (!select) {
      return [];
    }
    return Array.from(select.options || []).map((option) => ({
      value: option.value,
      label: option.textContent || option.value,
    }));
  }

  function create(options = {}) {
    const registry = options.registry || (root && root.StrategyPluginRegistry);
    if (!registry || typeof registry.getStrategyMetaById !== 'function') {
      throw new Error('StrategyPluginRegistry 未就緒');
    }
    const api = options.paramApi || paramApi;
    if (!api) {
      throw new Error('Param schema API 未就緒');
    }
    const stateApi = options.stateFactory || stateFactory;
    if (!stateApi || typeof stateApi.create !== 'function') {
      throw new Error('StrategyDslState 工廠未就緒');
    }
    const normaliseStrategyId = typeof options.normaliseStrategyId === 'function'
      ? options.normaliseStrategyId
      : (type, id) => id;
    const resolveFieldMetadata = typeof options.resolveFieldMetadata === 'function'
      ? options.resolveFieldMetadata
      : () => null;

    const store = stateApi.create({
      registry,
      paramApi: api,
      version: options.version,
    });

    const primaryForms = new Map();

    function updatePrimaryByType(type) {
      const config = TYPE_CONFIGS[type];
      if (!config) {
        return;
      }
      const select = document.getElementById(config.selectId);
      const container = document.getElementById(config.paramsContainerId);
      if (!select || !container) {
        return;
      }
      const rawId = select.value;
      const normalisedId = normaliseStrategyId(type, rawId);
      const meta = registry.getStrategyMetaById(normalisedId);
      const schema = meta && meta.paramsSchema ? meta.paramsSchema : { type: 'object', properties: {} };

      container.innerHTML = '';
      const form = createParamForm(container, schema, {}, {
        paramApi: api,
        idPrefix: `${type}`,
        resolvePresentation: (paramName) => resolveFieldMetadata(type, normalisedId, paramName),
        onChange: () => {},
      });

      primaryForms.set(type, {
        form,
        strategyId: normalisedId,
        schema,
        roleKey: config.roleKey,
      });
    }

    function getPrimarySelection(roleKey) {
      const entry = Array.from(primaryForms.values()).find((item) => item.roleKey === roleKey);
      if (!entry || !entry.strategyId) {
        return null;
      }
      return {
        id: entry.strategyId,
        params: entry.form.getValues(),
        roleKey,
      };
    }

    function getAllPrimarySelections() {
      const result = {};
      Object.keys(TYPE_CONFIGS).forEach((type) => {
        const entry = primaryForms.get(type);
        if (!entry || !entry.strategyId) {
          return;
        }
        result[entry.roleKey] = {
          id: entry.strategyId,
          params: entry.form.getValues(),
        };
      });
      return result;
    }

    function renderRoleNodes(type, roleState) {
      const config = TYPE_CONFIGS[type];
      if (!config) {
        return;
      }
      const operatorSelect = document.getElementById(config.operatorSelectId);
      const listContainer = document.getElementById(config.nodeListId);
      const addButton = document.getElementById(config.addButtonId);
      if (operatorSelect) {
        operatorSelect.value = roleState.operator || 'SINGLE';
      }
      if (!listContainer) {
        return;
      }
      listContainer.innerHTML = '';

      const isLogical = roleState.operator === 'AND' || roleState.operator === 'OR';
      if (addButton) {
        addButton.disabled = !isLogical;
        addButton.classList.toggle('opacity-50', !isLogical);
        addButton.classList.toggle('cursor-not-allowed', !isLogical);
      }

      if (!isLogical || !Array.isArray(roleState.nodes)) {
        return;
      }

      const baseSelect = document.getElementById(config.selectId);
      const options = cloneOptionsFromSelect(baseSelect);

      roleState.nodes.forEach((node, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'border border-border rounded-md p-3 space-y-3 bg-card';

        const header = document.createElement('div');
        header.className = 'flex items-center justify-between gap-3';

        const select = document.createElement('select');
        select.className = 'flex-1 px-3 py-2 border border-border rounded-md bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-xs';
        options.forEach((option) => {
          const optionEl = document.createElement('option');
          optionEl.value = option.value;
          optionEl.textContent = option.label;
          select.appendChild(optionEl);
        });
        select.value = node.id;
        select.addEventListener('change', (event) => {
          const nextId = normaliseStrategyId(type, event.target.value);
          store.replaceNode(config.roleKey, index, nextId, {});
        });

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'text-xs px-2 py-1 border border-border rounded-md text-destructive';
        removeBtn.textContent = '移除';
        removeBtn.addEventListener('click', () => {
          store.removeNode(config.roleKey, index);
        });

        header.appendChild(select);
        header.appendChild(removeBtn);
        wrapper.appendChild(header);

        const paramContainer = document.createElement('div');
        paramContainer.className = 'space-y-2';
        wrapper.appendChild(paramContainer);

        const meta = registry.getStrategyMetaById(node.id);
        const schema = meta && meta.paramsSchema ? meta.paramsSchema : { type: 'object', properties: {} };
        createParamForm(paramContainer, schema, node.params, {
          paramApi: api,
          idPrefix: `${config.roleKey}-extra-${index}-`,
          resolvePresentation: (paramName) => {
            const meta = resolveFieldMetadata(type, node.id, paramName);
            return meta && meta.label ? { label: meta.label } : null;
          },
          onChange: (values) => {
            store.updateNodeParams(config.roleKey, index, values);
          },
        });

        listContainer.appendChild(wrapper);
      });
    }

    function renderAllDsl(state) {
      Object.keys(TYPE_CONFIGS).forEach((type) => {
        const config = TYPE_CONFIGS[type];
        const roleState = state[config.roleKey] || { operator: 'SINGLE', nodes: [] };
        renderRoleNodes(type, roleState);
      });
    }

    function init() {
      Object.keys(TYPE_CONFIGS).forEach((type) => updatePrimaryByType(type));

      Object.keys(TYPE_CONFIGS).forEach((type) => {
        const config = TYPE_CONFIGS[type];
        const operatorSelect = document.getElementById(config.operatorSelectId);
        const addButton = document.getElementById(config.addButtonId);
        if (operatorSelect) {
          operatorSelect.addEventListener('change', (event) => {
            store.setOperator(config.roleKey, event.target.value);
          });
        }
        if (addButton) {
          addButton.addEventListener('click', () => {
            const primary = primaryForms.get(type);
            const defaultId = primary && primary.strategyId
              ? primary.strategyId
              : (document.getElementById(config.selectId) || {}).value;
            const normalisedId = normaliseStrategyId(type, defaultId);
            if (normalisedId) {
              store.addNode(config.roleKey, normalisedId, {});
            }
          });
        }
      });

      renderAllDsl(store.getState());
      store.subscribe(renderAllDsl);
    }

    function buildStrategyDsl(selection) {
      const primaryMap = {};
      Object.keys(TYPE_CONFIGS).forEach((type) => {
        const config = TYPE_CONFIGS[type];
        if ((config.roleKey === 'shortEntry' || config.roleKey === 'shortExit') && selection && selection.enableShorting === false) {
          return;
        }
        const entry = primaryForms.get(type);
        if (!entry || !entry.strategyId) {
          return;
        }
        primaryMap[config.roleKey] = {
          id: entry.strategyId,
          params: entry.form.getValues(),
        };
      });
      return store.buildDsl(primaryMap);
    }

    return {
      init,
      updatePrimaryByType,
      getPrimarySelection,
      getAllPrimarySelections,
      buildStrategyDsl,
      getStore() {
        return store;
      },
      applyDsl(definition) {
        if (typeof store.loadFromDsl === 'function') {
          store.loadFromDsl(definition || {});
        }
      },
    };
  }

  const api = Object.freeze({ create });

  if (root && typeof root === 'object') {
    root.lazybacktestStrategyUi = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this);
