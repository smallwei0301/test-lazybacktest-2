#!/usr/bin/env node

/**
 * 日誌監聽器 - 查看實際的 console 日誌輸出
 */

const puppeteer = require('puppeteer');
require('dotenv').config();

const CONFIG = {
  appUrl: process.env.APP_URL || 'https://test-lazybacktest.netlify.app/app/index.html',
  headless: false,
  timeout: 60000,
};

async function monitorLogs() {
  let browser;
  try {
    console.log('\n🔍 啟動日誌監聽器...\n');

    browser = await puppeteer.launch({
      headless: CONFIG.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // 監聽所有 console 消息
    const allLogs = [];

    page.on('console', msg => {
      const text = msg.text();
      allLogs.push({
        type: msg.type(),
        text: text,
      });

      const color = msg.type() === 'error' ? '\x1b[31m' : '\x1b[36m';
      const reset = '\x1b[0m';
      console.log(`${color}[${msg.type().toUpperCase()}]${reset} ${text}`);
    });

    console.log(`📍 正在訪問應用: ${CONFIG.appUrl}\n`);

    await page.goto(CONFIG.appUrl, {
      waitUntil: 'networkidle2',
      timeout: CONFIG.timeout,
    });

    console.log('\n✅ 頁面已加載，等待 3 秒以收集日誌...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 查找並點擊批量優化
    console.log('\n\n🔍 嘗試點擊批量優化...\n');

    const found = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('button, a, [role="button"], [role="tab"]'));
      for (const el of elements) {
        if (el.textContent.toLowerCase().includes('batch') ||
            el.textContent.toLowerCase().includes('批量') ||
            el.textContent.toLowerCase().includes('优化')) {
          el.click();
          return true;
        }
      }
      return false;
    });

    console.log(`\n找到批量優化: ${found}`);

    await new Promise(resolve => setTimeout(resolve, 2000));

    // 選擇策略
    console.log('\n🔍 嘗試選擇策略...\n');

    const selected = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[type="checkbox"], input[type="radio"]');
      if (inputs.length > 0) {
        inputs[0].click();
        return true;
      }
      return false;
    });

    console.log(`\n選擇策略: ${selected}`);

    await new Promise(resolve => setTimeout(resolve, 1000));

    // 查找並點擊開始按鈕
    console.log('\n🔍 嘗試點擊開始按鈕...\n');

    const started = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      for (const btn of buttons) {
        const text = btn.textContent.toLowerCase();
        if (text.includes('start') || text.includes('开始') || text.includes('执行') || text.includes('run')) {
          btn.click();
          return true;
        }
      }
      return false;
    });

    console.log(`\n開始執行: ${started}`);

    console.log('\n⏳ 等待 5 秒收集日誌...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 保存日誌到文件
    const report = {
      timestamp: new Date().toISOString(),
      totalLogs: allLogs.length,
      logs: allLogs,
      summary: {
        errors: allLogs.filter(l => l.type === 'error').length,
        warnings: allLogs.filter(l => l.type === 'warning').length,
        logs: allLogs.filter(l => l.type === 'log').length,
      },
    };

    const fs = require('fs');
    fs.writeFileSync('CONSOLE_LOGS_DUMP.json', JSON.stringify(report, null, 2));

    console.log('\n\n📊 日誌摘要:');
    console.log(`  - 總共 ${report.totalLogs} 條日誌`);
    console.log(`  - 錯誤: ${report.summary.errors}`);
    console.log(`  - 警告: ${report.summary.warnings}`);
    console.log(`  - 日誌: ${report.summary.logs}`);

    console.log('\n✅ 日誌已保存到 CONSOLE_LOGS_DUMP.json\n');

    await browser.close();
  } catch (error) {
    console.error('❌ 失敗:', error.message);
    if (browser) await browser.close();
    process.exit(1);
  }
}

monitorLogs();
