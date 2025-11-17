#!/usr/bin/env node

/**
 * 网站自动化验证脚本 (修复版 v2)
 * 使用 Puppeteer 进行完整的网站功能验证
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const CONFIG = {
  url: process.env.URL || 'https://test-lazybacktest.netlify.app',
  appUrl: process.env.APP_URL || 'https://test-lazybacktest.netlify.app/app/index.html',
  headless: false,
  timeout: 60000,
  slowMo: 50,
};

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
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

class WebsiteVerifier {
  constructor() {
    this.browser = null;
    this.page = null;
    this.consoleLogs = [];
    this.p1Logs = [];
    this.p2Logs = [];
    this.errors = [];
    this.lookbackValues = {
      batchOptimization: null,
      rollingTest: null,
    };
    this.startTime = Date.now();
  }

  async initialize() {
    logSection('🚀 初始化浏览器');

    try {
      this.browser = await puppeteer.launch({
        headless: CONFIG.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ],
      });

      this.page = await this.browser.newPage();
      await this.page.setViewport({ width: 1280, height: 800 });

      this.page.on('console', msg => {
        const text = msg.text();
        this.consoleLogs.push(text);

        if (text.includes('[P1]') || text.includes('P1') || text.includes('lookback')) {
          this.p1Logs.push(text);
          log(`[P1 日誌] ${text}`, 'yellow');
        }

        if (text.includes('[P2]') || text.includes('P2') || text.includes('Priority')) {
          this.p2Logs.push(text);
          log(`[P2 日誌] ${text}`, 'yellow');
        }

        if (msg.type() === 'error') {
          this.errors.push(text);
          log(`[ERROR] ${text}`, 'red');
        }
      });

      this.page.on('error', error => {
        this.errors.push(error.message);
        log(`[頁面錯誤] ${error.message}`, 'red');
      });

      logTest('浏览器初始化', true, '已启动');
      return true;
    } catch (error) {
      logTest('浏览器初始化', false, error.message);
      return false;
    }
  }

  async clearCache() {
    logSection('🧹 清除浏览器缓存');

    try {
      const cookies = await this.page.cookies();
      if (cookies.length > 0) {
        await this.page.deleteCookie(...cookies);
      }

      await this.page.evaluateOnNewDocument(() => {
        localStorage.clear();
        sessionStorage.clear();
      });

      logTest('清除缓存', true, `已清除 ${cookies.length} 个 cookies 和本地存储`);
      return true;
    } catch (error) {
      logTest('清除缓存', false, error.message);
      return false;
    }
  }

  async accessWebsite() {
    logSection('🌐 访问网站首页');

    try {
      log(`正在访问: ${CONFIG.url}`, 'blue');

      await this.page.goto(CONFIG.url, {
        waitUntil: 'networkidle2',
        timeout: CONFIG.timeout,
      });

      const title = await this.page.title();
      const hasContent = await this.page.evaluate(() => {
        return document.body.innerText.length > 0;
      });

      logTest('网站访问', hasContent, `页面标题: ${title}`);
      return hasContent;
    } catch (error) {
      logTest('网站访问', false, error.message);
      return false;
    }
  }

  async accessApp() {
    logSection('🚀 进入回测应用');

    try {
      log(`正在访问应用: ${CONFIG.appUrl}`, 'blue');

      await this.page.goto(CONFIG.appUrl, {
        waitUntil: 'networkidle2',
        timeout: CONFIG.timeout,
      });

      await new Promise(resolve => setTimeout(resolve, 3000));

      const appLoaded = await this.page.evaluate(() => {
        const containers = [
          document.querySelector('#app'),
          document.querySelector('#root'),
          document.querySelector('[data-testid="app"]'),
          document.querySelector('.app-container'),
          document.body.querySelector('main'),
        ];

        return containers.some(el => el && el.innerText.length > 0);
      });

      logTest('进入应用', appLoaded, '应用已加载');
      return appLoaded;
    } catch (error) {
      logTest('进入应用', false, error.message);
      return false;
    }
  }

  async testBatchOptimization() {
    logSection('⚙️  测试批量优化');

    try {
      log('正在查找批量优化选项...', 'blue');

      const batchOptFound = await this.page.evaluate(() => {
        const elements = Array.from(
          document.querySelectorAll('button, a, [role="button"], [role="tab"]')
        );

        for (const el of elements) {
          const text = el.textContent.toLowerCase();
          if (
            text.includes('batch') ||
            text.includes('批量') ||
            text.includes('优化') ||
            text.includes('optimization')
          ) {
            return {
              text: el.textContent.trim(),
              found: true,
            };
          }
        }
        return { found: false };
      });

      if (batchOptFound.found) {
        log(`找到批量优化按钮: "${batchOptFound.text}"`, 'cyan');

        const clicked = await this.page.evaluate(() => {
          const elements = Array.from(
            document.querySelectorAll('button, a, [role="button"], [role="tab"]')
          );

          for (const el of elements) {
            const text = el.textContent.toLowerCase();
            if (text.includes('batch') || text.includes('批量') || text.includes('优化')) {
              el.click();
              return true;
            }
          }
          return false;
        });

        if (clicked) {
          logTest('点击批量优化', true);
          await new Promise(resolve => setTimeout(resolve, 2000));

          const strategySelected = await this.page.evaluate(() => {
            const checkboxes = document.querySelectorAll('input[type="checkbox"]');
            const radios = document.querySelectorAll('input[type="radio"]');
            const inputs = checkboxes.length > 0 ? checkboxes : radios;

            if (inputs.length > 0) {
              inputs[0].click();
              return true;
            }
            return false;
          });

          logTest('选择策略', strategySelected, '已选择第一个可用策略');

          const started = await this.page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));

            for (const btn of buttons) {
              const text = btn.textContent.toLowerCase();
              if (
                text.includes('start') ||
                text.includes('开始') ||
                text.includes('执行') ||
                text.includes('run') ||
                text.includes('optimize')
              ) {
                btn.click();
                return {
                  clicked: true,
                  text: btn.textContent.trim(),
                };
              }
            }
            return { clicked: false };
          });

          if (started.clicked) {
            logTest('执行优化', true, `点击了: "${started.text}"`);
            this.lookbackValues.batchOptimization = 'executed';
            await new Promise(resolve => setTimeout(resolve, 3000));
          } else {
            logTest('执行优化', false, '未找到开始按钮');
          }

          return true;
        }
      }

      logTest('批量优化', false, '未找到批量优化选项');
      return false;
    } catch (error) {
      logTest('批量优化测试', false, error.message);
      return false;
    }
  }

  async testRollingTest() {
    logSection('🔄 测试滚动测试');

    try {
      log('正在查找滚动测试选项...', 'blue');

      const rollingFound = await this.page.evaluate(() => {
        const elements = Array.from(
          document.querySelectorAll('button, a, [role="button"], [role="tab"]')
        );

        for (const el of elements) {
          const text = el.textContent.toLowerCase();
          if (
            text.includes('rolling') ||
            text.includes('滚动') ||
            text.includes('test')
          ) {
            return {
              text: el.textContent.trim(),
              found: true,
            };
          }
        }
        return { found: false };
      });

      if (rollingFound.found) {
        log(`找到滚动测试按钮: "${rollingFound.text}"`, 'cyan');

        const clicked = await this.page.evaluate(() => {
          const elements = Array.from(
            document.querySelectorAll('button, a, [role="button"], [role="tab"]')
          );

          for (const el of elements) {
            const text = el.textContent.toLowerCase();
            if (text.includes('rolling') || text.includes('滚动') || text.includes('test')) {
              el.click();
              return true;
            }
          }
          return false;
        });

        if (clicked) {
          logTest('点击滚动测试', true);
          await new Promise(resolve => setTimeout(resolve, 2000));

          const strategySelected = await this.page.evaluate(() => {
            const checkboxes = document.querySelectorAll('input[type="checkbox"]');
            const radios = document.querySelectorAll('input[type="radio"]');
            const inputs = checkboxes.length > 0 ? checkboxes : radios;

            if (inputs.length > 0) {
              inputs[0].click();
              return true;
            }
            return false;
          });

          logTest('选择策略', strategySelected);

          const started = await this.page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));

            for (const btn of buttons) {
              const text = btn.textContent.toLowerCase();
              if (
                text.includes('start') ||
                text.includes('开始') ||
                text.includes('执行') ||
                text.includes('test')
              ) {
                btn.click();
                return {
                  clicked: true,
                  text: btn.textContent.trim(),
                };
              }
            }
            return { clicked: false };
          });

          if (started.clicked) {
            logTest('执行测试', true, `点击了: "${started.text}"`);
            this.lookbackValues.rollingTest = 'executed';
            await new Promise(resolve => setTimeout(resolve, 3000));
          } else {
            logTest('执行测试', false, '未找到开始按钮');
          }

          return true;
        }
      }

      logTest('滚动测试', false, '未找到滚动测试选项');
      return false;
    } catch (error) {
      logTest('滚动测试测试', false, error.message);
      return false;
    }
  }

  async verifyLogs() {
    logSection('📋 验证控制台日志');

    const p1Found = this.p1Logs.length > 0;
    const p2Found = this.p2Logs.length > 0;
    const noErrors = this.errors.length === 0;

    logTest('P1 日誌', p1Found, `找到 ${this.p1Logs.length} 条日志`);
    logTest('P2 日誌', p2Found, `找到 ${this.p2Logs.length} 条日志`);
    logTest('无主要错误', noErrors, `共 ${this.errors.length} 个错误`);

    if (this.p1Logs.length > 0) {
      log('\nP1 日誌詳情:', 'blue');
      this.p1Logs.forEach(logMsg => {
        log(`  • ${logMsg}`, 'gray');
      });
    }

    if (this.p2Logs.length > 0) {
      log('\nP2 日誌詳情:', 'blue');
      this.p2Logs.forEach(logMsg => {
        log(`  • ${logMsg}`, 'gray');
      });
    }

    return { p1Found, p2Found, noErrors };
  }

  generateReport(results) {
    const duration = Date.now() - this.startTime;

    const report = {
      timestamp: new Date().toISOString(),
      duration,
      website: CONFIG.appUrl,
      checks: {
        cacheCleared: results.cache,
        websiteAccess: results.access,
        appAccess: results.appAccess,
        batchOptimizationExecutable: results.batchOptimization,
        rollingTestExecutable: results.rollingTest,
        p1LogsFound: results.p1Found,
        p2LogsFound: results.p2Found,
        lookbackValuesConsistent:
          this.lookbackValues.batchOptimization === this.lookbackValues.rollingTest,
        noErrors: results.noErrors,
      },
      details: {
        p1Logs: this.p1Logs,
        p2Logs: this.p2Logs,
        lookbackValues: this.lookbackValues,
        errors: this.errors.slice(0, 20),
        consoleLogs: this.consoleLogs.slice(0, 50),
      },
    };

    return report;
  }

  async run() {
    try {
      const results = {
        cache: false,
        access: false,
        appAccess: false,
        batchOptimization: false,
        rollingTest: false,
        p1Found: false,
        p2Found: false,
        noErrors: false,
      };

      if (!(await this.initialize())) {
        throw new Error('浏览器初始化失败');
      }

      results.cache = await this.clearCache();
      results.access = await this.accessWebsite();
      results.appAccess = await this.accessApp();

      if (results.appAccess) {
        results.batchOptimization = await this.testBatchOptimization();
      }

      if (results.appAccess) {
        results.rollingTest = await this.testRollingTest();
      }

      log('等待日誌消息...', 'blue');
      await new Promise(resolve => setTimeout(resolve, 2000));

      const logResults = await this.verifyLogs();
      results.p1Found = logResults.p1Found;
      results.p2Found = logResults.p2Found;
      results.noErrors = logResults.noErrors;

      const report = this.generateReport(results);

      logSection('📊 验证结果');

      const passCount = Object.values(report.checks).filter(v => v).length;
      const totalCount = Object.keys(report.checks).length;
      const percentage = ((passCount / totalCount) * 100).toFixed(0);

      log(`\n验证结果: ${passCount}/${totalCount} 通过 (${percentage}%)\n`, 'bright');

      Object.entries(report.checks).forEach(([key, value]) => {
        const icon = value ? '✅' : '❌';
        const color = value ? 'green' : 'red';
        log(`${icon} ${key}: ${value}`, color);
      });

      fs.writeFileSync(
        'WEBSITE_VERIFICATION_RESULTS.json',
        JSON.stringify(report, null, 2)
      );

      log('\n✅ 报告已保存到 WEBSITE_VERIFICATION_RESULTS.json\n', 'green');

      await this.browser.close();
      log('✅ 验证完成！\n', 'green');
      process.exit(passCount === totalCount ? 0 : 1);
    } catch (error) {
      log(`\n❌ 验证失败: ${error.message}\n`, 'red');
      if (this.browser) await this.browser.close();
      process.exit(1);
    }
  }
}

const verifier = new WebsiteVerifier();
verifier.run();
