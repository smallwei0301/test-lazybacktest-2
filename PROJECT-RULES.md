# 📋 AI Agent 文件放置規則指南

**最後更新**: 2025-11-05  
**版本**: 1.0  
**目的**: 確保 AI Agent 生成的所有文件都被正確組織，不干擾 Netlify 自動部署

---

## 🎯 核心原則

1. **主目錄清潔性** ✅
   - 根目錄只保留部署必要的配置文件
   - 任何非部署相關的文件都應移至指定目錄

2. **Netlify 部署安全** ✅
   - 所有操作都必須尊重現有的 `v0 design code/netlify.toml` 配置
   - 不得在根目錄新增可能干擾部署的檔案

3. **AI Agent 指引清晰** ✅
   - 每種檔案類型都有明確的位置規則
   - 讀取時也有對應的來源位置

4. **版本控制整潔** ✅
   - 生成的文件必須考慮 `.gitignore` 設定
   - 臨時檔案應放在被忽略的目錄中

---

## 📂 目錄結構與規則

```
test-lazybacktest/
│
├─ 📍 根目錄（MAIN ROOT）
│  ├─ ✅ README.md                      # 主文檔（保留）
│  ├─ ✅ NETLIFY-DEPLOYMENT.md          # 部署指南（保留）
│  ├─ ✅ package.json                   # Node 配置（保留）
│  ├─ ✅ netlify.toml                   # Netlify 配置（保留）
│  ├─ ✅ tsconfig.json                  # TypeScript 配置（保留）
│  ├─ ✅ jest.config.js                 # Jest 配置（保留）
│  ├─ ✅ postcss.config.js              # PostCSS 配置（保留）
│  ├─ ✅ tailwind.config.js             # Tailwind 配置（保留）
│  └─ ❌ 任何其他 .md、.txt、臨時文件  # 不允許！
│
├─ 📍 v0 design code/（NEXT.JS APP）
│  ├─ ✅ netlify.toml                   # 部署配置
│  ├─ ✅ package.json
│  ├─ ✅ app/                           # 頁面和組件
│  ├─ ✅ public/                        # 靜態資源
│  │  └─ app/                          # 舊回測工具靜態文件
│  ├─ ✅ .next/                         # 編譯產物（發佈目錄）
│  ├─ ✅ netlify/functions/             # 無伺服器函數
│  └─ 📝 archived/                     # 項目內臨時文件
│     └─ docs/                         # 項目文檔
│
├─ 📍 archived/（ARCHIVED FILES - 被 .gitignore 忽略）
│  ├─ 📚 docs/                          # 文檔和說明
│  │  ├─ *.md                          # 所有 .md 文檔
│  │  ├─ MIGRATION-*.md
│  │  ├─ QUICK-*.md
│  │  └─ ...
│  │
│  ├─ 🔄 backups/                       # 備份文件
│  │  ├─ index.html                    # 舊根目錄 HTML
│  │  ├─ home.html
│  │  ├─ contact.html
│  │  ├─ app.html
│  │  └─ home - 第一版.html
│  │
│  ├─ 📊 logs/                          # 日誌文件
│  │  ├─ *.log
│  │  └─ deployment-*.log
│  │
│  ├─ 🎨 assets/                        # 示意圖片和資源
│  │  ├─ *.jpg
│  │  ├─ *.png
│  │  └─ ...其他圖片
│  │
│  └─ 📝 README.md                      # Archived 說明
│
├─ 📍 js/（靜態 JS 文件 - 舊應用相關）
│  ├─ *.js                              # 所有 JavaScript 檔案
│  └─ strategies/
│
├─ 📍 css/（靜態樣式 - 舊應用相關）
│  └─ *.css
│
├─ 📍 docs/（靜態文檔 - 舊應用相關）
│  └─ *.md
│
├─ 📍 tests/（測試文件）
│  ├─ unit/
│  ├─ integration/
│  └─ *.test.js
│
├─ 📍 .gitignore                        # Git 忽略規則（保留）
└─ 📍 .git/                             # Git 數據（保留）
```

---

## 📝 文件類型放置規則

### 1️⃣ 項目文檔（.md 文件）

| 檔案類型 | 位置 | 讀取來源 | 說明 |
|---------|------|---------|------|
| 主要文檔 | `./README.md` | `./README.md` | 項目簡介（保留在根目錄） |
| 部署指南 | `./NETLIFY-DEPLOYMENT.md` | `./NETLIFY-DEPLOYMENT.md` | Netlify 部署說明（保留在根目錄） |
| 項目規則 | `./PROJECT-RULES.md` | `./PROJECT-RULES.md` | 本文件（放在根目錄） |
| 功能/變更說明 | `archived/docs/` | `archived/docs/` | 所有其他 .md 文件 |
| 臨時筆記 | ❌ 不允許 | - | 應使用 comments 或 archived/docs/ |

