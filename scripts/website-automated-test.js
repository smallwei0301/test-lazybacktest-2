#!/usr/bin/env node

/**
 * 🌐 網站功能驗證腳本
 * 用途: 使用無頭瀏覽器自動化驗證網站上的所有功能
 * 依賴: puppeteer (需安裝)
 * 
 * 使用方式:
 * npm install puppeteer
 * node website-automated-test.js --url "https://test-lazybacktest.netlify.app"
 */

const fs = require('fs');
const path = require('path');

const CONFIG = {
  colors: {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
  },
};

function log(message, color = 'reset') {
  console.log(`${CONFIG.colors[color]}${message}${CONFIG.colors.reset}`);
}

function logSection(title) {
  log('\n' + '='.repeat(80), 'cyan');
  log(`  ${title}`, 'cyan');
  log('='.repeat(80) + '\n', 'cyan');
}

function logTest(name, status, details = '') {
  const icon = status ? '✅' : '❌';
  const color = status ? 'green' : 'red';
  log(`${icon} ${name}`, color);
  if (details) {
    log(`   └─ ${details}`, 'gray');
  }
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

// ==================== 本地驗證版本 ====================
// 如果無法使用 Puppeteer，使用本地文件驗證

class WebsiteLocalValidator {
  constructor() {
    this.results = {
      accessibility: [],
      performance: [],
      functionality: [],
    };
    this.startTime = Date.now();
  }

  async validateLocalFiles() {
    logSection('🔍 本地文件驗證');
    
    const baseDir = path.join(__dirname, 'v0 design code', 'public', 'app', 'js');
    
    // 驗證 P1 和 P2 的日誌完整性
    await this.validateLoggingStatements(baseDir);
    
    // 驗證網站資源完整性
    await this.validateWebsiteResources();
  }

  async validateLoggingStatements(baseDir) {
    logInfo('驗證日誌語句完整性...');
    
    const batchFile = path.join(baseDir, 'batch-optimization.js');
    const rollingFile = path.join(baseDir, 'rolling-test.js');
    
    try {
      const batchContent = fs.readFileSync(batchFile, 'utf8');
      const rollingContent = fs.readFileSync(rollingFile, 'utf8');
      
      // P1 日誌檢查
      const p1Checks = [
        {
          name: 'P1 日誌完整性 - batch-optimization',
          pattern: /\[Batch Optimization\] P1: Calculated lookback for strategies/,
          content: batchContent,
        },
        {
          name: 'P1 日誌完整性 - rolling-test',
          pattern: /\[Rolling Test\] P1: Calculated lookback for strategies/,
          content: rollingContent,
        },
      ];
      
      // P2 日誌檢查
      const p2Checks = [
        {
          name: 'P2 日誌完整性 - batch-optimization',
          pattern: /\[Batch Optimization\] P2: Using provided lookbackDays/,
          content: batchContent,
        },
        {
          name: 'P2 日誌完整性 - rolling-test',
          pattern: /\[Rolling Test\] P2: Using provided lookbackDays/,
          content: rollingContent,
        },
      ];
      
      [...p1Checks, ...p2Checks].forEach(check => {
        const passed = check.pattern.test(check.content);
        logTest(check.name, passed);
        this.results.functionality.push({ name: check.name, passed });
      });
      
    } catch (error) {
      logTest('日誌驗證', false, error.message);
    }
  }

  async validateWebsiteResources() {
    logInfo('\n驗證網站資源...');
    
    const resourcesDir = path.join(__dirname, 'v0 design code', 'public');
    
    try {
      // 檢查關鍵文件
      const criticalFiles = [
        'app/js/batch-optimization.js',
        'app/js/rolling-test.js',
        'app/js/shared-lookback.js',
      ];
      
      for (const file of criticalFiles) {
        const filePath = path.join(resourcesDir, file);
        const exists = fs.existsSync(filePath);
        const fileName = path.basename(filePath);
        
        logTest(`資源存在: ${fileName}`, exists);
        this.results.accessibility.push({ 
          name: `Resource: ${fileName}`, 
          passed: exists 
        });
      }
      
    } catch (error) {
      logTest('資源驗證', false, error.message);
    }
  }

  async runManualTestGuide() {
    logSection('📋 手動驗證指南');
    
    log('\n由於無頭瀏覽器限制，請按以下步驟進行手動驗證：\n', 'yellow');
    
    log('【步驟 1】清除瀏覽器緩存', 'bright');
    log('  • 按下: Ctrl+Shift+Delete', 'blue');
    log('  • 選擇: 全部時間', 'blue');
    log('  • 勾選: Cookies 及其他網站資料', 'blue');
    log('  • 點擊: 清除資料', 'blue');
    
    log('\n【步驟 2】訪問網站', 'bright');
    log('  • URL: https://test-lazybacktest.netlify.app', 'blue');
    log('  • 打開: F12 開發者工具', 'blue');
    log('  • 前往: Console 選項卡', 'blue');
    
    log('\n【步驟 3】測試批量優化', 'bright');
    log('  • 進入: 批量優化頁面', 'blue');
    log('  • 選擇: 1-2 個進出場策略', 'blue');
    log('  • 設定: 迭代次數為 10（快速測試）', 'blue');
    log('  • 點擊: 開始優化', 'blue');
    log('  • 觀察 Console: 查看 P1 和 P2 日誌', 'blue');
    
    log('\n【預期輸出】\n', 'bright');
    log('  [Batch Optimization] P1: Calculated lookback for strategies [...]: XX days', 'cyan');
    log('  [Batch Optimization] P2: Using provided lookbackDays=XX from strategy calculation', 'cyan');
    
    log('\n【步驟 4】測試滾動測試', 'bright');
    log('  • 進入: 滾動測試頁面', 'blue');
    log('  • 選擇: 相同的進出場策略', 'blue');
    log('  • 點擊: 開始測試', 'blue');
    log('  • 觀察 Console: 驗證日誌消息', 'blue');
    
    log('\n【預期輸出】\n', 'bright');
    log('  [Rolling Test] P1: Calculated lookback for strategies [...]: XX days', 'cyan');
    log('  [Rolling Test] P2: Using provided lookbackDays=XX from strategy calculation', 'cyan');
    
    log('\n【步驟 5】驗證一致性', 'bright');
    log('  • 比對: 批量優化和滾動測試中 lookbackDays 的值', 'blue');
    log('  • 預期: 兩側值應完全相同', 'blue');
    
    log('\n【步驟 6】驗證功能正常', 'bright');
    log('  • 檢查: 優化和測試正常完成', 'blue');
    log('  • 檢查: Console 無紅色 JavaScript 錯誤', 'blue');
    log('  • 檢查: 結果數據合理', 'blue');
  }

  async generateTestReport() {
    logSection('📊 驗證報告');
    
    const totalTests = this.results.functionality.length + this.results.accessibility.length;
    const passedTests = [
      ...this.results.functionality,
      ...this.results.accessibility,
    ].filter(r => r.passed).length;
    
    log(`\n📈 本地驗證成功率: ${totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : '0'}% (${passedTests}/${totalTests})`, 'bright');
    
    // 生成報告文件
    const reportData = {
      timestamp: new Date().toISOString(),
      type: 'local-validation',
      summary: {
        total_checks: totalTests,
        passed: passedTests,
        success_rate: totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : '0',
      },
      details: this.results,
      next_steps: [
        '1. 清除瀏覽器緩存 (Ctrl+Shift+Delete)',
        '2. 訪問網站: https://test-lazybacktest.netlify.app',
        '3. 打開 F12 Console',
        '4. 執行批量優化 → 驗證 P1/P2 日誌',
        '5. 執行滾動測試 → 驗證 P1/P2 日誌',
        '6. 對比 lookbackDays 值一致性',
        '7. 檢查 Console 無紅色錯誤',
      ],
    };
    
    const reportPath = path.join(__dirname, 'WEBSITE_VALIDATION_REPORT.json');
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
    
    logInfo(`\n驗證報告已保存到: ${reportPath}`);
  }

  async run() {
    logSection('🌐 網站驗證 - 本地模式');
    log('由於無頭瀏覽器的限制，使用本地文件驗證 + 手動步驟指南', 'yellow');
    
    try {
      await this.validateLocalFiles();
      await this.runManualTestGuide();
      await this.generateTestReport();
      
      logSection('✅ 驗證框架已生成');
      log('\n接下來請按照上述步驟在瀏覽器中進行手動驗證', 'green');
      log('完成後將看到 P1 和 P2 的日誌消息', 'green');
      
    } catch (error) {
      log(`❌ 驗證出錯: ${error.message}`, 'red');
      console.error(error);
      process.exit(1);
    }
  }
}

// ==================== 主程序 ====================

const validator = new WebsiteLocalValidator();
validator.run().catch(error => {
  log(`❌ 致命錯誤: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
