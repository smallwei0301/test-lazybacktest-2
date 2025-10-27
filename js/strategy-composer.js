// Patch Tag: LB-STRATEGY-COMPOSER-20250718A
(function (root) {
  const globalScope =
    root || (typeof self !== 'undefined' ? self : typeof global !== 'undefined' ? global : this);
  if (!globalScope) {
    return;
  }

  const COMPOSER_VERSION = 'LB-STRATEGY-COMPOSER-20250718A';
  const existing = globalScope.StrategyComposer;
  if (existing && typeof existing.__version__ === 'string' && existing.__version__ >= COMPOSER_VERSION) {
    return;
  }

  const BOOL_FIELDS = ['enter', 'exit', 'short', 'cover'];

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
    const clone = {};
    Object.keys(meta).forEach((key) => {
      const value = meta[key];
      if (value && typeof value === 'object') {
        if (Array.isArray(value)) {
          clone[key] = value.map((item) => (item && typeof item === 'object' ? cloneMeta(item) : item));
        } else {
          clone[key] = cloneMeta(value);
        }
      } else {
        clone[key] = value;
      }
    });
    return clone;
  }

  function sanitizeValue(value, path) {
    if (value === null) {
      return null;
    }
    const type = typeof value;
    if (type === 'function' || type === 'symbol' || type === 'bigint') {
      throw new TypeError(`${path} 不可為 ${type}`);
    }
    if (type !== 'object') {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map((item, index) => sanitizeValue(item, `${path}[${index}]`));
    }
    const clone = {};
    Object.keys(value).forEach((key) => {
      clone[key] = sanitizeValue(value[key], `${path}.${key}`);
    });
    return clone;
  }

  function toNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : NaN;
  }

  function clampNumeric(value, descriptor) {
    if (!Number.isFinite(value)) {
      return value;
    }
    let output = value;
    if (descriptor.type === 'integer') {
      output = Math.round(output);
    }
    if (Number.isFinite(descriptor.minimum)) {
      output = Math.max(descriptor.minimum, output);
    }
    if (Number.isFinite(descriptor.maximum)) {
      output = Math.min(descriptor.maximum, output);
    }
    return output;
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
      const value = rawParams[key];
      const descriptor = properties[key];
      if (!descriptor || typeof descriptor !== 'object') {
        output[key] = value;
        return;
      }
      if (descriptor.type === 'integer' || descriptor.type === 'number') {
        const numeric = toNumber(value);
        if (Number.isFinite(numeric)) {
          output[key] = clampNumeric(numeric, descriptor);
        }
      } else {
        output[key] = value;
      }
    });
    return output;
  }

  function pickFirstNonNull(results, field) {
    for (let i = 0; i < results.length; i += 1) {
      const value = results[i] && results[i][field];
      if (Number.isFinite(value) || value === 0) {
        return Number(value);
      }
    }
    return null;
  }

  function mergeMeta(results) {
    const merged = {};
    results.forEach((res) => {
      if (res && res.meta && typeof res.meta === 'object') {
        Object.keys(res.meta).forEach((key) => {
          merged[key] = res.meta[key];
        });
      }
    });
    return cloneMeta(merged);
  }

  function computeBoolean(op, values) {
    if (op === 'AND') {
      return values.every((v) => v === true);
    }
    if (op === 'OR') {
      return values.some((v) => v === true);
    }
    return false;
  }

  function ensureRuleResultFactory(options) {
    if (options && typeof options.ensureRuleResult === 'function') {
      return options.ensureRuleResult;
    }
    if (
      typeof globalScope.StrategyPluginContract === 'object' &&
      typeof globalScope.StrategyPluginContract.ensureRuleResult === 'function'
    ) {
      return globalScope.StrategyPluginContract.ensureRuleResult;
    }
    return (raw, info) => {
      const result = raw && typeof raw === 'object' ? raw : {};
      const normalised = createEmptyResult();
      BOOL_FIELDS.forEach((field) => {
        normalised[field] = result[field] === true;
      });
      if (Number.isFinite(result.stopLossPercent) || result.stopLossPercent === 0) {
        normalised.stopLossPercent = Number(result.stopLossPercent);
      }
      if (Number.isFinite(result.takeProfitPercent) || result.takeProfitPercent === 0) {
        normalised.takeProfitPercent = Number(result.takeProfitPercent);
      }
      if (result.meta && typeof result.meta === 'object') {
        normalised.meta = cloneMeta(result.meta);
      }
      return normalised;
    };
  }

  function normaliseNode(node) {
    if (typeof node === 'string') {
      const trimmed = node.trim();
      if (!trimmed) {
        throw new TypeError('策略節點 plugin id 不可為空字串');
      }
      return { type: 'plugin', plugin: trimmed, params: {} };
    }
    if (node === null || node === undefined) {
      throw new TypeError('策略節點不可為 null/undefined');
    }
    if (typeof node === 'boolean') {
      return { type: 'constant', value: node === true };
    }
    if (typeof node !== 'object') {
      throw new TypeError('策略節點必須為物件或字串');
    }
    if (Array.isArray(node)) {
      throw new TypeError('策略節點不支援陣列，請使用 { op: "AND"|"OR", rules: [...] }');
    }
    if (Object.prototype.hasOwnProperty.call(node, 'plugin') || Object.prototype.hasOwnProperty.call(node, 'strategy')) {
      const pluginIdRaw = node.plugin || node.strategy;
      const pluginId = typeof pluginIdRaw === 'string' ? pluginIdRaw.trim() : String(pluginIdRaw || '');
      if (!pluginId) {
        throw new TypeError('策略節點 plugin id 不可為空');
      }
      const params = node.params ? sanitizeValue(node.params, `[${pluginId}].params`) : {};
      return { type: 'plugin', plugin: pluginId, params };
    }
    const opRaw = typeof node.op === 'string' ? node.op.trim().toUpperCase() : null;
    if (opRaw === 'AND' || opRaw === 'OR') {
      const rules = Array.isArray(node.rules) ? node.rules : [];
      if (rules.length === 0) {
        throw new TypeError(`${opRaw} 節點需要至少一個 rules 子節點`);
      }
      return { type: 'operator', op: opRaw, rules: rules.map(normaliseNode) };
    }
    if (opRaw === 'NOT') {
      const child = node.rule || (Array.isArray(node.rules) ? node.rules[0] : null);
      if (!child) {
        throw new TypeError('NOT 節點需要 rule 子節點');
      }
      return { type: 'not', rule: normaliseNode(child) };
    }
    if (Object.prototype.hasOwnProperty.call(node, 'value')) {
      return { type: 'constant', value: Boolean(node.value) };
    }
    throw new TypeError('無法辨識的策略節點格式');
  }

  function loadStrategy(registry, pluginId) {
    if (!registry) {
      return null;
    }
    let plugin = null;
    try {
      if (typeof registry.getStrategyById === 'function') {
        plugin = registry.getStrategyById(pluginId);
      } else if (typeof registry.get === 'function') {
        plugin = registry.get(pluginId);
      }
    } catch (error) {
      if (typeof console !== 'undefined' && console.error) {
        console.error(`[StrategyComposer] 讀取策略 ${pluginId} 失敗`, error);
      }
    }
    if (!plugin && typeof registry.ensureStrategyLoaded === 'function') {
      try {
        const ensured = registry.ensureStrategyLoaded(pluginId);
        if (ensured) {
          plugin = ensured;
        }
      } catch (error) {
        if (typeof console !== 'undefined' && console.error) {
          console.error(`[StrategyComposer] 載入策略 ${pluginId} 失敗`, error);
        }
      }
    }
    if (!plugin || typeof plugin.run !== 'function') {
      return null;
    }
    return plugin;
  }

  function resolveMeta(registry, pluginId) {
    if (!registry || typeof registry.getStrategyMetaById !== 'function') {
      return null;
    }
    try {
      return registry.getStrategyMetaById(pluginId) || null;
    } catch (error) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(`[StrategyComposer] 取得策略 ${pluginId} meta 失敗`, error);
      }
      return null;
    }
  }

  function compilePluginNode(node, registry, options) {
    const pluginId = node.plugin;
    const meta = resolveMeta(registry, pluginId);
    const baseParams = applySchemaDefaults(meta && meta.paramsSchema, node.params || {});
    const ensureRuleResult = ensureRuleResultFactory(options);
    return function evaluatePlugin(context, extras) {
      const plugin = loadStrategy(registry, pluginId);
      if (!plugin) {
        return createEmptyResult();
      }
      const createPluginContext = options && typeof options.createPluginContext === 'function'
        ? options.createPluginContext
        : null;
      const augmentParams = options && typeof options.augmentParams === 'function' ? options.augmentParams : null;
      const pluginContext = createPluginContext ? createPluginContext(pluginId, context) : { ...context };
      const paramsSnapshot = { ...baseParams };
      const finalParams = augmentParams
        ? augmentParams(paramsSnapshot, extras || {}, pluginId, pluginContext)
        : paramsSnapshot;
      try {
        const raw = plugin.run(pluginContext, finalParams);
        return ensureRuleResult(raw, {
          pluginId,
          role: pluginContext.role,
          index: pluginContext.index,
        });
      } catch (error) {
        if (typeof console !== 'undefined' && console.error) {
          console.error(`[StrategyComposer] 策略 ${pluginId} 執行失敗`, error);
        }
        return createEmptyResult();
      }
    };
  }

  function compileConstantNode(node) {
    const result = createEmptyResult();
    BOOL_FIELDS.forEach((field) => {
      result[field] = node.value === true;
    });
    return function evaluateConstant() {
      return { ...result, meta: {} };
    };
  }

  function compileOperatorNode(node, registry, options) {
    const childFns = node.rules.map((rule) => compileNode(rule, registry, options));
    const op = node.op;
    return function evaluateOperator(context, extras) {
      const results = childFns.map((fn) => {
        try {
          const output = fn(context, extras);
          if (output && typeof output === 'object') {
            return {
              enter: output.enter === true,
              exit: output.exit === true,
              short: output.short === true,
              cover: output.cover === true,
              stopLossPercent: Number.isFinite(output.stopLossPercent)
                ? Number(output.stopLossPercent)
                : null,
              takeProfitPercent: Number.isFinite(output.takeProfitPercent)
                ? Number(output.takeProfitPercent)
                : null,
              meta: output.meta && typeof output.meta === 'object' ? cloneMeta(output.meta) : {},
            };
          }
        } catch (error) {
          if (typeof console !== 'undefined' && console.error) {
            console.error('[StrategyComposer] 子節點評估失敗', error);
          }
        }
        return createEmptyResult();
      });
      const aggregated = createEmptyResult();
      BOOL_FIELDS.forEach((field) => {
        aggregated[field] = computeBoolean(op, results.map((res) => res[field] === true));
      });
      aggregated.stopLossPercent = pickFirstNonNull(results, 'stopLossPercent');
      aggregated.takeProfitPercent = pickFirstNonNull(results, 'takeProfitPercent');
      aggregated.meta = mergeMeta(results);
      return aggregated;
    };
  }

  function compileNotNode(node, registry, options) {
    const childFn = compileNode(node.rule, registry, options);
    return function evaluateNot(context, extras) {
      let result = createEmptyResult();
      try {
        const evaluated = childFn(context, extras);
        if (evaluated && typeof evaluated === 'object') {
          result = {
            enter: evaluated.enter !== true,
            exit: evaluated.exit !== true,
            short: evaluated.short !== true,
            cover: evaluated.cover !== true,
            stopLossPercent: evaluated.stopLossPercent ?? null,
            takeProfitPercent: evaluated.takeProfitPercent ?? null,
            meta: evaluated.meta && typeof evaluated.meta === 'object' ? cloneMeta(evaluated.meta) : {},
          };
        }
      } catch (error) {
        if (typeof console !== 'undefined' && console.error) {
          console.error('[StrategyComposer] NOT 子節點評估失敗', error);
        }
      }
      return result;
    };
  }

  function compileNode(node, registry, options) {
    switch (node.type) {
      case 'plugin':
        return compilePluginNode(node, registry, options);
      case 'operator':
        return compileOperatorNode(node, registry, options);
      case 'not':
        return compileNotNode(node, registry, options);
      case 'constant':
        return compileConstantNode(node);
      default:
        throw new TypeError(`未支援的節點型別: ${node.type}`);
    }
  }

  function buildComposite(definition, registry, options) {
    const normalised = normaliseNode(definition);
    const evaluator = compileNode(normalised, registry, options || {});
    return function evaluateComposite(context, extras) {
      const safeContext =
        context && typeof context === 'object'
          ? {
              role: context.role,
              index: Number.isFinite(context.index) ? Number(context.index) : 0,
              series: context.series,
              helpers: context.helpers,
              runtime: context.runtime,
            }
          : { role: 'longEntry', index: 0 };
      return evaluator(safeContext, extras || {});
    };
  }

  const api = Object.freeze({
    buildComposite,
    normaliseNode,
    __version__: COMPOSER_VERSION,
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  Object.defineProperty(globalScope, 'StrategyComposer', {
    value: api,
    enumerable: true,
    configurable: false,
    writable: false,
  });
})(typeof self !== 'undefined' ? self : typeof global !== 'undefined' ? global : this);
