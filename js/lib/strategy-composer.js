// Patch Tag: LB-STRATEGY-COMPOSER-20250720A
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    const api = factory();
    if (root) {
      root.StrategyComposer = api;
    }
  }
})(
  typeof self !== 'undefined'
    ? self
    : typeof globalThis !== 'undefined'
    ? globalThis
    : typeof window !== 'undefined'
    ? window
    : this,
  function factory() {
    const VERSION = 'LB-STRATEGY-COMPOSER-20250720A';
    const ROLE_FIELD_MAP = {
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

    function isPlainObject(value) {
      return value !== null && typeof value === 'object' && !Array.isArray(value);
    }

    function mergeMeta(metas) {
      const filtered = Array.isArray(metas)
        ? metas.filter((meta) => isPlainObject(meta))
        : [];
      if (filtered.length === 0) {
        return {};
      }
      const merged = {};
      filtered.forEach((meta) => {
        Object.keys(meta).forEach((key) => {
          const value = meta[key];
          if (value === undefined) {
            return;
          }
          if (isPlainObject(merged[key]) && isPlainObject(value)) {
            merged[key] = { ...merged[key], ...value };
          } else {
            merged[key] = value;
          }
        });
      });
      return merged;
    }

    function pickFirstNumeric(results, predicateStates, field) {
      if (!Array.isArray(results)) {
        return null;
      }
      for (let idx = 0; idx < results.length; idx += 1) {
        if (Array.isArray(predicateStates) && predicateStates[idx] !== true) {
          continue;
        }
        const candidate = results[idx];
        if (candidate && Number.isFinite(candidate[field])) {
          return candidate[field];
        }
      }
      return null;
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
      if (!isPlainObject(schema)) {
        return rawParams && isPlainObject(rawParams) ? { ...rawParams } : {};
      }
      const properties = isPlainObject(schema.properties) ? schema.properties : {};
      const output = {};
      Object.keys(properties).forEach((key) => {
        const descriptor = properties[key];
        if (descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'default')) {
          output[key] = descriptor.default;
        }
      });
      if (!isPlainObject(rawParams)) {
        return output;
      }
      Object.keys(rawParams).forEach((key) => {
        const value = rawParams[key];
        const descriptor = properties[key];
        if (!descriptor || !isPlainObject(descriptor)) {
          output[key] = value;
          return;
        }
        if (descriptor.type === 'integer' || descriptor.type === 'number') {
          const numeric = toNumber(value);
          if (Number.isFinite(numeric)) {
            output[key] = clampNumeric(numeric, descriptor);
            return;
          }
        }
        output[key] = value;
      });
      return output;
    }

    function cloneConfig(node) {
      if (!node) {
        return null;
      }
      if (typeof node === 'string') {
        try {
          return JSON.parse(node);
        } catch (error) {
          return null;
        }
      }
      if (isPlainObject(node) || Array.isArray(node)) {
        try {
          return JSON.parse(JSON.stringify(node));
        } catch (error) {
          return null;
        }
      }
      return null;
    }

    function normaliseNode(node) {
      if (!node) {
        throw new TypeError('[StrategyComposer] 規則節點不可為空');
      }
      if (typeof node === 'string') {
        return { op: 'PLUGIN', strategy: node };
      }
      if (!isPlainObject(node)) {
        throw new TypeError('[StrategyComposer] 規則節點必須為物件或字串');
      }
      const op = typeof node.op === 'string' ? node.op.toUpperCase() : 'PLUGIN';
      if (op === 'AND' || op === 'OR') {
        if (!Array.isArray(node.rules) || node.rules.length === 0) {
          throw new TypeError(`[StrategyComposer] ${op} 規則需要非空的 rules 陣列`);
        }
        return {
          op,
          rules: node.rules.map((child) => normaliseNode(child)),
        };
      }
      if (op === 'NOT') {
        if (!node.rule) {
          throw new TypeError('[StrategyComposer] NOT 規則需要 rule 欄位');
        }
        return {
          op,
          rule: normaliseNode(node.rule),
        };
      }
      const strategyId =
        typeof node.strategy === 'string'
          ? node.strategy
          : typeof node.id === 'string'
          ? node.id
          : null;
      if (!strategyId) {
        throw new TypeError('[StrategyComposer] 規則節點缺少 strategy/id');
      }
      const paramsClone = isPlainObject(node.params) ? JSON.parse(JSON.stringify(node.params)) : {};
      return { op: 'PLUGIN', strategy: strategyId, params: paramsClone };
    }

    function resolveMeta(registry, strategyId) {
      if (!registry || typeof registry.getStrategyMetaById !== 'function') {
        return null;
      }
      try {
        return registry.getStrategyMetaById(strategyId) || null;
      } catch (error) {
        return null;
      }
    }

    function ensurePlugin(registry, strategyId) {
      if (!registry) {
        throw new Error('[StrategyComposer] 未提供 StrategyPluginRegistry');
      }
      let plugin = null;
      if (typeof registry.getStrategyById === 'function') {
        plugin = registry.getStrategyById(strategyId);
      } else if (typeof registry.get === 'function') {
        plugin = registry.get(strategyId);
      }
      if (!plugin && typeof registry.ensureStrategyLoaded === 'function') {
        plugin = registry.ensureStrategyLoaded(strategyId);
      }
      if (!plugin || typeof plugin.run !== 'function') {
        throw new Error(`[StrategyComposer] 策略 ${strategyId} 未註冊或缺少 run 函式`);
      }
      return plugin;
    }

    function createHelpers(strategyId, cacheStore, indicators) {
      const cache = cacheStore instanceof Map ? cacheStore : new Map();
      if (!cache.has(strategyId)) {
        cache.set(strategyId, new Map());
      }
      const pluginCache = cache.get(strategyId);
      return {
        getIndicator(key) {
          const source = indicators && indicators[key];
          return Array.isArray(source) ? source : undefined;
        },
        log(message, details) {
          if (typeof console !== 'undefined' && typeof console.debug === 'function') {
            if (details) {
              console.debug(`[StrategyPlugin:${strategyId}] ${message}`, details);
            } else {
              console.debug(`[StrategyPlugin:${strategyId}] ${message}`);
            }
          }
        },
        setCache(key, value) {
          pluginCache.set(key, value);
        },
        getCache(key) {
          return pluginCache.get(key);
        },
      };
    }

    function createPluginEvaluator(node, environment) {
      const { registry, contract, role, roleField, indicators, cacheStore, series, runtime } = environment;
      const strategyId = node.strategy;
      const meta = resolveMeta(registry, strategyId);
      const baseParams = Object.freeze(applySchemaDefaults(meta && meta.paramsSchema, node.params));
      let pluginInstance = null;
      const helpers = createHelpers(strategyId, cacheStore, indicators);
      function ensureInstance() {
        if (!pluginInstance) {
          pluginInstance = ensurePlugin(registry, strategyId);
        }
        return pluginInstance;
      }
      return function evaluate(index, runtimeExtras) {
        const plugin = ensureInstance();
        const params = runtimeExtras && isPlainObject(runtimeExtras)
          ? { ...baseParams, __runtime: runtimeExtras }
          : { ...baseParams };
        const context = {
          role,
          index,
          series,
          helpers,
          runtime,
        };
        const rawResult = plugin.run(context, params);
        return contract.ensureRuleResult(rawResult, {
          pluginId: strategyId,
          role,
          index,
        });
      };
    }

    function attachCompositeMeta(baseMeta, op, states) {
      const safeMeta = isPlainObject(baseMeta) ? { ...baseMeta } : {};
      safeMeta.__composite__ = {
        op,
        states: Array.isArray(states) ? states.slice() : states,
      };
      return safeMeta;
    }

    function createCompositeEvaluator(node, environment) {
      const { roleField } = environment;
      if (node.op === 'AND' || node.op === 'OR') {
        const children = node.rules.map((child) => {
          const evaluator = createCompositeEvaluator(child, environment);
          return (index, extras) => evaluator(index, extras);
        });
        return function evaluate(index, extras) {
          const ruleResults = children.map((fn) => fn(index, extras));
          const states = ruleResults.map((result) => !!(result && result[roleField] === true));
          const base = createEmptyRuleResult();
          if (node.op === 'AND') {
            base[roleField] = states.every((value) => value === true);
          } else {
            base[roleField] = states.some((value) => value === true);
          }
          base.meta = attachCompositeMeta(
            mergeMeta(ruleResults.map((result) => (result ? result.meta : null))),
            node.op,
            states,
          );
          if (base[roleField] === true) {
            base.stopLossPercent = pickFirstNumeric(ruleResults, states, 'stopLossPercent');
            base.takeProfitPercent = pickFirstNumeric(ruleResults, states, 'takeProfitPercent');
          }
          return base;
        };
      }
      if (node.op === 'NOT') {
        const childEvaluator = createCompositeEvaluator(node.rule, environment);
        return function evaluate(index, extras) {
          const childResult = childEvaluator(index, extras);
          const base = createEmptyRuleResult();
          const childState = !!(childResult && childResult[roleField] === true);
          base[roleField] = !childState;
          base.meta = attachCompositeMeta(
            mergeMeta([childResult ? childResult.meta : null]),
            'NOT',
            [childState],
          );
          return base;
        };
      }
      return createPluginEvaluator(node, environment);
    }

    function buildComposite(rawConfig, registry, options = {}) {
      if (!rawConfig) {
        throw new TypeError('[StrategyComposer] 需要提供複合規則設定');
      }
      if (!registry) {
        throw new TypeError('[StrategyComposer] 缺少策略註冊中心 (registry)');
      }
      const role = options.role;
      if (!role || typeof role !== 'string' || !ROLE_FIELD_MAP[role]) {
        throw new TypeError('[StrategyComposer] 需要指定合法的 role');
      }
      const contract = options.contract || (typeof root !== 'undefined' ? root.StrategyPluginContract : null);
      if (!contract || typeof contract.ensureRuleResult !== 'function') {
        throw new TypeError('[StrategyComposer] 缺少 StrategyPluginContract.ensureRuleResult');
      }
      const normalisedRoot = normaliseNode(cloneConfig(rawConfig) || rawConfig);
      const environment = {
        registry,
        contract,
        role,
        roleField: ROLE_FIELD_MAP[role],
        indicators: options.indicators || {},
        cacheStore: options.cacheStore instanceof Map ? options.cacheStore : new Map(),
        series: options.series || {},
        runtime: options.runtime || {},
      };
      const evaluator = createCompositeEvaluator(normalisedRoot, environment);
      return function evaluate(index, runtimeExtras) {
        return evaluator(index, runtimeExtras);
      };
    }

    return {
      buildComposite,
      __version__: VERSION,
    };
  },
);
