/**
 * 左侧面板 · 音频 Tab（BGM / 音效 / 语音）
 */
import { useState } from 'react';
import type { AudioTab } from '../../store/uiStore';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import { useUploadAssets } from '../../hooks/useUploadAssets';
import { useAudioPreview } from '../../hooks/useAudioPreview';
import { toast } from '../../store/toastStore';
import { countAssetUsage } from '../../lib/mutations/assets';
import { CATEGORY_TEXT, formatBytes, formatDuration } from '../../lib/assetUtils';
import Tabs from '../ui/Tabs';
import { Icon } from '../ui/Icon';
import UploadButton from '../ui/UploadButton';
import EmptyState from '../ui/EmptyState';
import ConfirmDialog from '../ui/ConfirmDialog';
import AudioPreviewButton from '../ui/AudioPreviewButton';
import type { EditorAsset } from '@gal/shared';

const TAB_ITEMS: { key: AudioTab; label: string }[] = [
  { key: 'bgms', label: 'BGM' },
  { key: 'ses', label: '音效' },
  { key: 'voices', label: '语音' },
];

/** 各分类的引导文案 */
const HINT: Record<AudioTab, { empty: string; upload: string }> = {
  bgms: { empty: '还没有背景音乐', upload: '建议用 mp3/ogg，会自动循环播放' },
  ses: { empty: '还没有音效', upload: '如翻页声、脚步声、提示音' },
  voices: { empty: '还没有语音', upload: '对话框可以挂一句配音' },
};

export default function AudioTabPanel() {
  const audioTab = useUiStore((s) => s.audioTab);
  const setAudioTab = useUiStore((s) => s.setAudioTab);
  const projectData = useProjectStore((s) => s.data);
  const renameAsset = useProjectStore((s) => s.renameAsset);
  const removeAsset = useProjectStore((s) => s.removeAsset);
  const upload = useUploadAssets();
  const stopPreview = useAudioPreview((s) => s.stop);
  const [pendingDelete, setPendingDelete] = useState<EditorAsset | null>(null);

  const counts = {
    bgms: projectData.story.bgms.length,
    ses: projectData.story.ses.length,
    voices: projectData.story.voices.length,
  };

  const assets = projectData.story[audioTab]
    .map((a) => projectData.assets[a.id])
    .filter((a): a is EditorAsset => !!a);

  return (
    <div className="space-y-2">
      <Tabs
        items={TAB_ITEMS.map((t) => ({ ...t, count: counts[t.key] }))}
        value={audioTab}
        onChange={setAudioTab}
        fill
      />

      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-faint">{CATEGORY_TEXT[audioTab]}共 {assets.length} 个</span>
        <UploadButton accept="audio/*" multiple onFiles={(files) => void upload(audioTab, files)}>
          上传音频
        </UploadButton>
      </div>

      {assets.length ? (
        <div className="space-y-1.5">
          {assets.map((asset) => (
            <div key={asset.id} className="rounded-md border border-line bg-white p-2">
              <div className="flex items-center gap-1.5">
                <Icon name={audioTab === 'bgms' ? 'music' : audioTab === 'ses' ? 'bell' : 'mic'} className="h-4 w-4 shrink-0 text-ink-faint" />
                <input
                  className="input flex-1"
                  defaultValue={asset.name}
                  onBlur={(e) => {
                    const next = e.target.value.trim();
                    if (next && next !== asset.name) renameAsset(audioTab, asset.id, next);
                  }}
                />
                <button className="btn btn-sm" title="删除" onClick={() => setPendingDelete(asset)}>
                  <Icon name="trash" className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="text-[10px] text-ink-faint">
                  {formatDuration(asset.duration)} · {formatBytes(asset.size)}
                </span>
                <AudioPreviewButton asset={asset} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="music"
          title={HINT[audioTab].empty}
          hint={HINT[audioTab].upload}
          action={
            <UploadButton accept="audio/*" multiple onFiles={(files) => void upload(audioTab, files)}>
              上传音频
            </UploadButton>
          }
        />
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title={`删除「${pendingDelete?.name ?? ''}」？`}
        message={(() => {
          const usage = pendingDelete ? countAssetUsage(projectData, audioTab, pendingDelete.id) : 0;
          return usage > 0
            ? `剧本里有 ${usage} 处正在使用它，删除后这些引用会被清空。`
            : '这个音频还没有被使用，可以安全删除。';
        })()}
        confirmText="删除"
        danger
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            stopPreview();
            removeAsset(audioTab, pendingDelete.id);
          }
          setPendingDelete(null);
          toast('音频已删除', 'success');
        }}
      />
    </div>
  );
}
