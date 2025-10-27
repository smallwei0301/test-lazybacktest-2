// Patch Tag: LB-COMPOSER-DSL-20250720A
(function (root) {
  const globalScope = root || (typeof self !== 'undefined' ? self : this);
  if (!globalScope) {
    return;
  }

  const contract = globalScope.StrategyPluginContract;
  if (!contract || typeof contract.ensureRuleResult !== 'function') {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[StrategyComposer] StrategyPluginContract.ensureRuleResult 未載入，跳過 composer 定義');
    }
    return;
  }

  const ensureRuleResult = contract.ensureRuleResult;

  const ROLE_TO_FIELD = Object.freeze({
    longEntry: 'enter',
    longExit: 'exit',
    shortEntry: 'short',
    shortExit: 'cover',
  });

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
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
      return {};
    }
    const clone = {};
    Object.keys(meta).forEach((key) => {
      if (key === '__proto__') {
        return;
      }
      const value = meta[key];
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        clone[key] = cloneMeta(value);
      } else if (Array.isArray(value)) {
        clone[key] = value.slice();
      } else {
        clone[key] = value;
      }
    });
    return clone;
  }

  function mergeMeta(target, source, options = {}) {
    if (!target || typeof target !== 'object') {
      return target;
    }
    if (!source || typeof source !== 'object') {
      return target;
    }
    const preserveExisting = options.preserveExisting === true;
    Object.keys(source).forEach((key) => {
      if (key === '__proto__') {
        return;
      }
      const sourceValue = source[key];
      const targetHasKey = Object.prototype.hasOwnProperty.call(target, key);
      if (preserveExisting && targetHasKey) {
        if (
          target[key] &&
          typeof target[key] === 'object' &&
          !Array.isArray(target[key]) &&
          sourceValue &&
          typeof sourceValue === 'object' &&
          !Array.isArray(sourceValue)
        ) {
          mergeMeta(target[key], sourceValue, options);
        }
        return;
      }
      if (sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
        target[key] = mergeMeta({}, sourceValue, options);
      } else if (Array.isArray(sourceValue)) {
        target[key] = sourceValue.slice();
      } else {
        target[key] = sourceValue;
      }
    });
    return target;
  }

  function applySchemaDefaults(schema, rawParams) {
    const source = rawParams && typeof rawParams === 'object' ? rawParams : {};
    if (!schema || typeof schema !== 'object') {
      return { ...source };
    }
    const properties = schema.properties && typeof schema.properties === 'object' ? schema.properties : {};
    const output = {};
    Object.keys(properties).forEach((key) => {
      const descriptor = properties[key];
      if (descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'default')) {
        output[key] = descriptor.default;
      }
    });
    Object.keys(source).forEach((key) => {
      const descriptor = properties[key];
      const value = source[key];
      if (!descriptor || typeof descriptor !== 'object') {
        output[key] = value;
        return;
      }
      if (descriptor.type === 'integer' || descriptor.type === 'number') {
        const numeric = Number(value);
        if (Number.isFinite(numeric)) {
          let normalised = descriptor.type === 'integer' ? Math.round(numeric) : numeric;
          if (Number.isFinite(descriptor.minimum)) {
            normalised = Math.max(descriptor.minimum, normalised);
          }
          if (Number.isFinite(descriptor.maximum)) {
            normalised = Math.min(descriptor.maximum, normalised);
          }
          output[key] = normalised;
        }
      } else {
        output[key] = value;
      }
    });
    return output;
  }

  function ensureRegistry(registry) {
    if (!registry || typeof registry !== 'object') {
      throw new TypeError('[StrategyComposer] registry 必須為物件');
    }
    if (
      typeof registry.getStrategyById !== 'function' &&
      typeof registry.get !== 'function' &&
      typeof registry.ensureStrategyLoaded !== 'function'
    ) {
      throw new TypeError('[StrategyComposer] registry 需要提供 getStrategyById/get 或 ensureStrategyLoaded');
    }
  }

  function loadStrategy(registry, strategyId) {
    let plugin = null;
    if (typeof registry.getStrategyById === 'function') {
      plugin = registry.getStrategyById(strategyId);
    } else if (typeof registry.get === 'function') {
      plugin = registry.get(strategyId);
    }
    if (!plugin && typeof registry.ensureStrategyLoaded === 'function') {
      try {
        plugin = registry.ensureStrategyLoaded(strategyId) || plugin;
      } catch (error) {
        if (typeof console !== 'undefined' && console.error) {
          console.error(`[StrategyComposer] 載入 ${strategyId} 插件失敗`, error);
        }
        return null;
      }
    }
    return plugin && typeof plugin.run === 'function' ? plugin : null;
  }

  function getStrategyMeta(registry, strategyId) {
    if (!strategyId) {
      return null;
    }
    if (typeof registry.getStrategyMetaById === 'function') {
      try {
        return registry.getStrategyMetaById(strategyId);
      } catch (error) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn(`[StrategyComposer] 讀取 ${strategyId} meta 失敗`, error);
        }
      }
    }
    return null;
  }

  function createDefaultInvoker(registry) {
    const cacheStore = new Map();
    return function invoke(strategyId, context, params, runtimeExtras) {
      if (!strategyId) {
        return createEmptyResult();
      }
      const plugin = loadStrategy(registry, strategyId);
      if (!plugin) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn(`[StrategyComposer] 找不到策略 ${strategyId}`);
        }
        return createEmptyResult();
      }
      let cache = cacheStore.get(strategyId);
      if (!cache) {
        cache = new Map();
        cacheStore.set(strategyId, cache);
      }
      const baseHelpers = context && context.helpers && typeof context.helpers === 'object' ? context.helpers : {};
      const helpers = {
        getIndicator: typeof baseHelpers.getIndicator === 'function' ? baseHelpers.getIndicator.bind(baseHelpers) : () => undefined,
        log(message, details) {
          if (typeof baseHelpers.log === 'function') {
            baseHelpers.log(message, details);
          } else if (typeof console !== 'undefined' && typeof console.debug === 'function') {
            if (details) console.debug(`[StrategyComposer:${strategyId}] ${message}`, details);
            else console.debug(`[StrategyComposer:${strategyId}] ${message}`);
          }
        },
        setCache(key, value) {
          cache.set(key, value);
        },
        getCache(key) {
          return cache.get(key);
        },
      };
      const pluginContext = {
        role: context.role,
        index: context.index,
        series: context.series,
        helpers,
        runtime: context.runtime,
      };
      const finalParams = runtimeExtras && typeof runtimeExtras === 'object'
        ? { ...params, __runtime: runtimeExtras }
        : { ...params };
      const rawResult = plugin.run(pluginContext, finalParams);
      return ensureRuleResult(rawResult, {
        pluginId: strategyId,
        role: context.role,
        index: context.index,
      });
    };
  }

  function normalisePluginId(node) {
    if (!node || typeof node !== 'object') {
      return '';
    }
    if (typeof node.pluginId === 'string') {
      return node.pluginId.trim();
    }
    if (typeof node.strategyId === 'string') {
      return node.strategyId.trim();
    }
    if (typeof node.id === 'string') {
      return node.id.trim();
    }
    return '';
  }

  function prepareNode(node, fallbackRole, registry) {
    if (!node || typeof node !== 'object') {
      throw new TypeError('[StrategyComposer] DSL 節點必須為物件');
    }
    const opRaw = typeof node.op === 'string' ? node.op.trim().toUpperCase() : null;
    const pluginId = normalisePluginId(node);
    if (!opRaw && pluginId) {
      return preparePluginNode({ ...node, pluginId }, fallbackRole, registry);
    }
    if (pluginId && (!opRaw || opRaw === 'PLUGIN')) {
      return preparePluginNode({ ...node, pluginId }, fallbackRole, registry);
    }
    switch (opRaw) {
      case 'AND':
      case 'OR': {
        const rules = Array.isArray(node.rules) ? node.rules : [];
        if (rules.length === 0) {
          throw new Error(`[StrategyComposer] ${opRaw} 節點需要至少一個子規則`);
        }
        return {
          type: opRaw,
          role: node.role && typeof node.role === 'string' ? node.role : fallbackRole,
          children: rules.map((child) => prepareNode(child, node.role || fallbackRole, registry)),
        };
      }
      case 'NOT': {
        if (!node.rule) {
          throw new Error('[StrategyComposer] NOT 節點缺少子規則');
        }
        return {
          type: 'NOT',
          role: node.role && typeof node.role === 'string' ? node.role : fallbackRole,
          child: prepareNode(node.rule, node.role || fallbackRole, registry),
        };
      }
      case 'TRUE':
      case 'FALSE': {
        return {
          type: 'LITERAL',
          role: node.role && typeof node.role === 'string' ? node.role : fallbackRole,
          value: opRaw === 'TRUE',
        };
      }
      default:
        throw new Error(`[StrategyComposer] 未支援的 DSL op: ${opRaw}`);
    }
  }

  function preparePluginNode(node, fallbackRole, registry) {
    const pluginId = normalisePluginId(node);
    if (!pluginId) {
      throw new Error('[StrategyComposer] plugin 節點缺少 pluginId');
    }
    const role = node.role && typeof node.role === 'string' ? node.role : fallbackRole;
    if (!ROLE_TO_FIELD[role]) {
      throw new Error(`[StrategyComposer] plugin ${pluginId} 缺少有效 role`);
    }
    const meta = getStrategyMeta(registry, pluginId);
    const params = applySchemaDefaults(meta && meta.paramsSchema, node.params);
    return {
      type: 'PLUGIN',
      role,
      pluginId,
      params,
    };
  }

  function cloneSeries(series) {
    if (!series || typeof series !== 'object') {
      return {};
    }
    return series;
  }

  function normaliseContext(context, role) {
    const index = Number.isFinite(context?.index) ? Number(context.index) : 0;
    const runtime = context && typeof context.runtime === 'object' ? context.runtime : { warmupStartIndex: 0, effectiveStartIndex: 0, length: 0 };
    const helpers = context && typeof context.helpers === 'object' ? context.helpers : {};
    const composerRuntime = context && typeof context.composerRuntime === 'object' ? context.composerRuntime : {};
    return {
      role,
      index,
      series: cloneSeries(context?.series),
      helpers,
      runtime,
      composerRuntime,
    };
  }

  function evaluatePluginNode(node, context, invoke) {
    const runtimeExtras = context.composerRuntime ? context.composerRuntime[node.pluginId] : null;
    const pluginContext = {
      role: node.role,
      index: context.index,
      series: context.series,
      helpers: context.helpers,
      runtime: context.runtime,
    };
    const rawResult = invoke(node.pluginId, pluginContext, node.params, runtimeExtras);
    const ensured = ensureRuleResult(rawResult, {
      pluginId: node.pluginId,
      role: node.role,
      index: context.index,
    });
    const clonedMeta = cloneMeta(ensured.meta);
    if (!Object.prototype.hasOwnProperty.call(clonedMeta, 'strategyId')) {
      clonedMeta.strategyId = node.pluginId;
    }
    clonedMeta.role = node.role;
    return {
      enter: ensured.enter === true,
      exit: ensured.exit === true,
      short: ensured.short === true,
      cover: ensured.cover === true,
      stopLossPercent:
        ensured.stopLossPercent !== null && Number.isFinite(ensured.stopLossPercent)
          ? Number(ensured.stopLossPercent)
          : null,
      takeProfitPercent:
        ensured.takeProfitPercent !== null && Number.isFinite(ensured.takeProfitPercent)
          ? Number(ensured.takeProfitPercent)
          : null,
      meta: clonedMeta,
    };
  }

  function evaluateLogicalNode(node, context, invoke) {
    const field = ROLE_TO_FIELD[node.role];
    if (!field) {
      return createEmptyResult();
    }
    if (node.type === 'LITERAL') {
      const literalResult = createEmptyResult();
      literalResult[field] = node.value === true;
      literalResult.meta = { composer: { op: 'LITERAL', value: node.value === true } };
      return literalResult;
    }
    if (node.type === 'NOT') {
      const childResult = evaluateNode(node.child, { ...context, role: node.child.role }, invoke);
      const result = createEmptyResult();
      result[field] = !(childResult[field] === true);
      result.meta = {
        composer: {
          op: 'NOT',
          childRole: node.child.role,
          childTriggered: childResult[field] === true,
          strategyId: childResult.meta?.strategyId || null,
        },
      };
      return result;
    }
    const children = node.children || [];
    const evaluated = children.map((child) => evaluateNode(child, { ...context, role: child.role }, invoke));
    const triggeredChildren = evaluated.filter((child) => child[field] === true);
    let triggered = false;
    if (node.type === 'AND') {
      triggered = triggeredChildren.length === children.length;
    } else if (node.type === 'OR') {
      triggered = triggeredChildren.length > 0;
    }
    const result = createEmptyResult();
    result[field] = triggered;
    const composerMeta = {
      op: node.type,
      evaluated: evaluated.map((child, index) => ({
        index,
        triggered: child[field] === true,
        strategyId: child.meta?.strategyId || null,
        role: children[index]?.role || null,
      })),
    };
    result.meta = { composer: composerMeta };
    if (triggered && triggeredChildren.length > 0) {
      const primary = triggeredChildren[0];
      if (primary.stopLossPercent !== null) {
        result.stopLossPercent = primary.stopLossPercent;
      }
      if (primary.takeProfitPercent !== null) {
        result.takeProfitPercent = primary.takeProfitPercent;
      }
      mergeMeta(result.meta, cloneMeta(primary.meta));
      if (triggeredChildren.length > 1) {
        const extraSources = triggeredChildren.slice(1).map((child) => cloneMeta(child.meta));
        result.meta.composer.sources = extraSources.map((meta) => ({
          strategyId: meta.strategyId || null,
          role: meta.role || null,
        }));
        extraSources.forEach((meta) => {
          mergeMeta(result.meta, meta, { preserveExisting: true });
        });
      }
    }
    return result;
  }

  function evaluateNode(node, context, invoke) {
    switch (node.type) {
      case 'PLUGIN':
        return evaluatePluginNode(node, context, invoke);
      case 'AND':
      case 'OR':
      case 'NOT':
      case 'LITERAL':
        return evaluateLogicalNode(node, context, invoke);
      default:
        return createEmptyResult();
    }
  }

  function buildComposite(definition, registry, options = {}) {
    ensureRegistry(registry);
    const role = typeof options.role === 'string' ? options.role : definition.role;
    if (!ROLE_TO_FIELD[role]) {
      throw new Error('[StrategyComposer] buildComposite 需要提供有效 role');
    }
    const preparedTree = prepareNode({ ...definition, role }, role, registry);
    const invoke = typeof options.invoke === 'function' ? options.invoke : createDefaultInvoker(registry);
    return function evaluate(context) {
      const normalised = normaliseContext(context, role);
      return evaluateNode(preparedTree, normalised, invoke);
    };
  }

  function containsPlugin(definition, targetId) {
    if (!definition || typeof definition !== 'object' || !targetId) {
      return false;
    }
    const pluginId = normalisePluginId(definition);
    if (pluginId && pluginId === targetId) {
      return true;
    }
    const opRaw = typeof definition.op === 'string' ? definition.op.trim().toUpperCase() : null;
    if (opRaw === 'NOT') {
      return containsPlugin(definition.rule, targetId);
    }
    if (opRaw === 'AND' || opRaw === 'OR') {
      const rules = Array.isArray(definition.rules) ? definition.rules : [];
      for (let i = 0; i < rules.length; i += 1) {
        if (containsPlugin(rules[i], targetId)) {
          return true;
        }
      }
    }
    return false;
  }

  const api = {
    buildComposite,
    containsPlugin,
    __version__: 'LB-COMPOSER-DSL-20250720A',
  };

  Object.defineProperty(globalScope, 'StrategyComposer', {
    value: Object.freeze(api),
    configurable: false,
    writable: false,
    enumerable: true,
  });
})(typeof self !== 'undefined' ? self : this);
