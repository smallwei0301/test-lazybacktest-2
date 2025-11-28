---
trigger: always_on
---

# AI Agent 工作指南

**本檔案是 LazyBacktest 專案的 AI Agent 工作規則。所有 AI 工具在開始工作前必須讀取此文件。**

---

## 必讀檔案順序

在進行任何開發或維護工作前，按以下順序讀取：

1. **README.md** - 專案總體說明
2. **FILE-ORGANIZATION.md** - 檔案放置規則（**最重要**）
3. **PROJECT-RULES.md** - 專案規則與準則

---

## 核心規則

### 1️⃣ 檔案放置規則

**部署相關的檔案：**
- React 元件 → `v0 design code/components/`
- 靜態資源 → `v0 design code/public/`
- 回測應用 → `v0 design code/public/app/`

**與部署無關的檔案：**
- 報告文件 → `/archived/`
- 臨時紀錄 → `/archived/`
- 開發工具腳本 → `/archived/`
- 舊資源 → `/archived/`

**在根目錄保留的檔案：**
- `README.md` - 專案說明
- `PROJECT-RULES.md` - 專案規則
- `FILE-ORGANIZATION.md` - 檔案規則
- `package.json` - 依賴配置
- `netlify.toml` - 部署配置
- `tsconfig.json`, `jest.config.js` 等配置檔

❌ **禁止在根目錄建立報告或臨時檔案！**

### 2️⃣ Git 忽略規則

以下檔案/資料夾被 Git 忽略，**不會自動部署**：

```
/archived/          # 已存檔文件
node_modules/       # 依賴
coverage/           # 測試覆蓋報告
.vscode/            # IDE 配置
.netlify/           # Netlify 工作區
```

### 3️⃣ 工作流程

每次工作結束後：

- [ ] 檢查檔案是否放在正確位置
- [ ] 確認與部署無關的檔案已移至 `/archived/`
- [ ] 驗證沒有在根目錄建立臨時報告
- [ ] **自動開啟簡易瀏覽器查看結果**

### 4️⃣ 常見檔案操作

| 操作 | 正確位置 | 錯誤位置 |
|------|--------|--------|
| 新增 React 元件 | `v0 design code/components/` | 根目錄 |
| 修改 LOGO | `assets/logo/` (原始) 或 `v0 design code/public/logo/` (部署) | 根目錄 |
| 修改回測應用 | `v0 design code/public/app/` | 根目錄 |
| 建立完成報告 | `/archived/` | 根目錄 |
| 開發工具腳本 | `/archived/` | 根目錄 |
| 文檔說明 | `/docs/` 或 `README.md` | 根目錄的 .md |

---

## AI Agent 必須執行的步驟

### 每次完成任務後：

1. ✅ 檢查所有檔案放置位置
2. ✅ 確認 .gitignore 配置正確
3. ✅ 驗證沒有無關檔案在根目錄
4. ✅ **自動開啟簡易瀏覽器** (http://localhost:3000)

### 自動開啟瀏覽器的配置

```javascript
// 每次工作完成時
open_simple_browser('http://localhost:3000')
```

---

## 常見錯誤與解決

### ❌ 錯誤 1: 在根目錄建立報告

```bash
錯誤：PROJECT-COMPLETION-REPORT.md (根目錄)
正確：archived/PROJECT-COMPLETION-REPORT.md
```

### ❌ 錯誤 2: 遺忘自動開啟瀏覽器

```
每次完成工作，必須自動開啟 http://localhost:3000
不要依賴使用者手動輸入指令
```

### ❌ 錯誤 3: 將工具腳本放在根目錄

```bash
錯誤：convert_logo.js (根目錄)
正確：archived/convert_logo.js 或適當的資源資料夾
```

---

## 參考檔案位置

- 🗂️ 檔案規則：[FILE-ORGANIZATION.md](../FILE-ORGANIZATION.md)
- 📋 專案規則：[PROJECT-RULES.md](../PROJECT-RULES.md)
- 📖 專案說明：[README.md](../README.md)

---

**記住：正確的檔案組織 = 順暢的部署流程 = 高效的開發體驗** ✨