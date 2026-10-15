/**
 * 冒烟测试运行器
 * 运行：npm run smoke
 *
 * 为什么要先打包：项目里的代码有 TS、有 @gal/shared 路径别名、有 workspace 跨包引用，
 * Node 直接跑不了。用 esbuild 打成一个文件再执行，就能在没有浏览器的环境里验证
 * 剧情引擎、存档、校验、导出打包这些纯逻辑。
 */
import { build } from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');
const outDir = join(repoRoot, 'node_modules', '.smoke');
const outfile = join(outDir, 'smoke.mjs');

mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: [join(here, 'smoke.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  sourcemap: false,
  logLevel: 'warning',
  // 桌面端专有模块在 Node 里不存在，测试用不到，直接跳过
  external: ['@tauri-apps/api', '@tauri-apps/plugin-dialog', '@tauri-apps/plugin-fs'],
  alias: {
    '@gal/shared': join(repoRoot, 'shared', 'src', 'index.ts'),
  },
});

const result = spawnSync(process.execPath, [outfile], { stdio: 'inherit', cwd: repoRoot });

// 清理临时产物。某些环境下删除会被沙箱拦下，清不掉也不影响结果
try {
  rmSync(outDir, { recursive: true, force: true });
} catch {
  /* 忽略 */
}

process.exit(result.status ?? 1);
