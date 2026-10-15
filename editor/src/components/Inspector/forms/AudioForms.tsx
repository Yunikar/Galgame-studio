/**
 * 音频相关节点表单（BGM / 停止BGM / 音效）
 */
import type { PlayBgmNode, PlaySeNode, StopBgmNode } from '@gal/shared';
import { useUiStore } from '../../../store/uiStore';
import AssetSelect from '../fields/AssetSelect';
import NumberField from '../fields/NumberField';
import NextNodeField from '../fields/NextNodeField';
import type { NodeFormProps } from '../types';

/** 播放 BGM */
export function PlayBgmForm({ node, sceneId, onChange, onFocusNode }: NodeFormProps<PlayBgmNode>) {
  const setLeftTab = useUiStore((s) => s.setLeftTab);
  const setAudioTab = useUiStore((s) => s.setAudioTab);

  return (
    <div className="space-y-3">
      <AssetSelect
        label="背景音乐"
        category="bgms"
        value={node.assetId}
        onChange={(id) => onChange({ assetId: id })}
        onGoUpload={() => {
          setLeftTab('audio');
          setAudioTab('bgms');
        }}
      />

      <label className="flex items-center gap-2 text-[12px] text-ink-soft">
        <input
          type="checkbox"
          className="h-3.5 w-3.5 accent-brand-600"
          checked={node.loop}
          onChange={(e) => onChange({ loop: e.target.checked })}
        />
        循环播放
      </label>

      <NumberField
        label="淡入时长"
        unit="秒"
        value={node.fadeIn ?? 0}
        min={0}
        max={10}
        step={0.5}
        onChange={(v) => onChange({ fadeIn: v ?? 0 })}
      />

      <NextNodeField
        sceneId={sceneId}
        value={node.next}
        onChange={(next) => onChange({ next })}
        onFocusNode={onFocusNode}
      />
    </div>
  );
}

/** 停止 BGM */
export function StopBgmForm({ node, sceneId, onChange, onFocusNode }: NodeFormProps<StopBgmNode>) {
  return (
    <div className="space-y-3">
      <p className="rounded-md bg-slate-50 p-2 text-[11px] leading-relaxed text-ink-faint">
        这个节点会停掉当前正在播放的背景音乐。
      </p>
      <NumberField
        label="淡出时长"
        unit="秒"
        value={node.fadeOut ?? 0}
        min={0}
        max={10}
        step={0.5}
        onChange={(v) => onChange({ fadeOut: v ?? 0 })}
      />
      <NextNodeField
        sceneId={sceneId}
        value={node.next}
        onChange={(next) => onChange({ next })}
        onFocusNode={onFocusNode}
      />
    </div>
  );
}

/** 播放音效 */
export function PlaySeForm({ node, sceneId, onChange, onFocusNode }: NodeFormProps<PlaySeNode>) {
  const setLeftTab = useUiStore((s) => s.setLeftTab);
  const setAudioTab = useUiStore((s) => s.setAudioTab);

  return (
    <div className="space-y-3">
      <AssetSelect
        label="音效"
        category="ses"
        value={node.assetId}
        onChange={(id) => onChange({ assetId: id })}
        onGoUpload={() => {
          setLeftTab('audio');
          setAudioTab('ses');
        }}
      />
      <NextNodeField
        sceneId={sceneId}
        value={node.next}
        onChange={(next) => onChange({ next })}
        onFocusNode={onFocusNode}
      />
    </div>
  );
}
