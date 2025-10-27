// Patch Tag: LB-COMPOSER-DSL-20260305B
(function (root) {
  const globalScope = root || (typeof self !== 'undefined' ? self : this);
  if (!globalScope) {
    return;
  }

  const VERSION = 'LB-COMPOSER-DSL-20260305B';
  const existing = globalScope.StrategyComposer;
  if (existing && typeof existing.__version__ === 'string' && existing.__version__ >= VERSION) {
    return;
  }

  function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function cloneParams(value) {
    if (!isPlainObject(value)) {
      return {};
    }
    return { ...value };
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

  function ensureRuleResultFactory(contract) {
    if (contract && typeof contract.ensureRuleResult === 'function') {
      return contract.ensureRuleResult.bind(contract);
    }
    return (rawResult) => {
      const base = createEmptyResult();
      if (!rawResult || typeof rawResult !== 'object') {
        return base;
      }
      const candidate = /** @type {Record<string, unknown>} */ (rawResult);
      const result = createEmptyResult();
      result.enter = candidate.enter === true;
      result.exit = candidate.exit === true;
      result.short = candidate.short === true;
      result.cover = candidate.cover === true;
      if (Number.isFinite(candidate.stopLossPercent)) {
        result.stopLossPercent = Number(candidate.stopLossPercent);
      }
      if (Number.isFinite(candidate.takeProfitPercent)) {
        result.takeProfitPercent = Number(candidate.takeProfitPercent);
      }
      if (candidate.meta && typeof candidate.meta === 'object' && !Array.isArray(candidate.meta)) {
        result.meta = { ...candidate.meta };
      }
      return result;
    };
  }

  function resolveEnsureRuleResult(options) {
    if (options && typeof options.ensureRuleResult === 'function') {
      return options.ensureRuleResult;
    }
    let contract = null;
    if (options && options.contract && typeof options.contract === 'object') {
      contract = options.contract;
    } else if (globalScope.StrategyPluginContract) {
      contract = globalScope.StrategyPluginContract;
    }
    return ensureRuleResultFactory(contract);
  }

  function mergeMeta(target, source) {
    if (!isPlainObject(source)) {
      return target;
    }
    const merged = isPlainObject(target) ? { ...target } : {};
    Object.keys(source).forEach((key) => {
      const value = source[key];
      if (isPlainObject(value)) {
        merged[key] = mergeMeta(merged[key], value);
      } else if (Array.isArray(value)) {
        merged[key] = value.slice();
      } else {
        merged[key] = value;
      }
    });
    return merged;
  }

  function adoptRiskFields(target, source, condition) {
    if (!source || typeof source !== 'object') {
      return;
    }
    if (condition && target.stopLossPercent === null && Number.isFinite(source.stopLossPercent)) {
      target.stopLossPercent = Number(source.stopLossPercent);
    }
    if (condition && target.takeProfitPercent === null && Number.isFinite(source.takeProfitPercent)) {
      target.takeProfitPercent = Number(source.takeProfitPercent);
    }
  }

  function buildPluginEvaluator(node, registry, options, ensureRuleResult) {
    const strategyId = typeof node.strategy === 'string' ? node.strategy.trim() : '';
    if (!strategyId) {
      throw new TypeError('StrategyComposer plugin 節點需要提供 strategy');
    }
    const rawParams = node.params && typeof node.params === 'object' ? node.params : {};
    const prepareParams =
      typeof options.prepareParams === 'function'
        ? options.prepareParams
        : globalScope.StrategyParamUtils &&
            typeof globalScope.StrategyParamUtils.buildParamsWithSchema === 'function'
        ? (id, params) => globalScope.StrategyParamUtils.buildParamsWithSchema(registry, id, params)
        : null;
    const params = prepareParams ? prepareParams(strategyId, rawParams) : cloneParams(rawParams);

    const invoke =
      typeof options.invoke === 'function'
        ? options.invoke
        : (id, context, preparedParams) => {
            if (!registry || typeof registry !== 'object') {
              return createEmptyResult();
            }
            let plugin = null;
            if (typeof registry.getStrategyById === 'function') {
              plugin = registry.getStrategyById(id);
            } else if (typeof registry.get === 'function') {
              plugin = registry.get(id);
            }
            if (!plugin || typeof plugin.run !== 'function') {
              return createEmptyResult();
            }
            const raw = plugin.run(context, preparedParams || {});
            return ensureRuleResult(raw, {
              pluginId: id,
              role: context?.role,
              index: context?.index,
            });
          };

    return (context, extras) => {
      const evaluated = invoke(strategyId, context, params, extras);
      if (!evaluated) {
        return createEmptyResult();
      }
      return ensureRuleResult(evaluated, {
        pluginId: strategyId,
        role: context?.role,
        index: context?.index,
      });
    };
  }

  function buildLogicalEvaluator(node, registry, options, ensureRuleResult) {
    const op = typeof node.op === 'string' ? node.op.toUpperCase() : '';
    if (op !== 'AND' && op !== 'OR' && op !== 'NOT') {
      throw new TypeError(`StrategyComposer 未支援的運算子: ${node.op}`);
    }
    if (op === 'NOT') {
      const childDef = node.rule || node.rules?.[0];
      if (!childDef) {
        throw new TypeError('StrategyComposer NOT 需要提供子規則');
      }
      const childEvaluator = buildEvaluator(childDef, registry, options, ensureRuleResult);
      return (context, extras) => {
        const child = childEvaluator(context, extras) || createEmptyResult();
        const inverted = createEmptyResult();
        inverted.enter = !child.enter;
        inverted.exit = !child.exit;
        inverted.short = !child.short;
        inverted.cover = !child.cover;
        if (child.meta && typeof child.meta === 'object') {
          inverted.meta = mergeMeta({}, child.meta);
        }
        return inverted;
      };
    }
    const rules = Array.isArray(node.rules) ? node.rules : [];
    if (rules.length === 0) {
      throw new TypeError(`StrategyComposer ${op} 需要至少一個子規則`);
    }
    const evaluators = rules.map((child) => buildEvaluator(child, registry, options, ensureRuleResult));
    if (op === 'AND') {
      return (context, extras) => {
        const aggregated = createEmptyResult();
        aggregated.enter = true;
        aggregated.exit = true;
        aggregated.short = true;
        aggregated.cover = true;
        let meta = {};
        for (let i = 0; i < evaluators.length; i += 1) {
          const result = evaluators[i](context, extras) || createEmptyResult();
          aggregated.enter = aggregated.enter && result.enter === true;
          aggregated.exit = aggregated.exit && result.exit === true;
          aggregated.short = aggregated.short && result.short === true;
          aggregated.cover = aggregated.cover && result.cover === true;
          if (result.enter === true || result.exit === true || result.short === true || result.cover === true) {
            adoptRiskFields(aggregated, result, true);
          }
          meta = mergeMeta(meta, result.meta);
        }
        if (!evaluators.length) {
          aggregated.enter = false;
          aggregated.exit = false;
          aggregated.short = false;
          aggregated.cover = false;
        }
        if (!aggregated.enter && !aggregated.exit && !aggregated.short && !aggregated.cover) {
          aggregated.stopLossPercent = null;
          aggregated.takeProfitPercent = null;
        }
        aggregated.meta = meta;
        return aggregated;
      };
    }
    return (context, extras) => {
      const aggregated = createEmptyResult();
      let meta = {};
      for (let i = 0; i < evaluators.length; i += 1) {
        const result = evaluators[i](context, extras) || createEmptyResult();
        const beforeEnter = aggregated.enter;
        const beforeExit = aggregated.exit;
        const beforeShort = aggregated.short;
        const beforeCover = aggregated.cover;
        aggregated.enter = aggregated.enter || result.enter === true;
        aggregated.exit = aggregated.exit || result.exit === true;
        aggregated.short = aggregated.short || result.short === true;
        aggregated.cover = aggregated.cover || result.cover === true;
        if (!beforeEnter && aggregated.enter) {
          adoptRiskFields(aggregated, result, true);
        }
        if (!beforeExit && aggregated.exit) {
          adoptRiskFields(aggregated, result, true);
        }
        if (!beforeShort && aggregated.short) {
          adoptRiskFields(aggregated, result, true);
        }
        if (!beforeCover && aggregated.cover) {
          adoptRiskFields(aggregated, result, true);
        }
        meta = mergeMeta(meta, result.meta);
      }
      aggregated.meta = meta;
      return aggregated;
    };
  }

  function buildEvaluator(definition, registry, options, ensureRuleResult) {
    if (!definition || typeof definition !== 'object') {
      throw new TypeError('StrategyComposer 規則必須為物件');
    }
    if (typeof definition.strategy === 'string' && definition.strategy) {
      return buildPluginEvaluator(definition, registry, options, ensureRuleResult);
    }
    if (typeof definition.op === 'string') {
      return buildLogicalEvaluator(definition, registry, options, ensureRuleResult);
    }
    throw new TypeError('StrategyComposer 規則缺少 strategy 或 op 欄位');
  }

  function buildComposite(definition, registry, options) {
    const resolvedOptions = options || {};
    const ensureRuleResult = resolveEnsureRuleResult(resolvedOptions);
    const evaluator = buildEvaluator(definition, registry, resolvedOptions, ensureRuleResult);
    return (context, extras) => {
      const safeContext = isPlainObject(context)
        ? {
            role: context.role,
            index: context.index,
            series: context.series,
            helpers: context.helpers,
            runtime: context.runtime,
          }
        : context;
      return evaluator(safeContext, extras);
    };
  }

  const api = Object.freeze({
    buildComposite,
    createEmptyResult,
    __version__: VERSION,
  });

  Object.defineProperty(globalScope, 'StrategyComposer', {
    value: api,
    writable: false,
    enumerable: true,
    configurable: false,
  });
})(typeof self !== 'undefined' ? self : this);
