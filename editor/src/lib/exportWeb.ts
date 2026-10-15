/**
 * 导出 Web 版：把游戏产物打成 zip 下载
 *
 * 之所以用 zip 而不是单文件 HTML：素材（图片/音频）没法塞进一个 html 里还能保持小体积，
 * 打包成目录后用户解压即可双击 index.html 开始游戏，也可以直接丢到静态托管上分享。
 */
import JSZip from 'jszip';
import { safeName } from '@gal/shared';
import type { ProjectData } from '../types/project';
import { assembleGameBuild, type BuildProgressReporter, type BuildReport } from './gameBuild';
import { saveFile, type SaveOutcome } from './fileIO';

export type WebExportResult = {
  outcome: SaveOutcome;
  report: BuildReport;
  /** 压缩包文件名 */
  filename: string;
};

/**
 * 导出 Web 版 zip。
 * @param data 项目数据
 * @param onProgress 进度回调
 */
export async function exportWebZip(
  data: ProjectData,
  onProgress?: BuildProgressReporter,
): Promise<WebExportResult> {
  const report = await assembleGameBuild(data, onProgress);

  const zip = new JSZip();
  const title = data.story.meta.title?.trim() || '我的作品';
  // 解压后是一个干净的文件夹，不会把文件散一地
  const folder = safeName(title) || 'game';

  for (const file of report.files) {
    zip.file(`${folder}/${file.path}`, file.bytes);
  }

  onProgress?.('压缩中', 0, 1);
  const blob = await zip.generateAsync(
    { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
    (meta) => onProgress?.('压缩中', Math.round(meta.percent), 100),
  );

  const filename = `${folder}.zip`;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const outcome = await saveFile(bytes, filename, 'application/zip', [
    { name: 'ZIP 压缩包', extensions: ['zip'] },
  ]);

  return { outcome, report, filename };
}
