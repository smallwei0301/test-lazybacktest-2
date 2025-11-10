# LazyBacktest 檔案組織規則

**最後更新：2025年11月10日**

本文件定義 LazyBacktest 專案的檔案放置規則。所有 AI Agent 在進行任何檔案操作時，必須先讀取此文件，確保檔案放置在正確的位置。

---

## 1. 專案結構總覽

```
test-lazybacktest/
├── v0 design code/              # 主要 Next.js 應用
│   ├── app/                     # Next.js App Router (主站點)
│   ├── components/              # React 元件
│   ├── public/                  # 靜態資源 (含 /app 回測應用)
│   │   ├── app/                 # 回測網頁應用 (HTML/CSS/JS)
│   │   └── logo/                # LOGO 資源
│   └── ...
├── assets/                      # 資源檔案
│   ├── logo/                    # LOGO 原始檔案
│   └── mascot/                  # 吉祥物相關
├── js/                          # 回測應用的 JavaScript 檔案
├── css/                         # 回測應用的 CSS 檔案
├── netlify/                     # Netlify 函數配置
├── archived/                    # 已存檔的報告與臨時文件（不自動部署）
├── tests/                       # 測試檔案
├── types/                       # TypeScript 型別定義
├── docs/                        # 文檔與說明文件
├── package.json                 # 專案依賴配置
├── netlify.toml                 # Netlify 部署配置
├── README.md                    # 專案說明（**必讀**）
├── PROJECT-RULES.md             # 專案規則（**必讀**）
├── FILE-ORGANIZATION.md         # 本文件（檔案放置規則）
└── ... 其他配置檔
```

---

## 2. 檔案分類與放置規則

### 2.1 部署相關的檔案 (必須在根目錄或特定位置)

| 檔案/資料夾 | 位置 | 說明 |
|-----------|------|------|
| `package.json` | 根目錄 | 專案依賴配置 |
| `netlify.toml` | 根目錄 | Netlify 部署配置 |
| `README.md` | 根目錄 | 專案主說明文件 |
| `PROJECT-RULES.md` | 根目錄 | 專案規則與準則 |
| `FILE-ORGANIZATION.md` | 根目錄 | **本文件** - 檔案放置規則 |
| `v0 design code/` | 根目錄 | Next.js 應用主目錄 |
| `netlify/` | 根目錄 | Netlify Functions |
| `public/` | `v0 design code/` | 靜態資源 (自動部署) |
| `.gitignore` | 根目錄 | Git 忽略配置 |

### 2.2 開發資源 (應在正確的資源資料夾)

| 檔案/資料夾 | 位置 | 說明 |
|-----------|------|------|
| React 元件 | `v0 design code/components/` | TSX/JSX 檔案 |
| LOGO 資源 | `assets/logo/` 或 `v0 design code/public/logo/` | 原始檔 → `assets/logo/`；部署用 → `public/logo/` |
| 回測應用 | `v0 design code/public/app/` | index.html, contact.html, home.html 等 |
| JavaScript 工具 | `js/` | 回測應用的輔助 JS |
| CSS 樣式 | `css/` | 全局樣式與 Tailwind 配置 |
| 文檔資料 | `docs/` | 項目文檔、使用說明 |
| 測試檔案 | `tests/` | 單元測試、集成測試 |
| TypeScript 型別 | `types/` | .d.ts 型別定義檔 |

### 2.3 與部署無關的檔案 (必須在 /archived/)

❌ **不應放在根目錄，一律移至 `/archived/`**

| 檔案類型 | 範例 | 說明 |
|---------|------|------|
| 完成報告 | `DELIVERY-REPORT.md`, `FINAL-VERIFICATION.md` | 工作完成報告 |
| 修復記錄 | `NETLIFY-*.md`, `NETLIFY-FIX-*.md` | Netlify 修復過程記錄 |
| AI 參考檔 | `AI-AGENT-*.md`, `VS-CODE-*.md` | AI Agent 參考說明 (可保留一份在 .vscode/) |
| 遷移指南 | `MIGRATION-GUIDE.md`, `LOGO-MIGRATION-*.md` | 數據遷移或變更記錄 |
| 開發腳本 | `convert_logo_to_white.js` | 一次性開發工具腳本 |
| 舊資源 | `LOGO-2.png` (原始版本) | 已被新版本替代的資源 |
| 版本檢查 | `LOGO-VERIFICATION-*.txt` | 驗證紀錄與檢查清單 |
| 規則文件 | `GITIGNORE-RULES.md`, `QUICK-START.md` | 已集成的規則說明 |

