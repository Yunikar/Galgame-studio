/**
 * 右侧属性面板：根据选中节点的类型渲染对应表单
 */
import {
  NODE_COLORS,
  NODE_ICONS,
  NODE_LABELS,
  type Issue,
  type StoryNode,
} from '@gal/shared';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import { toast } from '../../store/toastStore';
import { cloneNode } from '../../lib/cloneNode';
import { summarizeNode } from '../Graph/nodeSummary';
import { Icon } from '../ui/Icon';
import EmptyState from '../ui/EmptyState';
import DialogueForm from './forms/DialogueForm';
import ChoiceForm from './forms/ChoiceForm';
import { HideSpriteForm, SetBackgroundForm, ShowSpriteForm } from './forms/SpriteForms';
import { PlayBgmForm, PlaySeForm, StopBgmForm } from './forms/AudioForms';
import { EffectForm, EffectOffForm, EndingForm, JumpForm } from './forms/FlowForms';
import type { NodePatch } from '../../types/patch';

type Props = {
  sceneId: string;
  /** 当前节点的校验问题 */
  nodeIssues: Issue[];
};

/** 按类型分发到对应表单 */
function NodeForm({ node, sceneId, index }: { node: StoryNode; sceneId: string; index: number }) {
  const updateNode = useProjectStore((s) => s.updateNode);
  const requestFocus = useUiStore((s) => s.requestFocus);

  const onChange = (patch: NodePatch) => updateNode(sceneId, node.id, patch);
  const onFocusNode = (id: string) => requestFocus(sceneId, id);

  /** 各类型自己的字段 */
  const fields = (() => {
    switch (node.type) {
      case 'dialogue':
        return <DialogueForm node={node} sceneId={sceneId} onChange={onChange} onFocusNode={onFocusNode} />;
      case 'choice':
        return <ChoiceForm node={node} sceneId={sceneId} onChange={onChange} onFocusNode={onFocusNode} />;
      case 'showSprite':
        return <ShowSpriteForm node={node} sceneId={sceneId} onChange={onChange} onFocusNode={onFocusNode} />;
      case 'hideSprite':
        return <HideSpriteForm node={node} sceneId={sceneId} onChange={onChange} onFocusNode={onFocusNode} />;
      case 'setBackground':
        return <SetBackgroundForm node={node} sceneId={sceneId} onChange={onChange} onFocusNode={onFocusNode} />;
      case 'playBgm':
        return <PlayBgmForm node={node} sceneId={sceneId} onChange={onChange} onFocusNode={onFocusNode} />;
      case 'stopBgm':
        return <StopBgmForm node={node} sceneId={sceneId} onChange={onChange} onFocusNode={onFocusNode} />;
      case 'playSe':
        return <PlaySeForm node={node} sceneId={sceneId} onChange={onChange} onFocusNode={onFocusNode} />;
      case 'effect':
        return <EffectForm node={node} sceneId={sceneId} onChange={onChange} onFocusNode={onFocusNode} />;
      case 'effectOff':
        return <EffectOffForm node={node} sceneId={sceneId} onChange={onChange} onFocusNode={onFocusNode} />;
      case 'jump':
        return <JumpForm node={node} sceneId={sceneId} onChange={onChange} onFocusNode={onFocusNode} />;
      case 'ending':
        return <EndingForm node={node} sceneId={sceneId} onChange={onChange} onFocusNode={onFocusNode} />;
      default:
        return null;
    }
  })();

  return (
    <div className="space-y-3">
      {/* 节点名称：所有类型通用，留空就自动显示成序号 #1、#2…… */}
      <div>
        <label className="field-label">节点名称（可选）</label>
        <input
          className="input"
          value={node.name ?? ''}
          placeholder={`留空则显示为 #${index + 1}`}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        <p className="mt-1 text-[11px] text-ink-faint">
          起个名字方便你在画布和「跳向」下拉里认出它，比如「开场白」「真结局分支」
        </p>
      </div>

      {fields}
    </div>
  );
}

