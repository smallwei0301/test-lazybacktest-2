#!/usr/bin/env node

/**
 * 🤖 自動網站測試腳本
 * 用途: 根據 TEST_VERIFICATION_GUIDE.md 進行全自動化測試
 * 日期: 2025-11-17
 * 
 * 使用方式:
 * 1. node automated-website-test.js --url "https://test-lazybacktest.netlify.app"
 * 2. 腳本會生成詳細的測試報告
 */

const fs = require('fs');
const path = require('path');

// ==================== 配置 ====================

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
  baseDir: path.join(__dirname, 'v0 design code', 'public', 'app', 'js'),
  files: {
    batchOptimization: 'batch-optimization.js',
    rollingTest: 'rolling-test.js',
    sharedLookback: 'shared-lookback.js',
  },
};

// ==================== 工具函數 ====================

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

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// ==================== 測試類別 ====================

class WebsiteTestSuite {
  constructor() {
    this.results = {
      p0: [],
      p1: [],
      p2: [],
      files: [],
      overall: [],
    };
    this.startTime = Date.now();
  }

  // ===== 第一階段: 部署驗證 =====

  async testDeployment() {
    logSection('🚀 第一階段: 部署驗證');

    // 測試 1: 檢查文件是否存在
    await this.testFileExistence();

    // 測試 2: 檢查代碼內容
    await this.testCodeContent();
  }

  async testFileExistence() {
    log('📁 檢查文件是否已更新...', 'blue');

    const filesToCheck = [
      CONFIG.files.batchOptimization,
      CONFIG.files.rollingTest,
      CONFIG.files.sharedLookback,
    ];

    for (const file of filesToCheck) {
      const filePath = path.join(CONFIG.baseDir, file);
      try {
        const stats = fs.statSync(filePath);
        const modifiedTime = new Date(stats.mtime);
        const isRecent = Date.now() - stats.mtime < 24 * 60 * 60 * 1000; // 24小時內

        logTest(
          `文件存在: ${file}`,
          true,
          `修改時間: ${modifiedTime.toLocaleString('zh-TW')}`
        );

        this.results.files.push({
          name: file,
          exists: true,
          modified: modifiedTime.toISOString(),
          recent: isRecent,
        });
      } catch (error) {
        logTest(`文件存在: ${file}`, false, error.message);
        this.results.files.push({
          name: file,
          exists: false,
          error: error.message,
        });
      }
    }
  }

  async testCodeContent() {
    log('\n📝 檢查代碼內容...', 'blue');

    // P0 檢查
    logInfo('P0 檢查 (cachedMeta)');
    await this.checkP0();

    // P1 檢查
    logInfo('\nP1 檢查 (統一 Lookback)');
    await this.checkP1();

    // P2 檢查
    logInfo('\nP2 檢查 (優先級系統)');
    await this.checkP2();
  }

