// Patch Tag: LB-STRATEGY-COMPOSER-20250720A — JSON DSL composer for strategy plugins.
(function (rootFactory) {
  const globalScope = typeof globalThis !== 'undefined'
    ? globalThis
    : typeof self !== 'undefined'
    ? self
    : typeof window !== 'undefined'
    ? window
    : typeof global !== 'undefined'
    ? global
    : {};

  const exported = rootFactory(globalScope);

  if (typeof module === 'object' && module.exports) {
    module.exports = exported;
  } else if (globalScope) {
    globalScope.StrategyComposer = exported;
  }
})(function createStrategyComposer(globalScope) {
  const COMPOSER_VERSION = 'LB-STRATEGY-COMPOSER-20250720A';

  const BOOLEAN_FIELDS = ['enter', 'exit', 'short', 'cover'];
  const PERCENT_FIELDS = ['stopLossPercent', 'takeProfitPercent'];

  function cloneParams(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return { ...value };
  }

  function ensureRuleResultCompat(rawResult, info) {
    if (globalScope && globalScope.StrategyPluginContract && typeof globalScope.StrategyPluginContract.ensureRuleResult === 'function') {
      return globalScope.StrategyPluginContract.ensureRuleResult(rawResult, info);
    }

    const base = {
      enter: false,
      exit: false,
      short: false,
      cover: false,
      stopLossPercent: null,
      takeProfitPercent: null,
      meta: {},
    };

    if (!rawResult || typeof rawResult !== 'object') {
      return base;
    }

    const result = /** @type {Record<string, unknown>} */ (rawResult);
    BOOLEAN_FIELDS.forEach((field) => {
      if (result[field] === true) {
        base[field] = true;
      }
    });
    PERCENT_FIELDS.forEach((field) => {
      if (typeof result[field] === 'number' && Number.isFinite(result[field])) {
        base[field] = /** @type {number} */ (result[field]);
      }
    });
    if (result.meta && typeof result.meta === 'object' && !Array.isArray(result.meta)) {
      base.meta = { ...result.meta };
    }
    return base;
  }

  function normaliseOperation(node) {
    if (!node || typeof node !== 'object') {
      return null;
    }
    const op = typeof node.op === 'string' ? node.op.trim().toUpperCase() : null;
    if (op) {
      return op;
    }
    if (typeof node.type === 'string') {
      return node.type.trim().toUpperCase();
    }
    if (typeof node.operator === 'string') {
      return node.operator.trim().toUpperCase();
    }
    if (typeof node.id === 'string' || typeof node.strategy === 'string' || typeof node.plugin === 'string') {
      return 'PLUGIN';
    }
    return null;
  }

  function normalisePluginId(node) {
    if (!node || typeof node !== 'object') {
      return '';
    }
    const candidates = [node.id, node.strategy, node.strategyId, node.plugin, node.pluginId];
    for (let i = 0; i < candidates.length; i += 1) {
      const value = candidates[i];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return '';
  }

  function mergeParams(baseParams, optionParams, nodeParams) {
    return {
      ...(baseParams || {}),
      ...(optionParams || {}),
      ...(nodeParams || {}),
    };
  }

  function resolveParamsForNode(node, options) {
    let resolved = {};
    const named = options?.namedParams && typeof options.namedParams === 'object' ? options.namedParams : null;

    const refs = [];
    if (typeof node.paramsRef === 'string') {
      refs.push(node.paramsRef);
    }
    if (Array.isArray(node.paramsRefs)) {
      node.paramsRefs.forEach((ref) => {
        if (typeof ref === 'string') {
          refs.push(ref);
        }
      });
    }
    refs.forEach((refKey) => {
      if (named && named[refKey] && typeof named[refKey] === 'object') {
        resolved = { ...resolved, ...named[refKey] };
      }
    });

    if (typeof options?.getParams === 'function') {
      try {
        const extra = options.getParams(node);
        if (extra && typeof extra === 'object') {
          resolved = { ...resolved, ...extra };
        }
      } catch (error) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[StrategyComposer] getParams 解析失敗', error);
        }
      }
    }

    if (node.params && typeof node.params === 'object' && !Array.isArray(node.params)) {
      resolved = { ...resolved, ...node.params };
    }

    return resolved;
  }

  function aggregateBooleans(op, values) {
    if (!Array.isArray(values) || values.length === 0) {
      return false;
    }
    switch (op) {
      case 'AND':
        return values.map((val) => val === true).every((val) => val === true);
      case 'NOT': {
        const first = values[0];
        if (first === true) {
          return false;
        }
        if (first === false) {
          return true;
        }
        return false;
      }
      case 'OR':
      default:
        return values.map((val) => val === true).some((val) => val === true);
    }
  }

  function pickPercentValue(op, values) {
    if (!Array.isArray(values) || values.length === 0) {
      return null;
    }
    const numeric = values.filter((val) => typeof val === 'number' && Number.isFinite(val));
    if (numeric.length === 0) {
      return null;
    }
    if (op === 'AND') {
      return Math.min(...numeric);
    }
    if (op === 'NOT') {
      return null;
    }
    return numeric[0];
  }

  function mergeMetas(op, childResults) {
    const metaList = childResults
      .map((result) => (result && typeof result.meta === 'object' ? result.meta : null))
      .filter((meta) => meta !== null);
    if (metaList.length === 0) {
      return { operator: op };
    }
    return {
      operator: op,
      children: metaList,
    };
  }

  function createRegistryEvaluator(registry, ensureFn) {
    if (!registry) {
      return () => null;
    }
    return function evaluate(pluginId, context, params, extras) {
      let plugin = null;
      if (registry && typeof registry.getStrategyById === 'function') {
        plugin = registry.getStrategyById(pluginId);
      } else if (registry && typeof registry.get === 'function') {
        plugin = registry.get(pluginId);
      }
      if (!plugin && registry && typeof registry.ensureStrategyLoaded === 'function') {
        plugin = registry.ensureStrategyLoaded(pluginId);
      }
      if (!plugin || typeof plugin.run !== 'function') {
        return ensureFn({}, { pluginId, role: context?.role, index: context?.index });
      }
      try {
        const raw = plugin.run(
          {
            role: context?.role,
            index: context?.index,
            series: context?.series,
            helpers: context?.helpers,
            runtime: context?.runtime,
          },
          params,
          extras,
        );
        return ensureFn(raw, { pluginId, role: context?.role, index: context?.index });
      } catch (error) {
        if (typeof console !== 'undefined' && console.error) {
          console.error(`[StrategyComposer] 執行策略 ${pluginId} 失敗`, error);
        }
        return ensureFn({}, { pluginId, role: context?.role, index: context?.index });
      }
    };
  }

  function buildNodeEvaluator(node, options, ensureFn, evaluatePlugin, path) {
    const op = normaliseOperation(node);
    if (!op) {
      throw new TypeError(`[StrategyComposer] 無法解析 DSL 節點 ${path || '<root>'}`);
    }

    if (op === 'PLUGIN') {
      const pluginId = normalisePluginId(node);
      if (!pluginId) {
        throw new TypeError(`[StrategyComposer] ${path || '<root>'} 缺少策略 ID`);
      }
      const baseParams = cloneParams(options?.baseParams);
      return function evaluatePluginNode(context, extras) {
        const nodeParams = resolveParamsForNode(node, options);
        const finalParams = mergeParams(baseParams, options?.sharedParams, nodeParams);
        const info = { pluginId, role: context?.role, index: context?.index };
        const rawResult = evaluatePlugin(pluginId, context, finalParams, extras);
        return ensureFn(rawResult, info);
      };
    }

    const children = Array.isArray(node.rules) ? node.rules : node.rule ? [node.rule] : [];
    if (children.length === 0) {
      throw new TypeError(`[StrategyComposer] ${op} 節點缺少 rules 陣列`);
    }

    const childEvaluators = children.map((child, index) =>
      buildNodeEvaluator(child, options, ensureFn, evaluatePlugin, `${path || op}[${index}]`),
    );

    return function evaluateCompositeNode(context, extras) {
      const evaluated = childEvaluators.map((fn) => fn(context, extras));
      const booleanMap = {};
      BOOLEAN_FIELDS.forEach((field) => {
        booleanMap[field] = aggregateBooleans(op, evaluated.map((result) => result[field]));
      });
      const percentMap = {};
      PERCENT_FIELDS.forEach((field) => {
        percentMap[field] = pickPercentValue(op, evaluated.map((result) => result[field]));
      });
      const meta = mergeMetas(op, evaluated);
      return {
        ...booleanMap,
        ...percentMap,
        meta,
      };
    };
  }

  function buildComposite(dsl, registry, options = {}) {
    if (!dsl) {
      throw new TypeError('[StrategyComposer] DSL 不可為空');
    }
    const ensureFn = typeof options.ensureRuleResult === 'function' ? options.ensureRuleResult : ensureRuleResultCompat;
    const evaluatePlugin = typeof options.evaluatePlugin === 'function'
      ? options.evaluatePlugin
      : createRegistryEvaluator(registry, ensureFn);

    const builder = buildNodeEvaluator(dsl, options, ensureFn, evaluatePlugin, 'root');
    const executable = function executeComposite(context, extras) {
      const safeContext = context && typeof context === 'object' ? context : {};
      return builder(safeContext, extras);
    };
    Object.defineProperty(executable, '__dsl__', {
      value: dsl,
      enumerable: false,
      configurable: false,
      writable: false,
    });
    return executable;
  }

  return {
    __version__: COMPOSER_VERSION,
    buildComposite,
    ensureRuleResultCompat,
  };
});

