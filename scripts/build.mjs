import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const assets = path.join(dist, 'assets');

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
  .replace('src="src/app.js"', 'src="assets/app.js"')
  .replace('src="src/storage.js"', 'src="assets/storage.js"')
  .replace('src="src/backgrounds.js"', 'src="assets/backgrounds.js"')
  .replace('src="src/motion-preferences.js"', 'src="assets/motion-preferences.js"')
  .replace('src="src/stage-fx-scenes.js"', 'src="assets/stage-fx-scenes.js"')
  .replace('src="src/stage-fx-controller.js"', 'src="assets/stage-fx-controller.js"')
  .replace('src="src/stage-fx-bootstrap.js"', 'src="assets/stage-fx-bootstrap.js"');

await writeFile(path.join(dist, 'index.html'), builtHtml);
await cp(path.join(root, 'src', 'styles.css'), path.join(assets, 'styles.css'));
await cp(path.join(root, 'src', 'app.js'), path.join(assets, 'app.js'));
await cp(path.join(root, 'src', 'storage.js'), path.join(assets, 'storage.js'));
await cp(path.join(root, 'src', 'data-model.js'), path.join(assets, 'data-model.js'));
await cp(path.join(root, 'src', 'ai-client.js'), path.join(assets, 'ai-client.js'));
await cp(path.join(root, 'src', 'backgrounds.js'), path.join(assets, 'backgrounds.js'));
await cp(path.join(root, 'src', 'motion-preferences.js'), path.join(assets, 'motion-preferences.js'));
await cp(path.join(root, 'src', 'stage-fx-scenes.js'), path.join(assets, 'stage-fx-scenes.js'));
await cp(path.join(root, 'src', 'stage-fx-controller.js'), path.join(assets, 'stage-fx-controller.js'));
await cp(path.join(root, 'src', 'stage-fx-bootstrap.js'), path.join(assets, 'stage-fx-bootstrap.js'));
await cp(path.join(root, 'data', 'demo-data.js'), path.join(dist, 'data', 'demo-data.js'));
await cp(path.join(root, 'assets', 'backgrounds'), path.join(assets, 'backgrounds'), { recursive: true });
await cp(path.join(root, 'vendor', 'three'), path.join(dist, 'vendor', 'three'), { recursive: true });
await cp(path.join(root, 'preview.png'), path.join(dist, 'preview.png'));

console.log(`已生成静态部署目录：${path.relative(root, dist)}/`);
