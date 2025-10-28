// Strategy Refactor Roadmap - LB-STRATEGY-ROADMAP-20241001A
(function (root, factory) {
  const globalScope = root || (typeof self !== 'undefined' ? self : this);
  if (!globalScope) {
    return;
  }
  const api = factory(globalScope);
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof globalScope.LazybacktestStrategyRefactorRoadmap === 'object') {
    return;
  }
  globalScope.LazybacktestStrategyRefactorRoadmap = api;
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function (globalScope) {
  const VERSION = 'LB-STRATEGY-ROADMAP-20241001A';

  function freezeDeep(value) {
    if (Array.isArray(value)) {
      return Object.freeze(value.map((item) => freezeDeep(item)));
    }
    if (value && typeof value === 'object') {
      const clone = {};
      Object.keys(value).forEach((key) => {
        clone[key] = freezeDeep(value[key]);
      });
      return Object.freeze(clone);
    }
    return value;
  }

  const aggregatedTask = freezeDeep({
    version: VERSION,
    title: '策略插件模組化基線任務',
    summary:
      '將既有七階段重構濃縮為一個「策略可插拔基線」任務，先盤點契約與暖身診斷，再抽離執行引擎並串接 DSL，確保未來可漸進擴充 UI。',
    actionPlan: {
      id: 'LB-PLUGIN-CONSOLIDATED-TASK-20241001A',
      summary: '依序完成基線盤點、策略引擎抽離與 DSL 驗證，建立熱插拔策略骨幹。',
      phases: [
        {
          id: 'foundation-diagnostics',
          label: '基線盤點與契約修正',
          sourceStages: ['0', '1'],
          focus:
            '彙整現行策略、建立暖身與快取基準，並將 StrategyPluginContract 型別明確化，確保所有策略具備 meta 與參數描述。',
          deliverables: [
            'log.md 新增基準診斷區段',
            'types/strategy-plugin.d.ts 定義策略契約並被主執行緒/Worker 引用',
            '補齊策略 meta.paramsSchema 缺漏項',
          ],
        },
        {
          id: 'engine-isolation',
          label: '策略引擎抽離與載入治理',
          sourceStages: ['2', '3'],
          focus:
            '建立 js/lib/strategy-engine.js 封裝策略評估，並擴充 manifest 以 lazy loader 管理腳本，確保 Worker 僅透過引擎執行策略。',
          deliverables: [
            'StrategyEngine.run(role, payload) 於 Worker 落地',
            'StrategyPluginRegistry.registerLazyStrategy 用於延遲載入',
            'index.html 調整腳本順序確保 manifest 先於策略腳本初始化',
          ],
        },
        {
          id: 'dsl-integration',
          label: '策略組合 DSL 與自訂化準備',
          sourceStages: ['4', '5', '6', '7'],
          focus:
            '將 strategies/composer.js 提升為公開 API，擴充測試覆蓋 AND/OR/NOT 與組合策略，同步規劃 UI 積木介面與策略包分享。',
          deliverables: [
            'lib/strategy-engine 支援 DSL definition 輸入',
            'tests/strategy-composer.test.js 補齊組合案例',
            'index.html / main.js 介面預留策略積木按鈕與儲存/匯出流程',
          ],
        },
      ],
    },
    relatedFiles: [
      'js/strategy-plugin-contract.js',
      'js/strategy-plugin-registry.js',
      'js/strategy-plugin-manifest.js',
      'js/strategies/composer.js',
      'js/main.js',
      'index.html',
      'log.md',
    ],
    automatedValidation: [
      {
        command: 'npm test',
        description: '執行 Node 層單元測試，確保策略組合與重構計畫保持一致。',
      },
      {
        command: 'npm run typecheck',
        description: '使用 TypeScript 定義檢查策略契約與跨執行緒資料型別。',
      },
    ],
    manualValidation:
      '打開 Lazybacktest 主畫面 → 展開「開發者區域」 → 點擊「策略模組化任務檢查」按鈕，確認所有檢查項目顯示綠燈。',
    knowledgeTransfer:
      '策略插件就像積木：先確保插座規格一致，再把執行引擎集中管理，最後提供可視化積木介面與策略包分享。',
  });

  const api = Object.freeze({
    __version__: VERSION,
    getTask() {
      return aggregatedTask;
    },
    getActionPlan() {
      return aggregatedTask.actionPlan;
    },
  });

  if (globalScope && typeof globalScope === 'object') {
    return api;
  }
  return api;
});
