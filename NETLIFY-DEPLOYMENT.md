# 🚀 Netlify 部署配置

## 📋 部署結構

```
test-lazybacktest/
├── v0 design code/              ← Netlify 部署來源
│   ├── netlify.toml             ← 部署配置（重要）
│   ├── package.json
│   ├── .next/                   ← 編譯後的靜態文件（發佈目錄）
│   ├── public/app/              ← 靜態 app 界面
│   └── ...
├── archived/                    ← 不被部署（被 .gitignore 忽略）
│   ├── backups/
│   │   ├── index.html          ← 舊根目錄 index.html（已移出）
│   │   ├── home.html
│   │   ├── contact.html
│   │   └── app.html
│   ├── docs/
│   ├── logs/
│   └── assets/
└── ...
```

## ✅ 部署設定

### v0 design code/netlify.toml

```toml
[build]
  command = "npm run build"
  functions = "netlify/functions"
  publish = ".next"              # 發佈編譯後的 Next.js 靜態文件

[functions]
  directory = "netlify/functions"

# API 代理
[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/*"
  status = 200

# 靜態 App 路由
[[redirects]]
  from = "/app/*"
  to = "/app/index.html"
  status = 200
```

## 🔧 關鍵設定說明

| 設定 | 值 | 說明 |
|------|-----|------|
| **Build Command** | `npm run build` | 在 v0 design code 目錄執行 Next.js 編譯 |
| **Publish Directory** | `.next` | 發佈編譯後的靜態 HTML/CSS/JS |
| **Functions** | `netlify/functions/` | 無伺服器函數位置 |
| **Root index.html** | ❌ 已移至 archived | 不干擾部署流程 |

## 🌐 訪問流量

| URL | 路由 | 來源 |
|-----|------|------|
| `https://site.netlify.app/` | 首頁 | v0 Next.js app |
| `https://site.netlify.app/app/` | 回測工具 | /public/app/index.html |
| `https://site.netlify.app/api/*` | API 代理 | netlify/functions/* |

## 📝 部署歷史

| Commit | 說明 | 狀態 |
|--------|------|------|
| 7ff5549 | Organize project | ✅ 完成 |
| 4c36fbd | Fix Netlify deployment | ✅ 完成 |

## ⚡ 部署流程

1. **推送到 main 分支**
   ```bash
   git push origin main
   ```

2. **Netlify 自動構建**
   - 偵測 `v0 design code/netlify.toml`
   - 執行 `npm run build` 編譯 Next.js
   - 將 `.next/` 發佈為靜態站點

3. **訪問結果**
   - 主網址指向 Next.js 應用
   - `/app/*` 指向靜態回測工具

## ⚠️ 常見問題

### Q: 為什麼根目錄的 index.html 被移走？
A: 根目錄 index.html 會與 Netlify 配置衝突，導致不可預測的部署行為。已移至 `archived/backups/` 備份。

### Q: 如何恢復舊的 index.html？
A: 檔案保存在 `archived/backups/index.html`，如需恢復可手動復制。

### Q: API 代理如何工作？
A: Netlify Functions 在 `netlify/functions/` 中，所有 `/api/*` 請求都自動代理到相應函數。

## 🔗 相關文件

- `v0 design code/netlify.toml` - Netlify 部署配置
- `v0 design code/package.json` - Next.js 項目配置
- `v0 design code/public/app/` - 靜態應用文件
- `archived/ORGANIZATION-REPORT.md` - 完整的檔案整理報告

---

**最後更新**: 2025-11-05
**狀態**: ✅ 部署就緒
