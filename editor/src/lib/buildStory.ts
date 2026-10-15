/**
 * 剧本与素材打包（纯函数，不依赖浏览器）
 *
 * 职责：把编辑器里的「故事 + 素材记录」整理成运行时能直接吃的形态：
 * - 剧本里每个素材条目的 path 统一指向 assets/xxx.ext
 * - 素材二进制转成字节，按 path 排好
 * - 收集被引用但找不到文件的素材，导出时提示用户
 */
import { cloneStory, type Asset, type AssetCategory, type Story } from '@gal/shared';
import type { EditorAsset } from '@gal/shared';
import { dataUrlToBytes } from './assetUtils';
import { dataUrlToBase64 } from './base64';

/** 素材数组的分类顺序 */
export const ASSET_CATEGORIES: AssetCategory[] = ['backgrounds', 'sprites', 'bgms', 'ses', 'voices'];

/** 分类中文名（提示文案用） */
export const CATEGORY_LABEL: Record<AssetCategory, string> = {
  backgrounds: '背景图',
  sprites: '立绘',
  bgms: '背景音乐',
  ses: '音效',
  voices: '语音',
};

/** 有问题的素材 */
export type ProblemAsset = { id: string; name: string; label: string };

/** 一个待写入的素材文件 */
export type AssetFile = {
  path: string;
  bytes: Uint8Array;
  /** 同一份内容的 base64（导出 exe 时直接传给 Rust，省一次转码） */
  base64: string;
};

export type StoryPack = {
  /** 整理后的剧本（已克隆，改它不会影响编辑器） */
  story: Story;
  /** 需要写进 assets/ 的文件 */
  files: AssetFile[];
  /** 剧本里有、但编辑器里没有对应素材记录 */
  missing: ProblemAsset[];
  /** 有素材记录但内容是空的（上传失败等） */
  empty: ProblemAsset[];
  /** 素材总字节数 */
  totalBytes: number;
};

/**
 * 打包剧本与素材。
 * @param story 当前剧本
 * @param assets 编辑器里的素材记录（id -> EditorAsset）
 */
export function packStoryAndAssets(story: Story, assets: Record<string, EditorAsset>): StoryPack {
  const packed = cloneStory(story);
  const files: AssetFile[] = [];
  const missing: ProblemAsset[] = [];
  const empty: ProblemAsset[] = [];
  /** 已经用过的文件名，用于去重 */
  const usedPaths = new Set<string>();
  let totalBytes = 0;

  for (const category of ASSET_CATEGORIES) {
    const list = (packed[category] ?? []) as Asset[];

    for (const entry of list) {
      const record = assets[entry.id];
      if (!record) {
        missing.push({ id: entry.id, name: entry.name || entry.id, label: CATEGORY_LABEL[category] });
        continue;
      }

      // 路径以编辑器记录为准，没有就兜底生成，保证运行时能拼出地址
      const basePath = record.path?.trim() || `assets/${entry.id}`;
      let finalPath = basePath;

      // 两个素材撞名时补上 id 后缀，避免互相覆盖
      if (usedPaths.has(finalPath)) {
        const dot = finalPath.lastIndexOf('.');
        const stem = dot > 0 ? finalPath.slice(0, dot) : finalPath;
        const ext = dot > 0 ? finalPath.slice(dot) : '';
        finalPath = `${stem}_${entry.id.slice(-6)}${ext}`;
      }
      usedPaths.add(finalPath);
      entry.path = finalPath;

      if (!record.dataUrl) {
        empty.push({ id: entry.id, name: entry.name || entry.id, label: CATEGORY_LABEL[category] });
        continue;
      }

      const bytes = dataUrlToBytes(record.dataUrl);
      totalBytes += bytes.byteLength;
      files.push({ path: finalPath, bytes, base64: dataUrlToBase64(record.dataUrl) });
    }
  }

  return { story: packed, files, missing, empty, totalBytes };
}
