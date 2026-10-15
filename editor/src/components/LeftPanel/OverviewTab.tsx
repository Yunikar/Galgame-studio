/**
 * 左侧面板 · 概览 Tab
 * 作品信息、起始场景、场景管理、存储占用与数据清理。
 */
import { useState } from 'react';
import {
  CATEGORY_LABELS,
  OPENING_DEFAULT_SECONDS,
  OPENING_MAX_SECONDS,
  OPENING_MIN_SECONDS,
  OPENING_SECONDS_STEP,
  type AssetCategory,
} from '@gal/shared';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import { toast } from '../../store/toastStore';
import { formatBytes, totalAssetSize } from '../../lib/assetUtils';
import { countAssetUsage } from '../../lib/mutations/assets';
import { Icon } from '../ui/Icon';
import AssetSelect from '../Inspector/fields/AssetSelect';
import NumberField from '../Inspector/fields/NumberField';
import ConfirmDialog from '../ui/ConfirmDialog';

/** 场景列表行 */
function SceneRow({ sceneId }: { sceneId: string }) {
  const scene = useProjectStore((s) => s.data.story.scenes.find((x) => x.id === sceneId));
  const isStart = useProjectStore((s) => s.data.story.startSceneId === sceneId);
  const renameScene = useProjectStore((s) => s.renameScene);
  const removeScene = useProjectStore((s) => s.removeScene);
  const setStartScene = useProjectStore((s) => s.setStartScene);
  const duplicateScene = useProjectStore((s) => s.duplicateScene);
  const selectScene = useUiStore((s) => s.selectScene);
  const [confirming, setConfirming] = useState(false);

  if (!scene) return null;

  return (
    <div className="flex items-center gap-1.5 rounded-md border border-line bg-white p-1.5">
      <Icon name="flow" className="h-4 w-4 shrink-0 text-ink-faint" />
      <input
        className="input flex-1"
        value={scene.name}
        onChange={(e) => renameScene(sceneId, e.target.value)}
        onFocus={() => selectScene(sceneId)}
      />
      <span className="shrink-0 text-[10px] text-ink-faint">{scene.nodes.length} 节点</span>
      {isStart ? (
        <span className="chip shrink-0 border-emerald-200 bg-emerald-50 text-emerald-600">起始</span>
      ) : (
        <button className="btn btn-sm shrink-0" title="设为起始场景" onClick={() => setStartScene(sceneId)}>
          <Icon name="play" className="h-3.5 w-3.5" />
        </button>
      )}
      <button className="btn btn-sm shrink-0" title="复制场景" onClick={() => duplicateScene(sceneId)}>
        <Icon name="copy" className="h-3.5 w-3.5" />
      </button>
      <button className="btn btn-sm shrink-0" title="删除场景" onClick={() => setConfirming(true)}>
        <Icon name="trash" className="h-3.5 w-3.5" />
      </button>

      <ConfirmDialog
        open={confirming}
        title={`删除场景「${scene.name}」？`}
        message={`场景里的 ${scene.nodes.length} 个节点会一起删除。指向它的跳转节点会被清空。`}
        confirmText="删除"
        danger
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          removeScene(sceneId);
          setConfirming(false);
          toast('场景已删除', 'success');
        }}
      />
    </div>
  );
}