### 2️⃣ 程式碼文件

| 檔案類型 | 位置 | 讀取來源 | 說明 |
|---------|------|---------|------|
| Next.js 頁面 | `v0 design code/app/` | `v0 design code/app/` | 新功能開發 |
| React 組件 | `v0 design code/components/` | `v0 design code/components/` | 組件庫 |
| API 路由 | `v0 design code/app/api/` | `v0 design code/app/api/` | 後端邏輯 |
| 工具函數 | `v0 design code/lib/` | `v0 design code/lib/` | 共用函數 |
| 無伺服器函數 | `v0 design code/netlify/functions/` | `v0 design code/netlify/functions/` | Netlify Functions |
| TypeScript 類型 | `v0 design code/types/` | `v0 design code/types/` | 類型定義 |
| 靜態資源 | `v0 design code/public/` | `v0 design code/public/` | 圖片、圖標等 |

### 3️⃣ 備份和舊文件

| 檔案類型 | 位置 | 讀取來源 | 說明 |
|---------|------|---------|------|
| 舊 HTML 文件 | `archived/backups/` | `archived/backups/` | 不再使用 |
| 版本備份 | `archived/backups/` | `archived/backups/` | 舊版本保存 |

### 4️⃣ 資源和日誌

| 檔案類型 | 位置 | 讀取來源 | 說明 |
|---------|------|---------|------|
| 示意圖片 | `archived/assets/` | `archived/assets/` | 文檔用圖片 |
| 部署日誌 | `archived/logs/` | `archived/logs/` | 部署記錄 |
| 錯誤日誌 | `archived/logs/` | `archived/logs/` | 調試用日誌 |

### 5️⃣ 測試文件

| 檔案類型 | 位置 | 讀取來源 | 說明 |
|---------|------|---------|------|
| 單元測試 | `tests/unit/` | `tests/unit/` | Jest 單元測試 |
| 集成測試 | `tests/integration/` | `tests/integration/` | 集成測試 |
| 測試配置 | `jest.config.js` | `jest.config.js` | Jest 配置（根目錄） |

---

## ✅ AI Agent 作業檢查清單

### 在開始工作前，請確認：

- [ ] **檔案類型已識別** - 知道要生成什麼類型的檔案
- [ ] **目標位置已確認** - 根據上表確認應該放在哪裡
- [ ] **Netlify 影響評估** - 確認不會干擾部署流程
- [ ] **.gitignore 檢查** - 確認文件是否應被 Git 追蹤

### 在完成工作後，請確認：

- [ ] **文件放在正確位置** - 已按規則放置
- [ ] **根目錄未被汙染** - 沒有在根目錄創建不必要的檔案
- [ ] **Git 狀態清晰** - 運行 `git status` 確認無誤
- [ ] **部署配置不變** - netlify.toml 未被修改
- [ ] **可以編譯/部署** - v0 design code 仍可正常編譯

---

## 🚫 禁止行為

❌ **絕對不要做**：

1. 在根目錄創建任何 `.md` 檔案（除了已列出的 3 個）
   ```
   ❌ ./SOME-GUIDE.md
   ✅ ./archived/docs/SOME-GUIDE.md
   ```

2. 在根目錄創建臨時檔案或測試檔案
   ```
   ❌ ./temp.txt
   ❌ ./test-result.log
   ✅ ./archived/logs/test-result.log
   ```

3. 修改根目錄的配置檔案
   ```
   ❌ 修改 ./netlify.toml
   ✅ 只在 ./v0 design code/netlify.toml 中修改
   ```

4. 在根目錄添加 HTML/CSS/JS 檔案
   ```
   ❌ ./style.css
   ✅ ./v0 design code/styles/ 或 ./css/
   ```

5. 創建未在此規則中定義的新目錄
   ```
   ❌ ./new-folder/
   ✅ 使用現有目錄或詢問用戶
   ```

---

## ✅ 推薦的作業流程

### 情景 1: 新增功能到 Next.js 應用

```
1. 在 v0 design code/app/ 中創建頁面或組件
2. 在 v0 design code/lib/ 中添加工具函數
3. 在 v0 design code/types/ 中定義 TypeScript 類型
4. 運行 npm run build 確認編譯成功
5. 提交 git commit
```

### 情景 2: 生成文檔或說明

```
1. 確認是否是部署必需文檔
   - 是: 放在 ./（根目錄）
   - 否: 放在 ./archived/docs/
2. 創建或更新 .md 檔案
3. 運行 git add 並提交
```

### 情景 3: 保存舊版本或備份

```
1. 將舊檔案移至 ./archived/backups/
2. 確認 .gitignore 包含 /archived/
3. 運行 git add 以記錄移動
4. 提交 git commit
```

