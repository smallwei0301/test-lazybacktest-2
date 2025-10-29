(function (root, factory) {
  const exported = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = exported;
  }
  if (root) {
    root.LazyStrategyDslEditor = exported;
  }
})(typeof self !== 'undefined' ? self : this, function createDslEditorFactory() {
  function cloneNode(node) {
    if (!node || typeof node !== 'object') {
      return null;
    }
    if (node.type === 'plugin') {
      const cloned = { type: 'plugin', id: node.id };
      if (node.params && typeof node.params === 'object') {
        cloned.params = JSON.parse(JSON.stringify(node.params));
      }
      return cloned;
    }
    if (node.type === 'NOT') {
      return { type: 'NOT', node: cloneNode(node.node) };
    }
    if (node.type === 'AND' || node.type === 'OR') {
      const nodes = Array.isArray(node.nodes) ? node.nodes.map(cloneNode) : [];
      return { type: node.type, nodes };
    }
    return JSON.parse(JSON.stringify(node));
  }

  function collapseIfSingle(node) {
    if (!node) return null;
    if ((node.type === 'AND' || node.type === 'OR') && Array.isArray(node.nodes)) {
      const filtered = node.nodes.filter(Boolean);
      if (filtered.length === 0) {
        return null;
      }
      if (filtered.length === 1) {
        return filtered[0];
      }
      return { type: node.type, nodes: filtered };
    }
    if (node.type === 'NOT' && node.node) {
      return { type: 'NOT', node: collapseIfSingle(node.node) };
    }
    return node;
  }

  function createState(initialDsl) {
    const base = {
      version: initialDsl && initialDsl.version ? initialDsl.version : null,
      roles: {
        longEntry: null,
        longExit: null,
        shortEntry: null,
        shortExit: null,
      },
    };
    if (initialDsl && typeof initialDsl === 'object') {
      ['longEntry', 'longExit', 'shortEntry', 'shortExit'].forEach((role) => {
        if (initialDsl[role]) {
          base.roles[role] = cloneNode(initialDsl[role]);
        }
      });
    }
    return base;
  }

  function cloneState(state) {
    const cloned = {
      version: state && state.version ? state.version : null,
      roles: {
        longEntry: null,
        longExit: null,
        shortEntry: null,
        shortExit: null,
      },
    };
    if (state && state.roles) {
      ['longEntry', 'longExit', 'shortEntry', 'shortExit'].forEach((role) => {
        if (state.roles[role]) {
          cloned.roles[role] = cloneNode(state.roles[role]);
        }
      });
    }
    return cloned;
  }

  function insertPluginIntoNode(node, plugin, path) {
    const targetPath = Array.isArray(path) ? path.slice() : [];
    if (!node) {
      return plugin;
    }
    if (targetPath.length === 0) {
      if (node.type === 'plugin') {
        return { type: 'AND', nodes: [cloneNode(node), plugin] };
      }
      if (node.type === 'AND' || node.type === 'OR') {
        const nodes = Array.isArray(node.nodes) ? node.nodes.map(cloneNode) : [];
        nodes.push(plugin);
        return { type: node.type, nodes };
      }
      if (node.type === 'NOT') {
        return { type: 'NOT', node: insertPluginIntoNode(cloneNode(node.node), plugin, targetPath) };
      }
      return plugin;
    }

    const [key, ...rest] = targetPath;
    const cloned = cloneNode(node) || plugin;
    if (key === 'nodes') {
      const childIndex = typeof rest[0] === 'number' ? rest[0] : undefined;
      if (!Array.isArray(cloned.nodes)) {
        cloned.nodes = [];
      }
      if (childIndex === undefined || rest.length === 0) {
        const nodes = cloned.nodes.map(cloneNode);
        nodes.push(plugin);
        cloned.nodes = nodes;
        return cloned;
      }
      const [index, ...childRest] = rest;
      cloned.nodes = cloned.nodes.map((child, idx) => {
        if (idx === index) {
          return insertPluginIntoNode(child, plugin, childRest);
        }
        return cloneNode(child);
      });
      return cloned;
    }
    if (key === 'node') {
      cloned.node = insertPluginIntoNode(cloneNode(cloned.node), plugin, rest);
      return cloned;
    }
    return cloned;
  }

  function appendPlugin(state, role, pluginNode, options = {}) {
    if (!pluginNode || pluginNode.type !== 'plugin') {
      throw new TypeError('appendPlugin 需要 plugin 節點');
    }
    const newState = cloneState(state || createState());
    const roleKey = role in newState.roles ? role : 'longEntry';
    const plugin = cloneNode(pluginNode);
    const current = newState.roles[roleKey];
    const updated = insertPluginIntoNode(current, plugin, options.path);
    newState.roles[roleKey] = collapseIfSingle(updated);
    return newState;
  }

  function setSinglePlugin(state, role, pluginNode) {
    const newState = cloneState(state || createState());
    const roleKey = role in newState.roles ? role : 'longEntry';
    if (!pluginNode) {
      newState.roles[roleKey] = null;
      return newState;
    }
    if (pluginNode.type !== 'plugin') {
      throw new TypeError('setSinglePlugin 需要 plugin 節點或 null');
    }
    newState.roles[roleKey] = cloneNode(pluginNode);
    return newState;
  }

  function setRootOperator(state, role, operator) {
    if (!['AND', 'OR'].includes(operator)) {
      throw new Error('setRootOperator 僅支援 AND/OR');
    }
    const newState = cloneState(state || createState());
    const roleKey = role in newState.roles ? role : 'longEntry';
    const root = newState.roles[roleKey];
    if (!root) {
      newState.roles[roleKey] = { type: operator, nodes: [] };
      return newState;
    }
    if (root.type === 'NOT') {
      newState.roles[roleKey] = { type: 'NOT', node: setRootOperator({ roles: { [roleKey]: root.node } }, roleKey, operator).roles[roleKey] };
      return newState;
    }
    if (root.type === 'AND' || root.type === 'OR') {
      newState.roles[roleKey] = { type: operator, nodes: (root.nodes || []).map(cloneNode) };
      return newState;
    }
    newState.roles[roleKey] = { type: operator, nodes: [cloneNode(root)] };
    return newState;
  }

  function toggleRootNot(state, role) {
    const newState = cloneState(state || createState());
    const roleKey = role in newState.roles ? role : 'longEntry';
    const root = newState.roles[roleKey];
    if (!root) {
      return newState;
    }
    if (root.type === 'NOT') {
      newState.roles[roleKey] = root.node ? cloneNode(root.node) : null;
      return newState;
    }
    newState.roles[roleKey] = { type: 'NOT', node: cloneNode(root) };
    return newState;
  }

  function removeNode(state, role, path) {
    const newState = cloneState(state || createState());
    const roleKey = role in newState.roles ? role : 'longEntry';
    if (!Array.isArray(path) || path.length === 0) {
      newState.roles[roleKey] = null;
      return newState;
    }
    const root = cloneNode(newState.roles[roleKey]);
    if (!root) {
      return newState;
    }

    function removeRecursive(node, remainingPath) {
      if (!node) return null;
      if (remainingPath.length === 0) {
        return null;
      }
      const [key, ...rest] = remainingPath;
      const cloned = cloneNode(node);
      if (key === 'nodes' && Array.isArray(cloned.nodes)) {
        if (rest.length === 0) {
          return cloned;
        }
        const [index, ...childRest] = rest;
        if (typeof index === 'number') {
          if (childRest.length === 0) {
            const nodes = cloned.nodes.slice();
            nodes.splice(index, 1);
            cloned.nodes = nodes;
            return collapseIfSingle(cloned);
          }
          cloned.nodes = cloned.nodes.map((child, idx) => {
            if (idx === index) {
              return removeRecursive(child, childRest);
            }
            return cloneNode(child);
          });
          return collapseIfSingle(cloned);
        }
        return cloned;
      }
      if (key === 'node') {
        cloned.node = removeRecursive(cloned.node, rest);
        return collapseIfSingle(cloned);
      }
      return cloned;
    }

    newState.roles[roleKey] = collapseIfSingle(removeRecursive(root, path)) || null;
    return newState;
  }

  function toStrategyDsl(state, version) {
    const dsl = {};
    const resolvedVersion = version || (state && state.version) || null;
    if (resolvedVersion) {
      dsl.version = resolvedVersion;
    }
    if (!state || !state.roles) {
      return dsl;
    }
    ['longEntry', 'longExit', 'shortEntry', 'shortExit'].forEach((role) => {
      const node = state.roles[role];
      if (node) {
        dsl[role] = cloneNode(node);
      }
    });
    return dsl;
  }

  return {
    createState,
    appendPlugin,
    setSinglePlugin,
    setRootOperator,
    toggleRootNot,
    removeNode,
    toStrategyDsl,
  };
});
