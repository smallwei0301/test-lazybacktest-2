#!/usr/bin/env node

/**
 * 代碼修改驗證腳本
 * 用於檢查 P0/P1/P2 改進是否已正確實施
 * 
 * 使用方法:
 * node verify-modifications.js
 */

const fs = require('fs');
const path = require('path');

const BASE_PATH = 'v0 design code/public/app/js';

// 顏色定義
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[36m',
    bold: '\x1b[1m',
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function header(text) {
    console.log();
    log('═'.repeat(70), 'blue');
    log(text, 'bold');
    log('═'.repeat(70), 'blue');
}

function section(text) {
    console.log();
    log(`\n▶ ${text}`, 'yellow');
}

function checkmark(pass, message) {
    const symbol = pass ? '✅' : '❌';
    const color = pass ? 'green' : 'red';
    log(`  ${symbol} ${message}`, color);
    return pass;
}

// 檢查文件是否存在
function fileExists(filePath) {
    const fullPath = path.join(BASE_PATH, filePath);
    return fs.existsSync(fullPath);
}

// 讀取文件內容
function readFile(filePath) {
    const fullPath = path.join(BASE_PATH, filePath);
    try {
        return fs.readFileSync(fullPath, 'utf8');
    } catch (err) {
        log(`錯誤: 無法讀取 ${filePath}`, 'red');
        return null;
    }
}

// 檢查代碼是否包含特定字符串
function codeContains(filePath, searchString, description) {
    const content = readFile(filePath);
    if (!content) return false;
    
    const found = content.includes(searchString);
    checkmark(found, `${filePath} 包含 "${description}"`);
    return found;
}

// 檢查函數定義
function checkFunctionExists(filePath, functionName) {
    const pattern = new RegExp(`function\\s+${functionName}\\s*\\(`);
    const content = readFile(filePath);
    if (!content) return false;
    
    const found = pattern.test(content);
    checkmark(found, `${filePath} 定義了函數 ${functionName}`);
    return found;
}

// 主驗證邏輯
function runVerification() {
    header('🔍 代碼修改驗證檢查');
    
    let allPassed = true;
    
    // ===== P0 驗證 =====
    section('P0: 修復 cachedMeta 缺失');
    
    // 檢查 batch-optimization.js 中的 buildBatchCachedMeta
    allPassed &= checkFunctionExists('batch-optimization.js', 'buildBatchCachedMeta');
    allPassed &= codeContains(
        'batch-optimization.js',
        'const cachedMeta = buildBatchCachedMeta(preparedParams);',
        'cachedMeta 構建調用'
    );
    allPassed &= codeContains(
        'batch-optimization.js',
        'cachedMeta  // ✅ 新增此字段以統一 Worker 消息結構',
        'cachedMeta 在 postMessage 中'
    );
    
    // ===== P1 驗證 =====
    section('P1: 統一 Lookback 計算邏輯');
    
    // 檢查 shared-lookback.js 中的新函數
    allPassed &= checkFunctionExists('shared-lookback.js', 'getRequiredLookbackForStrategies');
    allPassed &= codeContains(
        'shared-lookback.js',
        'getRequiredLookbackForStrategies,  // ✅ 導出新函數',
        '函數已導出'
    );
    
    // 檢查 batch-optimization.js 中的使用
    allPassed &= codeContains(
        'batch-optimization.js',
        '// ✅ P1 改進: 使用統一的策略 lookback 計算邏輯',
        'P1 改進註釋'
    );
    allPassed &= codeContains(
        'batch-optimization.js',
        'sharedUtils.getRequiredLookbackForStrategies',
        'P1 函數調用（batch）'
    );
    allPassed &= codeContains(
        'batch-optimization.js',
        '[Batch Optimization] P1: Calculated lookback',
        'P1 日誌消息（batch）'
    );
    
    // 檢查 rolling-test.js 中的使用
    allPassed &= codeContains(
        'rolling-test.js',
        '// ✅ P1 改進: 使用統一的策略 lookback 計算邏輯',
        'P1 改進註釋（rolling）'
    );
    allPassed &= codeContains(
        'rolling-test.js',
        'sharedUtils.getRequiredLookbackForStrategies',
        'P1 函數調用（rolling）'
    );
    allPassed &= codeContains(
        'rolling-test.js',
        '[Rolling Test] P1: Calculated lookback',
        'P1 日誌消息（rolling）'
    );
    
    // ===== P2 驗證 =====
    section('P2: 改進 Lookback 優先級系統');
    
    // 檢查 batch-optimization.js 中的優先級邏輯
    allPassed &= codeContains(
        'batch-optimization.js',
        '// ✅ P2 改進: 優先使用已提供的 lookbackDays',
        'P2 優先級邏輯（batch）'
    );
    allPassed &= codeContains(
        'batch-optimization.js',
        '[Batch Optimization] P2: Using provided lookbackDays',
        'P2 日誌消息（batch）'
    );
    
    // 檢查 rolling-test.js 中的優先級邏輯
    allPassed &= codeContains(
        'rolling-test.js',
        '// ✅ P2 改進: 優先使用已提供的 lookbackDays',
        'P2 優先級邏輯（rolling）'
    );
    allPassed &= codeContains(
        'rolling-test.js',
        '[Rolling Test] P2: Using provided lookbackDays',
        'P2 日誌消息（rolling）'
    );
    
    // ===== 文件檢查 =====
    section('📁 文件存在性檢查');
    
    allPassed &= checkmark(fileExists('batch-optimization.js'), 'batch-optimization.js 存在');
    allPassed &= checkmark(fileExists('rolling-test.js'), 'rolling-test.js 存在');
    allPassed &= checkmark(fileExists('shared-lookback.js'), 'shared-lookback.js 存在');
    
    // ===== 最終結果 =====
    console.log();
    header('📊 驗證結果');
    
    if (allPassed) {
        log('✅ 所有檢查均通過！代碼修改已正確實施。', 'green');
        log('\n建議下一步:', 'yellow');
        log('1. 清除瀏覽器緩存 (Ctrl+Shift+Delete)', 'yellow');
        log('2. 訪問網站並打開開發者工具 (F12)', 'yellow');
        log('3. 執行批量優化或滾動測試', 'yellow');
        log('4. 在 Console 中查看 P1 和 P2 的日誌消息', 'yellow');
        log('5. 參考 TEST_VERIFICATION_GUIDE.md 進行完整測試', 'yellow');
    } else {
        log('❌ 某些檢查未通過。請檢查代碼修改。', 'red');
        log('\n詳見 IMPLEMENTATION_SUMMARY.md 了解具體修改位置', 'yellow');
    }
    
    console.log();
}

// 運行驗證
runVerification();
