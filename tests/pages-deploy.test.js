const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('GitHub Pages 工作流测试、构建并发布 dist 目录', () => {
  const workflowPath = path.join(root, '.github', 'workflows', 'deploy-pages.yml');

  assert.equal(fs.existsSync(workflowPath), true, '应存在 GitHub Pages 发布工作流');

  const workflow = fs.readFileSync(workflowPath, 'utf8');
  assert.match(workflow, /npm run check/);
  assert.match(workflow, /path:\s*dist/);
  assert.match(workflow, /actions\/upload-pages-artifact@v3/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
  assert.match(workflow, /pages:\s*write/);
  assert.match(workflow, /id-token:\s*write/);
});

test('README 提供公开在线试玩入口', () => {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');

  assert.match(readme, /https:\/\/aaaaaron\.github\.io\/relationship-decision-cards\//);
});
