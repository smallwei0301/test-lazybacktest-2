// Strategy DSL State Helpers - LB-DSL-FORM-20260920A
(function (root) {
  const globalScope = root || (typeof self !== 'undefined' ? self : this);
  const DEFAULT_VERSION = 'LB-STRATEGY-DSL-20260916A';

  function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function cloneParams(params) {
    if (!isPlainObject(params)) {
      return undefined;
    }
    const entries = Object.entries(params).filter(([key, value]) => {
      if (typeof value === 'function') {
        return false;
      }
      if (value === undefined) {
        return false;
      }
      return true;
    });
    if (entries.length === 0) {
      return undefined;
    }
    const clone = {};
    entries.forEach(([key, value]) => {
      if (isPlainObject(value)) {
        clone[key] = cloneParams(value) || {};
      } else if (Array.isArray(value)) {
        clone[key] = value.slice();
      } else {
        clone[key] = value;
      }
    });
    return clone;
  }

  function buildPluginNode(node) {
    if (!isPlainObject(node)) {
      return null;
    }
    const id = typeof node.id === 'string' ? node.id.trim() : '';
    if (!id) {
      return null;
    }
    const params = cloneParams(node.params);
    const pluginNode = { type: 'plugin', id };
    if (params && Object.keys(params).length > 0) {
      pluginNode.params = params;
    }
    return pluginNode;
  }

  function wrapWithNegation(node, negate) {
    if (!negate) {
      return node;
    }
    return { type: 'NOT', node };
  }

  function buildRoleNode(roleState) {
    if (!isPlainObject(roleState)) {
      return null;
    }
    const operatorRaw = typeof roleState.operator === 'string' ? roleState.operator.trim().toUpperCase() : 'AND';
    const nodes = Array.isArray(roleState.nodes) ? roleState.nodes : [];
    const pluginNodes = nodes
      .map((entry) => {
        const plugin = buildPluginNode(entry);
        if (!plugin) {
          return null;
        }
        const negate = Boolean(entry.negate);
        if (operatorRaw === 'NOT') {
          return { plugin, negate: false };
        }
        return { plugin, negate };
      })
      .filter(Boolean);

    if (pluginNodes.length === 0) {
      return null;
    }

    if (operatorRaw === 'NOT') {
      const target = pluginNodes[0].plugin;
      return { type: 'NOT', node: target };
    }

    const logicalNode = {
      type: operatorRaw === 'OR' ? 'OR' : 'AND',
      nodes: pluginNodes.map(({ plugin, negate }) => wrapWithNegation(plugin, negate)),
    };
    return logicalNode;
  }

  function buildDslFromState(state, options) {
    const config = isPlainObject(options) ? options : {};
    const version = typeof config.version === 'string'
      ? config.version
      : (typeof state?.version === 'string' ? state.version : DEFAULT_VERSION);

    const roles = {
      longEntry: state?.longEntry,
      longExit: state?.longExit,
      shortEntry: state?.shortEntry,
      shortExit: state?.shortExit,
    };

    const dsl = { version };
    let hasNode = false;

    Object.keys(roles).forEach((roleKey) => {
      const roleNode = buildRoleNode(roles[roleKey]);
      if (roleNode) {
        dsl[roleKey] = roleNode;
        hasNode = true;
      }
    });

    if (!hasNode) {
      return null;
    }

    return dsl;
  }

  const api = Object.freeze({
    DEFAULT_VERSION,
    buildDslFromState,
  });

  if (globalScope && typeof globalScope === 'object') {
    globalScope.LazyStrategyDslState = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this);
