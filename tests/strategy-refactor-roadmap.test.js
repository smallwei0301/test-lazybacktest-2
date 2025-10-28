const assert = require('assert');
const path = require('path');
const fs = require('fs');

const roadmap = require(path.join('..', 'js', 'lib', 'strategy-refactor-roadmap.js'));

function testRoadmapShape() {
  assert(roadmap && typeof roadmap.getTask === 'function', 'roadmap 模組應提供 getTask');
  assert.strictEqual(typeof roadmap.__version__, 'string', 'roadmap 應提供版本字串');
  const task = roadmap.getTask();
  assert(task && typeof task === 'object', 'getTask 應回傳物件');
  assert.strictEqual(task.version, 'LB-STRATEGY-ROADMAP-20241001A', '任務版本應符合約定');
  assert.strictEqual(task.title, '策略插件模組化基線任務', '任務標題應清楚描述目標');
  assert(task.actionPlan && typeof task.actionPlan === 'object', '任務應包含 actionPlan');
  assert.strictEqual(task.actionPlan.id, 'LB-PLUGIN-CONSOLIDATED-TASK-20241001A', '行動計畫代碼應一致');
  assert(Array.isArray(task.actionPlan.phases), '行動計畫應提供 phases 陣列');
  assert.strictEqual(task.actionPlan.phases.length, 3, '行動計畫應將多階段濃縮為三個里程碑');
  task.actionPlan.phases.forEach((phase) => {
    assert(Array.isArray(phase.sourceStages) && phase.sourceStages.length > 0, '每個里程碑需標明來源階段');
    assert(typeof phase.focus === 'string' && phase.focus.length > 0, '里程碑需提供焦點描述');
  });
  assert(Array.isArray(task.relatedFiles) && task.relatedFiles.length >= 3, '應列出相關檔案清單');
  task.relatedFiles.forEach((relativePath) => {
    const fullPath = path.join(__dirname, '..', relativePath);
    assert(fs.existsSync(fullPath), `相關檔案 ${relativePath} 應存在`);
  });
  assert(Array.isArray(task.automatedValidation) && task.automatedValidation.length > 0, '應提供自動驗證指令');
  const hasNpmTest = task.automatedValidation.some((entry) => entry.command === 'npm test');
  assert(hasNpmTest, '自動驗證需包含 npm test');
  assert(typeof task.manualValidation === 'string' && task.manualValidation.includes('策略模組化任務檢查'), '手動驗證說明需提到開發者按鈕');
}

function run() {
  testRoadmapShape();
  console.log('strategy-refactor-roadmap tests passed');
}

run();
