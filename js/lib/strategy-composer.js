// Patch Tag: LB-STRATEGY-COMPOSER-20260916A
(function (root) {
  const fallbackScope =
    typeof globalThis !== 'undefined'
      ? globalThis
      : typeof self !== 'undefined'
      ? self
      : this;
  const candidate = root && root.Math === Math ? root : null;
  const globalScope = candidate || fallbackScope;
  if (!globalScope) {
    return;
  }

  const VERSION = 'LB-STRATEGY-COMPOSER-20260916A';
  const existing = globalScope.StrategyComposer;
  if (existing && typeof existing.__version__ === 'string' && existing.__version__ >= VERSION) {
    return;
  }

  const contract = globalScope.StrategyPluginContract || null;

  const EMPTY_RULE_RESULT = Object.freeze({
    enter: false,
    exit: false,
    short: false,
    cover: false,
    stopLossPercent: null,
    takeProfitPercent: null,
    meta: {},
  });

  const BOOLEAN_FIELDS = ['enter', 'exit', 'short', 'cover'];

  function ensureObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
  }

  function clonePlainObject(value) {
    if (!ensureObject(value)) {
      return {};
    }
    const output = {};
    Object.keys(value).forEach((key) => {
      const candidate = value[key];
      if (Array.isArray(candidate)) {
        output[key] = candidate.slice();
      } else if (ensureObject(candidate)) {
        output[key] = { ...candidate };
      } else {
        output[key] = candidate;
      }
    });
    return output;
  }

  function toNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : NaN;
  }

  function applySchemaDefaults(schema, rawParams) {
    if (!ensureObject(schema)) {
      return rawParams && typeof rawParams === 'object' ? clonePlainObject(rawParams) : {};
    }
    const properties = ensureObject(schema.properties) ? schema.properties : {};
    const output = {};
    Object.keys(properties).forEach((key) => {
      const descriptor = properties[key];
      if (ensureObject(descriptor) && Object.prototype.hasOwnProperty.call(descriptor, 'default')) {
        output[key] = descriptor.default;
      }
    });
    if (!rawParams || typeof rawParams !== 'object') {
      return output;
    }
    Object.keys(rawParams).forEach((key) => {
      const descriptor = properties[key];
      const value = rawParams[key];
      if (!ensureObject(descriptor)) {
        output[key] = value;
        return;
      }
      if (descriptor.type === 'integer' || descriptor.type === 'number') {
        const numeric = toNumber(value);
        if (Number.isFinite(numeric)) {
          output[key] = descriptor.type === 'integer' ? Math.round(numeric) : numeric;
        }
      } else if (descriptor.type === 'boolean') {
        output[key] = value === true;
      } else {
        output[key] = value;
      }
    });
    return output;
  }

  function ensureRuleResult(candidate, info) {
    if (contract && typeof contract.ensureRuleResult === 'function') {
      return contract.ensureRuleResult(candidate, info);
    }
    if (!candidate || typeof candidate !== 'object') {
      return { ...EMPTY_RULE_RESULT };
    }
    const source = /** @type {Record<string, unknown>} */ (candidate);
    const result = {
      enter: source.enter === true,
      exit: source.exit === true,
      short: source.short === true,
      cover: source.cover === true,
      stopLossPercent: null,
      takeProfitPercent: null,
      meta: {},
    };
    if (Number.isFinite(source.stopLossPercent)) {
      result.stopLossPercent = Number(source.stopLossPercent);
    }
    if (Number.isFinite(source.takeProfitPercent)) {
      result.takeProfitPercent = Number(source.takeProfitPercent);
    }
    if (ensureObject(source.meta)) {
      result.meta = { ...source.meta };
    }
    return result;
  }

  function mergeIndicatorValues(children) {
    const merged = {};
    children.forEach((child) => {
      if (child && ensureObject(child.meta) && ensureObject(child.meta.indicatorValues)) {
        Object.assign(merged, child.meta.indicatorValues);
      }
    });
    return Object.keys(merged).length > 0 ? merged : null;
  }

  function collectMetaChildren(children) {
    const metaChildren = [];
    children.forEach((child) => {
      if (child && ensureObject(child.meta) && Object.keys(child.meta).length > 0) {
        metaChildren.push(child.meta);
      }
    });
    return metaChildren.length > 0 ? metaChildren : null;
  }

  function combineRuleResults(op, rawChildren) {
    const children = rawChildren.map((child) => ensureRuleResult(child));
    const output = {
      enter: false,
      exit: false,
      short: false,
      cover: false,
      stopLossPercent: null,
      takeProfitPercent: null,
      meta: {},
    };
    BOOLEAN_FIELDS.forEach((field) => {
      const values = children.map((item) => item[field] === true);
      if (op === 'AND') {
        output[field] = values.every(Boolean);
      } else {
        output[field] = values.some(Boolean);
      }
    });
    for (let i = 0; i < children.length; i += 1) {
      const child = children[i];
      if (output.stopLossPercent === null && Number.isFinite(child.stopLossPercent)) {
        output.stopLossPercent = Number(child.stopLossPercent);
      }
      if (output.takeProfitPercent === null && Number.isFinite(child.takeProfitPercent)) {
        output.takeProfitPercent = Number(child.takeProfitPercent);
      }
    }
    const indicatorValues = mergeIndicatorValues(children);
    const metaChildren = collectMetaChildren(children);
    if (indicatorValues) {
      output.meta.indicatorValues = indicatorValues;
    }
    if (metaChildren) {
      output.meta.children = metaChildren;
      output.meta.op = op;
    }
    if (Object.keys(output.meta).length === 0) {
      output.meta = {};
    }
    return output;
  }

  function invertRuleResult(rawChild) {
    const child = ensureRuleResult(rawChild);
    const inverted = {
      enter: !child.enter,
      exit: !child.exit,
      short: !child.short,
      cover: !child.cover,
      stopLossPercent: null,
      takeProfitPercent: null,
      meta: {},
    };
    if (ensureObject(child.meta) && Object.keys(child.meta).length > 0) {
      inverted.meta = { not: child.meta };
    }
    return inverted;
  }

  function resolveStrategyMeta(registry, pluginId) {
    if (!registry) {
      return null;
    }
    let meta = null;
    if (typeof registry.getStrategyMetaById === 'function') {
      try {
        meta = registry.getStrategyMetaById(pluginId);
      } catch (err) {
        meta = null;
      }
    }
    if (!meta && typeof registry.getStrategyById === 'function') {
      try {
        const plugin = registry.getStrategyById(pluginId);
        if (plugin && ensureObject(plugin.meta)) {
          meta = plugin.meta;
        }
      } catch (err) {
        meta = null;
      }
    }
    if (!meta && typeof registry.get === 'function') {
      try {
        const plugin = registry.get(pluginId);
        if (plugin && ensureObject(plugin.meta)) {
          meta = plugin.meta;
        }
      } catch (err) {
        meta = null;
      }
    }
    if (!meta && typeof registry.ensureStrategyLoaded === 'function') {
      try {
        const ensured = registry.ensureStrategyLoaded(pluginId);
        if (ensured && ensureObject(ensured.meta)) {
          meta = ensured.meta;
        }
      } catch (err) {
        meta = null;
      }
    }
    return meta || null;
  }

  function defaultEvaluatePlugin(registry) {
    return function evaluate(pluginId, context, params) {
      if (!registry) {
        return EMPTY_RULE_RESULT;
      }
      let plugin = null;
      if (typeof registry.getStrategyById === 'function') {
        plugin = registry.getStrategyById(pluginId);
      }
      if (!plugin && typeof registry.get === 'function') {
        plugin = registry.get(pluginId);
      }
      if (!plugin && typeof registry.ensureStrategyLoaded === 'function') {
        plugin = registry.ensureStrategyLoaded(pluginId);
      }
      if (!plugin || typeof plugin.run !== 'function') {
        return EMPTY_RULE_RESULT;
      }
      try {
        const raw = plugin.run(context || {}, params || {});
        return ensureRuleResult(raw, {
          pluginId,
          role: context?.role,
          index: context?.index,
        });
      } catch (error) {
        if (typeof console !== 'undefined' && console.error) {
          console.error(`[StrategyComposer] 執行 ${pluginId} 失敗`, error);
        }
        return EMPTY_RULE_RESULT;
      }
    };
  }

  function normaliseNode(node) {
    if (!node || typeof node !== 'object') {
      throw new TypeError('[StrategyComposer] DSL 節點必須為物件');
    }
    const op = typeof node.op === 'string' ? node.op.toUpperCase() : null;
    if (!op) {
      throw new TypeError('[StrategyComposer] DSL 節點缺少 op');
    }
    return { ...node, op };
  }

  function buildEvaluator(node, registry, evaluatePluginFn, metaCache) {
    const current = normaliseNode(node);
    if (current.op === 'PLUGIN') {
      const pluginId = typeof current.id === 'string' ? current.id.trim() : '';
      if (!pluginId) {
        throw new TypeError('[StrategyComposer] PLUGIN 節點需要 id');
      }
      let meta = metaCache.get(pluginId);
      if (meta === undefined) {
        meta = resolveStrategyMeta(registry, pluginId);
        metaCache.set(pluginId, meta);
      }
      const paramsSchema = meta && ensureObject(meta.paramsSchema) ? meta.paramsSchema : undefined;
      const params = applySchemaDefaults(paramsSchema, current.params);
      return function evaluatePluginNode(context) {
        return evaluatePluginFn(pluginId, context || {}, params);
      };
    }
    if (current.op === 'AND' || current.op === 'OR') {
      const rules = Array.isArray(current.rules) ? current.rules : [];
      if (rules.length === 0) {
        return function emptyLogicalNode() {
          return { ...EMPTY_RULE_RESULT };
        };
      }
      const evaluators = rules.map((child) => buildEvaluator(child, registry, evaluatePluginFn, metaCache));
      return function evaluateLogicalNode(context) {
        const results = evaluators.map((fn) => fn(context));
        return combineRuleResults(current.op, results);
      };
    }
    if (current.op === 'NOT') {
      if (!current.rule) {
        throw new TypeError('[StrategyComposer] NOT 節點需要 rule');
      }
      const evaluator = buildEvaluator(current.rule, registry, evaluatePluginFn, metaCache);
      return function evaluateNotNode(context) {
        const result = evaluator(context);
        return invertRuleResult(result);
      };
    }
    throw new TypeError(`[StrategyComposer] 不支援的運算子: ${current.op}`);
  }

  function buildComposite(definition, registry, options = {}) {
    if (!definition || typeof definition !== 'object') {
      throw new TypeError('[StrategyComposer] 需要提供 DSL 定義');
    }
    const evaluatePluginFn =
      typeof options.evaluatePlugin === 'function'
        ? options.evaluatePlugin
        : defaultEvaluatePlugin(registry);
    const metaCache = new Map();
    const evaluator = buildEvaluator(definition, registry, (pluginId, context, params) => {
      const raw = evaluatePluginFn(pluginId, context, params);
      return ensureRuleResult(raw, {
        pluginId,
        role: context?.role,
        index: context?.index,
      });
    }, metaCache);
    return function compositeEvaluator(context) {
      return evaluator(context || {});
    };
  }

  globalScope.StrategyComposer = Object.freeze({
    buildComposite,
    __version__: VERSION,
  });
})(typeof self !== 'undefined' ? self : this);
