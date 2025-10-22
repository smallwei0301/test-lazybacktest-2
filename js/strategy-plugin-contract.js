// Patch Tag: LB-PLUGIN-CONTRACT-20250705A
(function (root) {
  const globalScope = root || (typeof globalThis !== 'undefined' ? globalThis : {});
  const CONTRACT_VERSION = 'LB-PLUGIN-CONTRACT-20250705A';
  const ALLOWED_ROLES = ['longEntry', 'longExit', 'shortEntry', 'shortExit'];

  /**
   * @typedef {Object} StrategyPluginMeta
   * @property {string} id 唯一識別碼，作為快取與診斷鍵值。
   * @property {string} label UI 顯示名稱。
   * @property {Record<string, unknown>} [paramsSchema] 以 JSON Schema 風格描述的參數限制。
   */

  /**
   * @typedef {Object} StrategyContextDataset
   * @property {ReadonlyArray<number|null>} close 收盤價序列。
   * @property {ReadonlyArray<number|null>} open 開盤價序列。
   * @property {ReadonlyArray<number|null>} high 最高價序列。
   * @property {ReadonlyArray<number|null>} low 最低價序列。
   * @property {ReadonlyArray<string>} date ISO 字串日期序列。
   */

  /**
   * @typedef {Object} StrategyContextHelpers
   * @property {(indicatorKey: string) => ReadonlyArray<number|null>|undefined} getIndicator 取得共用指標陣列。
   * @property {(message: string, details?: Record<string, unknown>) => void} log 以策略命名空間寫入診斷訊息。
   * @property {(key: string, value: unknown) => void} setCache 寫入策略區域暫存。
   * @property {(key: string) => unknown} getCache 讀取策略區域暫存。
   */

  /**
   * @typedef {Object} StrategyContext
   * @property {'longEntry'|'longExit'|'shortEntry'|'shortExit'} role 策略扮演的腳色。
   * @property {number} index 目前判斷的資料索引。
   * @property {StrategyContextDataset} series 全部暖身＋正式序列。
   * @property {StrategyContextHelpers} helpers 白名單輔助 API。
   * @property {{ warmupStartIndex: number; effectiveStartIndex: number; length: number }} runtime 暖身、正式起點與資料長度資訊。
   */

  /**
   * @typedef {Object} RuleResult
   * @property {boolean} [enter] 多頭進場布林值。
   * @property {boolean} [exit] 多頭出場布林值。
   * @property {boolean} [short] 空頭進場布林值。
   * @property {boolean} [cover] 空頭回補布林值。
   * @property {number|null} [stopLossPercent] 可選停損百分比 (0~100 之間)。
   * @property {number|null} [takeProfitPercent] 可選停利百分比 (0~100 之間)。
   * @property {Record<string, unknown>} [meta] 額外診斷資訊。
   */

  /**
   * @typedef {Object} StrategyPlugin
   * @property {StrategyPluginMeta} meta 策略基本資料。
   * @property {(context: StrategyContext, params: Record<string, unknown>) => RuleResult} run 執行並回傳布林訊號。
   */

  function isFinitePercent(value) {
    return Number.isFinite(value) && value >= 0 && value <= 100;
  }

  function roleGuard(role) {
    return typeof role === 'string' && ALLOWED_ROLES.includes(role);
  }

  /**
   * 將任意輸入強制整理成 RuleResult，並於錯誤時拋出 TypeError。
   *
   * @param {unknown} rawResult 原始輸出。
   * @param {{ pluginId?: string; role?: string; index?: number }} [info]
   * @returns {RuleResult}
   */
  function ensureRuleResult(rawResult, info) {
    const contextLabel = info?.pluginId ? `[${info.pluginId}]` : '[StrategyPlugin]';
    if (rawResult === null || typeof rawResult !== 'object') {
      throw new TypeError(`${contextLabel} RuleResult 必須為物件`);
    }
    const result = /** @type {Record<string, unknown>} */ (rawResult);
    const normalised = {
      enter: result.enter === true,
      exit: result.exit === true,
      short: result.short === true,
      cover: result.cover === true,
      stopLossPercent: null,
      takeProfitPercent: null,
      meta: {},
    };

    const booleanFields = ['enter', 'exit', 'short', 'cover'];
    booleanFields.forEach((key) => {
      if (key in result && typeof result[key] !== 'boolean') {
        throw new TypeError(`${contextLabel} ${key} 必須是布林值`);
      }
    });

    if ('stopLossPercent' in result && result.stopLossPercent !== null) {
      if (!isFinitePercent(Number(result.stopLossPercent))) {
        throw new TypeError(`${contextLabel} stopLossPercent 必須介於 0~100 的數值或 null`);
      }
      normalised.stopLossPercent = Number(result.stopLossPercent);
    }

    if ('takeProfitPercent' in result && result.takeProfitPercent !== null) {
      if (!isFinitePercent(Number(result.takeProfitPercent))) {
        throw new TypeError(`${contextLabel} takeProfitPercent 必須介於 0~100 的數值或 null`);
      }
      normalised.takeProfitPercent = Number(result.takeProfitPercent);
    }

    if ('meta' in result) {
      if (result.meta === null || typeof result.meta !== 'object' || Array.isArray(result.meta)) {
        throw new TypeError(`${contextLabel} meta 必須為物件`);
      }
      normalised.meta = /** @type {Record<string, unknown>} */ (result.meta);
    }

    return /** @type {RuleResult} */ (normalised);
  }

  /**
   * 將布林值或 RuleResult 依角色轉換為完整 RuleResult，供舊策略 shim 使用。
   *
   * @param {'longEntry'|'longExit'|'shortEntry'|'shortExit'} role
   * @param {unknown} candidate
   * @param {{ pluginId?: string; index?: number }} [info]
   * @returns {RuleResult}
   */
  function normaliseByRole(role, candidate, info) {
    const base =
      candidate !== null && typeof candidate === 'object'
        ? candidate
        : role === 'longEntry'
        ? { enter: candidate === true }
        : role === 'longExit'
        ? { exit: candidate === true }
        : role === 'shortEntry'
        ? { short: candidate === true }
        : { cover: candidate === true };
    return ensureRuleResult(base, { pluginId: info?.pluginId, role, index: info?.index });
  }

  /**
   * 建立 Legacy 策略包裝器：允許舊函式僅回傳布林值或 RuleResult。
   *
   * @param {StrategyPluginMeta} meta
   * @param {(context: StrategyContext, params: Record<string, unknown>) => unknown} evaluator
   * @returns {StrategyPlugin}
   */
  function createLegacyStrategyPlugin(meta, evaluator) {
    if (!meta || typeof meta !== 'object') {
      throw new TypeError('StrategyPlugin meta 必須為物件');
    }
    if (typeof meta.id !== 'string' || !meta.id.trim()) {
      throw new TypeError('StrategyPlugin meta.id 必須為非空字串');
    }
    if (typeof meta.label !== 'string' || !meta.label.trim()) {
      throw new TypeError('StrategyPlugin meta.label 必須為非空字串');
    }
    if (typeof evaluator !== 'function') {
      throw new TypeError(`[${meta.id}] evaluator 必須為函式`);
    }

    const frozenMeta = Object.freeze({
      id: meta.id,
      label: meta.label,
      paramsSchema:
        meta.paramsSchema && typeof meta.paramsSchema === 'object'
          ? Object.freeze({ ...meta.paramsSchema })
          : undefined,
    });

    const plugin = {
      meta: frozenMeta,
      run(context, params) {
        if (!context || typeof context !== 'object') {
          throw new TypeError(`[${meta.id}] context 必須為物件`);
        }
        if (!roleGuard(context.role)) {
          throw new TypeError(`[${meta.id}] context.role 不在允許清單`);
        }
        const output = evaluator(context, params || {});
        return normaliseByRole(context.role, output, {
          pluginId: meta.id,
          index: typeof context.index === 'number' ? context.index : undefined,
        });
      },
    };

    return /** @type {StrategyPlugin} */ (plugin);
  }

  const api = {
    version: CONTRACT_VERSION,
    allowedRoles: Object.freeze([...ALLOWED_ROLES]),
    ensureRuleResult,
    normaliseByRole,
    createLegacyStrategyPlugin,
  };

  Object.defineProperty(globalScope, 'StrategyPluginContract', {
    value: api,
    enumerable: true,
    configurable: false,
    writable: false,
  });

  Object.defineProperty(globalScope, 'LegacyStrategyPluginShim', {
    value: Object.freeze({
      createLegacyStrategyPlugin,
      normaliseResult(pluginId, role, candidate, info) {
        if (!roleGuard(role)) {
          throw new TypeError(`[${pluginId || 'Unknown'}] 未支援的 role: ${role}`);
        }
        return normaliseByRole(role, candidate, {
          pluginId,
          index: info?.index,
        });
      },
      contractVersion: CONTRACT_VERSION,
    }),
    enumerable: true,
    configurable: false,
    writable: false,
  });
})(typeof self !== 'undefined' ? self : this);
