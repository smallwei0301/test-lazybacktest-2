// Strategy DSL Composer - LB-STRATEGY-COMPOSER-20260916A
(function (root) {
  const globalScope = root || (typeof self !== 'undefined' ? self : this);
  const API_VERSION = 'LB-STRATEGY-COMPOSER-20260916A';
  const DEFAULT_RESULT = Object.freeze({
    enter: false,
    exit: false,
    short: false,
    cover: false,
    stopLossPercent: null,
    takeProfitPercent: null,
    meta: {},
  });

  function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  function cloneSerializable(value, path = 'value') {
    if (value === null || value === undefined) {
      return value === undefined ? undefined : null;
    }
    if (typeof value === 'function') {
      throw new TypeError(`[StrategyDSL] ${path} 不可為函式`);
    }
    if (typeof value !== 'object') {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((item, index) => cloneSerializable(item, `${path}[${index}]`));
    }
    const clone = {};
    Object.keys(value).forEach((key) => {
      clone[key] = cloneSerializable(value[key], `${path}.${key}`);
    });
    return clone;
  }

  function ensureResultShape(candidate) {
    if (!candidate || typeof candidate !== 'object') {
      return { ...DEFAULT_RESULT };
    }
    const base = {
      ...DEFAULT_RESULT,
      enter: candidate.enter === true,
      exit: candidate.exit === true,
      short: candidate.short === true,
      cover: candidate.cover === true,
      stopLossPercent: isFiniteNumber(candidate.stopLossPercent)
        ? candidate.stopLossPercent
        : null,
      takeProfitPercent: isFiniteNumber(candidate.takeProfitPercent)
        ? candidate.takeProfitPercent
        : null,
      meta: candidate.meta && typeof candidate.meta === 'object' && candidate.meta !== null
        ? candidate.meta
        : {},
    };
    Object.keys(candidate).forEach((key) => {
      if (!(key in base)) {
        base[key] = candidate[key];
      }
    });
    return base;
  }

  function buildLogicalMeta(operator, childMetas) {
    const filtered = childMetas.filter((meta) => meta && typeof meta === 'object' && Object.keys(meta).length > 0);
    return {
      operator,
      nodes: filtered,
    };
  }

  function pickNumericFromResults(results, field, predicateResults, operator) {
    if (operator === 'OR') {
      for (let i = 0; i < results.length; i += 1) {
        const candidate = results[i];
        if (predicateResults[i] && isFiniteNumber(candidate[field])) {
          return candidate[field];
        }
      }
      return null;
    }
    if (operator === 'AND') {
      let selected = null;
      for (let i = 0; i < results.length; i += 1) {
        const candidate = results[i];
        if (isFiniteNumber(candidate[field])) {
          if (selected === null) {
            selected = candidate[field];
          } else {
            selected = Math.min(selected, candidate[field]);
          }
        }
      }
      return selected;
    }
    return null;
  }

  function combineAnd(results) {
    const normalised = results.map((item) => ensureResultShape(item));
    const enterList = normalised.map((item) => item.enter === true);
    const exitList = normalised.map((item) => item.exit === true);
    const shortList = normalised.map((item) => item.short === true);
    const coverList = normalised.map((item) => item.cover === true);
    const enter = enterList.every(Boolean);
    const exit = exitList.every(Boolean);
    const short = shortList.every(Boolean);
    const cover = coverList.every(Boolean);
    const stopLossPercent = enter
      ? pickNumericFromResults(normalised, 'stopLossPercent', enterList, 'AND')
      : null;
    const takeProfitPercent = enter
      ? pickNumericFromResults(normalised, 'takeProfitPercent', enterList, 'AND')
      : null;
    const meta = buildLogicalMeta('AND', normalised.map((item) => item.meta));
    return {
      ...DEFAULT_RESULT,
      enter,
      exit,
      short,
      cover,
      stopLossPercent,
      takeProfitPercent,
      meta,
    };
  }

  function combineOr(results) {
    const normalised = results.map((item) => ensureResultShape(item));
    const enterList = normalised.map((item) => item.enter === true);
    const exitList = normalised.map((item) => item.exit === true);
    const shortList = normalised.map((item) => item.short === true);
    const coverList = normalised.map((item) => item.cover === true);
    const enter = enterList.some(Boolean);
    const exit = exitList.some(Boolean);
    const short = shortList.some(Boolean);
    const cover = coverList.some(Boolean);
    const stopLossPercent = enter
      ? pickNumericFromResults(normalised, 'stopLossPercent', enterList, 'OR')
      : null;
    const takeProfitPercent = enter
      ? pickNumericFromResults(normalised, 'takeProfitPercent', enterList, 'OR')
      : null;
    const meta = buildLogicalMeta('OR', normalised.map((item) => item.meta));
    return {
      ...DEFAULT_RESULT,
      enter,
      exit,
      short,
      cover,
      stopLossPercent,
      takeProfitPercent,
      meta,
    };
  }

  function combineNot(result) {
    const normalised = ensureResultShape(result);
    const meta = buildLogicalMeta('NOT', [normalised.meta]);
    return {
      ...DEFAULT_RESULT,
      enter: !normalised.enter,
      exit: !normalised.exit,
      short: !normalised.short,
      cover: !normalised.cover,
      stopLossPercent: null,
      takeProfitPercent: null,
      meta,
    };
  }

  function normaliseNodeType(node) {
    if (!node || typeof node !== 'object') return null;
    if (typeof node.type === 'string' && node.type.trim()) {
      return node.type.trim().toUpperCase();
    }
    if (typeof node.op === 'string' && node.op.trim()) {
      return node.op.trim().toUpperCase();
    }
    if (typeof node.operator === 'string' && node.operator.trim()) {
      return node.operator.trim().toUpperCase();
    }
    if (typeof node.id === 'string' && node.id.trim()) {
      return 'PLUGIN';
    }
    return null;
  }

  function extractChildren(node, key = 'nodes') {
    if (!node) return [];
    const collection = node[key];
    if (Array.isArray(collection)) {
      return collection;
    }
    if (Array.isArray(node.children)) {
      return node.children;
    }
    if (key === 'nodes' && node.node && typeof node.node === 'object') {
      return [node.node];
    }
    return [];
  }

  function cloneDefinition(node, path = 'node') {
    const type = normaliseNodeType(node);
    if (!type) {
      throw new Error(`[StrategyDSL] ${path} 缺少節點類型`);
    }
    if (type === 'PLUGIN') {
      const rawId = typeof node.id === 'string' ? node.id.trim() : '';
      if (!rawId) {
        throw new Error(`[StrategyDSL] ${path} plugin 節點缺少 id`);
      }
      const inherit = node.inherit === true || node.params === undefined;
      const params = node.params === undefined ? undefined : cloneSerializable(node.params, `${path}.params`);
      return { type: 'PLUGIN', id: rawId, params, inherit: inherit === true };
    }
    if (type === 'NOT') {
      const child = node.node !== undefined ? node.node : extractChildren(node, 'nodes')[0];
      if (!child) {
        throw new Error(`[StrategyDSL] ${path} NOT 節點缺少子節點`);
      }
      return { type: 'NOT', node: cloneDefinition(child, `${path}.NOT`) };
    }
    if (type === 'AND' || type === 'OR') {
      const children = extractChildren(node, 'nodes');
      if (!Array.isArray(children) || children.length === 0) {
        throw new Error(`[StrategyDSL] ${path} ${type} 節點至少需要一個子節點`);
      }
      return {
        type,
        nodes: children.map((child, index) => cloneDefinition(child, `${path}.${type}[${index}]`)),
      };
    }
    throw new Error(`[StrategyDSL] ${path} 不支援的節點類型 ${type}`);
  }

  function buildComposite(rawNode, registry, options = {}) {
    if (!rawNode || typeof rawNode !== 'object') {
      throw new TypeError('[StrategyDSL] buildComposite 需要節點定義物件');
    }
    const role = typeof options.role === 'string' && options.role.trim()
      ? options.role.trim()
      : null;
    if (!role) {
      throw new Error('[StrategyDSL] buildComposite 需要指定 role');
    }
    const invoke = typeof options.invoke === 'function'
      ? options.invoke
      : null;
    if (!invoke) {
      throw new Error('[StrategyDSL] buildComposite 需要 invoke(strategy) 函式');
    }
    const baseParams = options.baseParams && typeof options.baseParams === 'object'
      ? cloneSerializable(options.baseParams, 'baseParams')
      : null;
    const pluginIds = new Set();
    const sanitizedDefinition = cloneDefinition(rawNode, 'root');

    function resolveParams(nodeDef, extraParams) {
      if (nodeDef.params === undefined) {
        if (!baseParams) {
          return extraParams ? { ...extraParams } : {};
        }
        return extraParams ? { ...baseParams, ...extraParams } : { ...baseParams };
      }
      if (nodeDef.inherit === true && baseParams) {
        const cloned = cloneSerializable(nodeDef.params, 'plugin.params');
        return { ...baseParams, ...cloned };
      }
      return cloneSerializable(nodeDef.params, 'plugin.params');
    }

    function buildNodeEvaluator(nodeDef) {
      if (!nodeDef) {
        return () => ({ ...DEFAULT_RESULT });
      }
      if (nodeDef.type === 'PLUGIN') {
        const pluginId = nodeDef.id;
        pluginIds.add(pluginId);
        const cachedParams = resolveParams(nodeDef);
        const pluginMeta = registry && typeof registry.getStrategyMetaById === 'function'
          ? registry.getStrategyMetaById(pluginId)
          : null;
        return function evaluatePlugin(index, extras) {
          const invocation = {
            id: pluginId,
            role,
            index,
            params: cachedParams,
            extras: extras || {},
            meta: pluginMeta || null,
          };
          const result = invoke(invocation);
          return ensureResultShape(result);
        };
      }
      if (nodeDef.type === 'NOT') {
        const evaluateChild = buildNodeEvaluator(nodeDef.node);
        return function evaluateNot(index, extras) {
          const childResult = evaluateChild(index, extras);
          return combineNot(childResult);
        };
      }
      if (nodeDef.type === 'AND' || nodeDef.type === 'OR') {
        const children = Array.isArray(nodeDef.nodes) ? nodeDef.nodes.map((child) => buildNodeEvaluator(child)) : [];
        if (children.length === 0) {
          return () => ({ ...DEFAULT_RESULT });
        }
        if (nodeDef.type === 'AND') {
          return function evaluateAnd(index, extras) {
            const results = children.map((evaluate) => evaluate(index, extras));
            return combineAnd(results);
          };
        }
        return function evaluateOr(index, extras) {
          const results = children.map((evaluate) => evaluate(index, extras));
          return combineOr(results);
        };
      }
      return () => ({ ...DEFAULT_RESULT });
    }

    const evaluateRoot = buildNodeEvaluator(sanitizedDefinition);

    return {
      __version__: API_VERSION,
      __role__: role,
      definition: sanitizedDefinition,
      evaluate(index, extras) {
        return ensureResultShape(evaluateRoot(index, extras));
      },
      collectPluginIds() {
        return Array.from(pluginIds);
      },
    };
  }

  const api = Object.freeze({
    __version__: API_VERSION,
    buildComposite,
  });

  if (globalScope && typeof globalScope === 'object') {
    globalScope.lazybacktestStrategyComposer = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this);
