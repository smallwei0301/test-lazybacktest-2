// Patch Tag: LB-STRATEGY-COMPOSER-20250720A
(function (root) {
  const globalScope = root || (typeof self !== 'undefined' ? self : this);
  const VERSION = 'LB-STRATEGY-COMPOSER-20250720A';
  const BOOLEAN_FIELDS = ['enter', 'exit', 'short', 'cover'];
  const ROLE_TO_FIELD = {
    longEntry: 'enter',
    longExit: 'exit',
    shortEntry: 'short',
    shortExit: 'cover',
  };

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

  function ensureObject(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new TypeError(`${label} 必須為物件`);
    }
    return value;
  }

  function toFiniteNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : NaN;
  }

  function applySchemaDefaults(schema, rawParams) {
    if (!schema || typeof schema !== 'object') {
      return rawParams && typeof rawParams === 'object' ? { ...rawParams } : {};
    }
    const properties = schema.properties && typeof schema.properties === 'object' ? schema.properties : {};
    const output = {};
    Object.keys(properties).forEach((key) => {
      const descriptor = properties[key];
      if (!descriptor || typeof descriptor !== 'object') {
        return;
      }
      if (Object.prototype.hasOwnProperty.call(descriptor, 'default')) {
        output[key] = descriptor.default;
      }
    });
    if (!rawParams || typeof rawParams !== 'object') {
      return output;
    }
    Object.keys(rawParams).forEach((key) => {
      const descriptor = properties[key];
      const value = rawParams[key];
      if (!descriptor || typeof descriptor !== 'object') {
        output[key] = value;
        return;
      }
      if (descriptor.type === 'integer' || descriptor.type === 'number') {
        const numeric = toFiniteNumber(value);
        if (Number.isFinite(numeric)) {
          let adjusted = numeric;
          if (descriptor.type === 'integer') {
            adjusted = Math.round(adjusted);
          }
          if (Number.isFinite(descriptor.minimum)) {
            adjusted = Math.max(descriptor.minimum, adjusted);
          }
          if (Number.isFinite(descriptor.maximum)) {
            adjusted = Math.min(descriptor.maximum, adjusted);
          }
          output[key] = adjusted;
        }
      } else {
        output[key] = value;
      }
    });
    return output;
  }

  function cloneParamsTemplate(template) {
    return Object.assign({}, template);
  }

  function combineBoolean(results, field, operator) {
    if (operator === 'AND') {
      return results.every((result) => result && result[field] === true);
    }
    if (operator === 'OR') {
      return results.some((result) => result && result[field] === true);
    }
    return false;
  }

  function pickRiskValue(results, key, roleField, finalSignal) {
    if (!finalSignal) {
      return null;
    }
    for (let i = 0; i < results.length; i += 1) {
      const result = results[i];
      if (!result) continue;
      if (roleField && result[roleField] === true && Number.isFinite(result[key])) {
        return Number(result[key]);
      }
    }
    for (let i = 0; i < results.length; i += 1) {
      const result = results[i];
      if (!result) continue;
      if (Number.isFinite(result[key])) {
        return Number(result[key]);
      }
    }
    return null;
  }

  function buildRuntimeExtras(context, mapping) {
    if (!mapping) {
      return undefined;
    }
    const runtimeSource = context && context.runtime && typeof context.runtime === 'object' ? context.runtime : {};
    const extras = {};
    let hasValue = false;
    Object.keys(mapping).forEach((targetKey) => {
      const runtimeKey = mapping[targetKey];
      if (typeof runtimeKey !== 'string' || !runtimeKey) {
        return;
      }
      if (Object.prototype.hasOwnProperty.call(runtimeSource, runtimeKey)) {
        extras[targetKey] = runtimeSource[runtimeKey];
        hasValue = true;
      }
    });
    return hasValue ? extras : undefined;
  }

  function mergeChildrenMeta(operator, children, result) {
    const metaChildren = children.map((child) => (child && child.meta ? child.meta : null));
    const baseMeta = result.meta && typeof result.meta === 'object' ? result.meta : {};
    return {
      operator,
      children: metaChildren,
      signal: {
        enter: result.enter,
        exit: result.exit,
        short: result.short,
        cover: result.cover,
      },
      details: baseMeta,
    };
  }

  function createPluginEvaluator(node, options, path) {
    const registry = options.registry;
    const pluginId = typeof node.plugin === 'string' ? node.plugin.trim() : '';
    if (!pluginId) {
      throw new TypeError(`${path}.plugin 必須為非空字串`);
    }
    let schema = null;
    if (registry && typeof registry.getStrategyMetaById === 'function') {
      try {
        const meta = registry.getStrategyMetaById(pluginId);
        schema = meta && meta.paramsSchema ? meta.paramsSchema : null;
      } catch (error) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn(`[StrategyComposer] 讀取 ${pluginId} meta 失敗`, error);
        }
      }
    }
    const paramsTemplate = Object.freeze(applySchemaDefaults(schema, node.params));
    const runtimeMapping = node.runtime && typeof node.runtime === 'object' && !Array.isArray(node.runtime)
      ? { ...node.runtime }
      : null;
    return function evaluatePlugin(context) {
      if (!context || typeof context.callPlugin !== 'function') {
        throw new TypeError('Composite evaluate 需要提供 callPlugin(context) 函式');
      }
      const params = cloneParamsTemplate(paramsTemplate);
      const extras = buildRuntimeExtras(context, runtimeMapping);
      const pluginResult = context.callPlugin(pluginId, params, extras);
      if (!pluginResult || typeof pluginResult !== 'object') {
        return createEmptyRuleResult();
      }
      const normalised = createEmptyRuleResult();
      BOOLEAN_FIELDS.forEach((field) => {
        normalised[field] = pluginResult[field] === true;
      });
      if (Number.isFinite(pluginResult.stopLossPercent)) {
        normalised.stopLossPercent = Number(pluginResult.stopLossPercent);
      }
      if (Number.isFinite(pluginResult.takeProfitPercent)) {
        normalised.takeProfitPercent = Number(pluginResult.takeProfitPercent);
      }
      if (pluginResult.meta && typeof pluginResult.meta === 'object') {
        normalised.meta = pluginResult.meta;
      }
      return normalised;
    };
  }

  function createOperatorEvaluator(node, options, path) {
    const op = typeof node.op === 'string' ? node.op.trim().toUpperCase() : '';
    if (op === 'AND' || op === 'OR') {
      const rules = Array.isArray(node.rules) ? node.rules : [];
      if (rules.length === 0) {
        throw new TypeError(`${path}.rules 至少需要一個子節點`);
      }
      const evaluators = rules.map((child, index) =>
        createEvaluator(child, options, `${path}.rules[${index}]`),
      );
      return function evaluateOperator(context) {
        const childResults = evaluators.map((fn) => fn(context));
        const combined = createEmptyRuleResult();
        BOOLEAN_FIELDS.forEach((field) => {
          combined[field] = combineBoolean(childResults, field, op);
        });
        const roleField = ROLE_TO_FIELD[context && context.role];
        combined.stopLossPercent = pickRiskValue(childResults, 'stopLossPercent', roleField, roleField ? combined[roleField] : false);
        combined.takeProfitPercent = pickRiskValue(childResults, 'takeProfitPercent', roleField, roleField ? combined[roleField] : false);
        combined.meta = mergeChildrenMeta(op, childResults, combined);
        return combined;
      };
    }
    if (op === 'NOT') {
      const childPath = `${path}.rule`;
      const childEvaluator = createEvaluator(ensureObject(node.rule, childPath), options, childPath);
      return function evaluateNot(context) {
        const childResult = childEvaluator(context);
        const inverted = createEmptyRuleResult();
        BOOLEAN_FIELDS.forEach((field) => {
          inverted[field] = !(childResult && childResult[field] === true);
        });
        inverted.meta = {
          operator: 'NOT',
          child: childResult && childResult.meta ? childResult.meta : null,
        };
        return inverted;
      };
    }
    throw new TypeError(`${path}.op 僅支援 AND/OR/NOT`);
  }

  function createEvaluator(node, options, path) {
    const candidate = ensureObject(node, path);
    if (typeof candidate.plugin === 'string') {
      return createPluginEvaluator(candidate, options, path);
    }
    if (typeof candidate.op === 'string') {
      return createOperatorEvaluator(candidate, options, path);
    }
    throw new TypeError(`${path} 缺少有效的 plugin 或 op 屬性`);
  }

  function buildComposite(definition, buildOptions = {}) {
    if (!definition || typeof definition !== 'object') {
      throw new TypeError('buildComposite 需要 DSL 物件定義');
    }
    const options = {
      registry: buildOptions.registry || (globalScope && globalScope.StrategyPluginRegistry) || null,
    };
    const evaluator = createEvaluator(definition, options, '$');
    const composite = function evaluateComposite(context) {
      return evaluator(context || {});
    };
    Object.defineProperty(composite, '__dsl__', {
      value: definition,
      writable: false,
      enumerable: false,
      configurable: false,
    });
    return composite;
  }

  const api = Object.freeze({
    buildComposite,
    __version__: VERSION,
  });

  if (globalScope) {
    const existing = globalScope.StrategyComposer;
    if (!existing || typeof existing.__version__ !== 'string' || existing.__version__ < VERSION) {
      Object.defineProperty(globalScope, 'StrategyComposer', {
        value: api,
        writable: false,
        configurable: false,
        enumerable: true,
      });
    }
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { buildComposite };
  }
})(typeof self !== 'undefined' ? self : this);
