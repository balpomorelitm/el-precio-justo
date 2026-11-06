import { mkdir, copyFile, cp, readFile } from 'node:fs/promises';
const files = ['index.html', 'styles.css', 'app.js', 'engine.js', 'catalog.js'];
await mkdir('dist', { recursive: true });
for (const file of files) await copyFile(file, `dist/${file}`);
await cp('assets', 'dist/assets', { recursive: true });
const catalog = (await import('../catalog.js')).CATALOG;
for (const product of catalog) await readFile(`dist/${product.image}`);
console.log(`Web preparada: ${files.length} archivos y ${catalog.length} productos con imágenes locales.`);
