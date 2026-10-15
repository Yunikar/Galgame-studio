/**
 * 导出 Windows exe（仅编辑器桌面版可用）
 *
 * 流程：
 *  1. 组装游戏产物（与 Web 版完全一致的那份）
 *  2. 用户选输出位置 -> Rust 建游戏文件夹并逐个写文件（带进度）
 *  3. Rust 把「便携播放器」复制进游戏文件夹，命名成作品名
 *
 * 结果是一个自包含的文件夹：
 *   《作品名》.exe   双击即玩（读同目录的 story.json 与 assets/）
 *   index.html       不想运行 exe 时，用浏览器打开也能玩
 *   story.json / assets/
 */
import { safeName } from '@gal/shared';
import type { ProjectData } from '../types/project';
import { assembleGameBuild, type BuildProgressReporter, type BuildReport } from './gameBuild';
import { isTauri } from './fileIO';

/** 是否具备导出 exe 的条件 */
export function exeSupported(): boolean {
  return isTauri();
}

export type ExeExportResult =
  | { kind: 'done'; directory: string; exeName: string; report: BuildReport }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string };

/** Tauri 动态导入的小包装，避免浏览器环境下一开始就去加载桌面模块 */
async function tauriInvoke() {
  const core = await import('@tauri-apps/api/core');
  return core.invoke;
}

/**
 * 导出 exe。
 * @param data 项目数据
 * @param onProgress 进度回调
 */
export async function exportExe(
  data: ProjectData,
  onProgress?: BuildProgressReporter,
): Promise<ExeExportResult> {
  if (!exeSupported()) {
    return { kind: 'error', message: '导出 exe 需要在编辑器桌面版里操作。' };
  }

  const report = await assembleGameBuild(data, onProgress);
  const invoke = await tauriInvoke();

  // 1. 选输出位置
  const root = await invoke<string | null>('pick_directory');
  if (!root) return { kind: 'cancelled' };

  // 2. 建游戏文件夹（名字做一次清洗，避免标题里有非法字符）
  const folder = safeName(data.story.meta.title?.trim() || '我的作品') || 'game';
  const gameDir = await invoke<string>('create_game_folder', { root, folder });

  // 3. 逐个写文件（素材多的时候也能平滑显示进度）
  let done = 0;
  for (const file of report.files) {
    await invoke('write_game_file', { gameDir, rel: file.path, data: file.base64 });
    done += 1;
    onProgress?.('写入文件', done, report.files.length);
  }

  // 4. 复制播放器进来
  onProgress?.('生成 exe', 0, 1);
  const exeName = folder;
  try {
    await invoke<string>('copy_player_exe', { gameDir, exeName });
  } catch (error) {
    return {
      kind: 'error',
      message: `游戏文件已经写好了，但生成 exe 失败：${String(error)}\n现在就能打开 ${gameDir} 里的 index.html 先玩。`,
    };
  }
  onProgress?.('生成 exe', 1, 1);

  // 5. 顺手把文件夹打开，用户立刻能看到成果
  try {
    await invoke('reveal_path', { path: gameDir });
  } catch {
    // 打不开资源管理器不算失败
  }

  return { kind: 'done', directory: gameDir, exeName: `${exeName}.exe`, report };
}
