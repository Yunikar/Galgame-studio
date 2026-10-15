/**
 * 把编译好的播放器 exe 复制到「编辑器桌面版」能自动找到的位置：
 *   editor/src-tauri/target/release/player/galgame-player.exe
 *
 * 这样跑完 npm run build:player 再跑 npm run build:desktop，
 * 编辑器里的「导出 exe」功能就能直接用，不需要手动搬文件。
 *
 * 注意：部分安全防护环境里，直接「覆盖」已存在的 exe 文件会导致进程被拦截，
 * 所以这里用「先改名旧的、再写新的」的策略，而不是原地覆盖。
 */
import { copyFileSync, existsSync, mkdirSync, renameSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(fileURLToPath(import.meta.url), '..', '..');
const src = join(repoRoot, 'runtime', 'src-tauri', 'target', 'release', 'galgame-player.exe');
const destDir = join(repoRoot, 'editor', 'src-tauri', 'target', 'release', 'player');
const dest = join(destDir, 'galgame-player.exe');

if (!existsSync(src)) {
  console.error('[播放器] 找不到编译产物：' + src);
  console.error('[播放器] 请先成功执行 npm run build:player（其中包含 cargo 编译）。');
  process.exit(1);
}

mkdirSync(destDir, { recursive: true });

// 目标已存在：先看内容是否一致，一致就没必要再写
if (existsSync(dest)) {
  const same =
    readFileSync(src).length === readFileSync(dest).length &&
    readFileSync(src).equals(readFileSync(dest));
  if (same) {
    console.log('[播放器] player/ 目录里已是最新版本，无需复制。');
    process.exit(0);
  }
  // 不一致：把旧的改名让路（改名不受「覆盖 exe」限制）
  const backup = dest + '.old';
  if (existsSync(backup)) {
    try {
      rmSync(backup);
    } catch {
      // 删不掉就算了，留着也不影响功能
    }
  }
  renameSync(dest, backup);
  try {
    copyFileSync(src, dest);
    // 新文件写好了，再清掉备份
    try {
      rmSync(backup);
    } catch {
      console.log('[播放器] 旧版本备份 ' + backup + ' 删除失败，可手动清理。');
    }
  } catch (e) {
    // 写新文件失败时把备份改回去，避免目录里没有可用的播放器
    renameSync(backup, dest);
    throw e;
  }
} else {
  copyFileSync(src, dest);
}

console.log('[播放器] 已复制到 ' + dest);
console.log('[播放器] 编辑器的「导出 exe」功能现在可以直接使用。');
