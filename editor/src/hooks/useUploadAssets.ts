/**
 * 上传素材的公共逻辑：选文件 -> 校验类型 -> 生成 EditorAsset -> 写入项目
 */
import { useCallback } from 'react';
import { type AssetCategory, type EditorAsset } from '@gal/shared';
import { useProjectStore } from '../store/projectStore';
import { toast } from '../store/toastStore';
import { CATEGORY_KIND, CATEGORY_TEXT, fileToEditorAsset, kindOfMime, formatBytes } from '../lib/assetUtils';

/** 单文件体积上限（防止 localforage/内存爆掉） */
export const MAX_ASSET_BYTES = 40 * 1024 * 1024;

export type UploadResult = { created: EditorAsset[]; skipped: string[] };

/** 返回一个上传函数：给分类和文件，返回成功创建的素材 */
export function useUploadAssets() {
  const addAsset = useProjectStore((s) => s.addAsset);

  return useCallback(
    async (category: AssetCategory, files: FileList | File[]): Promise<UploadResult> => {
      const list = Array.from(files);
      const created: EditorAsset[] = [];
      const skipped: string[] = [];
      const expected = CATEGORY_KIND[category];

      for (const file of list) {
        const kind = kindOfMime(file.type, file.name);

        if (kind !== 'unknown' && kind !== expected) {
          skipped.push(file.name);
          toast(
            `「${file.name}」类型不对`,
            'warning',
            `${CATEGORY_TEXT[category]}需要${expected === 'image' ? '图片' : '音频'}文件`,
          );
          continue;
        }
        if (file.size > MAX_ASSET_BYTES) {
          skipped.push(file.name);
          toast(
            `「${file.name}」太大了（${formatBytes(file.size)}）`,
            'warning',
            `单个文件请控制在 ${formatBytes(MAX_ASSET_BYTES)} 以内`,
          );
          continue;
        }

        try {
          const asset = await fileToEditorAsset(file, category);
          addAsset(asset);
          created.push(asset);
        } catch (error) {
          skipped.push(file.name);
          toast(`「${file.name}」读取失败`, 'error', String(error));
        }
      }

      if (created.length) {
        toast(`已添加 ${created.length} 个${CATEGORY_TEXT[category]}`, 'success');
      }
      return { created, skipped };
    },
    [addAsset],
  );
}
