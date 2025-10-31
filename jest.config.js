/** @type {import('jest').Config} */
module.exports = {
  // 測試環境設定
  testEnvironment: 'node',
  
  // 測試檔案匹配模式
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],
  
  // 忽略的檔案和目錄  
  testPathIgnorePatterns: [
    '/node_modules/',
    '/netlify/',
    '/assets/',
    '/css/',
    'index.html'
  ],
  
  // 覆蓋率收集
  collectCoverage: true,
  coverageDirectory: 'coverage',
  
  // 覆蓋率收集的檔案模式
  collectCoverageFrom: [
    'js/**/*.js',
    '!js/**/*.min.js',
    '!js/**/worker_backup*.js',
    '!js/**/backtest_corrupted.js',
    '!js/loading-mascot-sources.js',
    '!js/batch-optimization.js',
    '!js/backtest.js',
    '!js/main.js',
    '!js/worker.js'
  ],
  
  // 覆蓋率門檻設定 (暫時關閉，在重構後再啟用)
  // coverageThreshold: {
  //   global: {
  //     branches: 50,
  //     functions: 50,
  //     lines: 60,
  //     statements: 60
  //   }
  // },
  
  // 覆蓋率報告格式
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  
  // 測試設定檔案
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.js'
  ],
  
  // 模組名稱映射（為了支援絕對路徑）
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/js/$1',
    '^@layers/(.*)$': '<rootDir>/js/layers/$1'
  },
  
  // 測試超時設定（毫秒）
  testTimeout: 10000,
  
  // 詳细輸出
  verbose: true,
  
  // 清除模擬在每次測試之間
  clearMocks: true,
  
  // 重設模組註冊表在每次測試之間
  resetModules: true
};