export default function InspectorPanel({ sceneId, nodeIssues }: Props) {
  const selectedNodeId = useUiStore((s) => s.selectedNodeId);
  const selectNode = useUiStore((s) => s.selectNode);
  const requestFocus = useUiStore((s) => s.requestFocus);
  const scene = useProjectStore((s) => s.data.story.scenes.find((s2) => s2.id === sceneId));
  const story = useProjectStore((s) => s.data.story);
  const insertNode = useProjectStore((s) => s.insertNode);
  const removeNode = useProjectStore((s) => s.removeNode);

  const node = scene?.nodes.find((n) => n.id === selectedNodeId);
  /** 选中节点在场景里的序号（0 开始），用于自动命名 */
  const nodeIndex = scene && node ? scene.nodes.findIndex((n) => n.id === node.id) : -1;

  if (!node) {
    return (
      <div className="panel w-[320px] shrink-0">
        <div className="panel-header">属性</div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-2.5">
          <EmptyState
            icon="settings"
            title="没有选中节点"
            hint="在画布上点一下节点，这里就会显示它的详细设置"
          />
          {scene?.nodes.length ? (
            <div>
              <div className="mb-1 text-[11px] font-medium text-ink-faint">快速跳到节点</div>
              <div className="space-y-1">
                {scene.nodes.map((n, i) => {
                  const summary = summarizeNode(n, story, i);
                  return (
                    <button
                      key={n.id}
                      className="flex w-full items-center gap-1.5 rounded-md border border-line bg-white px-2 py-1 text-left text-[12px] transition hover:border-brand-500"
                      onClick={() => {
                        selectNode(sceneId, n.id);
                        requestFocus(sceneId, n.id);
                      }}
                    >
                      <span className="text-[12px]">{NODE_ICONS[n.type]}</span>
                      <span className="shrink-0 text-[11px] text-ink-faint">{summary.displayName}</span>
                      <span className="truncate text-ink-soft">{summary.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const summary = summarizeNode(node, story, nodeIndex);
  const color = NODE_COLORS[node.type];

  return (
    <div className="panel w-[320px] shrink-0">
      {/* 头部：节点身份 + 操作 */}
      <div className="panel-header">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="text-[13px]">{NODE_ICONS[node.type]}</span>
          <span className="shrink-0" style={{ color }}>
            {NODE_LABELS[node.type]}
          </span>
          {summary.displayName ? (
            <span className="truncate text-[12px] font-semibold text-ink" title={summary.displayName}>
              · {summary.displayName}
            </span>
          ) : null}
        </span>
        <span className="flex items-center gap-1">
          <button
            className="btn btn-sm"
            title="复制这个节点"
            onClick={() => {
              const copy = cloneNode(node);
              insertNode(sceneId, copy, node.id);
              selectNode(sceneId, copy.id);
              toast('节点已复制', 'success');
            }}
          >
            <Icon name="copy" className="h-3.5 w-3.5" />
          </button>
          <button
            className="btn btn-sm"
            title="删除这个节点"
            onClick={() => {
              removeNode(sceneId, node.id);
              selectNode(sceneId, null);
              toast('节点已删除（Ctrl+Z 可撤销）', 'success');
            }}
          >
            <Icon name="trash" className="h-3.5 w-3.5" />
          </button>
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
        {/* 该节点的问题提示 */}
        {nodeIssues.length ? (
          <div className="mb-3 space-y-1 rounded-md border border-amber-200 bg-amber-50 p-2">
            {nodeIssues.map((issue, index) => (
              <div key={index} className="flex items-start gap-1.5 text-[11px] leading-relaxed text-amber-800">
                <Icon
                  name={issue.level === 'error' ? 'alert' : 'info'}
                  className={`mt-0.5 h-3 w-3 shrink-0 ${issue.level === 'error' ? 'text-red-500' : 'text-amber-500'}`}
                />
                <span>{issue.message}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mb-3 flex items-center gap-1.5 rounded-md bg-emerald-50 p-2 text-[11px] text-emerald-700">
            <Icon name="check" className="h-3 w-3" />
            这个节点配置完整
          </div>
        )}

        <NodeForm node={node} sceneId={sceneId} index={nodeIndex} />

        {/* 底部：节点 id（调试用） */}
        <div className="mt-4 border-t border-line pt-2 text-[10px] text-ink-faint">
          <div>节点名称：{summary.displayName || '（无）'}</div>
          <div>节点标题：{summary.title || '（空）'}</div>
          <div className="truncate" title={node.id}>
            id: {node.id}
          </div>
        </div>
      </div>
    </div>
  );
}
