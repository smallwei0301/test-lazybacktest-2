// Patch Tag: LB-STRATEGY-COMPOSER-20261010A
(function (root) {
  const globalScope = root || (typeof self !== 'undefined' ? self : this);
  if (!globalScope) {
    return;
  }

  const COMPOSER_VERSION = 'LB-STRATEGY-COMPOSER-20261010A';
  const contract = globalScope.StrategyPluginContract || null;

  function createEmptyResult() {
    return {
      enter: false,
      exit: false,
      short: false,
      cover: false,
      stopLossPercent: null,
      takeProfitPercent: null,
      meta: {},
    };
  }

  function cloneMeta(meta) {
    if (!meta || typeof meta !== 'object') {
      return {};
    }
    try {
      return JSON.parse(JSON.stringify(meta));
    } catch (error) {
      return { ...meta };
    }
  }

  function inheritRiskAndMeta(target, providers) {
    if (!Array.isArray(providers) || providers.length === 0) {
      return;
    }
    for (let i = 0; i < providers.length; i += 1) {
      const candidate = providers[i];
      if (!candidate || typeof candidate !== 'object') {
        continue;
      }
      if (
        target.stopLossPercent === null &&
        typeof candidate.stopLossPercent === 'number' &&
        Number.isFinite(candidate.stopLossPercent)
      ) {
        target.stopLossPercent = candidate.stopLossPercent;
      }
      if (
        target.takeProfitPercent === null &&
        typeof candidate.takeProfitPercent === 'number' &&
        Number.isFinite(candidate.takeProfitPercent)
      ) {
        target.takeProfitPercent = candidate.takeProfitPercent;
      }
      if (
        (!target.meta || Object.keys(target.meta).length === 0) &&
        candidate.meta &&
        typeof candidate.meta === 'object'
      ) {
        target.meta = cloneMeta(candidate.meta);
      }
      if (
        target.stopLossPercent !== null &&
        target.takeProfitPercent !== null &&
        target.meta &&
        Object.keys(target.meta).length > 0
      ) {
        break;
      }
    }
  }

  function normaliseRuleResult(result, info) {
    if (!contract || typeof contract.ensureRuleResult !== 'function') {
      const base = createEmptyResult();
      if (!result || typeof result !== 'object') {
        return base;
      }
      return Object.assign(base, {
        enter: result.enter === true,
        exit: result.exit === true,
        short: result.short === true,
        cover: result.cover === true,
        stopLossPercent:
          typeof result.stopLossPercent === 'number' &&
          Number.isFinite(result.stopLossPercent)
            ? result.stopLossPercent
            : null,
        takeProfitPercent:
          typeof result.takeProfitPercent === 'number' &&
          Number.isFinite(result.takeProfitPercent)
            ? result.takeProfitPercent
            : null,
        meta: result.meta && typeof result.meta === 'object' ? result.meta : {},
      });
    }
    return contract.ensureRuleResult(result, info);
  }

  function resolveRegistry(registry) {
    if (registry && typeof registry === 'object') {
      return registry;
    }
    const globalRegistry = globalScope.StrategyPluginRegistry;
    if (globalRegistry && typeof globalRegistry === 'object') {
      return globalRegistry;
    }
    throw new Error('StrategyPluginRegistry 尚未載入');
  }

  function createPluginNode(node, registry) {
    if (!node || typeof node !== 'object') {
      throw new TypeError('Plugin 節點必須為物件');
    }
    const pluginId = typeof node.id === 'string' ? node.id.trim() : '';
    if (!pluginId) {
      throw new TypeError('Plugin 節點缺少 id');
    }
    const specifiedRole = typeof node.role === 'string' ? node.role : null;
    const params = node.params && typeof node.params === 'object' ? { ...node.params } : {};
    const registryRef = resolveRegistry(registry);
    let cachedPlugin = null;

    function ensurePluginLoaded() {
      if (cachedPlugin && typeof cachedPlugin.run === 'function') {
        return cachedPlugin;
      }
      if (
        registryRef &&
        typeof registryRef.getStrategyById === 'function'
      ) {
        cachedPlugin = registryRef.getStrategyById(pluginId) || cachedPlugin;
      }
      if (
        (!cachedPlugin || typeof cachedPlugin.run !== 'function') &&
        registryRef &&
        typeof registryRef.ensureStrategyLoaded === 'function'
      ) {
        cachedPlugin =
          registryRef.ensureStrategyLoaded(pluginId) || cachedPlugin;
      }
      if (!cachedPlugin || typeof cachedPlugin.run !== 'function') {
        throw new Error(`找不到策略插件 ${pluginId}`);
      }
      return cachedPlugin;
    }

    let lastIndex = null;
    let lastRole = null;
    let lastResult = null;

    return function evaluatePlugin(context) {
      if (!context || typeof context !== 'object') {
        throw new TypeError('缺少策略執行上下文');
      }
      const role = specifiedRole || context.role;
      if (typeof role !== 'string' || role.length === 0) {
        throw new TypeError(`策略節點 ${pluginId} 缺少 role`);
      }
      const index = Number(context.index);
      if (Number.isFinite(index) && index === lastIndex && role === lastRole) {
        return lastResult;
      }

      if (typeof context.invokePlugin === 'function') {
        const invoked = context.invokePlugin(pluginId, role, params, node.runtime);
        const normalised = normaliseRuleResult(invoked, {
          pluginId,
          role,
          index,
        });
        lastIndex = index;
        lastRole = role;
        lastResult = normalised;
        return normalised;
      }

      const plugin = ensurePluginLoaded();
      const pluginContext = {
        role,
        index,
        series: context.series,
        helpers: context.helpers,
        runtime: context.runtime,
      };
      const output = plugin.run(pluginContext, params);
      const normalised = normaliseRuleResult(output, {
        pluginId,
        role,
        index,
      });
      lastIndex = index;
      lastRole = role;
      lastResult = normalised;
      return normalised;
    };
  }

  function createCompositeNode(node, registry) {
    if (!node || typeof node !== 'object') {
      throw new TypeError('DSL 節點必須為物件');
    }
    const type = typeof node.type === 'string' ? node.type.toUpperCase() : '';
    if (type === 'PLUGIN') {
      return createPluginNode(node, registry);
    }
    if (type === 'NOT') {
      const child = createCompositeNode(node.node || node.child, registry);
      return function evaluateNot(context) {
        const result = child(context);
        const inverted = createEmptyResult();
        inverted.enter = !result.enter;
        inverted.exit = !result.exit;
        inverted.short = !result.short;
        inverted.cover = !result.cover;
        inverted.meta = {};
        return inverted;
      };
    }
    const rawChildren = Array.isArray(node.nodes)
      ? node.nodes
      : Array.isArray(node.children)
        ? node.children
        : [];
    if (rawChildren.length === 0) {
      return function noopEvaluator() {
        return createEmptyResult();
      };
    }
    const children = rawChildren.map((child) =>
      createCompositeNode(child, registry),
    );
    if (type === 'AND') {
      return function evaluateAnd(context) {
        const childResults = children.map((fn) => fn(context));
        const finalResult = createEmptyResult();
        const providers = [];
        const fields = ['enter', 'exit', 'short', 'cover'];
        fields.forEach((field) => {
          const values = childResults.map((res) => res[field] === true);
          const allTrue = values.length > 0 && values.every(Boolean);
          finalResult[field] = allTrue;
          if (allTrue) {
            const idx = values.findIndex(Boolean);
            if (idx >= 0) {
              providers.push(childResults[idx]);
            }
          }
        });
        inheritRiskAndMeta(finalResult, providers);
        return finalResult;
      };
    }
    if (type === 'OR') {
      return function evaluateOr(context) {
        const childResults = children.map((fn) => fn(context));
        const finalResult = createEmptyResult();
        const providers = [];
        const fields = ['enter', 'exit', 'short', 'cover'];
        fields.forEach((field) => {
          const values = childResults.map((res) => res[field] === true);
          const anyTrue = values.some(Boolean);
          finalResult[field] = anyTrue;
          if (anyTrue) {
            const idx = values.findIndex(Boolean);
            if (idx >= 0) {
              providers.push(childResults[idx]);
            }
          }
        });
        inheritRiskAndMeta(finalResult, providers);
        return finalResult;
      };
    }
    throw new Error(`未知的 DSL 節點型別: ${node.type}`);
  }

  function buildComposite(json, registry) {
    if (!json || typeof json !== 'object') {
      throw new TypeError('Strategy DSL 必須為物件');
    }
    const evaluator = createCompositeNode(json, registry);
    return function executeComposite(context) {
      const result = evaluator(context || {});
      return normaliseRuleResult(result, {
        pluginId: json && typeof json.id === 'string' ? json.id : undefined,
        role: context?.role,
        index: context?.index,
      });
    };
  }

  const api = {
    buildComposite,
    version: COMPOSER_VERSION,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  Object.defineProperty(globalScope, 'LazyStrategyComposer', {
    value: api,
    writable: false,
    enumerable: true,
    configurable: false,
  });
})(typeof self !== 'undefined' ? self : this);
