// Patch Tag: LB-STRATEGY-DSL-20260920A
(function (global) {
  const PATCH_VERSION = 'LB-STRATEGY-DSL-20260920A';

  function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function cloneDeep(value) {
    if (Array.isArray(value)) {
      return value.map((item) => cloneDeep(item));
    }
    if (isPlainObject(value)) {
      const cloned = {};
      Object.keys(value).forEach((key) => {
        cloned[key] = cloneDeep(value[key]);
      });
      return cloned;
    }
    return value;
  }

  function toNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : NaN;
  }

  function normaliseOp(op, contextLabel) {
    if (typeof op !== 'string') {
      throw new TypeError(`${contextLabel} op 必須為字串`);
    }
    const upper = op.trim().toUpperCase();
    if (upper === 'AND' || upper === 'OR' || upper === 'NOT') {
      return upper;
    }
    throw new TypeError(`${contextLabel} 未支援的運算子 ${op}`);
  }

  function ensureRegistry(registry) {
    if (!registry || typeof registry !== 'object') {
      throw new TypeError('buildComposite 需要提供策略註冊中心');
    }
    return registry;
  }

  function loadPlugin(registry, pluginId) {
    let plugin = null;
    if (typeof registry.getStrategyById === 'function') {
      plugin = registry.getStrategyById(pluginId);
    } else if (typeof registry.get === 'function') {
      plugin = registry.get(pluginId);
    }
    if ((!plugin || typeof plugin.run !== 'function') && typeof registry.ensureStrategyLoaded === 'function') {
      try {
        plugin = registry.ensureStrategyLoaded(pluginId) || plugin;
      } catch (error) {
        throw new Error(`[${pluginId}] 載入策略失敗: ${error && error.message ? error.message : error}`);
      }
    }
    if (!plugin || typeof plugin.run !== 'function') {
      throw new Error(`[${pluginId}] 尚未註冊或缺少 run(context, params)`);
    }
    return plugin;
  }

  function loadMeta(registry, pluginId, plugin) {
    if (registry && typeof registry.getStrategyMetaById === 'function') {
      try {
        const meta = registry.getStrategyMetaById(pluginId);
        if (meta) {
          return meta;
        }
      } catch (error) {
        throw new Error(`[${pluginId}] 讀取 meta 失敗: ${error && error.message ? error.message : error}`);
      }
    }
    if (plugin && plugin.meta) {
      return plugin.meta;
    }
    throw new Error(`[${pluginId}] 無法取得策略 meta`);
  }

  function clampInclusive(value, min, max) {
    let result = value;
    if (Number.isFinite(min)) {
      result = Math.max(min, result);
    }
    if (Number.isFinite(max)) {
      result = Math.min(max, result);
    }
    return result;
  }

  function sanitiseNumeric(descriptor, value, contextLabel) {
    const numeric = toNumber(value);
    if (!Number.isFinite(numeric)) {
      throw new TypeError(`${contextLabel} 必須為數值`);
    }
    let output = descriptor.type === 'integer' ? Math.round(numeric) : numeric;
    output = clampInclusive(output, descriptor.minimum, descriptor.maximum);
    if (Number.isFinite(descriptor.exclusiveMinimum) && !(output > descriptor.exclusiveMinimum)) {
      throw new RangeError(`${contextLabel} 必須大於 ${descriptor.exclusiveMinimum}`);
    }
    if (Number.isFinite(descriptor.exclusiveMaximum) && !(output < descriptor.exclusiveMaximum)) {
      throw new RangeError(`${contextLabel} 必須小於 ${descriptor.exclusiveMaximum}`);
    }
    if (Number.isFinite(descriptor.multipleOf) && descriptor.multipleOf > 0) {
      const quotient = Math.round(output / descriptor.multipleOf);
      output = quotient * descriptor.multipleOf;
    }
    return output;
  }

  function sanitiseByDescriptor(descriptor, value, contextLabel) {
    if (!descriptor || typeof descriptor !== 'object') {
      return value;
    }
    if (descriptor.enum && Array.isArray(descriptor.enum)) {
      const match = descriptor.enum.find((candidate) => candidate === value);
      if (match === undefined) {
        throw new TypeError(`${contextLabel} 需為 enum: ${descriptor.enum.join(', ')}`);
      }
      return match;
    }
    if (descriptor.type === 'integer' || descriptor.type === 'number') {
      return sanitiseNumeric(descriptor, value, contextLabel);
    }
    if (descriptor.type === 'boolean') {
      if (value === undefined) {
        return undefined;
      }
      if (value === true || value === false) {
        return value;
      }
      if (value === 'true' || value === 'false') {
        return value === 'true';
      }
      throw new TypeError(`${contextLabel} 必須為布林值`);
    }
    if (descriptor.type === 'string') {
      if (value === undefined || value === null) {
        return value;
      }
      return String(value);
    }
    if (descriptor.type === 'array') {
      if (!Array.isArray(value)) {
        throw new TypeError(`${contextLabel} 必須為陣列`);
      }
      return cloneDeep(value);
    }
    if (descriptor.type === 'object') {
      if (!isPlainObject(value)) {
        throw new TypeError(`${contextLabel} 必須為物件`);
      }
      return cloneDeep(value);
    }
    return value;
  }

  function applySchemaDefaults(schema, params, contextLabel) {
    if (!schema || typeof schema !== 'object') {
      return params && typeof params === 'object' ? cloneDeep(params) : {};
    }
    if (schema.type && schema.type !== 'object') {
      throw new TypeError(`${contextLabel} 僅支援 type=object 的 paramsSchema`);
    }
    const properties = schema.properties && typeof schema.properties === 'object' ? schema.properties : {};
    const allowAdditional = schema.additionalProperties !== false;
    const required = Array.isArray(schema.required) ? schema.required : [];
    const output = {};

    Object.keys(properties).forEach((key) => {
      const descriptor = properties[key];
      if (descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'default')) {
        output[key] = cloneDeep(descriptor.default);
      }
    });

    if (params !== undefined) {
      if (!isPlainObject(params)) {
        throw new TypeError(`${contextLabel} 需要傳入物件參數`);
      }
      Object.keys(params).forEach((key) => {
        const descriptor = properties[key];
        if (!descriptor) {
          if (allowAdditional) {
            output[key] = cloneDeep(params[key]);
          }
          return;
        }
        const sanitised = sanitiseByDescriptor(descriptor, params[key], `${contextLabel}.${key}`);
        if (sanitised !== undefined) {
          output[key] = sanitised;
        }
      });
    }

    required.forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(output, key) || output[key] === undefined) {
        throw new Error(`${contextLabel}.${key} 為必要欄位`);
      }
    });

    if (!allowAdditional) {
      Object.keys(output).forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(properties, key)) {
          delete output[key];
        }
      });
    }

    return output;
  }

  function ensureRuleResultShape(rawResult, info) {
    const label = info && info.pluginId ? `[${info.pluginId}]` : '[CompositeStrategy]';
    if (!isPlainObject(rawResult)) {
      throw new TypeError(`${label} RuleResult 必須為物件`);
    }
    const normalised = {
      enter: rawResult.enter === true,
      exit: rawResult.exit === true,
      short: rawResult.short === true,
      cover: rawResult.cover === true,
      stopLossPercent: null,
      takeProfitPercent: null,
      meta: {},
    };

    if (rawResult.stopLossPercent !== undefined && rawResult.stopLossPercent !== null) {
      const numeric = toNumber(rawResult.stopLossPercent);
      if (!Number.isFinite(numeric) || numeric < 0) {
        throw new TypeError(`${label} stopLossPercent 必須為非負數值或 null`);
      }
      normalised.stopLossPercent = numeric;
    }

    if (rawResult.takeProfitPercent !== undefined && rawResult.takeProfitPercent !== null) {
      const numeric = toNumber(rawResult.takeProfitPercent);
      if (!Number.isFinite(numeric) || numeric < 0) {
        throw new TypeError(`${label} takeProfitPercent 必須為非負數值或 null`);
      }
      normalised.takeProfitPercent = numeric;
    }

    if (rawResult.meta !== undefined) {
      if (rawResult.meta === null || typeof rawResult.meta !== 'object') {
        throw new TypeError(`${label} meta 必須為物件`);
      }
      normalised.meta = cloneDeep(rawResult.meta);
    }

    return normalised;
  }

  function pickMinNumeric(values) {
    const filtered = values.filter((value) => Number.isFinite(value) && value >= 0);
    if (filtered.length === 0) {
      return null;
    }
    return Math.min(...filtered);
  }

  function mergeMeta(op, childMetas) {
    return {
      op,
      children: childMetas.map((meta) => (isPlainObject(meta) ? cloneDeep(meta) : meta)),
    };
  }

  function combineResults(op, childResults) {
    const combined = {
      enter: false,
      exit: false,
      short: false,
      cover: false,
      stopLossPercent: null,
      takeProfitPercent: null,
      meta: {},
    };

    const fields = ['enter', 'exit', 'short', 'cover'];
    fields.forEach((field) => {
      const values = childResults.map((result) => Boolean(result && result[field] === true));
      combined[field] =
        op === 'AND' ? values.every((value) => value === true) : values.some((value) => value === true);
    });

    combined.stopLossPercent = pickMinNumeric(childResults.map((result) => result.stopLossPercent));
    combined.takeProfitPercent = pickMinNumeric(childResults.map((result) => result.takeProfitPercent));
    combined.meta = mergeMeta(op, childResults.map((result) => result.meta));
    return combined;
  }

  function invertResult(childResult) {
    const inverted = {
      enter: !Boolean(childResult && childResult.enter === true),
      exit: !Boolean(childResult && childResult.exit === true),
      short: !Boolean(childResult && childResult.short === true),
      cover: !Boolean(childResult && childResult.cover === true),
      stopLossPercent: null,
      takeProfitPercent: null,
      meta: {
        op: 'NOT',
        child: childResult && isPlainObject(childResult.meta) ? cloneDeep(childResult.meta) : childResult.meta,
      },
    };
    return inverted;
  }

  function compileNode(node, registry, path) {
    if (!node || typeof node !== 'object') {
      throw new TypeError(`${path} 節點必須為物件`);
    }

    if (typeof node.op === 'string') {
      const op = normaliseOp(node.op, `${path}.op`);
      if (op === 'NOT') {
        const child = node.rule !== undefined ? node.rule : Array.isArray(node.rules) ? node.rules[0] : undefined;
        if (!child) {
          throw new TypeError(`${path} NOT 需要提供 rule`);
        }
        const evaluateChild = compileNode(child, registry, `${path}>NOT`);
        return function evaluateNot(context, runtimeOptions) {
          const childResult = evaluateChild(context, runtimeOptions);
          return invertResult(childResult);
        };
      }

      if (!Array.isArray(node.rules) || node.rules.length === 0) {
        throw new TypeError(`${path} ${op} 需要 rules 陣列`);
      }
      const compiledChildren = node.rules.map((child, index) => compileNode(child, registry, `${path}>${op}[${index}]`));
      return function evaluateComposite(context, runtimeOptions) {
        const childResults = compiledChildren.map((evaluate) => evaluate(context, runtimeOptions));
        return combineResults(op, childResults);
      };
    }

    const pluginId = typeof node.plugin === 'string' ? node.plugin : typeof node.pluginId === 'string' ? node.pluginId : '';
    if (!pluginId || !pluginId.trim()) {
      throw new TypeError(`${path} 需要指定 plugin`);
    }
    const trimmedId = pluginId.trim();
    const plugin = loadPlugin(registry, trimmedId);
    const meta = loadMeta(registry, trimmedId, plugin);
    const baseParams = applySchemaDefaults(meta.paramsSchema, node.params, `[${trimmedId}] params`);
    const frozenParams = Object.freeze(baseParams);
    const contract = global && global.StrategyPluginContract;

    return function evaluateLeaf(context, runtimeOptions) {
      if (!context || typeof context !== 'object') {
        throw new TypeError(`[${trimmedId}] context 必須為物件`);
      }
      const overrides =
        runtimeOptions && runtimeOptions.perPlugin && runtimeOptions.perPlugin[trimmedId]
          ? runtimeOptions.perPlugin[trimmedId]
          : null;
      const params = overrides && typeof overrides === 'object' ? Object.freeze({ ...frozenParams, ...overrides }) : frozenParams;
      const rawResult = plugin.run(context, params);
      if (contract && typeof contract.ensureRuleResult === 'function') {
        return contract.ensureRuleResult(rawResult, {
          pluginId: trimmedId,
          role: context.role,
          index: typeof context.index === 'number' ? context.index : undefined,
        });
      }
      return ensureRuleResultShape(rawResult, {
        pluginId: trimmedId,
      });
    };
  }

  function buildComposite(dsl, registry, options) {
    const registryInstance = ensureRegistry(registry);
    const evaluator = compileNode(dsl, registryInstance, 'dsl');
    if (options && typeof options === 'object' && options.freezeEvaluator === true) {
      return Object.freeze(function compositeEvaluator(context, runtimeOptions) {
        return evaluator(context, runtimeOptions || {});
      });
    }
    return function compositeEvaluator(context, runtimeOptions) {
      return evaluator(context, runtimeOptions || {});
    };
  }

  const api = {
    buildComposite,
    applySchemaDefaults,
    __version__: PATCH_VERSION,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (global && typeof global === 'object') {
    if (!global.LazyStrategyDSL) {
      global.LazyStrategyDSL = {};
    }
    Object.assign(global.LazyStrategyDSL, api);
  }
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
