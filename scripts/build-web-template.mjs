/**
 * 把 runtime 的 Web 版构建产物复制成编辑器可用的「导出模板」
 *
 * 为什么要这么做：
 * 编辑器要「一键导出可玩的游戏」，就必须内置一份已经编译好的游戏运行时。
 * 这个脚本先编译 runtime（单文件 IIFE 模式），再把产物拷到 editor/public/runtime-web/，
 * 编辑器在导出时直接读取这些文件，和 story.json、assets 一起打包。
 *
 * 用法：npm run build:template
 */
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');
const distWeb = join(repoRoot, 'runtime', 'dist-web');
const target = join(repoRoot, 'editor', 'public', 'runtime-web');

/** 递归列出目录下所有文件（返回相对路径，统一用 / 分隔） */
function listFiles(root) {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) out.push(relative(root, full).split(sep).join('/'));
    }
  };
  walk(root);
  return out.sort();
}

console.log('[模板] 编译 runtime（web-export 模式）…');
execSync('npm run build:web -w runtime', { cwd: repoRoot, stdio: 'inherit' });

if (!existsSync(distWeb)) {
  console.error('[模板] 构建失败：找不到 runtime/dist-web');
  process.exit(1);
}

const files = listFiles(distWeb);
if (!files.includes('index.html')) {
  console.error('[模板] 产物里没有 index.html，无法作为导出模板');
  process.exit(1);
}

console.log('[模板] 复制到 editor/public/runtime-web/ …');
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(distWeb, target, { recursive: true });

// 记录清单，编辑器按清单逐个读取，不依赖硬编码文件名
const totalSize = files.reduce((sum, f) => sum + statSync(join(target, f)).size, 0);
writeFileSync(
  join(target, 'manifest.json'),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      files,
      totalSize,
    },
    null,
    2,
  ),
);

console.log(`[模板] 完成：${files.length} 个文件，共 ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
console.log(`[模板] 文件：${files.join('、')}`);
