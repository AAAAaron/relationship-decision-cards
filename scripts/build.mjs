import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const assets = path.join(dist, 'assets');

let buildHash = 'dev';
try {
  buildHash = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim();
} catch (e) {
  buildHash = `dev-${new Date().toISOString().slice(0, 10)}`;
}

await rm(dist, { recursive: true, force: true });
await mkdir(assets, { recursive: true });
await mkdir(path.join(assets, 'backgrounds'), { recursive: true });
await mkdir(path.join(dist, 'vendor'), { recursive: true });
await mkdir(path.join(dist, 'data'), { recursive: true });

const sourceHtml = await readFile(path.join(root, 'index.html'), 'utf8');
const builtHtml = sourceHtml
  .replace('href="src/styles.css"', 'href="assets/styles.css"')
  .replace('src="src/data-model.js"', 'src="assets/data-model.js"')
  .replace('src="src/ai-client.js"', 'src="assets/ai-client.js"')
  .replace('src="src/ai-engine.js"', 'src="assets/ai-engine.js"')
  .replace('src="src/ai-log.js"', 'src="assets/ai-log.js"')
  .replace('src="src/app.js"', 'src="assets/app.js"')
  .replace('src="src/storage.js"', 'src="assets/storage.js"')
  .replace('src="src/table3d/tween.js"', 'src="assets/table3d/tween.js"')
  .replace('src="src/table3d/card-texture.js"', 'src="assets/table3d/card-texture.js"')
  .replace('src="src/table3d/card3d.js"', 'src="assets/table3d/card3d.js"')
  .replace('src="src/table3d/scene3d.js"', 'src="assets/table3d/scene3d.js"')
  .replace('src="src/table3d/hand3d.js"', 'src="assets/table3d/hand3d.js"')
  .replace('src="src/table3d/board3d.js"', 'src="assets/table3d/board3d.js"')
  .replace('src="src/table3d/interact3d.js"', 'src="assets/table3d/interact3d.js"')
  .replace('src="src/table3d/index.js"', 'src="assets/table3d/index.js"')
  .replace('src="src/app.js"', 'src="assets/app.js"')
  .replace('src="src/table3d-bootstrap.js"', 'src="assets/table3d-bootstrap.js"')
  // 注入 git commit hash 给前端读取
  .replace(/window\.__APP_BUILD__ = '[^']*'/, `window.__APP_BUILD__ = '${buildHash}'`);

await writeFile(path.join(dist, 'index.html'), builtHtml);
await cp(path.join(root, 'src', 'styles.css'), path.join(assets, 'styles.css'));
await cp(path.join(root, 'src', 'app.js'), path.join(assets, 'app.js'));
await cp(path.join(root, 'src', 'ai-engine.js'), path.join(assets, 'ai-engine.js'));
await cp(path.join(root, 'src', 'ai-log.js'), path.join(assets, 'ai-log.js'));
await cp(path.join(root, 'src', 'storage.js'), path.join(assets, 'storage.js'));
await cp(path.join(root, 'src', 'data-model.js'), path.join(assets, 'data-model.js'));
await cp(path.join(root, 'src', 'ai-client.js'), path.join(assets, 'ai-client.js'));
await cp(path.join(root, 'src', 'table3d'), path.join(assets, 'table3d'), { recursive: true });
await cp(path.join(root, 'src', 'table3d-bootstrap.js'), path.join(assets, 'table3d-bootstrap.js'));
await cp(path.join(root, 'data', 'demo-data.js'), path.join(dist, 'data', 'demo-data.js'));
await cp(path.join(root, 'assets', 'backgrounds'), path.join(assets, 'backgrounds'), { recursive: true });
await cp(path.join(root, 'assets', 'icons'), path.join(assets, 'icons'), { recursive: true });
await cp(path.join(root, 'vendor', 'three'), path.join(dist, 'vendor', 'three'), { recursive: true });
await cp(path.join(root, 'preview.png'), path.join(dist, 'preview.png'));

console.log(`已生成静态部署目录：${path.relative(root, dist)}/  (build: ${buildHash})`);

