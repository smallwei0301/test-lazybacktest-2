// Patch Tag: LB-BACKTEST-RUNNER-20250715A
/* global StrategyPluginRegistry, workerUrl */
(function (root) {
  const globalScope = root || (typeof self !== 'undefined' ? self : this);
  if (!globalScope) {
    return;
  }

  const RUNNER_VERSION = 'LB-BACKTEST-RUNNER-20250715A';

  function toArray(value) {
    if (!value) {
      return [];
    }
    return Array.isArray(value) ? value : [value];
  }

  function resolveWorkerUrl() {
    if (typeof globalScope.workerUrl === 'string' && globalScope.workerUrl) {
      return globalScope.workerUrl;
    }
    if (typeof workerUrl === 'string' && workerUrl) {
      return workerUrl;
    }
    if (globalScope.document) {
      const script = globalScope.document.querySelector('script[data-worker-entry]');
      if (script && typeof script.getAttribute === 'function') {
        const fromAttr = script.getAttribute('data-worker-entry');
        if (fromAttr) {
          return fromAttr;
        }
      }
    }
    return 'js/worker.js';
  }

  function cloneParams(params) {
    if (!params || typeof params !== 'object') {
      return {};
    }
    try {
      if (typeof structuredClone === 'function') {
        return structuredClone(params);
      }
    } catch (error) {
      // ignore and fall back to JSON clone
    }
    try {
      return JSON.parse(JSON.stringify(params));
    } catch (error) {
      const shallow = {};
      Object.keys(params).forEach((key) => {
        shallow[key] = params[key];
      });
      return shallow;
    }
  }

  async function warmupStrategies(strategyIds) {
    const registry = globalScope.StrategyPluginRegistry;
    if (!registry) {
      return [];
    }
    const ids = toArray(strategyIds).filter((id) => typeof id === 'string' && id.trim());
    if (ids.length === 0) {
      return [];
    }
    if (typeof registry.loadStrategyById === 'function') {
      return Promise.allSettled(ids.map((id) => registry.loadStrategyById(id))).then((results) => results);
    }
    return Promise.allSettled(
      ids.map((id) => {
        try {
          if (typeof registry.ensureStrategyLoaded === 'function') {
            registry.ensureStrategyLoaded(id);
          } else if (typeof registry.getStrategyById === 'function') {
            registry.getStrategyById(id);
          }
          return Promise.resolve();
        } catch (error) {
          return Promise.reject(error);
        }
      }),
    );
  }

  function formatWorkerMessage(options) {
    const payload = {
      type: 'runBacktest',
      params: cloneParams(options.params || {}),
    };
    if (options.useCachedData && Array.isArray(options.cachedData)) {
      payload.useCachedData = true;
      payload.cachedData = options.cachedData;
      if (options.cachedMeta) {
        payload.cachedMeta = options.cachedMeta;
      }
    } else {
      payload.useCachedData = false;
    }
    if (options.dataStartDate) {
      payload.dataStartDate = options.dataStartDate;
    }
    if (options.effectiveStartDate) {
      payload.effectiveStartDate = options.effectiveStartDate;
    }
    if (Number.isFinite(options.lookbackDays)) {
      payload.lookbackDays = options.lookbackDays;
    }
    return payload;
  }

  function createRunner() {
    function run(options = {}) {
      if (!options || typeof options !== 'object') {
        return Promise.reject(new Error('[BacktestRunner] 需要提供 options 物件'));
      }
      if (!options.params || typeof options.params !== 'object') {
        return Promise.reject(new Error('[BacktestRunner] options.params 必須為物件'));
      }
      const workerScript = resolveWorkerUrl();
      if (!workerScript) {
        return Promise.reject(new Error('[BacktestRunner] 找不到可用的 worker 腳本'));
      }
      const strategies = toArray(options.strategies).filter((id) => typeof id === 'string' && id.trim());
      const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
      const abortSignal = options.signal;

      const warmupPromise = warmupStrategies(strategies);

      return warmupPromise.then(() =>
        new Promise((resolve, reject) => {
          let settled = false;
          const worker = new Worker(workerScript);
          const startedAt = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();

          const cleanup = () => {
            if (settled) {
              return;
            }
            settled = true;
            try {
              worker.terminate();
            } catch (terminateError) {
              // ignore terminate errors
            }
          };

          const abortHandler = () => {
            if (settled) {
              return;
            }
            cleanup();
            reject(new DOMException('BacktestRunner 已取消', 'AbortError'));
          };

          if (abortSignal && typeof abortSignal.addEventListener === 'function') {
            abortSignal.addEventListener('abort', abortHandler, { once: true });
          }

          worker.onmessage = (event) => {
            const message = event?.data || {};
            const type = message.type;
            if (type === 'progress') {
              if (onProgress) {
                try {
                  onProgress({
                    progress: message.progress,
                    message: message.message,
                  });
                } catch (error) {
                  // swallow progress handler errors
                }
              }
              return;
            }
            if (type === 'result') {
              const endedAt = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
              const durationMs = Math.max(0, endedAt - startedAt);
              cleanup();
              resolve({
                result: message.data || null,
                stockName: message.stockName || '',
                dataSource: message.dataSource || '',
                durationMs,
              });
              return;
            }
            if (type === 'error') {
              cleanup();
              reject(message.data || new Error('[BacktestRunner] Worker 回傳錯誤'));
              return;
            }
            if (type === 'suggestionError') {
              // 建議錯誤不影響主流程，僅記錄訊息
              if (onProgress) {
                try {
                  onProgress({ message: message.data?.message || '建議計算失敗' });
                } catch (error) {
                  // ignore handler error
                }
              }
              return;
            }
          };

          worker.onerror = (errorEvent) => {
            cleanup();
            const message = errorEvent?.message || '[BacktestRunner] Worker 發生錯誤';
            reject(new Error(message));
          };

          try {
            worker.postMessage(formatWorkerMessage(options));
          } catch (error) {
            cleanup();
            reject(error);
          }
        }),
      );
    }

    return {
      run,
      warmup: warmupStrategies,
      resolveWorkerUrl,
      __version__: RUNNER_VERSION,
    };
  }

  const runner = createRunner();

  Object.defineProperty(globalScope, 'BacktestRunner', {
    value: runner,
    writable: false,
    configurable: false,
    enumerable: true,
  });
})(typeof self !== 'undefined' ? self : this);
