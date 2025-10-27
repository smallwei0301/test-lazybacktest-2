// Patch Tag: LB-DSL-COMPOSER-20260920A
(function (root, factory) {
  const globalScope =
    typeof root !== 'undefined'
      ? root
      : typeof self !== 'undefined'
      ? self
      : typeof globalThis !== 'undefined'
      ? globalThis
      : typeof window !== 'undefined'
      ? window
      : typeof global !== 'undefined'
      ? global
      : {};
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (globalScope) {
    globalScope.StrategyComposer = api;
  }
})(this, function () {
  const VERSION = 'LB-DSL-COMPOSER-20260920A';
  const ROLE_FIELD_MAP = {
    longEntry: 'enter',
    longExit: 'exit',
    shortEntry: 'short',
    shortExit: 'cover',
  };

  function cloneParams(params) {
    if (!params || typeof params !== 'object') {
      return {};
    }
    const clone = {};
    Object.keys(params).forEach((key) => {
      const value = params[key];
      if (Array.isArray(value)) {
        clone[key] = value.slice();
      } else if (value && typeof value === 'object') {
        clone[key] = cloneParams(value);
      } else if (value !== undefined) {
        clone[key] = value;
      }
    });
    return clone;
  }

  function ensureRunner(registry) {
    if (!registry) {
      throw new TypeError('StrategyComposer 需要 registry 物件');
    }
    if (typeof registry === 'function') {
      return {
        runStrategy: registry,
      };
    }
    const candidates = ['runStrategy', 'run', 'invoke'];
    for (let i = 0; i < candidates.length; i += 1) {
      const key = candidates[i];
      if (typeof registry[key] === 'function') {
        return {
          runStrategy: registry[key].bind(registry),
        };
      }
    }
    throw new TypeError('StrategyComposer registry 必須提供 runStrategy(strategyId, context, params, extras)');
  }

  function normaliseNode(node) {
    if (!node) return null;
    if (typeof node === 'string') {
      return { kind: 'plugin', id: node, params: {} };
    }
    if (typeof node !== 'object') {
      throw new TypeError('DSL 節點必須為物件或字串');
    }
    if (node.kind === 'plugin' || node.type === 'plugin') {
      if (typeof node.id !== 'string' || !node.id.trim()) {
        throw new TypeError('Plugin 節點需要有效的 id');
      }
      return {
        kind: 'plugin',
        id: node.id.trim(),
        params: cloneParams(node.params || {}),
      };
    }
    const opRaw = typeof node.kind === 'string' ? node.kind : node.type;
    if (typeof opRaw !== 'string') {
      throw new TypeError('運算節點缺少 kind/type 欄位');
    }
    const op = opRaw.toUpperCase();
    if (op === 'AND' || op === 'OR') {
      const source = Array.isArray(node.children)
        ? node.children
        : Array.isArray(node.items)
        ? node.items
        : Array.isArray(node.operands)
        ? node.operands
        : [];
      if (!Array.isArray(source) || source.length === 0) {
        throw new TypeError(`${op} 節點需要至少一個子節點`);
      }
      return {
        kind: op,
        children: source.map((child) => normaliseNode(child)).filter(Boolean),
      };
    }
    if (op === 'NOT') {
      const child =
        node.child !== undefined
          ? node.child
          : node.operand !== undefined
          ? node.operand
          : node.item !== undefined
          ? node.item
          : null;
      if (!child) {
        throw new TypeError('NOT 節點需要子節點');
      }
      return {
        kind: 'NOT',
        child: normaliseNode(child),
      };
    }
    throw new TypeError(`未支援的運算節點類型: ${opRaw}`);
  }

  function createEmptyResult(roleField) {
    return {
      enter: false,
      exit: false,
      short: false,
      cover: false,
      stopLossPercent: null,
      takeProfitPercent: null,
      meta: { operator: 'NONE', triggered: false, children: [] },
    };
  }

  function cloneResult(source) {
    if (!source || typeof source !== 'object') {
      return createEmptyResult('enter');
    }
    return {
      enter: source.enter === true,
      exit: source.exit === true,
      short: source.short === true,
      cover: source.cover === true,
      stopLossPercent:
        Number.isFinite(source.stopLossPercent) && source.stopLossPercent >= 0
          ? Number(source.stopLossPercent)
          : null,
      takeProfitPercent:
        Number.isFinite(source.takeProfitPercent) && source.takeProfitPercent >= 0
          ? Number(source.takeProfitPercent)
          : null,
      meta:
        source.meta && typeof source.meta === 'object'
          ? Object.assign({}, source.meta)
          : {},
    };
  }

  function pickFirst(evaluations, field, predicate) {
    for (let i = 0; i < evaluations.length; i += 1) {
      const evaluation = evaluations[i];
      if (!evaluation || !evaluation.result) continue;
      if (predicate && !predicate(evaluation)) continue;
      const value = evaluation.result[field];
      if (value !== null && value !== undefined) {
        return value;
      }
    }
    return null;
  }

  function buildMeta(operator, triggered, childrenSummaries) {
    return {
      operator,
      triggered,
      children: childrenSummaries,
    };
  }

  function evaluateNode(node, context, options, runner, roleField) {
    if (!node) {
      const result = createEmptyResult(roleField);
      return {
        triggered: false,
        result,
        summary: { operator: 'NONE', triggered: false, children: [] },
      };
    }
    if (node.kind === 'plugin') {
      const baseParams =
        options && options.baseParams && typeof options.baseParams === 'object'
          ? cloneParams(options.baseParams)
          : {};
      const nodeParams = node.params ? cloneParams(node.params) : {};
      const params = Object.assign(baseParams, nodeParams);
      const extras = options ? options.extras : undefined;
      let pluginResult = null;
      try {
        pluginResult = runner.runStrategy(node.id, context, params, extras);
      } catch (error) {
        pluginResult = null;
      }
      const result = cloneResult(pluginResult);
      const triggered = result[roleField] === true;
      const metaSummary = {
        type: 'plugin',
        id: node.id,
        triggered,
        meta:
          result.meta && typeof result.meta === 'object'
            ? Object.assign({}, result.meta)
            : {},
      };
      return { triggered, result, summary: metaSummary };
    }
    if (node.kind === 'AND' || node.kind === 'OR') {
      const childEvaluations = node.children.map((child) =>
        evaluateNode(child, context, options, runner, roleField),
      );
      const triggered =
        node.kind === 'AND'
          ? childEvaluations.every((child) => child.triggered)
          : childEvaluations.some((child) => child.triggered);
      const result = createEmptyResult(roleField);
      result[roleField] = triggered;
      if (triggered) {
        if (node.kind === 'AND') {
          result.stopLossPercent = pickFirst(
            childEvaluations,
            'stopLossPercent',
            (child) => child.result && child.result[roleField] === true,
          );
          result.takeProfitPercent = pickFirst(
            childEvaluations,
            'takeProfitPercent',
            (child) => child.result && child.result[roleField] === true,
          );
        } else {
          result.stopLossPercent = pickFirst(
            childEvaluations,
            'stopLossPercent',
            (child) => child.triggered,
          );
          result.takeProfitPercent = pickFirst(
            childEvaluations,
            'takeProfitPercent',
            (child) => child.triggered,
          );
        }
      }
      result.meta = buildMeta(
        node.kind,
        triggered,
        childEvaluations.map((child) => child.summary),
      );
      return { triggered, result, summary: result.meta };
    }
    if (node.kind === 'NOT') {
      const childEvaluation = evaluateNode(
        node.child,
        context,
        options,
        runner,
        roleField,
      );
      const triggered = !childEvaluation.triggered;
      const result = createEmptyResult(roleField);
      result[roleField] = triggered;
      if (triggered) {
        result.stopLossPercent = null;
        result.takeProfitPercent = null;
      }
      result.meta = {
        operator: 'NOT',
        triggered,
        children: [childEvaluation.summary],
      };
      return { triggered, result, summary: result.meta };
    }
    throw new TypeError(`未知的節點類型: ${node.kind}`);
  }

  function buildComposite(json, registry) {
    if (!json) {
      return null;
    }
    const runner = ensureRunner(registry);
    const root = normaliseNode(json);
    return function compose(context, options = {}) {
      if (!context || typeof context !== 'object') {
        throw new TypeError('StrategyComposer 需要 context 物件');
      }
      const roleField = ROLE_FIELD_MAP[context.role];
      if (!roleField) {
        throw new TypeError(`不支援的角色: ${context.role}`);
      }
      const evaluation = evaluateNode(root, context, options, runner, roleField);
      return evaluation.result;
    };
  }

  return {
    __version__: VERSION,
    buildComposite,
  };
});
