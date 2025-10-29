(function (root) {
  function cloneParams(value) {
    if (!value || typeof value !== 'object') {
      return {};
    }
    return JSON.parse(JSON.stringify(value));
  }

  const ROLE_KEYS = ['longEntry', 'longExit', 'shortEntry', 'shortExit'];
  const VALID_OPERATORS = ['SINGLE', 'AND', 'OR', 'NOT'];

  function createRoleState() {
    return { operator: 'SINGLE', nodes: [] };
  }

  function create(options = {}) {
    const registry = options.registry || (root && root.StrategyPluginRegistry);
    if (!registry || typeof registry.getStrategyMetaById !== 'function') {
      throw new Error('StrategyPluginRegistry 未就緒');
    }
    const paramApi = options.paramApi || (root && root.lazybacktestParamSchema);
    if (!paramApi || typeof paramApi.sanitiseParams !== 'function') {
      throw new Error('Param schema API 未提供 sanitiseParams');
    }
    const version = typeof options.version === 'string' && options.version.trim()
      ? options.version.trim()
      : 'LB-STRATEGY-DSL-20260916A';

    let state = {
      longEntry: createRoleState(),
      longExit: createRoleState(),
      shortEntry: createRoleState(),
      shortExit: createRoleState(),
    };

    const listeners = new Set();

    function emit() {
      const snapshot = getState();
      listeners.forEach((listener) => {
        try {
          listener(snapshot);
        } catch (error) {
          if (typeof console !== 'undefined' && console.error) {
            console.error('[StrategyDslState] listener error', error);
          }
        }
      });
    }

    function subscribe(listener) {
      if (typeof listener !== 'function') {
        return () => {};
      }
      listeners.add(listener);
      return () => listeners.delete(listener);
    }

    function getState() {
      return JSON.parse(JSON.stringify(state));
    }

    function resolveMeta(id) {
      if (!id || typeof id !== 'string') {
        return null;
      }
      try {
        const meta = registry.getStrategyMetaById(id);
        return meta || null;
      } catch (error) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[StrategyDslState] 無法取得策略定義', id, error);
        }
        return null;
      }
    }

    function sanitisePlugin(id, params) {
      const meta = resolveMeta(id);
      if (!meta) {
        return null;
      }
      const schema = meta.paramsSchema || null;
      if (schema) {
        const result = paramApi.sanitiseParams(schema, params || {});
        return {
          id: meta.id,
          label: meta.label,
          params: result.values,
          errors: result.errors || [],
        };
      }
      const payload = params && typeof params === 'object' ? params : {};
      return {
        id: meta.id,
        label: meta.label,
        params: cloneParams(payload),
        errors: [],
      };
    }

    function ensureRoleKey(roleKey) {
      return ROLE_KEYS.includes(roleKey) ? roleKey : null;
    }

    function updateRoleState(roleKey, updater) {
      const validKey = ensureRoleKey(roleKey);
      if (!validKey || typeof updater !== 'function') {
        return;
      }
      const next = updater(state[validKey] || createRoleState());
      if (!next) {
        return;
      }
      state = { ...state, [validKey]: next };
      emit();
    }

    function setOperator(roleKey, operator) {
      const validKey = ensureRoleKey(roleKey);
      if (!validKey) return;
      const op = typeof operator === 'string' ? operator.trim().toUpperCase() : 'SINGLE';
      if (!VALID_OPERATORS.includes(op)) {
        return;
      }
      updateRoleState(validKey, (current) => {
        const next = {
          operator: op,
          nodes: op === 'AND' || op === 'OR' ? current.nodes.slice() : [],
        };
        return next;
      });
    }

    function addNode(roleKey, pluginId, params) {
      const validKey = ensureRoleKey(roleKey);
      if (!validKey) return;
      const sanitised = sanitisePlugin(pluginId, params);
      if (!sanitised) return;
      updateRoleState(validKey, (current) => {
        const nodes = Array.isArray(current.nodes) ? current.nodes.slice() : [];
        nodes.push({ id: sanitised.id, params: sanitised.params, errors: sanitised.errors });
        return { operator: current.operator, nodes };
      });
    }

    function replaceNode(roleKey, index, pluginId, params) {
      const validKey = ensureRoleKey(roleKey);
      if (!validKey) return;
      const sanitised = sanitisePlugin(pluginId, params);
      if (!sanitised) return;
      updateRoleState(validKey, (current) => {
        const nodes = Array.isArray(current.nodes) ? current.nodes.slice() : [];
        if (index < 0 || index >= nodes.length) {
          return current;
        }
        nodes[index] = { id: sanitised.id, params: sanitised.params, errors: sanitised.errors };
        return { operator: current.operator, nodes };
      });
    }

    function updateNodeParams(roleKey, index, params) {
      const validKey = ensureRoleKey(roleKey);
      if (!validKey) return;
      updateRoleState(validKey, (current) => {
        const nodes = Array.isArray(current.nodes) ? current.nodes.slice() : [];
        if (index < 0 || index >= nodes.length) {
          return current;
        }
        const node = nodes[index];
        const sanitised = sanitisePlugin(node.id, params);
        if (!sanitised) {
          return current;
        }
        nodes[index] = { id: sanitised.id, params: sanitised.params, errors: sanitised.errors };
        return { operator: current.operator, nodes };
      });
    }

    function removeNode(roleKey, index) {
      const validKey = ensureRoleKey(roleKey);
      if (!validKey) return;
      updateRoleState(validKey, (current) => {
        const nodes = Array.isArray(current.nodes) ? current.nodes.slice() : [];
        if (index < 0 || index >= nodes.length) {
          return current;
        }
        nodes.splice(index, 1);
        return { operator: current.operator, nodes };
      });
    }

  function buildPluginNode(entry) {
      if (!entry || !entry.id) {
        return null;
      }
      const sanitised = sanitisePlugin(entry.id, entry.params || {});
      if (!sanitised) {
        return null;
      }
      const paramsClone = cloneParams(sanitised.params);
      return { type: 'plugin', id: sanitised.id, params: paramsClone };
    }

    function loadFromDsl(definition) {
      const nextState = {
        longEntry: createRoleState(),
        longExit: createRoleState(),
        shortEntry: createRoleState(),
        shortExit: createRoleState(),
      };

      if (!definition || typeof definition !== 'object') {
        state = nextState;
        emit();
        return;
      }

      ROLE_KEYS.forEach((roleKey) => {
        const node = definition[roleKey];
        if (!node || typeof node !== 'object') {
          nextState[roleKey] = createRoleState();
          return;
        }
        const typeRaw = typeof node.type === 'string'
          ? node.type.trim().toUpperCase()
          : typeof node.op === 'string'
            ? node.op.trim().toUpperCase()
            : typeof node.operator === 'string'
              ? node.operator.trim().toUpperCase()
              : null;
        if (typeRaw === 'NOT') {
          nextState[roleKey] = { operator: 'NOT', nodes: [] };
          return;
        }
        if (typeRaw === 'AND' || typeRaw === 'OR') {
          const children = Array.isArray(node.nodes)
            ? node.nodes
            : Array.isArray(node.children)
              ? node.children
              : [];
          const extras = [];
          children.slice(1).forEach((child) => {
            if (!child || typeof child !== 'object') {
              return;
            }
            const sanitised = sanitisePlugin(child.id, child.params || {});
            if (sanitised) {
              extras.push({ id: sanitised.id, params: sanitised.params, errors: sanitised.errors || [] });
            }
          });
          nextState[roleKey] = { operator: typeRaw, nodes: extras };
          return;
        }
        nextState[roleKey] = createRoleState();
      });

      state = nextState;
      emit();
    }

    function buildDsl(primaryMap = {}) {
      const result = { version };
      let hasRole = false;

      ROLE_KEYS.forEach((roleKey) => {
        const primary = primaryMap[roleKey];
        if (!primary || !primary.id) {
          return;
        }
        const primaryNode = buildPluginNode(primary);
        if (!primaryNode) {
          return;
        }
        const roleState = state[roleKey] || createRoleState();
        const operator = roleState.operator || 'SINGLE';
        const extraNodes = Array.isArray(roleState.nodes) ? roleState.nodes : [];

        if (operator === 'NOT') {
          result[roleKey] = { type: 'NOT', node: primaryNode };
          hasRole = true;
          return;
        }

        const logicalExtras = extraNodes
          .map((entry) => buildPluginNode(entry))
          .filter((node) => node);

        if ((operator === 'AND' || operator === 'OR') && logicalExtras.length > 0) {
          const nodes = [primaryNode, ...logicalExtras];
          result[roleKey] = { type: operator, nodes };
          hasRole = true;
          return;
        }

        result[roleKey] = primaryNode;
        hasRole = true;
      });

      return hasRole ? result : null;
    }

    return {
      getState,
      subscribe,
      setOperator,
      addNode,
      replaceNode,
      updateNodeParams,
      removeNode,
      buildDsl,
      loadFromDsl,
    };
  }

  const api = Object.freeze({ create });

  if (root && typeof root === 'object') {
    root.lazybacktestStrategyDslState = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this);
