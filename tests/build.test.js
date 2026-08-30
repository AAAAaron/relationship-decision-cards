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
    'dist/assets/table3d/tween.js',
    'dist/assets/table3d/card-texture.js',
    'dist/assets/table3d/scene3d.js',
    'dist/assets/table3d/index.js',
    'dist/assets/table3d/modern-strategy.js',
    'dist/assets/table3d/modern-strategy.css',
    'dist/assets/table3d/modern-strategy-tuning.js',
    'dist/assets/table3d/modern-strategy-tuning.css',
    'dist/assets/table3d/modern-strategy-art.js',
    'dist/assets/table3d-bootstrap.js',
    'dist/assets/styles.css',
    'dist/assets/backgrounds/manifest.json',
    'dist/vendor/three/three.module.js',
    'dist/data/demo-data.js'
  ];
  required.forEach(file => assert.equal(fs.existsSync(path.join(root, file)), true, `${file} 应存在`));

  const html = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8');
  assert.match(html, /assets\/styles\.css/);
  assert.match(html, /assets\/storage\.js/);
  assert.match(html, /assets\/table3d\/index\.js/);
  assert.match(html, /assets\/table3d-bootstrap\.js/);
  assert.match(html, /assets\/app\.js/);
  assert.match(html, /three\.module\.js/);
  assert.doesNotMatch(html, /node_modules|localhost/);

  const bootstrap = fs.readFileSync(path.join(root, 'dist/assets/table3d-bootstrap.js'), 'utf8');
  assert.match(bootstrap, /table3d\/modern-strategy\.js/);
  assert.match(bootstrap, /table3d\/modern-strategy-tuning\.js/);
  assert.match(bootstrap, /table3d\/modern-strategy-art\.js/);
});
