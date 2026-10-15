/**
 * 特效 / 特效关闭 / 跳转 / 结局 节点表单
 */
import {
  EFFECT_LABELS,
  EFFECT_TARGET_LABELS,
  type EffectNode,
  type EffectOffNode,
  type EndingNode,
  type JumpNode,
  isOneShotEffect,
} from '@gal/shared';
import { useProjectStore } from '../../../store/projectStore';
import { useUiStore } from '../../../store/uiStore';
import SelectField from '../fields/SelectField';
import CharacterSelect from '../fields/CharacterSelect';
import NextNodeField from '../fields/NextNodeField';
import type { NodeFormProps } from '../types';

/** 特效 */
export function EffectForm({ node, sceneId, onChange, onFocusNode }: NodeFormProps<EffectNode>) {
  const setLeftTab = useUiStore((s) => s.setLeftTab);
  const effectOptions = (['shake', 'flash', 'fadeOutIn', 'blackAndWhite', 'blur'] as const).map((e) => ({
    value: e,
    label: EFFECT_LABELS[e],
  }));
  const targetOptions = (['screen', 'dialogue', 'sprite'] as const).map((t) => ({
    value: t,
    label: EFFECT_TARGET_LABELS[t],
  }));
  const oneShot = isOneShotEffect(node.effect);
  const legacy = typeof node.duration === 'number' && node.duration > 0;

  return (
    <div className="space-y-3">
      <SelectField
        label="特效类型"
        value={node.effect}
        options={effectOptions}
        onChange={(v) =>
          // 换类型时清掉旧版限时设置，统一走"开启后持续生效"的新模型
          onChange({ effect: v as EffectNode['effect'], duration: undefined })
        }
      />

      {oneShot ? (
        <p className="rounded-md bg-slate-50 p-2 text-[11px] leading-relaxed text-ink-faint">
          这个特效会自动播放一次，不需要用「特效关闭」节点去关它。
        </p>
      ) : (
        <>
          <SelectField
            label="作用在什么上面"
            value={node.target ?? 'screen'}
            options={targetOptions}
            onChange={(v) =>
              onChange({
                target: v as EffectNode['target'],
                duration: undefined,
                // 作用对象不再是立绘时，清掉之前选的角色
                targetCharacterId: v === 'sprite' ? node.targetCharacterId : undefined,
              })
            }
            hint="开启后会一直生效，直到「特效关闭」节点把它关掉"
          />
          {node.target === 'sprite' ? (
            <CharacterSelect
              label="作用在哪个角色"
              value={node.targetCharacterId ?? ''}
              onChange={(id) => onChange({ targetCharacterId: id || undefined })}
              onGoUpload={() => setLeftTab('characters')}
            />
          ) : null}
        </>
      )}

      {legacy ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] leading-relaxed text-amber-700">
          这是旧版的「限时特效」：播放 {node.duration} 秒后自动结束。
          重新选择特效类型或作用对象后会改成新版行为（持续生效直到关闭）。
        </p>
      ) : null}

      <NextNodeField
        sceneId={sceneId}
        value={node.next}
        onChange={(next) => onChange({ next })}
        onFocusNode={onFocusNode}
      />
    </div>
  );
}

/** 特效关闭 */
export function EffectOffForm({ node, sceneId, onChange, onFocusNode }: NodeFormProps<EffectOffNode>) {
  const effectOptions = [
    { value: '', label: '全部特效' },
    ...(['shake', 'flash', 'fadeOutIn', 'blackAndWhite', 'blur'] as const).map((e) => ({
      value: e,
      label: EFFECT_LABELS[e],
    })),
  ];

  return (
    <div className="space-y-3">
      <SelectField
        label="关闭哪个特效"
        value={node.effect ?? ''}
        options={effectOptions}
        onChange={(v) => onChange({ effect: (v || undefined) as EffectOffNode['effect'] })}
        hint="选「全部特效」会把画面上所有持续特效一次性关掉；闪白、淡出淡入本来就播一次就完，不用关"
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

/** 跳转场景 */
export function JumpForm({ node, onChange }: NodeFormProps<JumpNode>) {
  const scenes = useProjectStore((s) => s.data.story.scenes);
  const selectScene = useUiStore((s) => s.selectScene);

  return (
    <div className="space-y-3">
      <SelectField
        label="目标场景"
        value={node.targetSceneId}
        options={scenes.map((s) => ({
          value: s.id,
          label: `${s.name}（${s.nodes.length} 个节点）`,
        }))}
        onChange={(v) => onChange({ targetSceneId: v })}
        hint="游戏会从这个场景的第一个节点继续播放"
      />
      {node.targetSceneId ? (
        <button className="btn btn-sm w-full" onClick={() => selectScene(node.targetSceneId)}>
          打开这个场景
        </button>
      ) : (
        <p className="text-[11px] text-amber-600">必须选一个目标场景，否则剧情会断掉</p>
      )}
    </div>
  );
}

/** 结局 */
export function EndingForm({ node, onChange }: NodeFormProps<EndingNode>) {
  const endings = useProjectStore((s) => s.data.story.endings);
  const setLeftTab = useUiStore((s) => s.setLeftTab);
  const ending = endings.find((e) => e.id === node.endingId);

  return (
    <div className="space-y-3">
      <SelectField
        label="触发哪个结局"
        value={node.endingId}
        options={endings.map((e) => ({ value: e.id, label: e.name }))}
        onChange={(v) => onChange({ endingId: v })}
      />

      {ending ? (
        <div className="rounded-md border border-line bg-slate-50 p-2 text-[11px] text-ink-soft">
          <div className="font-medium text-ink">{ending.name}</div>
          <div className="mt-0.5 text-ink-faint">
            {ending.description?.trim() || '（这个结局还没有写描述）'}
          </div>
        </div>
      ) : (
        <p className="flex items-start gap-1 text-[11px] text-amber-600">
          还没有可选的结局，先去左侧「结局」里定义一个。
          <button className="text-brand-600 hover:underline" onClick={() => setLeftTab('endings')}>
            去定义
          </button>
        </p>
      )}

      <p className="rounded-md bg-slate-50 p-2 text-[11px] leading-relaxed text-ink-faint">
        结局节点是剧情的终点：游戏会播放结局画面并回到标题。它没有后续节点。
      </p>
    </div>
  );
}
