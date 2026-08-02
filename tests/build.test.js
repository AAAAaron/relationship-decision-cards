const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');

test('构建生成可直接静态部署的完整 dist 目录', () => {
  execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: root });

  const required = [
    'dist/index.html',
    'dist/assets/app.js',
    'dist/assets/data-model.js',
    'dist/assets/ai-client.js',
    'dist/assets/storage.js',
    'dist/assets/backgrounds.js',
    'dist/assets/styles.css',
    'dist/assets/backgrounds/manifest.json',
    'dist/assets/backgrounds/candlelit-table.png',
    'dist/data/demo-data.js'
  ];
  required.forEach(file => assert.equal(fs.existsSync(path.join(root, file)), true, `${file} 应存在`));

  const html = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8');
  assert.match(html, /assets\/styles\.css/);
  assert.match(html, /assets\/storage\.js/);
  assert.match(html, /assets\/backgrounds\.js/);
  assert.match(html, /assets\/app\.js/);
  assert.doesNotMatch(html, /node_modules|localhost/);
});
