// Patch Tag: LB-DSL-COMPOSER-20260919A
(function (root) {
  const globalScope = root || (typeof globalThis !== 'undefined' ? globalThis : {});
  const VERSION = 'LB-DSL-COMPOSER-20260919A';

  function cloneMeta(sourceList) {
    const merged = {};
    sourceList.forEach((src) => {
      if (!src || typeof src !== 'object') {
        return;
      }
      Object.keys(src).forEach((key) => {
        const value = src[key];
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          merged[key] = { ...(merged[key] && typeof merged[key] === 'object' ? merged[key] : {}), ...value };
        } else if (Array.isArray(value)) {
          merged[key] = value.slice();
        } else {
          merged[key] = value;
        }
      });
    });
    return merged;
  }

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

  function toFinitePercent(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  function normaliseRuleResult(candidate, context) {
    if (!candidate || typeof candidate !== 'object') {
      throw new TypeError(`[StrategyComposer] ${context} 必須回傳物件`);
    }
    const result = createEmptyResult();
    const booleanKeys = ['enter', 'exit', 'short', 'cover'];
    booleanKeys.forEach((key) => {
      if (key in candidate && candidate[key] !== undefined) {
        if (typeof candidate[key] !== 'boolean') {
          throw new TypeError(`[StrategyComposer] ${context}.${key} 必須為布林值`);
        }
        result[key] = candidate[key];
      }
    });
    if ('stopLossPercent' in candidate && candidate.stopLossPercent !== undefined) {
      const numeric = toFinitePercent(candidate.stopLossPercent);
      if (numeric === null || numeric < 0 || numeric > 100) {
        throw new TypeError(`[StrategyComposer] ${context}.stopLossPercent 需為 0~100 之間數值或省略`);
      }
      result.stopLossPercent = numeric;
    }
    if ('takeProfitPercent' in candidate && candidate.takeProfitPercent !== undefined) {
      const numeric = toFinitePercent(candidate.takeProfitPercent);
      if (numeric === null || numeric < 0 || numeric > 1000) {
        throw new TypeError(`[StrategyComposer] ${context}.takeProfitPercent 需為 0~1000 之間數值或省略`);
      }
      result.takeProfitPercent = numeric;
    }
    if ('meta' in candidate) {
      const meta = candidate.meta;
      if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
        throw new TypeError(`[StrategyComposer] ${context}.meta 必須為物件`);
      }
      result.meta = meta;
    }
    return result;
  }

  function pickFirstPercent(results, key) {
    for (let i = 0; i < results.length; i += 1) {
      const value = results[i] && results[i][key];
      if (value !== null && value !== undefined) {
        return value;
      }
    }
    return null;
  }

  function ensureChildrenArray(node, contextLabel) {
    const list = Array.isArray(node?.children) ? node.children : node?.nodes;
    if (!Array.isArray(list) || list.length === 0) {
      throw new TypeError(`${contextLabel} 需要 children 陣列`);
    }
    return list;
  }

  function createRegistryFacade(registry) {
    if (!registry || typeof registry !== 'object') {
      throw new TypeError('[StrategyComposer] registry 必須為物件');
    }
    const facade = { ...registry };
    if (typeof facade.invoke !== 'function') {
      facade.invoke = function invokeWithPlugin(pluginId, context, params) {
        if (!pluginId) {
          throw new Error('[StrategyComposer] pluginId 不可為空');
        }
        const loaderChain = [];
        if (typeof registry.ensureStrategyLoaded === 'function') {
          loaderChain.push(() => registry.ensureStrategyLoaded(pluginId));
        }
        let plugin = null;
        for (let i = 0; i < loaderChain.length && !plugin; i += 1) {
          try {
            loaderChain[i]();
          } catch (error) {
            throw error;
          }
          if (typeof registry.getStrategyById === 'function') {
            plugin = registry.getStrategyById(pluginId);
          }
          if (!plugin && typeof registry.get === 'function') {
            plugin = registry.get(pluginId);
          }
        }
        if (!plugin) {
          if (typeof registry.getStrategyById === 'function') {
            plugin = registry.getStrategyById(pluginId);
          }
          if (!plugin && typeof registry.get === 'function') {
            plugin = registry.get(pluginId);
          }
        }
        if (!plugin || typeof plugin.run !== 'function') {
          throw new Error(`[StrategyComposer] 找不到策略 ${pluginId}`);
        }
        const pluginParams = params && typeof params === 'object' ? params : {};
        const ctx = context && typeof context === 'object' ? context : {};
        const rawResult = plugin.run(ctx, pluginParams);
        return normaliseRuleResult(rawResult, `[${pluginId}]`);
      };
    }
    return facade;
  }

  function buildComposite(node, registry) {
    if (!node || typeof node !== 'object') {
      return null;
    }
    const facade = createRegistryFacade(registry);

    function buildEvaluator(current, path) {
      const typeRaw = typeof current.type === 'string' ? current.type.trim().toLowerCase() : null;
      const opRaw = typeof current.op === 'string' ? current.op.trim().toLowerCase() : null;
      const resolvedType = typeRaw || opRaw || 'plugin';
      const contextLabel = path.join('>');

      if (resolvedType === 'plugin') {
        const pluginId = typeof current.pluginId === 'string'
          ? current.pluginId.trim()
          : typeof current.plugin === 'string'
          ? current.plugin.trim()
          : typeof current.id === 'string'
          ? current.id.trim()
          : '';
        if (!pluginId) {
          throw new Error(`${contextLabel}: plugin 節點缺少 pluginId`);
        }
        const params = current.params && typeof current.params === 'object' ? { ...current.params } : {};
        return function evaluatePlugin(context) {
          const role = context && typeof context.role === 'string' ? context.role : null;
          const index = Number.isFinite(context?.index) ? context.index : 0;
          const invokeContext = {
            ...(context || {}),
            role,
            index,
          };
          if (typeof facade.invoke !== 'function') {
            throw new Error('[StrategyComposer] registry.invoke 未定義');
          }
          const result = facade.invoke(pluginId, invokeContext, params, context?.extras);
          return normaliseRuleResult(result, `[${pluginId}]`);
        };
      }

      if (resolvedType === 'and') {
        const children = ensureChildrenArray(current, `${contextLabel} (AND)`);
        const evaluators = children.map((child, idx) => buildEvaluator(child, path.concat(`and[${idx}]`)));
        return function evaluateAnd(context) {
          const childResults = evaluators.map((fn) => fn(context));
          const base = createEmptyResult();
          base.enter = childResults.every((res) => res.enter === true);
          base.exit = childResults.every((res) => res.exit === true);
          base.short = childResults.every((res) => res.short === true);
          base.cover = childResults.every((res) => res.cover === true);
          base.stopLossPercent = pickFirstPercent(childResults, 'stopLossPercent');
          base.takeProfitPercent = pickFirstPercent(childResults, 'takeProfitPercent');
          base.meta = cloneMeta(childResults.map((res) => res.meta));
          return base;
        };
      }

      if (resolvedType === 'or') {
        const children = ensureChildrenArray(current, `${contextLabel} (OR)`);
        const evaluators = children.map((child, idx) => buildEvaluator(child, path.concat(`or[${idx}]`)));
        return function evaluateOr(context) {
          const childResults = evaluators.map((fn) => fn(context));
          const base = createEmptyResult();
          base.enter = childResults.some((res) => res.enter === true);
          base.exit = childResults.some((res) => res.exit === true);
          base.short = childResults.some((res) => res.short === true);
          base.cover = childResults.some((res) => res.cover === true);
          base.stopLossPercent = pickFirstPercent(childResults, 'stopLossPercent');
          base.takeProfitPercent = pickFirstPercent(childResults, 'takeProfitPercent');
          base.meta = cloneMeta(childResults.filter((res) =>
            res.enter === true ||
            res.exit === true ||
            res.short === true ||
            res.cover === true
          ).map((res) => res.meta));
          if (Object.keys(base.meta).length === 0) {
            base.meta = cloneMeta(childResults.map((res) => res.meta));
          }
          return base;
        };
      }

      if (resolvedType === 'not') {
        const child = current.child || current.children?.[0];
        if (!child || typeof child !== 'object') {
          throw new TypeError(`${contextLabel} (NOT) 需要 child 節點`);
        }
        const evaluator = buildEvaluator(child, path.concat('not'));
        return function evaluateNot(context) {
          const result = evaluator(context);
          const base = createEmptyResult();
          base.enter = result.enter !== true;
          base.exit = result.exit !== true;
          base.short = result.short !== true;
          base.cover = result.cover !== true;
          base.meta = cloneMeta([result.meta]);
          return base;
        };
      }

      throw new Error(`${contextLabel}: 未知節點型別 ${resolvedType}`);
    }

    const evaluator = buildEvaluator(node, ['root']);
    return function evaluate(context) {
      return evaluator(context || {});
    };
  }

  const api = {
    version: VERSION,
    buildComposite,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (globalScope) {
    const existing = globalScope.StrategyComposer || {};
    globalScope.StrategyComposer = {
      ...existing,
      ...api,
      __version__: VERSION,
    };
  }
})(typeof self !== 'undefined' ? self : this);
