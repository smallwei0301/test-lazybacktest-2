// Strategy DSL Editor - Patch Tag: LB-STRATEGY-DSL-EDITOR-20260917A
(function attachStrategyDslEditor(root) {
  const globalScope = root || (typeof self !== 'undefined' ? self : this);
  if (!globalScope) {
    return;
  }

  const EDITOR_VERSION = 'LB-STRATEGY-DSL-EDITOR-20260917A';
  const roleStateMap = new Map();
  const listeners = new Set();
  let nodeCounter = 0;

  function createNodeId() {
    nodeCounter += 1;
    return `dsl-node-${nodeCounter}`;
  }

  function normaliseOperator(operator) {
    const value = typeof operator === 'string' ? operator.toUpperCase() : 'AND';
    if (value === 'OR' || value === 'NOT') {
      return value;
    }
    return 'AND';
  }

  function cloneParams(params) {
    if (!params || typeof params !== 'object') {
      return {};
    }
    return JSON.parse(JSON.stringify(params));
  }

  function serializeNode(node) {
    if (!node) {
      return null;
    }
    if (node.kind === 'plugin') {
      const payload = { type: 'plugin', id: node.strategyId };
      if (node.params && Object.keys(node.params).length > 0) {
        payload.params = cloneParams(node.params);
      }
      return payload;
    }
    if (node.kind === 'group') {
      const operator = normaliseOperator(node.operator);
      if (!Array.isArray(node.children) || node.children.length === 0) {
        return null;
      }
      if (operator === 'NOT') {
        const firstChild = serializeNode(node.children[0]);
        if (!firstChild) {
          return null;
        }
        return { type: 'NOT', node: firstChild };
      }
      const childNodes = node.children
        .map((child) => serializeNode(child))
        .filter((child) => child !== null);
      if (childNodes.length === 0) {
        return null;
      }
      return { type: operator, nodes: childNodes };
    }
    return null;
  }

  function ensureRoleState(role) {
    const key = String(role || 'entry');
    if (!roleStateMap.has(key)) {
      roleStateMap.set(key, {
        role: key,
        containerId: null,
        container: null,
        header: null,
        body: null,
        toggle: null,
        useBuilder: false,
        root: null,
        baseStrategy: null,
        schema: null,
        label: key,
      });
    }
    return roleStateMap.get(key);
  }

  function notifyChange(role) {
    listeners.forEach((listener) => {
      try {
        listener(role);
      } catch (error) {
        console.warn('[StrategyDslEditor] listener 執行失敗', error);
      }
    });
  }

  function getPaletteStrategies() {
    const manifest = globalScope.lazybacktestStrategyManifest;
    if (Array.isArray(manifest) && manifest.length > 0) {
      return manifest;
    }
    const registry = globalScope.StrategyPluginRegistry;
    if (registry && typeof registry.listStrategies === 'function') {
      try {
        return registry.listStrategies({ includeLazy: true }) || [];
      } catch (error) {
        console.warn('[StrategyDslEditor] 無法取得策略清單', error);
      }
    }
    return [];
  }

  function createPluginNode(strategyId, params, label) {
    return {
      id: createNodeId(),
      kind: 'plugin',
      strategyId,
      params: cloneParams(params),
      label: label || strategyId,
      fields: [],
      parentId: null,
    };
  }

  function createGroupNode(operator = 'AND') {
    return {
      id: createNodeId(),
      kind: 'group',
      operator: normaliseOperator(operator),
      children: [],
      parentId: null,
    };
  }

  function findNode(roleState, nodeId) {
    if (!roleState || !roleState.root) {
      return null;
    }
    if (roleState.root.id === nodeId) {
      return roleState.root;
    }
    const stack = Array.isArray(roleState.root.children) ? [...roleState.root.children] : [];
    while (stack.length > 0) {
      const node = stack.shift();
      if (!node) continue;
      if (node.id === nodeId) {
        return node;
      }
      if (node.kind === 'group' && Array.isArray(node.children)) {
        stack.push(...node.children);
      }
    }
    return null;
  }

  function removeNode(roleState, nodeId) {
    if (!roleState || !roleState.root) {
      return;
    }
    if (roleState.root.id === nodeId) {
      roleState.root = null;
      return;
    }
    const stack = [roleState.root];
    while (stack.length > 0) {
      const current = stack.shift();
      if (!current || current.kind !== 'group' || !Array.isArray(current.children)) {
        continue;
      }
      const index = current.children.findIndex((child) => child.id === nodeId);
      if (index >= 0) {
        current.children.splice(index, 1);
        return;
      }
      current.children.forEach((child) => {
        if (child && child.kind === 'group') {
          stack.push(child);
        }
      });
    }
  }

  function renderPluginFields(roleState, node, container) {
    if (typeof document === 'undefined') {
      return;
    }
    container.innerHTML = '';
    const schemaHelper = globalScope.lazybacktestStrategyParamForm;
    if (!schemaHelper || typeof schemaHelper.getSchemaForStrategy !== 'function') {
      return;
    }
    const schema = schemaHelper.getSchemaForStrategy(node.strategyId);
    node.schema = schema;
    node.fields = [];
    if (!schema || !schema.properties || Object.keys(schema.properties).length === 0) {
      const empty = document.createElement('p');
      empty.className = 'text-[11px] italic';
      empty.style.color = 'var(--muted-foreground)';
      empty.textContent = '此策略無額外參數';
      container.appendChild(empty);
      return;
    }
    Object.entries(schema.properties).forEach(([paramName, descriptor]) => {
      const createField = typeof schemaHelper.createField === 'function' ? schemaHelper.createField : null;
      if (!createField) {
        return;
      }
      const field = createField({
        role: `${roleState.role}-dsl`,
        strategyId: node.strategyId,
        paramName,
        descriptor,
        value: node.params && Object.prototype.hasOwnProperty.call(node.params, paramName)
          ? node.params[paramName]
          : descriptor.default,
        onChange: (value) => {
          node.params[paramName] = value;
          notifyChange(roleState.role);
        },
      });
      if (field && field.element) {
        container.appendChild(field.element);
        node.fields.push(field);
      }
    });
  }

  function renderGroupChildren(roleState, groupNode, listContainer) {
    if (typeof document === 'undefined') {
      return;
    }
    listContainer.innerHTML = '';
    if (!Array.isArray(groupNode.children) || groupNode.children.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'text-[11px] italic px-3 py-2 rounded border border-dashed';
      empty.style.borderColor = 'var(--border)';
      empty.style.color = 'var(--muted-foreground)';
      empty.textContent = '拖曳策略卡片到此或使用下方按鈕新增條件';
      listContainer.appendChild(empty);
      return;
    }
    groupNode.children.forEach((child, index) => {
      if (child && typeof child === 'object') {
        child.parentId = groupNode.id;
      }
      const item = document.createElement('div');
      item.className = 'bg-card border border-border rounded-md p-3 space-y-2 relative';
      item.setAttribute('draggable', 'true');
      item.dataset.nodeId = child.id;
      item.dataset.parentId = groupNode.id;
      item.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('text/plain', JSON.stringify({ role: roleState.role, nodeId: child.id }));
        event.dataTransfer.effectAllowed = 'move';
      });
      item.addEventListener('dragover', (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      });
      item.addEventListener('drop', (event) => {
        event.preventDefault();
        try {
          const payload = JSON.parse(event.dataTransfer.getData('text/plain'));
          if (!payload || payload.role !== roleState.role) {
            return;
          }
          const targetParentId = groupNode.id;
          const sourceNode = findNode(roleState, payload.nodeId);
          if (!sourceNode || sourceNode.parentId !== targetParentId) {
            return;
          }
          const sourceParent = findNode(roleState, sourceNode.parentId);
          if (!sourceParent || sourceParent.kind !== 'group') {
            return;
          }
          const sourceIndex = sourceParent.children.findIndex((entry) => entry.id === sourceNode.id);
          const targetIndex = groupNode.children.findIndex((entry) => entry.id === child.id);
          if (sourceIndex === -1 || targetIndex === -1) {
            return;
          }
          if (sourceParent.id !== groupNode.id) {
            return;
          }
          sourceParent.children.splice(sourceIndex, 1);
          const insertIndex = targetIndex + (index < targetIndex ? 1 : 0);
          sourceParent.children.splice(insertIndex, 0, sourceNode);
          renderRole(roleState);
          notifyChange(roleState.role);
        } catch (error) {
          console.warn('[StrategyDslEditor] 無法處理拖放資料', error);
        }
      });

      const header = document.createElement('div');
      header.className = 'flex items-center justify-between gap-2';
      const title = document.createElement('div');
      title.className = 'font-medium text-sm';
      title.style.color = 'var(--foreground)';
      if (child.kind === 'plugin') {
        title.textContent = child.label || child.strategyId;
      } else {
        title.textContent = `${child.operator} 群組`;
      }
      header.appendChild(title);

      const buttonGroup = document.createElement('div');
      buttonGroup.className = 'flex items-center gap-1';

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'text-[11px] px-2 py-1 border rounded';
      removeBtn.style.borderColor = 'var(--border)';
      removeBtn.style.color = 'var(--destructive)';
      removeBtn.textContent = '刪除';
      removeBtn.addEventListener('click', () => {
        removeNode(roleState, child.id);
        renderRole(roleState);
        notifyChange(roleState.role);
      });
      buttonGroup.appendChild(removeBtn);

      if (child.kind === 'group') {
        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'text-[11px] px-2 py-1 border rounded';
        toggleBtn.style.borderColor = 'var(--border)';
        toggleBtn.textContent = `改為 ${child.operator === 'AND' ? 'OR' : child.operator === 'OR' ? 'NOT' : 'AND'}`;
        toggleBtn.addEventListener('click', () => {
          const next = child.operator === 'AND' ? 'OR' : child.operator === 'OR' ? 'NOT' : 'AND';
          child.operator = normaliseOperator(next);
          if (child.operator === 'NOT' && Array.isArray(child.children) && child.children.length > 1) {
            child.children = child.children.slice(0, 1);
          }
          renderRole(roleState);
          notifyChange(roleState.role);
        });
        buttonGroup.appendChild(toggleBtn);
      }

      header.appendChild(buttonGroup);
      item.appendChild(header);

      if (child.kind === 'plugin') {
        const fieldContainer = document.createElement('div');
        fieldContainer.className = 'border-t pt-2 mt-2 space-y-2';
        fieldContainer.style.borderColor = 'var(--border)';
        renderPluginFields(roleState, child, fieldContainer);
        item.appendChild(fieldContainer);
      } else {
        const groupChildList = document.createElement('div');
        groupChildList.className = 'space-y-2 mt-2';
        renderGroupChildren(roleState, child, groupChildList);
        item.appendChild(groupChildList);

        const groupControls = document.createElement('div');
        groupControls.className = 'flex flex-wrap gap-2 text-[11px]';
        const addPluginBtn = document.createElement('button');
        addPluginBtn.type = 'button';
        addPluginBtn.className = 'px-2 py-1 border rounded';
        addPluginBtn.style.borderColor = 'var(--border)';
        addPluginBtn.textContent = '新增策略規則';
        addPluginBtn.addEventListener('click', () => {
          openStrategyPicker(roleState, child);
        });
        groupControls.appendChild(addPluginBtn);

        if (child.operator !== 'NOT') {
          const addGroupBtn = document.createElement('button');
          addGroupBtn.type = 'button';
          addGroupBtn.className = 'px-2 py-1 border rounded';
          addGroupBtn.style.borderColor = 'var(--border)';
          addGroupBtn.textContent = '新增群組';
          addGroupBtn.addEventListener('click', () => {
            const newGroup = createGroupNode('AND');
            newGroup.parentId = child.id;
            child.children.push(newGroup);
            renderRole(roleState);
            notifyChange(roleState.role);
          });
          groupControls.appendChild(addGroupBtn);
        }
        item.appendChild(groupControls);
      }

      listContainer.appendChild(item);
    });
  }

  function openStrategyPicker(roleState, parentNode) {
    if (typeof document === 'undefined') {
      return;
    }
    const palette = getPaletteStrategies();
    const select = document.createElement('select');
    select.className = 'w-full px-3 py-2 border border-border rounded-md bg-input text-foreground text-sm';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '請選擇策略';
    select.appendChild(placeholder);
    palette.forEach((entry) => {
      const option = document.createElement('option');
      option.value = entry.id;
      option.textContent = entry.label || entry.id;
      select.appendChild(option);
    });

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40';

    const card = document.createElement('div');
    card.className = 'bg-card border border-border rounded-lg shadow-lg p-4 space-y-3 max-w-sm w-full';
    const title = document.createElement('h3');
    title.className = 'text-sm font-semibold';
    title.style.color = 'var(--foreground)';
    title.textContent = '選擇要加入的策略規則';
    card.appendChild(title);
    card.appendChild(select);

    const actionRow = document.createElement('div');
    actionRow.className = 'flex justify-end gap-2';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'text-xs px-3 py-1 border rounded';
    cancelBtn.style.borderColor = 'var(--border)';
    cancelBtn.textContent = '取消';
    cancelBtn.addEventListener('click', () => {
      modal.remove();
    });
    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'text-xs px-3 py-1 border rounded';
    confirmBtn.style.borderColor = 'var(--accent)';
    confirmBtn.style.color = 'var(--accent)';
    confirmBtn.textContent = '加入';
    confirmBtn.addEventListener('click', () => {
      const selectedId = select.value;
      if (!selectedId) {
        modal.remove();
        return;
      }
      const registry = globalScope.StrategyPluginRegistry;
      let meta = null;
      if (registry && typeof registry.getStrategyMetaById === 'function') {
        try {
          meta = registry.getStrategyMetaById(selectedId);
        } catch (error) {
          console.warn('[StrategyDslEditor] 無法讀取策略 meta', error);
        }
      }
      const label = meta && meta.label ? meta.label : selectedId;
      const schemaHelper = globalScope.lazybacktestStrategyParamForm;
      let params = {};
      if (schemaHelper && typeof schemaHelper.getSchemaForStrategy === 'function') {
        const schema = schemaHelper.getSchemaForStrategy(selectedId);
        if (schema && schema.properties) {
          Object.entries(schema.properties).forEach(([paramName, descriptor]) => {
            if (descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'default')) {
              params[paramName] = descriptor.default;
            }
          });
        }
      }
      const node = createPluginNode(selectedId, params, label);
      node.parentId = parentNode ? parentNode.id : null;
      if (parentNode) {
        if (!Array.isArray(parentNode.children)) {
          parentNode.children = [];
        }
        if (normaliseOperator(parentNode.operator) === 'NOT' && parentNode.children.length > 0) {
          parentNode.children[0] = node;
        } else {
          parentNode.children.push(node);
        }
      } else if (!roleState.root) {
        roleState.root = node;
      }
      renderRole(roleState);
      notifyChange(roleState.role);
      modal.remove();
    });
    actionRow.appendChild(cancelBtn);
    actionRow.appendChild(confirmBtn);
    card.appendChild(actionRow);

    modal.appendChild(card);
    document.body.appendChild(modal);
  }

  function renderRole(roleState) {
    if (typeof document === 'undefined') {
      return;
    }
    if (!roleState.containerId) {
      return;
    }
    if (!roleState.container) {
      roleState.container = document.getElementById(roleState.containerId);
    }
    const container = roleState.container;
    if (!container) {
      return;
    }
    container.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'flex items-center justify-between gap-2';
    const title = document.createElement('h4');
    title.className = 'text-sm font-semibold';
    title.style.color = 'var(--foreground)';
    title.textContent = roleState.label || roleState.role;
    header.appendChild(title);

    const toggleContainer = document.createElement('label');
    toggleContainer.className = 'flex items-center gap-2 text-xs';
    const toggleInput = document.createElement('input');
    toggleInput.type = 'checkbox';
    toggleInput.checked = Boolean(roleState.useBuilder);
    toggleInput.addEventListener('change', () => {
      roleState.useBuilder = toggleInput.checked;
      if (roleState.useBuilder && !roleState.root) {
        roleState.root = createGroupNode('AND');
      }
      renderRole(roleState);
      notifyChange(roleState.role);
    });
    const toggleLabel = document.createElement('span');
    toggleLabel.textContent = '使用 DSL 群組';
    toggleContainer.appendChild(toggleInput);
    toggleContainer.appendChild(toggleLabel);
    header.appendChild(toggleContainer);
    container.appendChild(header);

    const body = document.createElement('div');
    body.className = 'mt-2 space-y-3';
    container.appendChild(body);

    if (!roleState.useBuilder) {
      const preview = document.createElement('div');
      preview.className = 'text-xs text-muted-foreground';
      preview.style.color = 'var(--muted-foreground)';
      if (roleState.baseStrategy) {
        preview.textContent = `沿用策略：「${roleState.baseStrategy.label || roleState.baseStrategy.strategyId}」`; 
      } else {
        preview.textContent = '尚未選擇策略，請於上方選單設定。';
      }
      body.appendChild(preview);
      return;
    }

    if (!roleState.root) {
      roleState.root = createGroupNode('AND');
    }

    const groupContainer = document.createElement('div');
    groupContainer.className = 'space-y-2';
    const childList = document.createElement('div');
    childList.className = 'space-y-2';
    renderGroupChildren(roleState, roleState.root, childList);
    groupContainer.appendChild(childList);

    const controls = document.createElement('div');
    controls.className = 'flex flex-wrap gap-2 text-[11px]';
    const addRuleBtn = document.createElement('button');
    addRuleBtn.type = 'button';
    addRuleBtn.className = 'px-2 py-1 border rounded';
    addRuleBtn.style.borderColor = 'var(--border)';
    addRuleBtn.textContent = '新增策略規則';
    addRuleBtn.addEventListener('click', () => {
      openStrategyPicker(roleState, roleState.root);
    });
    controls.appendChild(addRuleBtn);

    const addGroupBtn = document.createElement('button');
    addGroupBtn.type = 'button';
    addGroupBtn.className = 'px-2 py-1 border rounded';
    addGroupBtn.style.borderColor = 'var(--border)';
    addGroupBtn.textContent = '新增群組';
    addGroupBtn.addEventListener('click', () => {
      const child = createGroupNode('AND');
      child.parentId = roleState.root.id;
      roleState.root.children.push(child);
      renderRole(roleState);
      notifyChange(roleState.role);
    });
    controls.appendChild(addGroupBtn);

    const toggleRootBtn = document.createElement('button');
    toggleRootBtn.type = 'button';
    toggleRootBtn.className = 'px-2 py-1 border rounded';
    toggleRootBtn.style.borderColor = 'var(--border)';
    toggleRootBtn.textContent = `根節點改為 ${roleState.root.operator === 'AND' ? 'OR' : roleState.root.operator === 'OR' ? 'NOT' : 'AND'}`;
    toggleRootBtn.addEventListener('click', () => {
      const next = roleState.root.operator === 'AND' ? 'OR' : roleState.root.operator === 'OR' ? 'NOT' : 'AND';
      roleState.root.operator = normaliseOperator(next);
      if (roleState.root.operator === 'NOT' && roleState.root.children.length > 1) {
        roleState.root.children = roleState.root.children.slice(0, 1);
      }
      renderRole(roleState);
      notifyChange(roleState.role);
    });
    controls.appendChild(toggleRootBtn);

    groupContainer.appendChild(controls);
    body.appendChild(groupContainer);
  }

  function init(options = {}) {
    const roles = Array.isArray(options.roles) ? options.roles : [];
    roles.forEach((roleConfig) => {
      const state = ensureRoleState(roleConfig.role);
      state.containerId = roleConfig.containerId || state.containerId;
      state.label = roleConfig.label || state.label;
      state.container = typeof document !== 'undefined' ? document.getElementById(state.containerId) : null;
      if (roleConfig.onChange && typeof roleConfig.onChange === 'function') {
        listeners.add(roleConfig.onChange);
      }
      renderRole(state);
    });
    if (typeof options.onChange === 'function') {
      listeners.add(options.onChange);
    }
  }

  function syncBaseStrategy(role, payload) {
    const roleState = ensureRoleState(role);
    roleState.baseStrategy = payload ? { ...payload } : null;
    renderRole(roleState);
    notifyChange(roleState.role);
  }

  function getRoleDsl(role) {
    const roleState = ensureRoleState(role);
    if (!roleState.useBuilder) {
      return null;
    }
    const node = serializeNode(roleState.root);
    return node;
  }

  function getDsl(version) {
    const payload = { version: version || globalScope.STRATEGY_DSL_VERSION || 'LB-STRATEGY-DSL-20260917A' };
    roleStateMap.forEach((roleState, role) => {
      const node = roleState.useBuilder ? serializeNode(roleState.root) : null;
      if (node) {
        if (role === 'entry') payload.longEntry = node;
        else if (role === 'exit') payload.longExit = node;
        else if (role === 'shortEntry') payload.shortEntry = node;
        else if (role === 'shortExit') payload.shortExit = node;
      }
    });
    return payload;
  }

  const api = {
    init,
    syncBaseStrategy,
    getRoleDsl,
    getDsl,
    __version__: EDITOR_VERSION,
    __test__: {
      serializeNode,
      normaliseOperator,
    },
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (typeof globalScope.lazybacktestStrategyDslEditor !== 'object') {
    globalScope.lazybacktestStrategyDslEditor = api;
  } else {
    Object.assign(globalScope.lazybacktestStrategyDslEditor, api);
  }
})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