### 2.4 配置檔案 (保留在根目錄)

| 檔案 | 說明 |
|------|------|
| `tsconfig.json` | TypeScript 配置 |
| `jest.config.js` | Jest 測試配置 |
| `postcss.config.js` | PostCSS 配置 |
| `tailwind.config.js` | Tailwind CSS 配置 |
| `.gitignore` | Git 忽略規則 |

---

## 3. Netlify 自動部署配置

**.netlify 資料夾**
- 自動部署工作區，不應手動修改
- 已在 `.gitignore` 中排除

**/archived/ 資料夾**
- 在 `.gitignore` 中已排除
- Netlify 部署時不會追蹤此資料夾
- 用於存放開發文件、報告、臨時檔案

**部署包含項目**
- ✅ `v0 design code/public/` - 靜態資源
- ✅ `v0 design code/app/` - Next.js 路由
- ✅ `netlify/` - Netlify Functions
- ✅ `package.json`, `netlify.toml` - 配置

**部署排除項目**
- ❌ `node_modules/` - 依賴 (Netlify 自動安裝)
- ❌ `coverage/` - 測試覆蓋報告
- ❌ `/archived/` - 已存檔檔案
- ❌ `.vscode/` - IDE 配置

---

## 4. AI Agent 檔案操作指南

### ✅ 正確的操作

1. **建立新的 React 元件**
   ```
   正確：v0 design code/components/my-component.tsx
   ```

2. **新增 LOGO 資源**
   ```
   原始檔案：assets/logo/logo-new.png
   部署用：v0 design code/public/logo/logo-new.png
   ```

3. **修改回測應用**
   ```
   位置：v0 design code/public/app/index.html
   ```

4. **添加文檔**
   ```
   位置：docs/ 或 README.md / PROJECT-RULES.md
   ```

5. **建立完成報告**
   ```
   臨時存放：archived/PROJECT-STATUS-2025-11-10.md
   ```

### ❌ 應避免的操作

1. ❌ 在根目錄建立新的 `.md` 報告檔
   ```
   錯誤：PROJECT-REPORT.md （直接在根目錄）
   正確：archived/PROJECT-REPORT.md
   ```

2. ❌ 開發工具腳本放在根目錄
   ```
   錯誤：my-script.js
   正確：archived/my-script.js （臨時） 或適當的資源資料夾
   ```

3. ❌ 將舊的資源文件保留在根目錄
   ```
   錯誤：OLD-LOGO-2.png
   正確：archived/OLD-LOGO-2.png
   ```

---

## 5. .gitignore 忽略清單

下列項目在 Git 中被忽略，**不會自動部署到 Netlify**：

```gitignore
# Local Netlify folder
.netlify

# Archived files - not tracked in git history
/archived/

# Backup files
js/*backup*.js
js/*corrupted*.js

# Test coverage
coverage/

# Dependencies
node_modules/

# IDE configuration
.vscode/
.idea/

# OS files
.DS_Store
Thumbs.db

# Temporary files
*.tmp
*.swp
*.swo
```

---

## 6. 每次工作流程檢查清單

### 建立或修改檔案時：

- [ ] 此檔案是否與部署相關？
  - 是 → 放在 `v0 design code/public/` 或對應的專案資料夾
  - 否 → 放在 `/archived/` 或臨時位置

- [ ] 此檔案是否為報告、開發記錄或臨時文件？
  - 是 → 放在 `/archived/`
  - 否 → 放在適當的開發資料夾

- [ ] 此檔案名稱是否清晰且無重複？
  - 確認不會與現有檔案衝突

- [ ] 此檔案是否需要在 `.gitignore` 中新增排除規則？
  - 確認 Git 正確處理此檔案

---

## 7. 參考文件

- **README.md** - 專案主說明
- **PROJECT-RULES.md** - 專案規則與準則
- **.gitignore** - Git 忽略規則
- **netlify.toml** - 部署配置

---

**重要提醒：** 所有 AI Agent 在進行檔案操作前，必須參考此文件，確保檔案放置在正確的位置，避免部署錯誤或結構混亂。
