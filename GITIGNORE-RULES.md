# 📋 .gitignore 規則詳解

**目的**: 幫助 AI Agent 理解哪些文件應該被 Git 追蹤，哪些不應該

---

## 🔍 根目錄 .gitignore

### 當前配置

```gitignore
# Netlify folder
.netlify/

# Archived files - not tracked in git history
/archived/

# 備份檔案
js/*backup*.js
js/*corrupted*.js

# 測試覆蓋率報告
coverage/

# Node modules
node_modules/

# IDE 設定檔案
.vscode/
.idea/

# OS 檔案
.DS_Store
Thumbs.db

# 臨時檔案
*.tmp
*.swp
*.swo
```

### 規則說明

| 規則 | 含義 | 例子 |
|------|------|------|
| `.netlify/` | 本地 Netlify 配置目錄 | `.netlify/state.json` ❌ 不追蹤 |
| `/archived/` | 整個 archived 目錄 | `archived/docs/*.md` ❌ 不追蹤 |
| `js/*backup*.js` | 備份 JS 檔案 | `js/backtest_backup.js` ❌ 不追蹤 |
| `coverage/` | 測試覆蓋率報告 | `coverage/lcov.info` ❌ 不追蹤 |
| `node_modules/` | 依賴包 | `node_modules/package/` ❌ 不追蹤 |
| `*.tmp` | 臨時檔案 | `file.tmp` ❌ 不追蹤 |

---

## 🔍 v0 design code/.gitignore

### 當前配置

```gitignore
# Archived files - not tracked in git history
/archived/

# dependencies
/node_modules

# next.js
/.next/
/out/

# production
/build

# debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*

# env files
.env*

# vercel
.vercel

# typescript
*.tsbuildinfo
next-env.d.ts
```

### 規則說明

| 規則 | 含義 | 例子 |
|------|------|------|
| `/archived/` | 本地 archived 目錄 | `v0/archived/` ❌ 不追蹤 |
| `/node_modules` | 依賴包 | `v0/node_modules/` ❌ 不追蹤 |
| `/.next/` | Next.js 編譯產物 | `v0/.next/` ❌ 不追蹤 |
| `.env*` | 環境變數檔案 | `.env.local` ❌ 不追蹤 |
| `*.log` | 日誌檔案 | `npm-debug.log` ❌ 不追蹤 |

---

## ✅ AI Agent 應該追蹤的檔案

### 根目錄
```
✅ README.md
✅ NETLIFY-DEPLOYMENT.md
✅ PROJECT-RULES.md
✅ AI-AGENT-QUICK-REFERENCE.md
✅ package.json
✅ netlify.toml
✅ tsconfig.json
✅ jest.config.js
✅ postcss.config.js
✅ tailwind.config.js
✅ .gitignore
```

### v0 design code/
```
✅ app/**/*.tsx          （頁面和組件）
✅ components/**/*.tsx   （組件庫）
✅ lib/**/*.ts           （工具函數）
✅ types/**/*.ts         （類型定義）
✅ netlify/functions/**/*.ts （無伺服器函數）
✅ public/**/*           （靜態資源）
✅ styles/**/*           （樣式文件）
✅ package.json
✅ netlify.toml
✅ tsconfig.json
✅ .gitignore
```

---

## ❌ AI Agent 應該忽略/不追蹤的檔案

### 不應該被追蹤（但應該被保存）
```
❌ archived/docs/**/*.md         （文檔，保留但不追蹤）
❌ archived/backups/**/*         （舊版本，保留但不追蹤）
❌ archived/assets/**/*.jpg      （圖片，保留但不追蹤）
❌ archived/logs/**/*.log        （日誌，保留但不追蹤）
```

### 完全不應該存在
```
❌ 根目錄中的 .md（除了允許的 3 個）
❌ 根目錄中的臨時檔案
❌ 未定義的新目錄
```

---

## 📊 Git 狀態解讀指南

### ✅ 正常狀態（預期結果）

```bash
$ git status

On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean
```

或者有待提交的變更：

```bash
Changes to be committed:
  new file:   v0 design code/app/page.tsx
  modified:   v0 design code/lib/utils.ts

Untracked files:
  (nothing shown for archived/ because it's in .gitignore)
```

### ❌ 不正常狀態（需要修正）

