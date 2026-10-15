/**
 * 左侧面板 · 背景 Tab
 */
import { useState } from 'react';
import type { EditorAsset } from '@gal/shared';
import { useProjectStore } from '../../store/projectStore';
import { useUploadAssets } from '../../hooks/useUploadAssets';
import { useReplaceAsset } from '../../hooks/useReplaceAsset';
import { toast } from '../../store/toastStore';
import { countAssetUsage } from '../../lib/mutations/assets';
import { formatBytes } from '../../lib/assetUtils';
import { Icon } from '../ui/Icon';
import UploadButton from '../ui/UploadButton';
import EmptyState from '../ui/EmptyState';
import ConfirmDialog from '../ui/ConfirmDialog';

export default function BackgroundsTab() {
  const projectData = useProjectStore((s) => s.data);
  const backgroundIds = useProjectStore((s) => s.data.story.backgrounds.map((a) => a.id));
  const renameAsset = useProjectStore((s) => s.renameAsset);
  const removeAsset = useProjectStore((s) => s.removeAsset);
  const upload = useUploadAssets();
  const replaceWith = useReplaceAsset();
  const [pendingDelete, setPendingDelete] = useState<EditorAsset | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);

  const backgrounds = backgroundIds
    .map((id) => projectData.assets[id])
    .filter((a): a is EditorAsset => !!a);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-faint">共 {backgrounds.length} 张背景</span>
        <UploadButton accept="image/*" multiple onFiles={(files) => void upload('backgrounds', files)}>
          上传图片
        </UploadButton>
      </div>

      {backgrounds.length ? (
        <div className="grid grid-cols-2 gap-2">
          {backgrounds.map((asset) => (
            <div key={asset.id} className="overflow-hidden rounded-lg border border-line bg-white">
              <img
                src={asset.dataUrl}
                alt={asset.name}
                className="h-[68px] w-full cursor-zoom-in bg-slate-100 object-cover"
                onClick={() => window.open(asset.dataUrl, '_blank')}
                title="点击查看大图"
              />
              <div className="space-y-1 p-1.5">
                {renamingId === asset.id ? (
                  <input
                    autoFocus
                    className="input"
                    defaultValue={asset.name}
                    onBlur={(e) => {
                      renameAsset('backgrounds', asset.id, e.target.value || asset.name);
                      setRenamingId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    }}
                  />
                ) : (
                  <div
                    className="truncate text-[12px] text-ink-soft"
                    title={`${asset.name} · ${formatBytes(asset.size)}`}
                    onDoubleClick={() => setRenamingId(asset.id)}
                  >
                    {asset.name}
                  </div>
                )}
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] text-ink-faint">{formatBytes(asset.size)}</span>
                  <div className="flex gap-1">
                    <UploadButton
                      accept="image/*"
                      className="btn btn-sm"
                      title="替换这张图"
                      onFiles={(files) => void replaceWith('backgrounds', asset.id, files)}
                    >
                      <Icon name="refresh" className="h-3.5 w-3.5" />
                    </UploadButton>
                    <button
                      className="btn btn-sm"
                      title="删除"
                      onClick={() => setPendingDelete(asset)}
                    >
                      <Icon name="trash" className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="image"
          title="还没有背景图"
          hint="建议尺寸 1920×1080，上传后可以拖拽文件到按钮上"
          action={<UploadButton accept="image/*" multiple onFiles={(files) => void upload('backgrounds', files)}>上传图片</UploadButton>}
        />
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title={`删除背景「${pendingDelete?.name ?? ''}」？`}
        message={(() => {
          const usage = pendingDelete ? countAssetUsage(projectData, 'backgrounds', pendingDelete.id) : 0;
          return usage > 0
            ? `有 ${usage} 个「切换背景」节点正在使用它，删除后这些节点会变成未设置状态。`
            : '这张图还没有被使用，可以安全删除。';
        })()}
        confirmText="删除"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) removeAsset('backgrounds', pendingDelete.id);
          setPendingDelete(null);
          toast('背景已删除', 'success');
        }}
      />
    </div>
  );
}