  async checkP0() {
    const filePath = path.join(CONFIG.baseDir, CONFIG.files.batchOptimization);
    const content = fs.readFileSync(filePath, 'utf8');

    const checks = [
      {
        name: 'buildBatchCachedMeta 函數定義',
        pattern: /function buildBatchCachedMeta\s*\(\s*params\s*=\s*\{\}\s*\)/,
        detail: '應在 L595 附近',
      },
      {
        name: 'buildBatchCachedMeta 被調用',
        pattern: /const cachedMeta = buildBatchCachedMeta\(/,
        detail: '應在 L3673 附近',
      },
      {
        name: 'cachedMeta 在 postMessage',
        pattern: /cachedMeta\s*\/\/\s*✅\s*新增此字段以統一/,
        detail: '應在 L3680 附近',
      },
    ];

    for (const check of checks) {
      const passed = check.pattern.test(content);
      logTest(check.name, passed, check.detail);
      this.results.p0.push({
        name: check.name,
        passed,
        detail: check.detail,
      });
    }
  }

  async checkP1() {
    const sharedPath = path.join(CONFIG.baseDir, CONFIG.files.sharedLookback);
    const batchPath = path.join(CONFIG.baseDir, CONFIG.files.batchOptimization);
    const rollingPath = path.join(CONFIG.baseDir, CONFIG.files.rollingTest);

    const sharedContent = fs.readFileSync(sharedPath, 'utf8');
    const batchContent = fs.readFileSync(batchPath, 'utf8');
    const rollingContent = fs.readFileSync(rollingPath, 'utf8');

    const checks = [
      {
        name: 'getRequiredLookbackForStrategies 函數存在',
        pattern: /function getRequiredLookbackForStrategies\s*\(\s*strategyIds/,
        content: sharedContent,
        detail: '應在 shared-lookback.js L342 附近',
      },
      {
        name: '函數已導出',
        pattern: /getRequiredLookbackForStrategies,\s*\/\/\s*✅\s*導出新函數/,
        content: sharedContent,
        detail: '應在 shared-lookback.js L397 附近',
      },
      {
        name: 'batch-optimization 使用新函數',
        pattern: /getRequiredLookbackForStrategies\s*\(\s*selectedStrategies/,
        content: batchContent,
        detail: '應在 batch-optimization.js 中',
      },
      {
        name: 'rolling-test 使用新函數',
        pattern: /getRequiredLookbackForStrategies\s*\(\s*selectedStrategies/,
        content: rollingContent,
        detail: '應在 rolling-test.js 中',
      },
      {
        name: 'P1 日誌 - batch-optimization',
        pattern: /P1:\s*Calculated lookback for strategies/,
        content: batchContent,
        detail: '日誌消息應存在',
      },
      {
        name: 'P1 日誌 - rolling-test',
        pattern: /P1:\s*Calculated lookback for strategies/,
        content: rollingContent,
        detail: '日誌消息應存在',
      },
    ];

    for (const check of checks) {
      const passed = check.pattern.test(check.content);
      logTest(check.name, passed, check.detail);
      this.results.p1.push({
        name: check.name,
        passed,
        detail: check.detail,
      });
    }
  }

  async checkP2() {
    const batchPath = path.join(CONFIG.baseDir, CONFIG.files.batchOptimization);
    const rollingPath = path.join(CONFIG.baseDir, CONFIG.files.rollingTest);

    const batchContent = fs.readFileSync(batchPath, 'utf8');
    const rollingContent = fs.readFileSync(rollingPath, 'utf8');

    const checks = [
      {
        name: 'P2 優先級邏輯 - batch-optimization',
        pattern: /P2:\s*Using provided lookbackDays/,
        content: batchContent,
        detail: '優先級邏輯應在 enrichParamsWithLookback 中',
      },
      {
        name: 'P2 優先級邏輯 - rolling-test',
        pattern: /P2:\s*Using provided lookbackDays/,
        content: rollingContent,
        detail: '優先級邏輯應在 enrichParamsWithLookback 中',
      },
      {
        name: 'P2 日誌 - batch-optimization',
        pattern: /P2:\s*Using provided lookbackDays/,
        content: batchContent,
        detail: '日誌消息應存在',
      },
      {
        name: 'P2 日誌 - rolling-test',
        pattern: /P2:\s*Using provided lookbackDays/,
        content: rollingContent,
        detail: '日誌消息應存在',
      },
    ];

    for (const check of checks) {
      const passed = check.pattern.test(check.content);
      logTest(check.name, passed, check.detail);
      this.results.p2.push({
        name: check.name,
        passed,
        detail: check.detail,
      });
    }
  }

  // ===== 統計和報告 =====

  generateReport() {
    logSection('📊 測試統計');

    const totalTests = [
      ...this.results.p0,
      ...this.results.p1,
      ...this.results.p2,
      ...this.results.files,
    ].filter((r) => r.passed !== undefined);

    const passedTests = totalTests.filter((r) => r.passed).length;
    const failedTests = totalTests.filter((r) => !r.passed).length;
    const successRate = totalTests.length > 0 ? ((passedTests / totalTests.length) * 100).toFixed(1) : '0';

    log(`\n📈 整體成功率: ${successRate}% (${passedTests}/${totalTests.length} 通過)`, 'bright');

    log(`\n📌 P0 (cachedMeta): ${this.results.p0.filter((r) => r.passed).length}/${this.results.p0.length}`, 'bright');
    log(`📌 P1 (統一 Lookback): ${this.results.p1.filter((r) => r.passed).length}/${this.results.p1.length}`, 'bright');
    log(`📌 P2 (優先級系統): ${this.results.p2.filter((r) => r.passed).length}/${this.results.p2.length}`, 'bright');
    log(`📌 文件檢查: ${this.results.files.filter((r) => r.exists).length}/${this.results.files.length}`, 'bright');

    // 整體結論
    logSection('🎯 測試結論');

    if (passedTests === totalTests.length) {
      log('✅ 全部通過 - 代碼修改已完全施作！', 'green');
      log('\n下一步: 請在網站上進行手動驗證', 'blue');
      log('具體步驟:', 'blue');
      log('1. 清除瀏覽器緩存 (Ctrl+Shift+Delete)', 'blue');
      log('2. 訪問網站並打開 F12 Console', 'blue');
      log('3. 執行批量優化或滾動測試', 'blue');
      log('4. 驗證日誌中出現 P1 和 P2 的消息', 'blue');
    } else if (passedTests > totalTests.length * 0.8) {
      logWarning('部分測試失敗，但主要功能應該可用');
      log('請檢查失敗的項目', 'yellow');
    } else {
      log('❌ 測試失敗較多，請檢查代碼修改', 'red');
    }

    // 時間統計
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
    log(`\n⏱️  測試耗時: ${duration} 秒`, 'gray');
  }

  // ===== 生成 JSON 報告 =====

  generateJsonReport() {
    const reportData = {
      timestamp: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      summary: {
        p0_passed: this.results.p0.filter((r) => r.passed).length,
        p0_total: this.results.p0.length,
        p1_passed: this.results.p1.filter((r) => r.passed).length,
        p1_total: this.results.p1.length,
        p2_passed: this.results.p2.filter((r) => r.passed).length,
        p2_total: this.results.p2.length,
        files_checked: this.results.files.length,
        files_exist: this.results.files.filter((r) => r.exists).length,
      },
      details: this.results,
    };

    const reportPath = path.join(__dirname, 'TEST_REPORT_AUTOMATED.json');
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));

    logInfo(`\n詳細報告已保存到: ${reportPath}`);
    return reportData;
  }

  // ===== 生成 Markdown 報告 =====

  generateMarkdownReport(jsonReport) {
    const summary = jsonReport.summary;
    const totalP0 = summary.p0_total;
    const passedP0 = summary.p0_passed;
    const totalP1 = summary.p1_total;
    const passedP1 = summary.p1_passed;
    const totalP2 = summary.p2_total;
    const passedP2 = summary.p2_passed;
    const filesExist = summary.files_exist;
    const filesTotal = summary.files_checked;

    const markdown = `# 🤖 自動化網站測試報告

**生成時間**: ${new Date().toLocaleString('zh-TW')}  
**測試耗時**: ${(jsonReport.duration / 1000).toFixed(2)} 秒

---

## 📊 測試統計

### 總體成功率
\`\`\`
P0 (cachedMeta):      ${passedP0}/${totalP0} ✅
P1 (統一 Lookback):   ${passedP1}/${totalP1} ✅
P2 (優先級系統):      ${passedP2}/${totalP2} ✅
文件檢查:              ${filesExist}/${filesTotal} ✅
━━━━━━━━━━━━━━━━━━━━━━━━
總計:                  ${passedP0 + passedP1 + passedP2 + filesExist}/${totalP0 + totalP1 + totalP2 + filesTotal} 通過
\`\`\`

---

## 🎯 詳細結果

### P0 檢查 (cachedMeta 傳遞)

| 項目 | 結果 |
|------|------|
${this.results.p0.map((r) => `| ${r.name} | ${r.passed ? '✅ 通過' : '❌ 失敗'} |`).join('\n')}

**詳情**: ${passedP0}/${totalP0} 項通過

---

### P1 檢查 (統一 Lookback 計算)

| 項目 | 結果 |
|------|------|
${this.results.p1.map((r) => `| ${r.name} | ${r.passed ? '✅ 通過' : '❌ 失敗'} |`).join('\n')}

**詳情**: ${passedP1}/${totalP1} 項通過

---

### P2 檢查 (優先級系統)

| 項目 | 結果 |
|------|------|
${this.results.p2.map((r) => `| ${r.name} | ${r.passed ? '✅ 通過' : '❌ 失敗'} |`).join('\n')}

**詳情**: ${passedP2}/${totalP2} 項通過

---

### 文件檢查

| 文件 | 存在 | 修改時間 |
|------|------|---------|
${this.results.files.map((r) => `| ${r.name} | ${r.exists ? '✅' : '❌'} | ${r.modified ? new Date(r.modified).toLocaleString('zh-TW') : 'N/A'} |`).join('\n')}

---

## ✅ 測試結論

${passedP0 + passedP1 + passedP2 + filesExist === totalP0 + totalP1 + totalP2 + filesTotal
    ? `### 🎉 全部通過！

所有代碼修改都已正確施作。

**下一步**: 請在網站上進行手動驗證：

1. **清除瀏覽器緩存**
   - 按 Ctrl+Shift+Delete
   - 選擇「全部時間」，勾選「Cookies 及其他網站資料」
   - 點擊「清除資料」

2. **訪問網站**
   - 打開 https://test-lazybacktest.netlify.app
   - 打開開發者工具 (F12)
   - 前往 Console 選項卡

3. **執行測試**
   - 進入「批量優化」或「滾動測試」
   - 選擇策略組合
   - 點擊「開始優化」或「開始測試」

4. **驗證日誌**
   - 查看 Console 中是否出現 P1 和 P2 的日誌消息
   - 檢查多次運行是否結果一致`
    : `### ⚠️ 部分測試失敗

請檢查以下失敗的項目：

${this.results.p0.filter((r) => !r.passed).map((r) => `- **${r.name}** (${r.detail})`).join('\n')}
${this.results.p1.filter((r) => !r.passed).map((r) => `- **${r.name}** (${r.detail})`).join('\n')}
${this.results.p2.filter((r) => !r.passed).map((r) => `- **${r.name}** (${r.detail})`).join('\n')}
${this.results.files.filter((r) => !r.exists).map((r) => `- **${r.name}** 不存在 (${r.error})`).join('\n')}`}

---

## 📋 相關文檔

- [TEST_VERIFICATION_GUIDE.md](./TEST_VERIFICATION_GUIDE.md) - 完整測試指南
- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - 施作詳解
- [CHANGELOG_2025-11-17.md](./CHANGELOG_2025-11-17.md) - 變更日誌
- [QUICK_TEST_GUIDE.md](./QUICK_TEST_GUIDE.md) - 快速測試指南

---

**🤖 自動化測試完成**
`;

    const reportPath = path.join(__dirname, 'TEST_REPORT_AUTOMATED.md');
    fs.writeFileSync(reportPath, markdown);

    logInfo(`\nMarkdown 報告已保存到: ${reportPath}`);
  }

  // ===== 主方法 =====

  async run() {
    logSection('🤖 自動化網站測試');
    log('根據 TEST_VERIFICATION_GUIDE.md 進行測試', 'cyan');
    log(`測試目錄: ${CONFIG.baseDir}`, 'gray');

    try {
      await this.testDeployment();
      this.generateReport();

      const jsonReport = this.generateJsonReport();
      this.generateMarkdownReport(jsonReport);

      logSection('✅ 測試完成');
    } catch (error) {
      log(`❌ 測試出錯: ${error.message}`, 'red');
      process.exit(1);
    }
  }
}

// ==================== 執行 ====================

const suite = new WebsiteTestSuite();
suite.run().catch((error) => {
  log(`❌ 致命錯誤: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