export default function OverviewTab() {
  const story = useProjectStore((s) => s.data.story);
  const data = useProjectStore((s) => s.data);
  const setTitle = useProjectStore((s) => s.setTitle);
  const setMeta = useProjectStore((s) => s.setMeta);
  const removeAsset = useProjectStore((s) => s.removeAsset);
  const resetToEmpty = useProjectStore((s) => s.resetToEmpty);
  const loadExample = useProjectStore((s) => s.loadExample);
  const lastSavedAt = useProjectStore((s) => s.lastSavedAt);
  const setLeftTab = useUiStore((s) => s.setLeftTab);
  const [clearing, setClearing] = useState(false);
  const [pendingReset, setPendingReset] = useState<false | 'empty' | 'example'>(false);

  const size = totalAssetSize(data.assets);

  /** 找出没有被任何节点/角色引用的素材 */
  const unusedAssets: { category: AssetCategory; id: string }[] = [];
  for (const category of ['backgrounds', 'sprites', 'bgms', 'ses', 'voices'] as AssetCategory[]) {
    for (const asset of story[category]) {
      if (countAssetUsage(data, category, asset.id) === 0) {
        // 立绘额外判断角色是否还在用它
        const usedByCharacter = story.characters.some(
          (c) => c.sprites.base === asset.id || c.sprites.expressions.some((e) => e.assetId === asset.id),
        );
        if (!usedByCharacter) unusedAssets.push({ category, id: asset.id });
      }
    }
  }

  return (
    <div className="space-y-3">
      {/* 作品信息 */}
      <div>
        <label className="field-label">作品标题</label>
        <input
          className="input"
          value={story.meta.title}
          placeholder="会显示在游戏标题画面"
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      {/* 进场画面（可选） */}
      <div className="space-y-2.5 rounded-lg border border-line bg-slate-50 p-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-ink-soft">进场画面</span>
          <span className="text-[10px] text-ink-faint">可选</span>
        </div>

        <AssetSelect
          label="开场图"
          category="backgrounds"
          optional
          value={story.meta.openingImage ?? ''}
          onChange={(id) => setMeta({ openingImage: id || undefined })}
          onGoUpload={() => setLeftTab('backgrounds')}
        />

        <NumberField
          label="开场图显示时长"
          unit="秒"
          min={OPENING_MIN_SECONDS}
          max={OPENING_MAX_SECONDS}
          step={OPENING_SECONDS_STEP}
          value={story.meta.openingDuration ?? OPENING_DEFAULT_SECONDS}
          onChange={(v) => setMeta({ openingDuration: v })}
          hint="只在配了开场图时生效；显示完自动进入标题画面"
        />

        <AssetSelect
          label="标题画面背景"
          category="backgrounds"
          optional
          value={story.meta.titleBackground ?? ''}
          onChange={(id) => setMeta({ titleBackground: id || undefined })}
        />

        <p className="text-[11px] leading-relaxed text-ink-faint">
          开场图只在游戏启动时显示一次；从游戏里返回标题画面不会重播。
        </p>
      </div>

      {/* 场景管理 */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="field-label mb-0">场景列表</label>
          <span className="text-[10px] text-ink-faint">点场景名可跳转编辑</span>
        </div>
        <div className="space-y-1.5">
          {story.scenes.map((s) => (
            <SceneRow key={s.id} sceneId={s.id} />
          ))}
        </div>
      </div>

      {/* 存储信息 */}
      <div className="rounded-lg border border-line bg-slate-50 p-2.5 text-xs text-ink-soft">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-medium">素材占用</span>
          <span className="text-ink-faint">{formatBytes(size)}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {(['backgrounds', 'sprites', 'bgms', 'ses', 'voices'] as AssetCategory[]).map((c) => (
            <span key={c} className="chip">
              {CATEGORY_LABELS[c]} {story[c].length}
            </span>
          ))}
        </div>
        <div className="mt-1.5 text-[11px] text-ink-faint">
          {lastSavedAt
            ? `已自动保存 · ${new Date(lastSavedAt).toLocaleTimeString('zh-CN')}`
            : '尚未保存到本地'}
        </div>
        {unusedAssets.length ? (
          <button
            className="btn btn-sm mt-2 w-full"
            disabled={clearing}
            onClick={() => {
              setClearing(true);
              unusedAssets.forEach((u) => removeAsset(u.category, u.id));
              setClearing(false);
              toast(`已清理 ${unusedAssets.length} 个未使用素材`, 'success');
            }}
          >
            <Icon name="trash" className="h-3.5 w-3.5" />
            清理 {unusedAssets.length} 个未使用素材
          </button>
        ) : null}
      </div>

      {/* 危险操作 */}
      <div className="space-y-1.5 rounded-lg border border-red-100 bg-red-50/60 p-2.5">
        <div className="text-xs font-medium text-red-600">重置项目</div>
        <p className="text-[11px] leading-relaxed text-ink-faint">
          下面两个操作会替换当前项目内容（当前内容会先自动保存一份到浏览器本地，但建议先导出 .galproj 备份）。
        </p>
        <div className="flex gap-1.5">
          <button className="btn btn-sm flex-1" onClick={() => setPendingReset('example')}>
            载入示例项目
          </button>
          <button className="btn btn-sm btn-danger flex-1" onClick={() => setPendingReset('empty')}>
            新建空项目
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={pendingReset !== false}
        title={pendingReset === 'empty' ? '新建空项目？' : '载入示例项目？'}
        message={
          pendingReset === 'empty'
            ? '当前项目内容会被一个空项目替换（素材也会一并清空）。'
            : '当前项目内容会被内置示例剧本替换（素材也会一并清空）。'
        }
        confirmText="确定替换"
        danger={pendingReset === 'empty'}
        onCancel={() => setPendingReset(false)}
        onConfirm={async () => {
          if (pendingReset === 'empty') await resetToEmpty();
          else await loadExample();
          setPendingReset(false);
          toast('项目已重置', 'success');
        }}
      />
    </div>
  );
}
