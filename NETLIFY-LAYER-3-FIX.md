# Netlify 404 問題 - 第三層修復報告

## 🔍 問題診斷

### 前兩層修復後的狀況
- ✅ 第一層：Build 配置已加入（提交 330db12）
- ✅ 第二層：路由規則已加入（提交 59ca901）
- ❌ 結果：仍然出現 404 錯誤

Netlify 部署日誌顯示：
```
✅ Build success: 57 files uploaded
✅ Site is live ✨
❌ But accessing https://test-lazybacktest.netlify.app/ still shows 404
```

### 根本原因分析

**第三層問題**：Next.js 部署模式不匹配

#### Next.js 在 Netlify 的兩種部署模式

```
1. Static Export 模式（純前端）
   └─ next build --output-dir "out"
   └─ 輸出：index.html, page.html 等靜態文件
   └─ 適用：完全靜態網站，無服務器端功能
   └─ 部署：直接上傳 HTML 文件

2. Server 模式（當前使用）✗
   └─ next build
   └─ 輸出：.next/server/, .next/static/ 
   └─ 需要：Node.js 伺服器執行
   └─ 部署：Netlify Functions + @netlify/plugin-nextjs
```

#### Netlify 環境的限制

- **無原生 Node.js Runtime**：Netlify 不能直接執行 Node.js 伺服器
- **只有 Serverless Functions**：需要特殊適配器
- **靜態文件託管**：預期獲得 HTML/CSS/JS 文件

#### 當前配置的問題

```toml
[build]
  base = "v0 design code"
  command = "npm run build"
  functions = "netlify/functions"
  publish = ".next"  ← 問題！.next/ 不包含 index.html
```

`.next` 目錄結構：
```
.next/
├── server/          ← Node.js 伺服器代碼
├── static/          ← 靜態資源
├── cache/
├── types/
├── *.json           ← 配置文件
└── trace            ← 構建追蹤
```

**關鍵問題**：`.next/` 沒有 `index.html` 文件！

Netlify 試圖將 `.next/` 作為根目錄託管，但其中沒有 HTML 文件，導致 404。

---

## ✅ 解決方案

### 第三層修復：安裝 @netlify/plugin-nextjs

#### 步驟 1：安裝插件

```bash
npm install @netlify/plugin-nextjs --save-dev --legacy-peer-deps
```

這個插件的作用：
- 自動檢測 Next.js Server 模式應用
- 生成 Netlify Functions 適配器
- 正確配置路由轉發
- 處理 SSR/ISR 路由

#### 步驟 2：更新 netlify.toml

```toml
[[plugins]]
  package = "@netlify/plugin-nextjs"
```

#### 步驟 3：重新構建

```bash
npm run build
```

插件將生成必要的轉發邏輯。

#### 步驟 4：提交並推送

```bash
git add -A
git commit -m "Fix: Add @netlify/plugin-nextjs for proper Next.js server mode deployment"
git push origin main
```

---

## 📊 修復效果對比

| 層次 | 問題 | 原因 | 修復 | 提交 |
|------|------|------|------|------|
| 第一層 | Build 配置缺失 | netlify.toml 無 [build] 段 | 添加 build 配置 | 330db12 |
| 第二層 | 路由無法工作 | SPA 無 catch-all 重定向 | 添加 catch-all 規則 | 59ca901 |
| **第三層** | **部署無法訪問** | **Server 模式無適配器** | **安裝 @netlify/plugin-nextjs** | **77fb712** |

---

## 🔧 技術詳解

### @netlify/plugin-nextjs 做什麼？

```
1. 檢測 Next.js 版本和構建配置
2. 分析 .next/ 目錄結構
3. 生成 serverless 函數適配器
4. 配置路由轉發規則
5. 處理靜態資源緩存
6. 支持 ISR (Incremental Static Regeneration)
```

### 部署流程現在變成：

```
用戶請求 → Netlify Edge
          ↓
    檢查是否靜態？
    ├─ 是 → 返回靜態文件
    └─ 否 → 轉發到 Function
          ↓
      @netlify/plugin-nextjs
      生成的適配器
          ↓
      調用 Next.js Server
          ↓
      返回渲染結果
          ↓
      返回給用戶
```

### 為什麼之前的配置不工作？

舊配置只是告訴 Netlify "託管 .next 目錄"，但：
- `.next/` 中沒有 HTML 入口
- 無法執行 Next.js Server 代碼
- 所有請求都返回 404

新配置：
- 插件自動生成適配器
- 動態請求由 Functions 處理
- 靜態文件正常保存

---

## ✅ 驗證清單

部署後（3-5 分鐘內）：

- [ ] 訪問 https://test-lazybacktest.netlify.app/
- [ ] 首頁正常顯示（無 404）
- [ ] 測試 `/backtest` 路由
- [ ] 測試 `/stock-records` 路由
- [ ] 檢查 Netlify 部署日誌：
  - [ ] 看到 "Plugin @netlify/plugin-nextjs"
  - [ ] 沒有構建錯誤
  - [ ] 函數正確部署

---

## 🔍 故障排查

### 如果仍然出現 404

**檢查 1：Netlify 部署日誌**
```
https://app.netlify.com/sites/test-lazybacktest/deploys
```
查看是否有插件錯誤信息

**檢查 2：plugin-nextjs 是否真的被安裝**
```bash
npm list @netlify/plugin-nextjs
```

**檢查 3：package.json 是否已更新**
```json
{
  "devDependencies": {
    "@netlify/plugin-nextjs": "^version"
  }
}
```

**檢查 4：netlify.toml 是否正確**
```toml
[[plugins]]
  package = "@netlify/plugin-nextjs"
```

### 如果仍無法解決

聯繫 Netlify 支持，提供：
- Netlify Site ID
- 最新部署日誌
- 提交 hash（77fb712）

---

## 📚 參考資源

- [Netlify Next.js Plugin](https://github.com/netlify/next-runtime)
- [Next.js on Netlify Documentation](https://docs.netlify.com/integrations/frameworks/next-js/)
- [Netlify Build Plugins](https://docs.netlify.com/integrations/build-plugins-and-runtimes/build-plugins/)

---

## 🎯 總結

**三層修復完整流程**：

1. ✅ **Build 層**：Configure build path, command, publish
2. ✅ **Routing 層**：Add catch-all redirect for SPA
3. ✅ **Runtime 層**：Install @netlify/plugin-nextjs for server execution

這次部署應該成功！🚀

---

**相關提交**：
- 330db12：第一層 - Build 配置
- 59ca901：第二層 - 路由配置
- 946db2b：第二層 - 路由文檔
- 193119c：綜合解決方案
- **77fb712：第三層 - Next.js 運行時適配（此次修復）**
