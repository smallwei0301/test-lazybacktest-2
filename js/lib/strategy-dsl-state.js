// Strategy DSL State Manager - LB-DSL-STATE-20260918A
(function (root) {
  const globalScope = root || (typeof self !== 'undefined' ? self : this);
  const VERSION = 'LB-DSL-STATE-20260918A';
  const ROLE_KEYS = Object.freeze(['longEntry', 'longExit', 'shortEntry', 'shortExit']);

  function createRoleState() {
    return { mode: 'single', operator: 'AND', nodes: [] };
  }

  function createState() {
    const state = {};
    ROLE_KEYS.forEach((role) => {
      state[role] = createRoleState();
    });
    return state;
  }

  function ensureRoleState(state, role) {
    if (!state || typeof state !== 'object') {
      throw new TypeError('StrategyDslState 需要有效的 state 物件');
    }
    if (!ROLE_KEYS.includes(role)) {
      throw new Error(`StrategyDslState 不支援角色 ${role}`);
    }
    if (!state[role]) {
      state[role] = createRoleState();
    }
    return state[role];
  }

  function cloneParams(params) {
    if (!params || typeof params !== 'object') {
      return {};
    }
    if (Array.isArray(params)) {
      return params
        .filter((item) => item !== undefined && typeof item !== 'function')
        .map((item) => (typeof item === 'object' && item !== null ? cloneParams(item) : item));
    }
    const clone = {};
    Object.keys(params).forEach((key) => {
      const value = params[key];
      if (value === undefined || typeof value === 'function') {
        return;
      }
      if (value === null) {
        clone[key] = null;
      } else if (typeof value === 'object') {
        clone[key] = cloneParams(value);
      } else {
        clone[key] = value;
      }
    });
    return clone;
  }

  function createNode(id, params) {
    if (typeof id !== 'string' || !id.trim()) {
      throw new TypeError('StrategyDslState 節點需要有效的策略 ID');
    }
    const trimmedId = id.trim();
    const cleanParams = cloneParams(params);
    return { id: trimmedId, params: cleanParams, negate: false };
  }

  function setPrimaryPlugin(state, role, id, params) {
    const roleState = ensureRoleState(state, role);
    const node = createNode(id, params);
    if (roleState.mode === 'group' && roleState.nodes.length > 0) {
      roleState.nodes[0] = { ...roleState.nodes[0], id: node.id, params: node.params };
    } else {
      roleState.nodes = [node];
      roleState.mode = 'single';
      roleState.operator = 'AND';
    }
  }

  function addNode(state, role, id, params) {
    const roleState = ensureRoleState(state, role);
    const node = createNode(id, params);
    if (roleState.nodes.length === 0) {
      roleState.nodes.push(node);
      roleState.mode = 'single';
      return;
    }
    if (roleState.mode !== 'group') {
      roleState.mode = 'group';
      roleState.operator = roleState.operator === 'OR' ? 'OR' : 'AND';
    }
    roleState.nodes.push(node);
  }

  function removeNode(state, role, index) {
    const roleState = ensureRoleState(state, role);
    if (!Array.isArray(roleState.nodes) || roleState.nodes.length === 0) {
      return;
    }
    if (index < 0 || index >= roleState.nodes.length) {
      return;
    }
    roleState.nodes.splice(index, 1);
    if (roleState.nodes.length <= 1) {
      roleState.mode = 'single';
      roleState.operator = 'AND';
    }
  }

  function setOperator(state, role, operator) {
    const normalized = typeof operator === 'string' ? operator.toUpperCase() : '';
    if (normalized !== 'AND' && normalized !== 'OR') {
      throw new Error(`StrategyDslState 不支援的運算子 ${operator}`);
    }
    const roleState = ensureRoleState(state, role);
    roleState.mode = 'group';
    roleState.operator = normalized;
  }

  function toggleNegate(state, role, index) {
    const roleState = ensureRoleState(state, role);
    if (!roleState.nodes[index]) {
      return;
    }
    roleState.nodes[index].negate = !roleState.nodes[index].negate;
  }

  function reorderNode(state, role, fromIndex, toIndex) {
    const roleState = ensureRoleState(state, role);
    const nodes = roleState.nodes;
    if (!Array.isArray(nodes) || nodes.length === 0) {
      return;
    }
    if (fromIndex < 0 || fromIndex >= nodes.length || toIndex < 0 || toIndex >= nodes.length) {
      return;
    }
    if (fromIndex === toIndex) {
      return;
    }
    const [item] = nodes.splice(fromIndex, 1);
    nodes.splice(toIndex, 0, item);
  }

  function serializeNode(node) {
    const pluginNode = {
      type: 'plugin',
      id: node.id,
      params: cloneParams(node.params),
    };
    if (node.negate) {
      return { type: 'NOT', node: pluginNode };
    }
    return pluginNode;
  }

  function serializeRole(state, role) {
    const roleState = ensureRoleState(state, role);
    const nodes = Array.isArray(roleState.nodes) ? roleState.nodes : [];
    if (nodes.length === 0) {
      return null;
    }
    if (nodes.length === 1 && roleState.mode !== 'group') {
      return serializeNode(nodes[0]);
    }
    const operator = roleState.operator === 'OR' ? 'OR' : 'AND';
    return {
      type: operator,
      nodes: nodes.map(serializeNode),
    };
  }

  function serializeAll(state, version) {
    if (!state || typeof state !== 'object') {
      return null;
    }
    const payload = {};
    if (version) {
      payload.version = version;
    }
    ROLE_KEYS.forEach((role) => {
      const node = serializeRole(state, role);
      if (node) {
        payload[role] = node;
      }
    });
    const keys = Object.keys(payload);
    if (version && keys.length === 1 && keys[0] === 'version') {
      return null;
    }
    if (!version && keys.length === 0) {
      return null;
    }
    return payload;
  }

  const api = Object.freeze({
    __version__: VERSION,
    createState,
    setPrimaryPlugin,
    addNode,
    removeNode,
    setOperator,
    toggleNegate,
    reorderNode,
    serializeRole,
    serializeAll,
    ROLE_KEYS,
  });

  if (globalScope && typeof globalScope === 'object') {
    globalScope.lazybacktestStrategyDslState = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this);
