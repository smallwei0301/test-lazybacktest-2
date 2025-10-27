// Patch Tag: LB-DSL-COMPOSER-20250713A
(function (globalScope) {
  const root = globalScope || (typeof globalThis !== 'undefined' ? globalThis : {});
  const PATCH_VERSION = 'LB-DSL-COMPOSER-20250713A';
  if (root && root.LazyStrategyDslComposer && typeof root.LazyStrategyDslComposer.__version__ === 'string') {
    if (root.LazyStrategyDslComposer.__version__ >= PATCH_VERSION) {
      return;
    }
  }

  const BOOLEAN_FIELDS = Object.freeze(['enter', 'exit', 'short', 'cover']);
  const ROLE_FIELD_MAP = Object.freeze({
    longEntry: 'enter',
    longExit: 'exit',
    shortEntry: 'short',
    shortExit: 'cover',
  });

  function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function clonePlain(value) {
    if (Array.isArray(value)) {
      return value.map((item) => clonePlain(item));
    }
    if (isPlainObject(value)) {
      const output = {};
      Object.keys(value).forEach((key) => {
        output[key] = clonePlain(value[key]);
      });
      return output;
    }
    return value;
  }

  function deepFreeze(value) {
    if (!isPlainObject(value) && !Array.isArray(value)) {
      return value;
    }
    Object.freeze(value);
    if (Array.isArray(value)) {
      value.forEach((item) => {
        deepFreeze(item);
      });
    } else {
      Object.keys(value).forEach((key) => {
        const child = value[key];
        if (isPlainObject(child) || Array.isArray(child)) {
          deepFreeze(child);
        }
      });
    }
    return value;
  }

  function toFiniteNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  function toPercentOrNull(value) {
    const num = toFiniteNumber(value);
    if (num === null) {
      return null;
    }
    if (num < 0) {
      return 0;
    }
    if (num > 100) {
      return 100;
    }
    return num;
  }

  function resolveRoleField(role) {
    return ROLE_FIELD_MAP[role] || null;
  }

  function createBaseResult() {
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
    if (!isPlainObject(meta) && !Array.isArray(meta)) {
      return meta;
    }
    const cloned = clonePlain(meta);
    return cloned;
  }

  function applySchemaDefaults(schema, rawParams) {
    if (!isPlainObject(schema)) {
      return rawParams && isPlainObject(rawParams) ? clonePlain(rawParams) : {};
    }
    const properties = isPlainObject(schema.properties) ? schema.properties : {};
    const output = {};
    Object.keys(properties).forEach((key) => {
      const descriptor = properties[key];
      if (descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'default')) {
        output[key] = clonePlain(descriptor.default);
      }
    });
    if (!isPlainObject(rawParams)) {
      return output;
    }
    Object.keys(rawParams).forEach((key) => {
      const descriptor = properties[key];
      const value = rawParams[key];
      if (descriptor && (descriptor.type === 'integer' || descriptor.type === 'number')) {
        const numeric = toFiniteNumber(value);
        if (numeric !== null) {
          let normalised = numeric;
          if (descriptor.type === 'integer') {
            normalised = Math.round(normalised);
          }
          if (Number.isFinite(descriptor.minimum)) {
            normalised = Math.max(descriptor.minimum, normalised);
          }
          if (Number.isFinite(descriptor.maximum)) {
            normalised = Math.min(descriptor.maximum, normalised);
          }
          output[key] = normalised;
          return;
        }
      }
      output[key] = clonePlain(value);
    });
    return output;
  }

  function ensureRegistry(registry) {
    if (!registry || typeof registry !== 'object') {
      throw new TypeError('buildComposite 需要傳入 StrategyPluginRegistry 實例');
    }
    if (
      typeof registry.getStrategyById !== 'function' &&
      typeof registry.get !== 'function'
    ) {
      throw new TypeError('StrategyPluginRegistry 需要提供 getStrategyById 或 get 方法');
    }
    if (typeof registry.getStrategyMetaById !== 'function') {
      throw new TypeError('StrategyPluginRegistry 需要提供 getStrategyMetaById');
    }
    if (typeof registry.registerStrategy !== 'function' && typeof registry.register !== 'function') {
      throw new TypeError('StrategyPluginRegistry 需要提供 registerStrategy 方法');
    }
    return registry;
  }

  function defaultEnsureRuleResult(rawResult) {
    if (!isPlainObject(rawResult)) {
      throw new TypeError('StrategyPlugin 必須回傳 RuleResult 物件');
    }
    const result = {
      enter: rawResult.enter === true,
      exit: rawResult.exit === true,
      short: rawResult.short === true,
      cover: rawResult.cover === true,
      stopLossPercent: toPercentOrNull(rawResult.stopLossPercent),
      takeProfitPercent: toPercentOrNull(rawResult.takeProfitPercent),
      meta: isPlainObject(rawResult.meta) ? clonePlain(rawResult.meta) : {},
    };
    return result;
  }

  function combineBoolean(op, values) {
    if (op === 'AND') {
      return values.every((val) => val === true);
    }
    if (op === 'OR') {
      return values.some((val) => val === true);
    }
    return false;
  }

  function pickFirstNumeric(results, key, roleField) {
    if (roleField) {
      for (let i = 0; i < results.length; i += 1) {
        const res = results[i];
        if (res && res[roleField] === true) {
          const numeric = toPercentOrNull(res[key]);
          if (numeric !== null) {
            return numeric;
          }
        }
      }
    }
    for (let i = 0; i < results.length; i += 1) {
      const numeric = toPercentOrNull(results[i]?.[key]);
      if (numeric !== null) {
        return numeric;
      }
    }
    return null;
  }

  function mergeCompositeMeta(op, childResults) {
    return {
      type: 'composite',
      op,
      children: childResults.map((item) => cloneMeta(item.meta)),
    };
  }

  function buildCompositeAggregator(op, evaluators) {
    return function evaluateComposite(context) {
      const roleField = resolveRoleField(context?.role);
      const childResults = evaluators.map((fn) => fn(context));
      if (op === 'NOT') {
        const baseResult = childResults[0] || createBaseResult();
        const cloned = {
          enter: baseResult.enter,
          exit: baseResult.exit,
          short: baseResult.short,
          cover: baseResult.cover,
          stopLossPercent: toPercentOrNull(baseResult.stopLossPercent),
          takeProfitPercent: toPercentOrNull(baseResult.takeProfitPercent),
          meta: mergeCompositeMeta('NOT', childResults),
        };
        if (roleField) {
          cloned[roleField] = !baseResult[roleField];
        } else {
          BOOLEAN_FIELDS.forEach((field) => {
            cloned[field] = !baseResult[field];
          });
        }
        return cloned;
      }
      const result = createBaseResult();
      BOOLEAN_FIELDS.forEach((field) => {
        result[field] = combineBoolean(op, childResults.map((item) => item[field] === true));
      });
      result.stopLossPercent = pickFirstNumeric(childResults, 'stopLossPercent', roleField);
      result.takeProfitPercent = pickFirstNumeric(childResults, 'takeProfitPercent', roleField);
      result.meta = mergeCompositeMeta(op, childResults);
      return result;
    };
  }

  function resolvePluginEntry(registry, pluginId) {
    if (typeof registry.getStrategyById === 'function') {
      return registry.getStrategyById(pluginId);
    }
    if (typeof registry.get === 'function') {
      return registry.get(pluginId);
    }
    return null;
  }

  function buildLeafEvaluator(node, context, path) {
    const pluginIdRaw =
      typeof node.plugin === 'string'
        ? node.plugin
        : typeof node.strategy === 'string'
        ? node.strategy
        : typeof node.strategyId === 'string'
        ? node.strategyId
        : typeof node.id === 'string'
        ? node.id
        : '';
    const pluginId = pluginIdRaw.trim();
    if (!pluginId) {
      throw new Error(`${path} 缺少 plugin/strategyId`);
    }
    const registry = context.registry;
    let plugin = null;
    try {
      plugin = resolvePluginEntry(registry, pluginId);
    } catch (error) {
      throw new Error(`${path} 讀取策略 ${pluginId} 失敗：${error.message}`);
    }
    if (!plugin || typeof plugin.run !== 'function') {
      throw new Error(`${path} 找不到策略 ${pluginId}`);
    }
    const meta = plugin.meta || { id: pluginId, label: pluginId };
    const paramsSchema = meta && meta.paramsSchema ? meta.paramsSchema : undefined;
    const params = applySchemaDefaults(paramsSchema, node.params);
    const frozenParams = deepFreeze(clonePlain(params));
    const ensureRuleResultFn = context.ensureRuleResult;

    return function evaluateLeaf(ruleContext) {
      const result = ensureRuleResultFn(plugin.run(ruleContext, frozenParams), {
        pluginId: meta.id,
        role: ruleContext?.role,
        index: ruleContext?.index,
      });
      return {
        enter: result.enter === true,
        exit: result.exit === true,
        short: result.short === true,
        cover: result.cover === true,
        stopLossPercent: toPercentOrNull(result.stopLossPercent),
        takeProfitPercent: toPercentOrNull(result.takeProfitPercent),
        meta: {
          type: 'leaf',
          pluginId: meta.id,
          label: meta.label || meta.id,
          params: frozenParams,
          details: cloneMeta(result.meta || {}),
        },
      };
    };
  }

  function buildNode(definition, context, path) {
    if (!isPlainObject(definition)) {
      throw new TypeError(`${path} 必須為物件`);
    }
    const opRaw = typeof definition.op === 'string' ? definition.op.trim().toUpperCase() : null;
    if (opRaw === 'AND' || opRaw === 'OR') {
      const rules = Array.isArray(definition.rules) ? definition.rules : [];
      if (rules.length === 0) {
        throw new Error(`${path}.rules 至少需要一項`);
      }
      const evaluators = rules.map((rule, index) => buildNode(rule, context, `${path}.rules[${index}]`));
      return buildCompositeAggregator(opRaw, evaluators);
    }
    if (opRaw === 'NOT') {
      let targetRule = null;
      if (Array.isArray(definition.rules) && definition.rules.length > 0) {
        [targetRule] = definition.rules;
      } else if (definition.rule) {
        targetRule = definition.rule;
      }
      if (!targetRule) {
        throw new Error(`${path}.rule 必須提供 NOT 的子節點`);
      }
      const evaluator = buildNode(targetRule, context, `${path}.rule`);
      return buildCompositeAggregator('NOT', [evaluator]);
    }
    if (opRaw === 'PLUGIN') {
      return buildLeafEvaluator(definition, context, path);
    }
    if (definition.plugin || definition.strategy || definition.strategyId || definition.id) {
      return buildLeafEvaluator(definition, context, path);
    }
    throw new Error(`${path} 缺少有效的 op 或 plugin 定義`);
  }

  function buildComposite(definition, registry, options) {
    const ensuredRegistry = ensureRegistry(registry);
    const ensureRuleResultFn =
      (options && options.contract && typeof options.contract.ensureRuleResult === 'function'
        ? options.contract.ensureRuleResult
        : null) ||
      (root.StrategyPluginContract && typeof root.StrategyPluginContract.ensureRuleResult === 'function'
        ? root.StrategyPluginContract.ensureRuleResult
        : null) ||
      defaultEnsureRuleResult;

    const context = {
      registry: ensuredRegistry,
      ensureRuleResult: (candidate, info) => ensureRuleResultFn(candidate, info),
    };

    const evaluator = buildNode(definition, context, '#');
    return function compositeEvaluator(strategyContext) {
      return evaluator(strategyContext || {});
    };
  }

  const api = {
    buildComposite,
    __version__: PATCH_VERSION,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  if (root && typeof root === 'object') {
    const existing = root.LazyStrategyDslComposer || {};
    const next = Object.assign({}, existing, api);
    Object.defineProperty(next, '__version__', {
      value: PATCH_VERSION,
      enumerable: false,
      configurable: false,
      writable: false,
    });
    Object.defineProperty(root, 'LazyStrategyDslComposer', {
      value: next,
      configurable: false,
      enumerable: true,
      writable: false,
    });
  }
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : this);
