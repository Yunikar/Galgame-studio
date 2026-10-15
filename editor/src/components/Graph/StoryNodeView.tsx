/**
 * 自定义节点外观
 * 一个组件覆盖全部 11 种节点类型，用颜色 + 图标 + 内容区分。
 */
import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import {
  NODE_COLORS,
  NODE_ICONS,
  branchPercents,
  formatPercent,
  hasOptionExit,
  type Story,
  type StoryNode,
} from '@gal/shared';
import { summarizeNode } from './nodeSummary';
import { Icon } from '../ui/Icon';

/** 节点携带的数据 */
export type StoryFlowNodeData = {
  node: StoryNode;
  story: Story;
  /** 节点在场景里的序号（从 0 开始），用于没起名时的自动序号 #1、#2…… */
  index: number;
  /** 该节点关联的校验问题数量 */
  issueCount: number;
};

/** 每个选项右侧一个连接点，所以选项节点高度自适应 */
function StoryNodeViewInner({ data, selected }: NodeProps<StoryFlowNodeData>) {
  const { node, story, index, issueCount } = data;
  const summary = summarizeNode(node, story, index);
  const color = NODE_COLORS[node.type];
  /** 作者自己起的名字（和自动序号区分开，显示时会加粗） */
  const customName = node.name?.trim();

  return (
    <div
      className={`w-[228px] rounded-lg border bg-white shadow-card transition ${
        selected ? 'border-brand-500 ring-2 ring-brand-100' : 'border-line hover:border-slate-300'
      }`}
      style={{ borderLeft: `4px solid ${color}` }}
    >
      {/* 入口连接点 */}
      <Handle type="target" position={Position.Left} style={{ top: 18 }} />

      {/* 头部：类型 + 节点名（名字优先，没起名显示序号） */}
      <div className="flex items-center justify-between gap-2 border-b border-line px-2.5 py-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="text-[13px] leading-none">{NODE_ICONS[node.type]}</span>
          <span className="shrink-0 text-[11px] font-medium" style={{ color }}>
            {summary.label}
          </span>
          {summary.displayName ? (
            <span
              className={`truncate text-[11px] ${
                customName ? 'font-semibold text-ink' : 'text-ink-faint'
              }`}
              title={customName ? `节点名：${summary.displayName}` : '还没起名字，显示的是场景内序号'}
            >
              · {summary.displayName}
            </span>
          ) : null}
        </div>
        {issueCount > 0 ? (
          <span
            className="flex shrink-0 items-center gap-0.5 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] text-red-600"
            title={`有 ${issueCount} 个校验问题`}
          >
            <Icon name="alert" className="h-3 w-3" />
            {issueCount}
          </span>
        ) : null}
      </div>

      {/* 主体 */}
      <div className="space-y-1 px-2.5 py-2">
        <div className="truncate text-[12.5px] font-semibold text-ink" title={summary.title}>
          {summary.title}
        </div>
        {summary.detail ? (
          <div className="line-clamp-2 text-[11.5px] leading-relaxed text-ink-soft" title={summary.detail}>
            {summary.detail}
          </div>
        ) : null}

        {node.type === 'choice' ? (
          <div className="mt-1 space-y-1">
            {node.options.map((opt) => {
              const branches = opt.branches ?? [];
              const percents = branchPercents(branches);
              const showPercent = branches.length > 1;
              return (
                <div key={opt.id} className="rounded border border-line bg-slate-50 px-1.5 py-1">
                  {/* 选项本体 */}
                  <div className="relative flex items-center justify-between">
                    <span className="max-w-[140px] truncate text-[11px]" title={opt.text}>
                      {opt.text || '（空选项）'}
                    </span>
                    {!hasOptionExit(opt) ? (
                      <span className="flex items-center gap-0.5 text-[10px] text-red-500">
                        <Icon name="alert" className="h-3 w-3" />
                        未连线
                      </span>
                    ) : showPercent ? (
                      <span className="text-[10px] text-ink-faint">{branches.length} 个分支</span>
                    ) : (
                      <Icon name="chevron" className="h-3 w-3 text-ink-faint" />
                    )}
                    {/* 选项主体连接点：已经有出口时，从这里拖线 = 再加一条分支 */}
                    <Handle
                      type="source"
                      position={Position.Right}
                      id={`opt:${opt.id}`}
                      style={{ right: -6, top: '50%' }}
                    />
                  </div>

                  {/* 概率分支：每条一个独立连接点，从它拖线 = 改这一条的目标 */}
                  {branches.length ? (
                    <div className="mt-1 space-y-0.5 border-t border-dashed border-line pt-1">
                      {branches.map((branch, bi) => (
                        <div
                          key={branch.id}
                          className="relative flex items-center justify-between text-[10px]"
                        >
                          <span className="flex items-center gap-1 text-ink-faint">
                            <span className="text-[9px]">└</span>
                            {branch.next ? (
                              showPercent ? (
                                formatPercent(percents[bi] ?? 0)
                              ) : (
                                '分支'
                              )
                            ) : (
                              <span className="text-red-500">未连线</span>
                            )}
                          </span>
                          <Handle
                            type="source"
                            position={Position.Right}
                            id={`opt:${opt.id}:${branch.id}`}
                            style={{ right: -6, top: '50%' }}
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* 出口连接点：非终止型节点才有 */}
      {node.type !== 'choice' && node.type !== 'jump' && node.type !== 'ending' ? (
        <Handle type="source" position={Position.Right} id="out" style={{ top: 18 }} />
      ) : null}
    </div>
  );
}

export const StoryNodeView = memo(StoryNodeViewInner);
