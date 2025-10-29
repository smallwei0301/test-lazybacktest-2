// Strategy DSL Editor State - LB-STRATEGY-DSL-STATE-20260922A
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    const globalScope = root || (typeof self !== 'undefined' ? self : this);
    if (globalScope) {
      Object.defineProperty(globalScope, 'lazybacktestStrategyDslState', {
        value: factory(),
        configurable: false,
        enumerable: true,
        writable: false,
      });
    }
  }
})(typeof self !== 'undefined' ? self : this, function strategyDslStateFactory() {
  const VERSION = 'LB-STRATEGY-DSL-STATE-20260922A';
  const ROLE_KEYS = ['longEntry', 'longExit', 'shortEntry', 'shortExit'];

  function createRoleState(base) {
    if (base && typeof base === 'object') {
      const operator = base.operator === 'OR' ? 'OR' : 'AND';
      const rules = Array.isArray(base.rules)
        ? base.rules.map((rule) => ({
            id: rule.id || null,
            params: rule.params && typeof rule.params === 'object' ? { ...rule.params } : {},
            negated: rule.negated === true,
          }))
        : [];
      return { operator, rules };
    }
    return { operator: 'AND', rules: [] };
  }

  function cloneState(state) {
    const source = state && typeof state === 'object' ? state : {};
    const version = typeof source.version === 'string' ? source.version : VERSION;
    const roles = {};
    ROLE_KEYS.forEach((role) => {
      roles[role] = createRoleState(source.roles && source.roles[role]);
    });
    return { version, roles };
  }

  function createState(version) {
    const stateVersion = typeof version === 'string' && version ? version : VERSION;
    return cloneState({ version: stateVersion, roles: {} });
  }

  function ensureRole(state, role) {
    if (!ROLE_KEYS.includes(role)) {
      throw new Error(`Unsupported role: ${role}`);
    }
    if (!state.roles[role]) {
      state.roles[role] = createRoleState();
    }
    return state.roles[role];
  }

  function setOperator(state, role, operator) {
    const next = cloneState(state);
    const roleState = ensureRole(next, role);
    roleState.operator = operator === 'OR' ? 'OR' : 'AND';
    return next;
  }

  function normaliseRule(rule) {
    if (!rule || typeof rule !== 'object') {
      return { id: null, params: {}, negated: false };
    }
    return {
      id: typeof rule.id === 'string' && rule.id.trim() ? rule.id.trim() : null,
      params: rule.params && typeof rule.params === 'object' ? { ...rule.params } : {},
      negated: rule.negated === true,
    };
  }

  function addRule(state, role, rule) {
    const next = cloneState(state);
    const roleState = ensureRole(next, role);
    roleState.rules = roleState.rules.concat([normaliseRule(rule)]);
    return next;
  }

  function updateRule(state, role, index, updates) {
    const next = cloneState(state);
    const roleState = ensureRole(next, role);
    if (index < 0 || index >= roleState.rules.length) {
      return next;
    }
    const current = roleState.rules[index];
    const patch = updates && typeof updates === 'object' ? updates : {};
    const merged = {
      id: Object.prototype.hasOwnProperty.call(patch, 'id')
        ? (typeof patch.id === 'string' && patch.id.trim() ? patch.id.trim() : null)
        : current.id,
      params: Object.prototype.hasOwnProperty.call(patch, 'params')
        ? (patch.params && typeof patch.params === 'object' ? { ...patch.params } : {})
        : { ...current.params },
      negated: Object.prototype.hasOwnProperty.call(patch, 'negated') ? Boolean(patch.negated) : current.negated,
    };
    const nextRules = roleState.rules.slice();
    nextRules[index] = merged;
    roleState.rules = nextRules;
    return next;
  }

  function removeRule(state, role, index) {
    const next = cloneState(state);
    const roleState = ensureRole(next, role);
    if (index < 0 || index >= roleState.rules.length) {
      return next;
    }
    roleState.rules = roleState.rules.filter((_, i) => i !== index);
    return next;
  }

  function toggleNegation(state, role, index) {
    const next = cloneState(state);
    const roleState = ensureRole(next, role);
    if (index < 0 || index >= roleState.rules.length) {
      return next;
    }
    const nextRules = roleState.rules.slice();
    const current = nextRules[index];
    nextRules[index] = { ...current, negated: !current.negated };
    roleState.rules = nextRules;
    return next;
  }

  function reorderRules(state, role, fromIndex, toIndex) {
    const next = cloneState(state);
    const roleState = ensureRole(next, role);
    const rules = roleState.rules.slice();
    if (
      fromIndex < 0 ||
      fromIndex >= rules.length ||
      toIndex < 0 ||
      toIndex >= rules.length ||
      fromIndex === toIndex
    ) {
      return next;
    }
    const [moved] = rules.splice(fromIndex, 1);
    rules.splice(toIndex, 0, moved);
    roleState.rules = rules;
    return next;
  }

  function buildRuleNode(rule) {
    if (!rule || !rule.id) {
      return null;
    }
    const base = { type: 'plugin', id: rule.id };
    if (rule.params && typeof rule.params === 'object' && Object.keys(rule.params).length > 0) {
      base.params = { ...rule.params };
    }
    if (rule.negated) {
      return { type: 'NOT', node: base };
    }
    return base;
  }

  function buildDsl(state) {
    const next = cloneState(state);
    const dsl = { version: next.version || VERSION };
    ROLE_KEYS.forEach((role) => {
      const roleState = ensureRole(next, role);
      const nodes = roleState.rules
        .map((rule) => buildRuleNode(rule))
        .filter((node) => node !== null);
      if (nodes.length === 0) {
        return;
      }
      if (nodes.length === 1) {
        dsl[role] = nodes[0];
        return;
      }
      dsl[role] = { type: roleState.operator === 'OR' ? 'OR' : 'AND', nodes };
    });
    return Object.keys(dsl).length > 1 ? dsl : null;
  }

  function collectRulesFromNode(node, collector, negated) {
    if (!node || typeof node !== 'object') {
      return;
    }
    const nodeType = typeof node.type === 'string' ? node.type : null;
    if (nodeType === 'NOT') {
      collectRulesFromNode(node.node, collector, !negated);
      return;
    }
    if (nodeType === 'AND' || nodeType === 'OR') {
      const nodes = Array.isArray(node.nodes) ? node.nodes : [];
      nodes.forEach((child) => collectRulesFromNode(child, collector, negated));
      return;
    }
    const id = typeof node.id === 'string' && node.id.trim() ? node.id.trim() : null;
    if (!id) {
      return;
    }
    const params = node.params && typeof node.params === 'object' ? { ...node.params } : {};
    collector.push({ id, params, negated: Boolean(negated) });
  }

  function createStateFromDsl(dsl, version) {
    const baseVersion = typeof version === 'string' && version
      ? version
      : (dsl && typeof dsl.version === 'string' ? dsl.version : VERSION);
    let state = createState(baseVersion);
    if (!dsl || typeof dsl !== 'object') {
      return state;
    }
    ROLE_KEYS.forEach((role) => {
      const node = dsl[role];
      if (!node || typeof node !== 'object') {
        return;
      }
      const containerType = typeof node.type === 'string' ? node.type : null;
      const nodes = (containerType === 'AND' || containerType === 'OR')
        ? (Array.isArray(node.nodes) ? node.nodes : [])
        : [node];
      const rules = [];
      nodes.forEach((child) => collectRulesFromNode(child, rules, false));
      if (rules.length === 0) {
        return;
      }
      let nextState = state;
      rules.forEach((rule) => {
        nextState = addRule(nextState, role, rule);
      });
      nextState = setOperator(nextState, role, containerType === 'OR' ? 'OR' : 'AND');
      state = nextState;
    });
    return state;
  }

  return Object.freeze({
    version: VERSION,
    createState,
    setOperator,
    addRule,
    updateRule,
    removeRule,
    toggleNegation,
    reorderRules,
    buildDsl,
    fromDsl: createStateFromDsl,
  });
});
