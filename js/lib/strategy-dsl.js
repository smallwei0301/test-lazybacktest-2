// Patch Tag: LB-DSL-COMPOSER-20260915A
(function (root) {
  const globalScope = root || (typeof self !== 'undefined' ? self : typeof global !== 'undefined' ? global : this);
  if (!globalScope) {
    return;
  }

  const DSL_VERSION = 'LB-DSL-COMPOSER-20260915A';
  const existing = globalScope.LazyStrategyDSL;
  if (existing && typeof existing.__version__ === 'string' && existing.__version__ >= DSL_VERSION) {
    return;
  }

  const contract =
    globalScope.StrategyPluginContract &&
    typeof globalScope.StrategyPluginContract.ensureRuleResult === 'function'
      ? globalScope.StrategyPluginContract
      : null;

  function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function cloneDeep(value) {
    if (!isPlainObject(value)) {
      return value;
    }
    const cloned = {};
    Object.keys(value).forEach((key) => {
      const val = value[key];
      if (Array.isArray(val)) {
        cloned[key] = val.map((item) => cloneDeep(item));
      } else if (isPlainObject(val)) {
        cloned[key] = cloneDeep(val);
      } else {
        cloned[key] = val;
      }
    });
    return cloned;
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

  function createEmptyRuleResult() {
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

  function normaliseOperator(op) {
    if (typeof op !== 'string') {
      return '';
    }
    return op.trim().toUpperCase();
  }

  function ensureRuleResult(rawResult, info) {
    if (!contract) {
      if (!rawResult || typeof rawResult !== 'object') {
        return createEmptyRuleResult();
      }
      const base = createEmptyRuleResult();
      base.enter = rawResult.enter === true;
      base.exit = rawResult.exit === true;
      base.short = rawResult.short === true;
      base.cover = rawResult.cover === true;
      base.stopLossPercent = Number.isFinite(rawResult.stopLossPercent)
        ? Number(rawResult.stopLossPercent)
        : null;
      base.takeProfitPercent = Number.isFinite(rawResult.takeProfitPercent)
        ? Number(rawResult.takeProfitPercent)
        : null;
      base.meta = isPlainObject(rawResult.meta) ? rawResult.meta : {};
      return base;
    }
    try {
      return contract.ensureRuleResult(rawResult, info);
    } catch (error) {
      if (typeof console !== 'undefined' && console.error) {
        console.error('[StrategyDSL] ensureRuleResult 失敗', error);
      }
      return createEmptyRuleResult();
    }
  }

  function buildCombinationMeta(op, childEvaluations, combinedSignals) {
    const meta = {
      op,
      children: [],
    };
    let primary = null;
    childEvaluations.forEach((childEval, index) => {
      const rule = childEval.rule || createEmptyRuleResult();
      const childMeta = isPlainObject(rule.meta) ? rule.meta : {};
      meta.children.push({
        index,
        strategyId: childEval.strategyId || null,
        signals: {
          enter: rule.enter === true,
          exit: rule.exit === true,
          short: rule.short === true,
          cover: rule.cover === true,
        },
        meta: cloneDeep(childMeta),
      });
      const isRelevant =
        (combinedSignals.enter && rule.enter) ||
        (combinedSignals.exit && rule.exit) ||
        (combinedSignals.short && rule.short) ||
        (combinedSignals.cover && rule.cover);
      if (!primary && isRelevant) {
        primary = childMeta;
      }
    });
    if (!primary && meta.children.length > 0) {
      primary = meta.children[0].meta;
    }
    if (isPlainObject(primary)) {
      if (primary.indicatorValues && !meta.indicatorValues) {
        meta.indicatorValues = primary.indicatorValues;
      }
      if (primary.kdValues && !meta.kdValues) {
        meta.kdValues = primary.kdValues;
      }
      if (primary.macdValues && !meta.macdValues) {
        meta.macdValues = primary.macdValues;
      }
      if (primary.note && !meta.note) {
        meta.note = primary.note;
      }
    }
    return meta;
  }

  function selectFirstNumeric(childEvaluations, field) {
    for (let i = 0; i < childEvaluations.length; i += 1) {
      const candidate = childEvaluations[i].rule;
      if (candidate && candidate[field] !== null && candidate[field] !== undefined) {
        const numeric = Number(candidate[field]);
        if (Number.isFinite(numeric)) {
          return numeric;
        }
      }
    }
    return null;
  }

  function combineAnd(childEvaluations) {
    const combined = createEmptyRuleResult();
    if (childEvaluations.length === 0) {
      return combined;
    }
    combined.enter = childEvaluations.every((child) => child.rule.enter === true);
    combined.exit = childEvaluations.every((child) => child.rule.exit === true);
    combined.short = childEvaluations.every((child) => child.rule.short === true);
    combined.cover = childEvaluations.every((child) => child.rule.cover === true);
    combined.stopLossPercent = selectFirstNumeric(childEvaluations, 'stopLossPercent');
    combined.takeProfitPercent = selectFirstNumeric(childEvaluations, 'takeProfitPercent');
    combined.meta = buildCombinationMeta('AND', childEvaluations, combined);
    return combined;
  }

  function combineOr(childEvaluations) {
    const combined = createEmptyRuleResult();
    if (childEvaluations.length === 0) {
      return combined;
    }
    combined.enter = childEvaluations.some((child) => child.rule.enter === true);
    combined.exit = childEvaluations.some((child) => child.rule.exit === true);
    combined.short = childEvaluations.some((child) => child.rule.short === true);
    combined.cover = childEvaluations.some((child) => child.rule.cover === true);
    combined.stopLossPercent = selectFirstNumeric(childEvaluations, 'stopLossPercent');
    combined.takeProfitPercent = selectFirstNumeric(childEvaluations, 'takeProfitPercent');
    combined.meta = buildCombinationMeta('OR', childEvaluations, combined);
    return combined;
  }

  function combineNot(childEvaluation) {
    const source = childEvaluation?.rule || createEmptyRuleResult();
    const inverted = createEmptyRuleResult();
    inverted.enter = !source.enter;
    inverted.exit = !source.exit;
    inverted.short = !source.short;
    inverted.cover = !source.cover;
    inverted.stopLossPercent = source.stopLossPercent;
    inverted.takeProfitPercent = source.takeProfitPercent;
    inverted.meta = {
      op: 'NOT',
      child: {
        strategyId: childEvaluation?.strategyId || null,
        meta: cloneDeep(isPlainObject(source.meta) ? source.meta : {}),
        signals: {
          enter: source.enter === true,
          exit: source.exit === true,
          short: source.short === true,
          cover: source.cover === true,
        },
      },
    };
    if (source.meta && source.meta.indicatorValues) {
      inverted.meta.indicatorValues = source.meta.indicatorValues;
    }
    if (source.meta && source.meta.kdValues) {
      inverted.meta.kdValues = source.meta.kdValues;
    }
    if (source.meta && source.meta.macdValues) {
      inverted.meta.macdValues = source.meta.macdValues;
    }
    return inverted;
  }

  function validateRegistry(registry) {
    if (!registry || typeof registry !== 'object') {
      throw new TypeError('buildComposite 需要 StrategyPluginRegistry 實例');
    }
    if (
      typeof registry.getStrategyMetaById !== 'function' &&
      typeof registry.getStrategyById !== 'function'
    ) {
      throw new TypeError('StrategyPluginRegistry 必須提供 getStrategyMetaById 或 getStrategyById');
    }
  }

  function resolveStrategyMeta(registry, strategyId) {
    if (typeof registry.getStrategyMetaById === 'function') {
      return registry.getStrategyMetaById(strategyId);
    }
    if (typeof registry.getStrategyById === 'function') {
      const entry = registry.getStrategyById(strategyId, { loadIfNeeded: false });
      return entry ? entry.meta : null;
    }
    return null;
  }

  function compileNode(node, context) {
    if (!isPlainObject(node)) {
      throw new TypeError('策略 DSL 節點必須為物件');
    }
    if (typeof node.ref === 'string') {
      const strategyId = node.ref.trim();
      if (!strategyId) {
        throw new TypeError('策略 DSL ref 不可為空字串');
      }
      const meta = resolveStrategyMeta(context.registry, strategyId);
      if (!meta) {
        throw new Error(`找不到策略 ${strategyId} 的 meta 資訊`);
      }
      const sanitizedParams = applySchemaDefaults(meta.paramsSchema, node.params);
      const leafPlan = {
        kind: 'leaf',
        strategyId,
        params: Object.freeze({ ...sanitizedParams }),
      };
      context.leaves.push(leafPlan);
      if (!context.strategyIdSet.has(strategyId)) {
        context.strategyIdSet.add(strategyId);
      }
      return leafPlan;
    }

    const op = normaliseOperator(node.op);
    if (!op) {
      throw new TypeError('策略 DSL 需要提供 op 或 ref');
    }

    if (op === 'NOT') {
      const childNode = Array.isArray(node.rules) ? node.rules[0] : node.rule;
      if (!childNode || typeof childNode !== 'object') {
        throw new TypeError('NOT 節點需要一個子節點');
      }
      const childPlan = compileNode(childNode, context);
      return {
        kind: 'not',
        child: childPlan,
      };
    }

    if (op !== 'AND' && op !== 'OR') {
      throw new TypeError(`不支援的 DSL 運算子：${op}`);
    }

    const rawRules = Array.isArray(node.rules) ? node.rules : [];
    if (rawRules.length === 0) {
      throw new TypeError(`${op} 節點至少需要一個子節點`);
    }
    const children = rawRules.map((child) => compileNode(child, context));
    return {
      kind: op.toLowerCase(),
      children,
    };
  }

  function executePlan(planNode, context) {
    if (planNode.kind === 'leaf') {
      if (typeof context.runStrategy !== 'function') {
        throw new TypeError('evaluateComposite 需要提供 runStrategy(strategyId, role, index, params, extras)');
      }
      const rawResult = context.runStrategy(
        planNode.strategyId,
        context.role,
        context.index,
        planNode.params,
        context.runtimeExtras,
      );
      const rule = ensureRuleResult(rawResult, {
        pluginId: planNode.strategyId,
        role: context.role,
        index: context.index,
      });
      return {
        strategyId: planNode.strategyId,
        rule,
      };
    }
    if (planNode.kind === 'not') {
      const childEvaluation = executePlan(planNode.child, context);
      return {
        rule: combineNot(childEvaluation),
        strategyId: null,
        children: [childEvaluation],
      };
    }
    if (planNode.kind === 'and' || planNode.kind === 'or') {
      const childEvaluations = planNode.children.map((child) => executePlan(child, context));
      const rule = planNode.kind === 'and' ? combineAnd(childEvaluations) : combineOr(childEvaluations);
      return {
        rule,
        strategyId: null,
        children: childEvaluations,
      };
    }
    throw new TypeError(`未知的 DSL 節點種類：${planNode.kind}`);
  }

  function normaliseDefinition(definition) {
    if (!definition) {
      return null;
    }
    if (typeof definition === 'string') {
      try {
        const parsed = JSON.parse(definition);
        return parsed && typeof parsed === 'object' ? parsed : null;
      } catch (error) {
        if (typeof console !== 'undefined' && console.error) {
          console.error('[StrategyDSL] 無法解析字串定義', error);
        }
        return null;
      }
    }
    if (typeof definition === 'object') {
      return definition;
    }
    return null;
  }

  function buildComposite(definition, registry) {
    const normalised = normaliseDefinition(definition);
    if (!normalised) {
      throw new TypeError('buildComposite 需要有效的 DSL 定義');
    }
    validateRegistry(registry);
    const context = {
      registry,
      leaves: [],
      strategyIdSet: new Set(),
    };
    const plan = compileNode(normalised, context);
    const leavesSnapshot = context.leaves.map((leaf) => ({
      strategyId: leaf.strategyId,
      params: leaf.params,
    }));
    const usedIds = Array.from(context.strategyIdSet);

    function evaluator(evaluateOptions) {
      if (!evaluateOptions || typeof evaluateOptions !== 'object') {
        throw new TypeError('evaluateComposite 需要傳入參數物件');
      }
      const role = evaluateOptions.role;
      const index = Number.isInteger(evaluateOptions.index)
        ? evaluateOptions.index
        : Number(evaluateOptions.index) || 0;
      if (typeof role !== 'string') {
        throw new TypeError('evaluateComposite 需要指定 role');
      }
      const execContext = {
        role,
        index,
        runStrategy: evaluateOptions.runStrategy,
        runtimeExtras:
          evaluateOptions.runtimeExtras && typeof evaluateOptions.runtimeExtras === 'object'
            ? evaluateOptions.runtimeExtras
            : undefined,
      };
      const evaluation = executePlan(plan, execContext);
      return evaluation.rule || createEmptyRuleResult();
    }

    Object.defineProperty(evaluator, 'usedStrategyIds', {
      value: Object.freeze(usedIds.slice()),
      writable: false,
      enumerable: true,
      configurable: false,
    });

    evaluator.listStrategyParams = function listStrategyParams() {
      return leavesSnapshot.map((leaf) => ({
        strategyId: leaf.strategyId,
        params: cloneDeep(leaf.params),
      }));
    };

    evaluator.getParamsForStrategy = function getParamsForStrategy(strategyId) {
      if (!strategyId) {
        return null;
      }
      const target = leavesSnapshot.find((leaf) => leaf.strategyId === strategyId);
      return target ? cloneDeep(target.params) : null;
    };

    evaluator.usesStrategy = function usesStrategy(strategyId) {
      if (!strategyId) {
        return false;
      }
      return usedIds.includes(strategyId);
    };

    return evaluator;
  }

  const api = {
    __version__: DSL_VERSION,
    buildComposite,
    normaliseDefinition,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  Object.defineProperty(globalScope, 'LazyStrategyDSL', {
    value: api,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(typeof self !== 'undefined' ? self : this);
