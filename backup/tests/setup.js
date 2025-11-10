/**
 * Jest 測試環境設定檔案
 * 在所有測試執行前進行全域設定
 */

// 設定全域 console mock 以避免測試輸出混亂
global.console = {
  ...console,
  // 保持 error 和 warn 以便於除錯
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: console.warn,
  error: console.error,
};

// 模擬瀏覽器環境的全域物件
global.window = {
  location: {
    href: 'http://localhost:3000'
  },
  document: {
    getElementById: jest.fn(),
    createElement: jest.fn(),
    addEventListener: jest.fn()
  },
  localStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
  },
  sessionStorage: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
  }
};

// 模擬 DOM API
global.document = global.window.document;
global.localStorage = global.window.localStorage;
global.sessionStorage = global.window.sessionStorage;

// 設定測試超時（對於較複雜的計算）
jest.setTimeout(10000);

// 模擬 fetch API
global.fetch = jest.fn();

// 清理函數 - 在每個測試後執行
afterEach(() => {
  jest.clearAllMocks();
  
  // 重設 localStorage mock
  global.localStorage.getItem.mockClear();
  global.localStorage.setItem.mockClear();
  global.localStorage.removeItem.mockClear();
  global.localStorage.clear.mockClear();
  
  // 重設 fetch mock
  if (global.fetch.mockClear) {
    global.fetch.mockClear();
  }
});

// 測試開始前的設定
beforeAll(() => {
  console.log('🧪 Jest 測試環境初始化完成');
});

// 測試結束後的清理
afterAll(() => {
  console.log('✅ Jest 測試環境清理完成');
});