```bash
# 不應該看到 archived 中的文件
Changes not staged for commit:
  modified:   archived/docs/README.md  ❌ 不應該追蹤

# 不應該看到根目錄的臨時檔案
Untracked files:
  temp.txt                            ❌ 應該刪除或移動
  TEMP-GUIDE.md                       ❌ 應該移至 archived/docs/
```

---

## 🔧 AI Agent 操作指南

### 檢查某個檔案是否應該被追蹤

```bash
git check-ignore -v <filename>

# 如果輸出顯示規則，表示該文件被忽略
# 如果無輸出，表示該文件應該被追蹤
```

### 例子

```bash
# 檢查 archived 中的文件
$ git check-ignore -v archived/docs/my-guide.md
.gitignore:6:/archived/           archived/docs/my-guide.md
# ✅ 被忽略（符合預期）

# 檢查 v0 中的新頁面
$ git check-ignore -v v0\ design\ code/app/newpage.tsx
# （無輸出）✅ 應該被追蹤（符合預期）

# 檢查根目錄的臨時文件
$ git check-ignore -v temp.txt
.gitignore:23:*.tmp                temp.txt
# ✅ 被忽略（符合預期）
```

### 檢查一個目錄是否被 .gitignore 忽略

```bash
# 檢查 archived 目錄
git check-ignore -d archived/
# ✅ 應該有輸出，表示被忽略

# 檢查 v0 design code/app
git check-ignore -d v0\ design\ code/app/
# ✅ 應該無輸出，表示不被忽略
```

---

## 📝 AI Agent 工作流程

### 開始工作

1. **確認檔案類型和目標位置**
   ```
   檔案類型 → 查看 PROJECT-RULES.md → 確認位置
   ```

2. **檢查該位置是否應被 Git 追蹤**
   ```bash
   git check-ignore -v <target-path>
   ```

3. **創建/修改檔案**
   ```
   在正確的目錄下進行工作
   ```

### 完成工作

1. **檢查 git status**
   ```bash
   git status
   ```

2. **確認所有變更都符合預期**
   ```bash
   git diff --name-only
   ```

3. **檢查是否有不應該的檔案**
   ```bash
   # 不應該看到 archived 中的文件
   # 不應該看到根目錄的臨時檔案
   ```

4. **提交變更**
   ```bash
   git add .
   git commit -m "description"
   ```

---

## 🎯 特殊情況

### 情況 1: 我想臨時添加一個檔案進行測試，不想提交

```bash
# 創建檔案
echo "test" > test-file.txt

# 檢查是否被追蹤
git status

# 如果要排除它
echo "test-file.txt" >> .gitignore.local

# 工作完後刪除
rm test-file.txt
```

### 情況 2: 我不小心提交了不應該提交的檔案

```bash
# 撤銷最後的提交（但保留檔案）
git reset --soft HEAD~1

# 將檔案從 Git 移除
git rm --cached <filename>

# 檢查 .gitignore 是否包含它
# 重新提交
git commit -m "Remove unwanted file"
```

### 情況 3: 我想檢查 archived 中有多少檔案（但不追蹤）

```bash
# 列出所有被忽略的檔案
git check-ignore -r archived/

# 查看 archived 目錄大小
du -sh archived/

# 查看 archived 中的檔案數量
find archived/ -type f | wc -l
```

---

## 📊 規則檢查清單

在每次提交前，運行以下命令確認：

```bash
# 1. 檢查根目錄是否有不應該的檔案
ls -la . | grep -E "\.(md|txt|html|css|js)$" | grep -v "README\|NETLIFY\|PROJECT\|AI-AGENT"

# 2. 檢查 git 狀態
git status

# 3. 檢查即將提交的檔案
git diff --name-only --cached

# 4. 檢查是否有意外的檔案被追蹤
git ls-files | grep -E "archived|temp|backup" | grep -v "\.git"
```

---

## ✅ 最終驗證

```bash
# 這些應該都返回結果（被忽略）
git check-ignore -d archived/          ✅
git check-ignore -v archived/docs/     ✅
git check-ignore -v .netlify/          ✅

# 這些應該都無返回結果（不被忽略）
git check-ignore -d v0\ design\ code/  ✅
git check-ignore -d app/               ✅

# Git 應該顯示簡潔的狀態
git status                             ✅
```

---

**版本**: 1.0  
**最後更新**: 2025-11-05  
**目的**: 確保 AI Agent 理解並遵守文件追蹤規則
