// Patch Tag: LB-STRATEGY-COMPOSER-20250720A
(function (root) {
  const globalScope =
    root || (typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this);
  if (!globalScope) {
    return;
  }

  const EXISTING = globalScope.StrategyComposer;
  const COMPOSER_VERSION = 'LB-STRATEGY-COMPOSER-20250720A';
  if (EXISTING && typeof EXISTING.__version__ === 'string' && EXISTING.__version__ >= COMPOSER_VERSION) {
    if (typeof module !== 'undefined' && module.exports) {
      module.exports = EXISTING;
    }
    return;
  }

  const ALLOWED_BOOLEAN_OPS = ['AND', 'OR'];
  const BOOLEAN_FIELDS = ['enter', 'exit', 'short', 'cover'];

  function cloneObject(value, label) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new TypeError(`[StrategyComposer] ${label} 必須為物件`);
    }
    const cloned = {};
    Object.keys(value).forEach((key) => {
      const item = value[key];
      if (item && typeof item === 'object') {
        cloned[key] = Array.isArray(item) ? item.slice() : cloneObject(item, `${label}.${key}`);
      } else {
        cloned[key] = item;
      }
    });
    return cloned;
  }

  function cloneDslNode(node, path = 'root') {
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      throw new TypeError(`[StrategyComposer] ${path} 必須為物件`);
    }
    const op = typeof node.op === 'string' ? node.op.trim().toUpperCase() : '';
    if (!op) {
      throw new TypeError(`[StrategyComposer] ${path}.op 必須為字串`);
    }
    if (op === 'NOT') {
      if (!node.rule && !node.rules) {
        throw new TypeError(`[StrategyComposer] ${path}.NOT 需要 rule 或 rules`);
      }
      const child = node.rule || (Array.isArray(node.rules) ? node.rules[0] : null);
      if (!child) {
        throw new TypeError(`[StrategyComposer] ${path}.NOT 缺少子節點`);
      }
      return Object.freeze({ op: 'NOT', rule: cloneDslNode(child, `${path}.rule`) });
    }
    if (op === 'LEAF' || op === 'PLUGIN' || op === 'RULE') {
      if (typeof node.strategy !== 'string' || !node.strategy.trim()) {
        throw new TypeError(`[StrategyComposer] ${path}.strategy 必須為字串`);
      }
      const params = node.params ? cloneObject(node.params, `${path}.params`) : {};
      return Object.freeze({ op: 'LEAF', strategy: node.strategy.trim(), params: Object.freeze(params) });
    }
    if (!ALLOWED_BOOLEAN_OPS.includes(op)) {
      throw new TypeError(`[StrategyComposer] 不支援的運算子 ${op}`);
    }
    const rules = Array.isArray(node.rules)
      ? node.rules.map((rule, index) => cloneDslNode(rule, `${path}.rules[${index}]`))
      : [];
    if (rules.length === 0) {
      throw new TypeError(`[StrategyComposer] ${path}.rules 至少需要一個子節點`);
    }
    return Object.freeze({ op, rules: Object.freeze(rules) });
  }

  function ensureRegistry(registry) {
    if (!registry || typeof registry !== 'object') {
      throw new TypeError('[StrategyComposer] 需要提供 StrategyPluginRegistry');
    }
    return registry;
  }

  function getMeta(registry, strategyId) {
    const safeId = typeof strategyId === 'string' ? strategyId.trim() : '';
    if (!safeId) {
      throw new TypeError('[StrategyComposer] strategyId 必須為字串');
    }
    if (typeof registry.getStrategyMetaById === 'function') {
      const meta = registry.getStrategyMetaById(safeId);
      if (meta) return meta;
    }
    if (typeof registry.ensureStrategyLoaded === 'function') {
      const meta = registry.ensureStrategyLoaded(safeId);
      if (meta && meta.meta) {
        return meta.meta;
      }
    }
    if (typeof registry.get === 'function') {
      const plugin = registry.get(safeId);
      if (plugin && plugin.meta) {
        return plugin.meta;
      }
    }
    throw new Error(`[StrategyComposer] 找不到策略 ${safeId}`);
  }

  function clampNumeric(value, descriptor) {
    if (!Number.isFinite(value)) {
      return value;
    }
    let result = value;
    if (descriptor.type === 'integer') {
      result = Math.round(result);
    }
    if (Number.isFinite(descriptor.minimum)) {
      result = Math.max(descriptor.minimum, result);
    }
    if (Number.isFinite(descriptor.maximum)) {
      result = Math.min(descriptor.maximum, result);
    }
    return result;
  }

  function applySchemaDefaults(schema, rawParams) {
    if (!schema || typeof schema !== 'object') {
      return rawParams && typeof rawParams === 'object' ? { ...rawParams } : {};
    }
    const properties = schema.properties && typeof schema.properties === 'object' ? schema.properties : {};
    const output = {};
    Object.keys(properties).forEach((key) => {
      const descriptor = properties[key];
      if (descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'default')) {
        output[key] = descriptor.default;
      }
    });
    if (!rawParams || typeof rawParams !== 'object') {
      return output;
    }
    Object.keys(rawParams).forEach((key) => {
      const descriptor = properties[key];
      if (!descriptor || typeof descriptor !== 'object') {
        output[key] = rawParams[key];
        return;
      }
      if (descriptor.type === 'integer' || descriptor.type === 'number') {
        const numeric = Number(rawParams[key]);
        if (Number.isFinite(numeric)) {
          output[key] = clampNumeric(numeric, descriptor);
        }
      } else {
        output[key] = rawParams[key];
      }
    });
    return output;
  }

  function normaliseParams(registry, strategyId, rawParams, overrideParams) {
    const meta = getMeta(registry, strategyId);
    const merged = {
      ...(rawParams && typeof rawParams === 'object' ? rawParams : {}),
      ...(overrideParams && typeof overrideParams === 'object' ? overrideParams : {}),
    };
    return applySchemaDefaults(meta ? meta.paramsSchema : null, merged);
  }

  function toRuleResult(candidate) {
    if (!candidate || typeof candidate !== 'object') {
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
    return {
      enter: candidate.enter === true,
      exit: candidate.exit === true,
      short: candidate.short === true,
      cover: candidate.cover === true,
      stopLossPercent: Number.isFinite(candidate.stopLossPercent)
        ? Number(candidate.stopLossPercent)
        : null,
      takeProfitPercent: Number.isFinite(candidate.takeProfitPercent)
        ? Number(candidate.takeProfitPercent)
        : null,
      meta: candidate.meta && typeof candidate.meta === 'object' ? candidate.meta : {},
    };
  }

  function combineBoolean(op, values) {
    if (op === 'NOT') {
      return values.length === 0 ? true : !values[0];
    }
    if (op === 'AND') {
      return values.length === 0 ? true : values.every(Boolean);
    }
    if (op === 'OR') {
      return values.some(Boolean);
    }
    return false;
  }

  function mergeRuleResults(op, childResults) {
    const combined = {
      enter: false,
      exit: false,
      short: false,
      cover: false,
      stopLossPercent: null,
      takeProfitPercent: null,
      meta: { op, children: childResults.map((child) => child.meta || null) },
    };
    BOOLEAN_FIELDS.forEach((field) => {
      const values = childResults.map((result) => result[field] === true);
      combined[field] = combineBoolean(op, values);
    });
    if (combined.enter || combined.exit || combined.short || combined.cover) {
      for (let i = childResults.length - 1; i >= 0; i -= 1) {
        const child = childResults[i];
        if (combined.stopLossPercent === null && Number.isFinite(child.stopLossPercent)) {
          combined.stopLossPercent = Number(child.stopLossPercent);
        }
        if (combined.takeProfitPercent === null && Number.isFinite(child.takeProfitPercent)) {
          combined.takeProfitPercent = Number(child.takeProfitPercent);
        }
      }
    }
    return combined;
  }

  function evaluateNode(node, registry, options, context, evalOptions) {
    const op = node.op;
    if (op === 'LEAF') {
      const strategyId = node.strategy;
      const overrides = evalOptions?.paramsOverride;
      const overrideParams = overrides && strategyId && overrides[strategyId];
      const params = normaliseParams(registry, strategyId, node.params, overrideParams);
      const runtimeExtras = evalOptions?.runtime;
      const invoker = options.invokeLeaf;
      const result = invoker
        ? invoker({ strategyId, role: context.role, index: context.index, params, runtime: runtimeExtras })
        : null;
      return toRuleResult(result);
    }
    if (op === 'NOT') {
      const child = evaluateNode(node.rule, registry, options, context, evalOptions);
      return mergeRuleResults('NOT', [child]);
    }
    const children = node.rules.map((rule) => evaluateNode(rule, registry, options, context, evalOptions));
    return mergeRuleResults(op, children);
  }

  function buildComposite(dsl, registry, options = {}) {
    ensureRegistry(registry);
    const root = cloneDslNode(dsl, 'root');
    if (!options || typeof options !== 'object') {
      throw new TypeError('[StrategyComposer] buildComposite 需要 options');
    }
    if (typeof options.invokeLeaf !== 'function') {
      throw new TypeError('[StrategyComposer] options.invokeLeaf 必須為函式');
    }
    return function composite(context, evalOptions) {
      if (!context || typeof context !== 'object') {
        throw new TypeError('[StrategyComposer] composite(context) 需要傳入策略情境物件');
      }
      const role = context.role;
      if (typeof role !== 'string') {
        throw new TypeError('[StrategyComposer] context.role 必須為字串');
      }
      const index = Number(context.index);
      if (!Number.isFinite(index)) {
        throw new TypeError('[StrategyComposer] context.index 必須為數值');
      }
      const evaluationContext = { role, index };
      return evaluateNode(root, registry, options, evaluationContext, evalOptions);
    };
  }

  function createLeaf(strategyId, params) {
    if (typeof strategyId !== 'string' || !strategyId.trim()) {
      throw new TypeError('[StrategyComposer] createLeaf 需要 strategyId');
    }
    const baseParams =
      params && typeof params === 'object' ? Object.freeze(cloneObject(params, 'leaf.params')) : Object.freeze({});
    return Object.freeze({
      op: 'LEAF',
      strategy: strategyId.trim(),
      params: baseParams,
    });
  }

  const StrategyComposer = {
    __version__: COMPOSER_VERSION,
    buildComposite,
    createLeaf,
    normaliseParams: (registry, strategyId, rawParams, overrides) =>
      normaliseParams(registry, strategyId, rawParams, overrides),
    applySchemaDefaults,
  };

  globalScope.StrategyComposer = StrategyComposer;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = StrategyComposer;
  }
})(typeof self !== 'undefined' ? self : this);
