#!/usr/bin/env node

/**
 * 🔍 網站結構掃描器
 * 用來找出實際的頁面元素結構
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
require('dotenv').config();

const CONFIG = {
  url: process.env.URL || 'https://test-lazybacktest.netlify.app',
  headless: false,
  timeout: 60000,
};

async function scanWebsite() {
  console.log('\n🔍 開始掃描網站結構...\n');

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: CONFIG.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    // 監聽 console
    page.on('console', (msg) => {
      console.log(`[CONSOLE] ${msg.text()}`);
    });

    console.log(`📍 正在訪問: ${CONFIG.url}\n`);
    await page.goto(CONFIG.url, { waitUntil: 'networkidle2', timeout: CONFIG.timeout });

    // 掃描所有鏈接和按鈕
    console.log('\n=== 🔗 所有鏈接 ===\n');
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a')).map((link) => ({
        text: link.textContent.trim(),
        href: link.getAttribute('href'),
        classes: link.className,
        id: link.id,
      }));
    });

    links.forEach((link, i) => {
      console.log(`${i + 1}. ${link.text}`);
      console.log(`   href: ${link.href}`);
      if (link.classes) console.log(`   classes: ${link.classes}`);
      if (link.id) console.log(`   id: ${link.id}`);
    });

    // 掃描所有按鈕
    console.log('\n=== 🔘 所有按鈕 ===\n');
    const buttons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button')).map((btn) => ({
        text: btn.textContent.trim(),
        classes: btn.className,
        id: btn.id,
        type: btn.type,
        onclick: btn.getAttribute('onclick'),
      }));
    });

    buttons.forEach((btn, i) => {
      console.log(`${i + 1}. ${btn.text || '(無文字)'}`);
      if (btn.classes) console.log(`   classes: ${btn.classes}`);
      if (btn.id) console.log(`   id: ${btn.id}`);
      if (btn.type) console.log(`   type: ${btn.type}`);
      if (btn.onclick) console.log(`   onclick: ${btn.onclick}`);
    });

    // 掃描導航結構
    console.log('\n=== 📱 導航結構 ===\n');
    const nav = await page.evaluate(() => {
      const nav = document.querySelector('nav, [role="navigation"], .navbar, .menu');
      if (!nav) return null;

      return {
        selector: nav.className || nav.id || nav.tagName,
        html: nav.outerHTML.substring(0, 300),
      };
    });

    if (nav) {
      console.log(`導航類型: ${nav.selector}`);
      console.log(`HTML: ${nav.html}...`);
    }

    // 掃描表單
    console.log('\n=== 📝 表單元素 ===\n');
    const forms = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('form, input, select, textarea')).map((el) => ({
        tag: el.tagName,
        type: el.type || el.tagName,
        name: el.name || el.id,
        placeholder: el.placeholder,
        value: el.value,
        classes: el.className,
      }));
    });

    forms.forEach((form, i) => {
      console.log(`${i + 1}. <${form.tag}> type="${form.type}"`);
      if (form.name) console.log(`   name: ${form.name}`);
      if (form.placeholder) console.log(`   placeholder: ${form.placeholder}`);
      if (form.classes) console.log(`   classes: ${form.classes}`);
    });

    // 掃描主要容器
    console.log('\n=== 📦 主要容器 ===\n');
    const containers = await page.evaluate(() => {
      const mainElements = [
        'main',
        '[role="main"]',
        '.main',
        '.container',
        '.content',
        '#app',
        '#root',
      ];

      return mainElements
        .map((selector) => {
          const el = document.querySelector(selector);
          if (!el) return null;
          return {
            selector,
            text: el.innerText.substring(0, 100),
            classes: el.className,
          };
        })
        .filter((x) => x);
    });

    containers.forEach((container) => {
      console.log(`選擇器: ${container.selector}`);
      console.log(`文字: ${container.text}...`);
      if (container.classes) console.log(`classes: ${container.classes}`);
      console.log('');
    });

    // 掃描 data 屬性
    console.log('\n=== 🏷️  Data 屬性 ===\n');
    const dataAttrs = await page.evaluate(() => {
      const elements = document.querySelectorAll('[data-testid], [data-id], [data-value]');
      return Array.from(elements).map((el) => ({
        tag: el.tagName,
        text: el.textContent.trim().substring(0, 50),
        attrs: {
          'data-testid': el.getAttribute('data-testid'),
          'data-id': el.getAttribute('data-id'),
          'data-value': el.getAttribute('data-value'),
        },
      }));
    });

    dataAttrs.forEach((el, i) => {
      console.log(`${i + 1}. <${el.tag}> - ${el.text}`);
      Object.entries(el.attrs).forEach(([key, val]) => {
        if (val) console.log(`   ${key}: ${val}`);
      });
    });

    // 掃描頁面標題和 H1
    console.log('\n=== 📑 頁面標題 ===\n');
    const titles = await page.evaluate(() => {
      const results = {};
      const title = document.querySelector('title');
      const h1 = document.querySelector('h1');
      const h2s = Array.from(document.querySelectorAll('h2')).slice(0, 5);

      if (title) results.title = title.textContent;
      if (h1) results.h1 = h1.textContent;
      if (h2s.length > 0) results.h2s = h2s.map((h) => h.textContent);

      return results;
    });

    console.log(JSON.stringify(titles, null, 2));

    // 檢查是否是單頁應用 (SPA)
    console.log('\n=== 🚀 應用類型 ===\n');
    const appType = await page.evaluate(() => {
      const hasReact = !!window.React || !!document.querySelector('[data-react-root]');
      const hasVue = !!window.Vue || !!document.querySelector('[data-v-app]');
      const hasAngular = !!window.ng || !!document.querySelector('[ng-app]');
      const hasNext = !!document.querySelector('[id="__next"]');
      const hasNuxt = !!document.querySelector('[id="__nuxt"]');

      return {
        isReact: hasReact,
        isVue: hasVue,
        isAngular: hasAngular,
        isNext: hasNext,
        isNuxt: hasNuxt,
      };
    });

    console.log(JSON.stringify(appType, null, 2));

    // 將詳細結果保存到文件
    const scanResults = {
      timestamp: new Date().toISOString(),
      url: CONFIG.url,
      summary: {
        linksCount: links.length,
        buttonsCount: buttons.length,
        formsCount: forms.length,
        containersCount: containers.length,
      },
      links,
      buttons,
      forms,
      containers,
      dataAttrs,
      titles,
      appType,
    };

    fs.writeFileSync('WEBSITE_STRUCTURE_SCAN.json', JSON.stringify(scanResults, null, 2));
    console.log('\n✅ 掃描結果已保存到 WEBSITE_STRUCTURE_SCAN.json\n');

    await browser.close();
  } catch (error) {
    console.error('❌ 掃描失敗:', error.message);
    if (browser) await browser.close();
    process.exit(1);
  }
}

scanWebsite();
