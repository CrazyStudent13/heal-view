/**
 * 体积量测脚本（仅用于本地验收，非构建流程的一部分）。
 *
 * 用法：node scripts/measure-assets.mjs
 * 前置：先执行 `pnpm --filter heal-view-client build`。
 *
 * 输出：
 *  - dist/index.html 中静态引用的 JS/CSS（即首屏资源）的 raw / gzip 体积
 *  - 全部 CSS 产物的 raw / gzip 体积
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';

const distDir = fileURLToPath(new URL('../dist', import.meta.url));
const assetsDir = join(distDir, 'assets');

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

function sizeOf(file) {
  const buf = readFileSync(file);
  return { raw: buf.length, gzip: gzipSync(buf, { level: 9 }).length };
}

const html = readFileSync(join(distDir, 'index.html'), 'utf8');

// index.html 里的 <script src> / <link rel="stylesheet" href> 即首屏静态资源。
// modulepreload 也是首屏会被并行拉取的资源，一并统计。
const referenced = new Set();
for (const m of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) {
  referenced.add(m[1].replace(/^\//, ''));
}
for (const m of html.matchAll(/rel="modulepreload"[^>]*href="(\/assets\/[^"]+)"/g)) {
  referenced.add(m[1].replace(/^\//, ''));
}

let firstScreenRaw = 0;
let firstScreenGzip = 0;
const rows = [];

for (const rel of [...referenced].sort()) {
  const abs = join(distDir, rel);
  let s;
  try {
    s = sizeOf(abs);
  } catch {
    continue;
  }
  firstScreenRaw += s.raw;
  firstScreenGzip += s.gzip;
  rows.push({ rel, ...s });
}

console.log('== 首屏静态资源（index.html 直接引用） ==');
for (const r of rows) {
  console.log(`  ${r.rel.padEnd(44)} raw ${kb(r.raw).padStart(9)}   gzip ${kb(r.gzip).padStart(9)}`);
}
console.log(`  ${'首屏合计'.padEnd(42)} raw ${kb(firstScreenRaw).padStart(9)}   gzip ${kb(firstScreenGzip).padStart(9)}`);

console.log('\n== 全部 CSS 产物 ==');
let cssRaw = 0;
let cssGzip = 0;
for (const name of readdirSync(assetsDir).filter((n) => n.endsWith('.css')).sort()) {
  const abs = join(assetsDir, name);
  const s = sizeOf(abs);
  cssRaw += s.raw;
  cssGzip += s.gzip;
  console.log(`  ${relative(distDir, abs).replaceAll('\\', '/').padEnd(44)} raw ${kb(s.raw).padStart(9)}   gzip ${kb(s.gzip).padStart(9)}`);
}
console.log(`  ${'CSS 合计'.padEnd(42)} raw ${kb(cssRaw).padStart(9)}   gzip ${kb(cssGzip).padStart(9)}`);

const entryCss = readdirSync(assetsDir).filter((n) => /^index-.*\.css$/.test(n));
for (const name of entryCss) {
  const s = sizeOf(join(assetsDir, name));
  console.log(`\n== 入口 CSS ${name} ==\n  raw ${kb(s.raw)}   gzip ${kb(s.gzip)}   (${statSync(join(assetsDir, name)).size} bytes)`);
}