### 情景 4: 生成錯誤或調試日誌

```
1. 創建日誌檔案到 ./archived/logs/
2. 包含時間戳記和描述
3. 不添加到 git（.gitignore 會忽略）
4. 用戶可在需要時查看
```

---

## 📌 .gitignore 現狀

### 根目錄 `.gitignore`
```
/archived/              # 整個 archived 目錄被忽略
node_modules/
.netlify/
...
```

### v0 design code `.gitignore`
```
/archived/              # 本地 archived 被忽略
/node_modules
/.next/
...
```

**重要**: `/archived/` 被 Git 忽略，因此：
- ✅ 所有備份、日誌、文檔都不會被提交
- ✅ 不會影響 Git 歷史記錄大小
- ✅ 部署時 Netlify 也不會包含這些文件

---

## 🔍 如何驗證規則是否被遵守

運行以下命令檢查：

### 檢查根目錄是否清潔
```bash
ls -la ~/ | grep -E "\.(md|txt|log|html|css|js)$"
# 應該只看到已允許的文件
```

### 檢查 Git 狀態
```bash
git status
# 應該看不到 archived/ 中的文件
# 只會看到 v0 design code/ 中的變更
```

### 檢查 Netlify 部署配置
```bash
cat v0\ design\ code/netlify.toml
# 確認 build 和 publish 設定正確
```

### 檢查 archived 目錄大小
```bash
du -sh archived/
# 可以看到有多少文件被存檔
```

---

## 📞 常見問題

### Q: 我想添加一個新功能，應該在哪裡創建檔案？

**A**: 取決於功能類型：
- **Next.js 頁面** → `v0 design code/app/`
- **React 組件** → `v0 design code/components/`
- **API 路由** → `v0 design code/app/api/`
- **工具函數** → `v0 design code/lib/`
- **類型定義** → `v0 design code/types/`

### Q: 我需要保存一個舊版本的檔案，應該放哪裡？

**A**: 放在 `archived/backups/`

### Q: 我想寫一個技術文檔，應該放哪裡？

**A**: 如果是部署相關，放在根目錄（`.md`）；否則放在 `archived/docs/`

### Q: 根目錄的 netlify.toml 有什麼用？

**A**: 這是舊應用的 Netlify 配置。現在實際的部署配置在 `v0 design code/netlify.toml`。根目錄的會被忽略。

### Q: 如果我不小心在根目錄創建了檔案怎麼辦？

**A**: 
```bash
# 1. 確認檔案內容應該去哪裡
# 2. 移動檔案到正確位置
# 3. git rm <filename>
# 4. git add <new-location>
# 5. git commit
```

### Q: archived 目錄中的文件會被部署嗎？

**A**: 不會。因為 `.gitignore` 忽略了 `/archived/`，Netlify 也不會看到這些文件。

---

## 🎓 實施步驟

### 第 1 步: AI Agent 審閱規則
開始任何工作前，AI Agent 應該：
- 讀取本檔案
- 確認作業類型
- 查詢對應的放置規則

### 第 2 步: 確認文件位置
```
檔案類型 → 查表 → 確認位置 → 開始工作
```

### 第 3 步: 完成後驗證
```
工作完成 → 檢查清單 → 驗證位置 → 提交 Git
```

### 第 4 步: 報告
```
告知用戶文件位置 → 解釋原因 → 列出更改摘要
```

---

## 📊 快速參考表

| 我想... | 檔案類型 | 位置 | 被 Git 追蹤 |
|--------|---------|------|-----------|
| 添加 Next.js 頁面 | .tsx | v0 design code/app/ | ✅ 是 |
| 添加 React 組件 | .tsx | v0 design code/components/ | ✅ 是 |
| 編寫文檔 | .md | archived/docs/ | ❌ 否 |
| 保存舊版本 | .html | archived/backups/ | ❌ 否 |
| 添加圖片 | .jpg/.png | archived/assets/ | ❌ 否 |
| 保存日誌 | .log | archived/logs/ | ❌ 否 |
| 編寫部署指南 | .md | ./ | ✅ 是 |
| 添加類型定義 | .d.ts | v0 design code/types/ | ✅ 是 |

---

## 🚀 最終檢查清單

在提交任何工作前，確認：

- [ ] 所有文件都在正確位置
- [ ] 根目錄沒有不必要的文件
- [ ] `git status` 顯示預期的變更
- [ ] `archived/` 目錄中的文件不在 Git 中
- [ ] Netlify 部署配置未被修改
- [ ] v0 design code 仍可編譯
- [ ] 已記錄所有變更（commit message）

---

**版本**: 1.0  
**最後更新**: 2025-11-05  
**維護者**: 項目管理  
**狀態**: ✅ 實施中
