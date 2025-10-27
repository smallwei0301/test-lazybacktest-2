// Patch Tag: LB-STRATEGY-DSL-20250914A
(function (root) {
  const globalScope =
    (root && typeof root === 'object') || typeof root === 'function'
      ? root
      : typeof globalThis !== 'undefined'
      ? globalThis
      : typeof self !== 'undefined'
      ? self
      : this;
  if (!globalScope) {
    return;
  }

  let contract = globalScope.StrategyPluginContract;
  if (!contract && typeof module !== 'undefined' && module && typeof require === 'function') {
    try {
      const contractModule = require('./strategy-plugin-contract.js');
      if (contractModule && typeof contractModule.StrategyPluginContract === 'object') {
        contract = contractModule.StrategyPluginContract;
      }
    } catch (error) {
      // ignore optional Node fallback errors
    }
  }
  const DSL_VERSION = 'LB-STRATEGY-DSL-20250914A';
  const BOOLEAN_FIELDS = Object.freeze(['enter', 'exit', 'short', 'cover']);

  function createError(path, message) {
    return new Error(`[StrategyDSL] ${path} ${message}`);
  }

  function ensureContract() {
    if (!contract || typeof contract.ensureRuleResult !== 'function') {
      throw new Error('[StrategyDSL] StrategyPluginContract 尚未就緒');
    }
    return contract;
  }

  function ensureRegistry(registry) {
    const candidate = registry || globalScope.StrategyPluginRegistry;
    if (!candidate) {
      throw new Error('[StrategyDSL] 需要提供 StrategyPluginRegistry 實例');
    }
    if (typeof candidate.getStrategyById !== 'function') {
      throw new TypeError('[StrategyDSL] registry 需實作 getStrategyById(id)');
    }
    if (typeof candidate.getStrategyMetaById !== 'function') {
      throw new TypeError('[StrategyDSL] registry 需實作 getStrategyMetaById(id)');
    }
    return candidate;
  }

  function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function toFiniteNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : NaN;
  }

  function validateNumericBounds(descriptor, value, pathLabel) {
    if ('minimum' in descriptor) {
      const min = Number(descriptor.minimum);
      if (value < min) {
        throw createError(pathLabel, `需大於或等於 ${min}`);
      }
    }
    if ('maximum' in descriptor) {
      const max = Number(descriptor.maximum);
      if (value > max) {
        throw createError(pathLabel, `需小於或等於 ${max}`);
      }
    }
    if ('exclusiveMinimum' in descriptor) {
      const min = Number(descriptor.exclusiveMinimum);
      if (!(value > min)) {
        throw createError(pathLabel, `需嚴格大於 ${min}`);
      }
    }
    if ('exclusiveMaximum' in descriptor) {
      const max = Number(descriptor.exclusiveMaximum);
      if (!(value < max)) {
        throw createError(pathLabel, `需嚴格小於 ${max}`);
      }
    }
    if ('multipleOf' in descriptor) {
      const unit = Number(descriptor.multipleOf);
      if (unit > 0 && Math.abs(value / unit - Math.round(value / unit)) > 1e-9) {
        throw createError(pathLabel, `需為 ${unit} 的倍數`);
      }
    }
  }

  function applyEnum(descriptor, value, pathLabel) {
    if (!Array.isArray(descriptor.enum)) {
      return value;
    }
    if (!descriptor.enum.includes(value)) {
      throw createError(pathLabel, `需為允許值 ${JSON.stringify(descriptor.enum)}`);
    }
    return value;
  }

  function coerceParamValue(descriptor, rawValue, pathLabel) {
    if (!descriptor || typeof descriptor !== 'object') {
      return rawValue;
    }
    const type = descriptor.type;
    if (type === 'integer' || type === 'number') {
      const numeric = toFiniteNumber(rawValue);
      if (!Number.isFinite(numeric)) {
        throw createError(pathLabel, '需為有效數值');
      }
      if (type === 'integer') {
        const rounded = Math.round(numeric);
        if (!Number.isInteger(rounded)) {
          throw createError(pathLabel, '需為整數');
        }
        validateNumericBounds(descriptor, rounded, pathLabel);
        return applyEnum(descriptor, rounded, pathLabel);
      }
      validateNumericBounds(descriptor, numeric, pathLabel);
      return applyEnum(descriptor, numeric, pathLabel);
    }
    if (type === 'boolean') {
      if (typeof rawValue !== 'boolean') {
        throw createError(pathLabel, '需為布林值');
      }
      return applyEnum(descriptor, rawValue, pathLabel);
    }
    if (type === 'string') {
      if (typeof rawValue !== 'string') {
        throw createError(pathLabel, '需為字串');
      }
      return applyEnum(descriptor, rawValue, pathLabel);
    }
    return applyEnum(descriptor, rawValue, pathLabel);
  }

  function normaliseParams(meta, params, pathLabel) {
    if (!meta || !meta.paramsSchema) {
      if (params === undefined) {
        return {};
      }
      if (!isObject(params)) {
        throw createError(pathLabel, '需為物件');
      }
      return { ...params };
    }
    const schema = meta.paramsSchema;
    if ((schema.type && schema.type !== 'object') || !isObject(schema)) {
      throw createError(pathLabel, 'paramsSchema 僅支援 type="object"');
    }
    if (params !== undefined && !isObject(params)) {
      throw createError(pathLabel, '需為物件');
    }
    const source = params || {};
    const result = {};
    const descriptors = schema.properties && isObject(schema.properties) ? schema.properties : {};
    Object.keys(descriptors).forEach((key) => {
      const descriptor = descriptors[key];
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        result[key] = coerceParamValue(descriptor, source[key], `${pathLabel}.${key}`);
      } else if (Object.prototype.hasOwnProperty.call(descriptor, 'default')) {
        result[key] = descriptor.default;
      }
    });
    const requiredFields = Array.isArray(schema.required) ? schema.required : [];
    requiredFields.forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(result, key)) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          return;
        }
        throw createError(`${pathLabel}.${key}`, '為必要參數');
      }
    });
    const additionalAllowed = schema.additionalProperties !== false;
    Object.keys(source).forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(descriptors, key)) {
        return;
      }
      if (!additionalAllowed) {
        throw createError(`${pathLabel}.${key}`, '不在允許的參數清單內');
      }
      const value = source[key];
      if (typeof value === 'function') {
        throw createError(`${pathLabel}.${key}`, '不可為函式');
      }
      result[key] = value;
    });
    return result;
  }

  function freezeMeta(meta) {
    if (!isObject(meta)) {
      return Object.freeze({});
    }
    const clone = { ...meta };
    return Object.freeze(clone);
  }

  function freezeResult(result) {
    const clone = {
      enter: result.enter === true,
      exit: result.exit === true,
      short: result.short === true,
      cover: result.cover === true,
      stopLossPercent:
        typeof result.stopLossPercent === 'number' && Number.isFinite(result.stopLossPercent)
          ? result.stopLossPercent
          : null,
      takeProfitPercent:
        typeof result.takeProfitPercent === 'number' && Number.isFinite(result.takeProfitPercent)
          ? result.takeProfitPercent
          : null,
      meta: freezeMeta(result.meta),
    };
    return Object.freeze(clone);
  }

  function aggregatePercent(children, finalFlags, fieldName, selector) {
    if (!finalFlags[fieldName]) {
      return null;
    }
    const values = [];
    children.forEach((child) => {
      if (child[fieldName]) {
        const numeric = selector(child);
        if (typeof numeric === 'number' && Number.isFinite(numeric)) {
          values.push(numeric);
        }
      }
    });
    if (values.length === 0) {
      return null;
    }
    return selector === getStopLoss ? Math.min(...values) : Math.max(...values);
  }

  function getStopLoss(child) {
    return child.stopLossPercent;
  }

  function getTakeProfit(child) {
    return child.takeProfitPercent;
  }

  function combineChildren(op, childResults) {
    if (op === 'NOT') {
      const child = childResults[0];
      const combined = {
        enter: !child.enter,
        exit: !child.exit,
        short: !child.short,
        cover: !child.cover,
        stopLossPercent: null,
        takeProfitPercent: null,
        meta: {
          type: 'composite',
          op,
          children: childResults.map((item) => item.meta),
          truthTable: {
            enter: [child.enter],
            exit: [child.exit],
            short: [child.short],
            cover: [child.cover],
          },
        },
      };
      return freezeResult(combined);
    }
    const aggregator = op === 'AND' ? 'every' : 'some';
    const boolResult = {};
    BOOLEAN_FIELDS.forEach((field) => {
      boolResult[field] = childResults[aggregator]((item) => item[field] === true);
    });
    const percentField = ['enter', 'short', 'exit', 'cover'].find((field) => boolResult[field]);
    const combined = {
      ...boolResult,
      stopLossPercent:
        percentField !== undefined
          ? aggregatePercent(childResults, boolResult, percentField, getStopLoss)
          : null,
      takeProfitPercent:
        percentField !== undefined
          ? aggregatePercent(childResults, boolResult, percentField, getTakeProfit)
          : null,
      meta: {
        type: 'composite',
        op,
        children: childResults.map((item) => item.meta),
        truthTable: BOOLEAN_FIELDS.reduce((acc, field) => {
          acc[field] = childResults.map((item) => item[field]);
          return acc;
        }, {}),
      },
    };
    return freezeResult(combined);
  }

  function compilePluginNode(node, registry, pathLabel) {
    if (!isObject(node)) {
      throw createError(pathLabel, '需為物件');
    }
    if (typeof node.plugin !== 'string' || !node.plugin.trim()) {
      throw createError(`${pathLabel}.plugin`, '需為非空字串');
    }
    const pluginId = node.plugin.trim();
    const plugin = registry.getStrategyById(pluginId);
    if (!plugin || typeof plugin.run !== 'function' || !plugin.meta) {
      throw createError(`${pathLabel}.plugin`, `找不到已註冊的插件 ${pluginId}`);
    }
    const params = normaliseParams(plugin.meta, node.params, `${pathLabel}.params`);
    const frozenParams = Object.freeze({ ...params });
    const contractApi = ensureContract();
    return function executePlugin(context) {
      const rawResult = plugin.run(context, frozenParams);
      const ensured = contractApi.ensureRuleResult(rawResult, {
        pluginId: plugin.meta.id,
        role: context && context.role,
        index: context && typeof context.index === 'number' ? context.index : undefined,
      });
      const pluginMeta = {
        type: 'plugin',
        pluginId: plugin.meta.id,
        label: plugin.meta.label,
        params: frozenParams,
        outputMeta: ensured.meta,
      };
      return freezeResult({ ...ensured, meta: pluginMeta });
    };
  }

  function compileCompositeNode(node, registry, pathLabel) {
    if (!isObject(node)) {
      throw createError(pathLabel, '需為物件');
    }
    const op = typeof node.op === 'string' ? node.op.trim().toUpperCase() : '';
    if (!op) {
      return compilePluginNode(node, registry, pathLabel);
    }
    if (!['AND', 'OR', 'NOT'].includes(op)) {
      throw createError(`${pathLabel}.op`, '僅支援 AND/OR/NOT');
    }
    if (op === 'NOT') {
      const child = node.rule || node.rules;
      if (!child) {
        throw createError(`${pathLabel}.rule`, 'NOT 需提供單一子節點');
      }
      const compiled = [compileCompositeNode(child, registry, `${pathLabel}.rule`)];
      return function evaluateNot(context) {
        const childResults = compiled.map((fn) => fn(context));
        return combineChildren(op, childResults);
      };
    }
    const rules = Array.isArray(node.rules) ? node.rules : [];
    if (rules.length === 0) {
      throw createError(`${pathLabel}.rules`, `${op} 需提供至少一個子節點`);
    }
    const compiledChildren = rules.map((rule, index) =>
      compileCompositeNode(rule, registry, `${pathLabel}.rules[${index}]`),
    );
    return function evaluateComposite(context) {
      const childResults = compiledChildren.map((fn) => fn(context));
      return combineChildren(op, childResults);
    };
  }

  function buildComposite(definition, registry) {
    if (!isObject(definition)) {
      throw createError('root', 'DSL 定義需為物件');
    }
    const activeRegistry = ensureRegistry(registry);
    const evaluator = compileCompositeNode(definition, activeRegistry, 'root');
    const composite = function compositeEvaluator(context) {
      if (!isObject(context)) {
        throw createError('context', '需提供 context 物件');
      }
      return evaluator(context);
    };
    return Object.freeze({
      evaluate: composite,
      __version__: DSL_VERSION,
    });
  }

  const api = Object.freeze({
    buildComposite,
    __version__: DSL_VERSION,
  });

  Object.defineProperty(globalScope, 'StrategyDSL', {
    value: api,
    configurable: false,
    enumerable: true,
    writable: false,
  });
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this);
