/**
 * 替换已有素材的文件（保持素材 id 不变，剧本里的引用不会失效）
 */
import { useCallback } from 'react';
import type { AssetCategory } from '@gal/shared';
import { useProjectStore } from '../store/projectStore';
import { toast } from '../store/toastStore';
import {
  CATEGORY_KIND,
  CATEGORY_TEXT,
  fileToEditorAsset,
  formatBytes,
  kindOfMime,
} from '../lib/assetUtils';
import { MAX_ASSET_BYTES } from './useUploadAssets';

export function useReplaceAsset() {
  const replaceAsset = useProjectStore((s) => s.replaceAsset);

  return useCallback(
    async (category: AssetCategory, assetId: string, files: FileList | File[]): Promise<boolean> => {
      const file = Array.from(files)[0];
      if (!file) return false;

      const kind = kindOfMime(file.type, file.name);
      const expected = CATEGORY_KIND[category];
      if (kind !== 'unknown' && kind !== expected) {
        toast(
          `「${file.name}」类型不对`,
          'warning',
          `${CATEGORY_TEXT[category]}需要${expected === 'image' ? '图片' : '音频'}文件`,
        );
        return false;
      }
      if (file.size > MAX_ASSET_BYTES) {
        toast(`文件太大（${formatBytes(file.size)}）`, 'warning', `请控制在 ${formatBytes(MAX_ASSET_BYTES)} 内`);
        return false;
      }

      const asset = await fileToEditorAsset(file, category);
      replaceAsset(assetId, asset);
      toast('素材已替换', 'success');
      return true;
    },
    [replaceAsset],
  );
}
