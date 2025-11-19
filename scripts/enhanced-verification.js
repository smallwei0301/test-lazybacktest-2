#!/usr/bin/env node

/**
 * 增強型驗證腳本 - 確保實際執行優化以觸發 P1/P2 日誌
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
require('dotenv').config();

const CONFIG = {
  appUrl: 'https://test-lazybacktest.netlify.app/app/index.html',
  headless: false,
  timeout: 90000,
};

const logs = {
  all: [],
  p1: [],
  p2: [],
  errors: [],
};

async function run() {
  let browser;
  try {
    console.log('\n🚀 啟動網站驗證...\n');

    browser = await puppeteer.launch({
      headless: CONFIG.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });

    // 監聽所有 console 消息
    page.on('console', msg => {
      const text = msg.text();
      logs.all.push(text);

      if (text.includes('[Batch Optimization] P1:') || text.includes('[Rolling Test] P1:')) {
        logs.p1.push(text);
        console.log(`\x1b[33m[P1]\x1b[0m ${text}`);
      }
      if (text.includes('[Batch Optimization] P2:') || text.includes('[Rolling Test] P2:')) {
        logs.p2.push(text);
        console.log(`\x1b[35m[P2]\x1b[0m ${text}`);
      }
      if (msg.type() === 'error') {
        logs.errors.push(text);
      }
    });

    // 進入應用
    console.log('📍 進入應用...');
    await page.goto(CONFIG.appUrl, { waitUntil: 'networkidle2', timeout: CONFIG.timeout });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 第 1 步: 進入批量優化並執行
    console.log('\n\n=== 第 1 步: 執行批量優化 ===\n');

    // 查找批量優化選項卡或按鈕
    const hasBatchTab = await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('[role="tab"], button, a'));
      for (const tab of tabs) {
        const text = tab.textContent.toLowerCase();
        if (text.includes('batch') || text.includes('批量')) {
          console.log(`[Debug] 找到批量優化: ${tab.textContent}`);
          tab.click();
          return true;
        }
      }
      return false;
    });

    if (hasBatchTab) {
      console.log('✅ 已點擊批量優化');
      await new Promise(resolve => setTimeout(resolve, 1500));

      // 選擇第一個策略
      const strategySelected = await page.evaluate(() => {
        // 嘗試找到策略選擇器
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        const radios = document.querySelectorAll('input[type="radio"]');
        const inputs = Array.from(checkboxes).concat(Array.from(radios));

        if (inputs.length > 0) {
          // 找到第一個未被選中的輸入
          const toSelect = inputs.find(input => !input.checked) || inputs[0];
          toSelect.click();
          console.log(`[Debug] 選擇了策略`);
          return true;
        }
        return false;
      });

      if (strategySelected) {
        console.log('✅ 已選擇策略');
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 查找並點擊"開始優化"按鈕
        const optimized = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          console.log(`[Debug] 找到 ${buttons.length} 個按鈕`);

          // 顯示所有按鈕
          buttons.slice(0, 10).forEach((btn, i) => {
            console.log(`  按鈕 ${i}: "${btn.textContent.trim().substring(0, 40)}"`);
          });

          for (const btn of buttons) {
            const text = btn.textContent.toLowerCase();
            if (
              text.includes('start') ||
              text.includes('run') ||
              text.includes('optimize') ||
              text.includes('開始') ||
              text.includes('執行')
            ) {
              console.log(`[Debug] 點擊按鈕: ${btn.textContent}`);
              btn.click();
              return true;
            }
          }
          return false;
        });

        if (optimized) {
          console.log('✅ 已點擊開始優化');
          console.log('⏳ 等待優化執行 (10 秒)...');
          await new Promise(resolve => setTimeout(resolve, 10000));
        } else {
          console.log('⚠️  未找到開始優化按鈕');
        }
      }
    }

    // 第 2 步: 進入滾動測試並執行
    console.log('\n\n=== 第 2 步: 執行滾動測試 ===\n');

    const hasRollingTab = await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('[role="tab"], button, a'));
      for (const tab of tabs) {
        const text = tab.textContent.toLowerCase();
        if (text.includes('rolling') || text.includes('滾動') || text.includes('roll')) {
          console.log(`[Debug] 找到滾動測試: ${tab.textContent}`);
          tab.click();
          return true;
        }
      }
      return false;
    });

    if (hasRollingTab) {
      console.log('✅ 已點擊滾動測試');
      await new Promise(resolve => setTimeout(resolve, 1500));

      // 選擇策略
      const strategySelected = await page.evaluate(() => {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        const radios = document.querySelectorAll('input[type="radio"]');
        const inputs = Array.from(checkboxes).concat(Array.from(radios));

        if (inputs.length > 0) {
          const toSelect = inputs.find(input => !input.checked) || inputs[0];
          toSelect.click();
          console.log(`[Debug] 選擇了滾動測試策略`);
          return true;
        }
        return false;
      });

      if (strategySelected) {
        console.log('✅ 已選擇策略');
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 點擊開始
        const tested = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));

          for (const btn of buttons) {
            const text = btn.textContent.toLowerCase();
            if (
              text.includes('start') ||
              text.includes('run') ||
              text.includes('test') ||
              text.includes('開始') ||
              text.includes('執行')
            ) {
              console.log(`[Debug] 點擊按鈕: ${btn.textContent}`);
              btn.click();
              return true;
            }
          }
          return false;
        });

        if (tested) {
          console.log('✅ 已點擊開始測試');
          console.log('⏳ 等待測試執行 (10 秒)...');
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
      }
    }

    // 生成報告
    console.log('\n\n=== 驗證結果 ===\n');

    const report = {
      timestamp: new Date().toISOString(),
      checks: {
        p1LogsFound: logs.p1.length > 0,
        p2LogsFound: logs.p2.length > 0,
        hasErrors: logs.errors.length > 0,
        totalLogs: logs.all.length,
      },
      details: {
        p1Logs: logs.p1,
        p2Logs: logs.p2,
        errorCount: logs.errors.length,
        totalLogsCount: logs.all.length,
      },
    };

    console.log(`P1 日誌: ${logs.p1.length > 0 ? '✅ 找到' : '❌ 未找到'}`);
    console.log(`P2 日誌: ${logs.p2.length > 0 ? '✅ 找到' : '❌ 未找到'}`);
    console.log(`錯誤: ${logs.errors.length > 0 ? '❌ 有錯誤' : '✅ 無錯誤'}`);
    console.log(`總日誌: ${logs.all.length}`);

    fs.writeFileSync('ENHANCED_VERIFICATION_RESULTS.json', JSON.stringify(report, null, 2));
    console.log('\n✅ 報告已保存到 ENHANCED_VERIFICATION_RESULTS.json');

    await browser.close();
  } catch (error) {
    console.error('❌ 失敗:', error.message);
    if (browser) await browser.close();
    process.exit(1);
  }
}

run();
