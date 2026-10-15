/**
 * 选项节点属性表单
 *
 * 一个选项可以是：
 * - 单出口（老形态）：一个「跳向」下拉
 * - 概率分支：多条分支，各带权重，进游戏时按权重随机抽一条
 */
import { branchPercents, formatPercent, type ChoiceNode } from '@gal/shared';
import { useProjectStore } from '../../../store/projectStore';
import { nodeOptionLabel } from '../../Graph/nodeSummary';
import { Icon } from '../../ui/Icon';
import type { NodeFormProps } from '../types';

export default function ChoiceForm({ node, sceneId, onChange, onFocusNode }: NodeFormProps<ChoiceNode>) {
  const scene = useProjectStore((s) => s.data.story.scenes.find((x) => x.id === sceneId));
  const story = useProjectStore((s) => s.data.story);
  const addOption = useProjectStore((s) => s.addOption);
  const updateOption = useProjectStore((s) => s.updateOption);
  const removeOption = useProjectStore((s) => s.removeOption);
  const moveOption = useProjectStore((s) => s.moveOption);
  const addBranch = useProjectStore((s) => s.addBranch);
  const updateBranch = useProjectStore((s) => s.updateBranch);
  const removeBranch = useProjectStore((s) => s.removeBranch);
  const evenBranches = useProjectStore((s) => s.evenBranches);

  const candidates = (scene?.nodes ?? []).filter((n) => n.id !== node.id);

  /** 某个节点在场景里的序号（下拉里显示自动序号用） */
  const indexOfNode = (id: string) => scene?.nodes.findIndex((x) => x.id === id) ?? -1;

  /** 「跳向」下拉：分支和单出口共用 */
  const targetSelect = (value: string, onPick: (next: string) => void) => (
    <select
      className={`input flex-1 ${!value ? 'border-amber-400' : ''}`}
      value={value}
      onChange={(e) => onPick(e.target.value)}
    >
      <option value="">（未连线）</option>
      {candidates.map((n) => (
        <option key={n.id} value={n.id}>
          {nodeOptionLabel(n, story, indexOfNode(n.id))}
        </option>
      ))}
    </select>
  );

  /** 定位按钮 */
  const focusButton = (targetId: string) =>
    targetId && onFocusNode ? (
      <button className="btn btn-sm shrink-0" title="定位" onClick={() => onFocusNode(targetId)}>
        <Icon name="eye" className="h-3.5 w-3.5" />
      </button>
    ) : null;

  return (
    <div className="space-y-3">
      <div>
        <label className="field-label">提示语（可留空）</label>
        <input
          className="input"
          value={node.prompt ?? ''}
          placeholder="例如：要怎么回应她？"
          onChange={(e) => onChange({ prompt: e.target.value })}
        />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="field-label mb-0">选项（{node.options.length}）</label>
          <button className="btn btn-sm" onClick={() => addOption(sceneId, node.id)}>
            <Icon name="plus" className="h-3.5 w-3.5" />
            加一项
          </button>
        </div>

        <div className="space-y-2">
          {node.options.map((opt, index) => {
            const branches = opt.branches ?? [];
            const percents = branchPercents(branches);
            const showPercent = branches.length > 1;
            const unlinked = !branches.length && !opt.next;

            return (
              <div key={opt.id} className="rounded-md border border-line bg-slate-50 p-2">
                {/* 选项文字 */}
                <div className="flex items-center gap-1">
                  <span className="w-4 shrink-0 text-center text-[11px] text-ink-faint">{index + 1}</span>
                  <input
                    className="input flex-1"
                    value={opt.text}
                    placeholder="选项文字，玩家会看到"
                    onChange={(e) => updateOption(sceneId, node.id, opt.id, { text: e.target.value })}
                  />
                  <button
                    className="btn btn-sm"
                    title="上移"
                    disabled={index === 0}
                    onClick={() => moveOption(sceneId, node.id, opt.id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    className="btn btn-sm"
                    title="下移"
                    disabled={index === node.options.length - 1}
                    onClick={() => moveOption(sceneId, node.id, opt.id, 1)}
                  >
                    ↓
                  </button>
                  <button
                    className="btn btn-sm"
                    title="删除这个选项"
                    onClick={() => removeOption(sceneId, node.id, opt.id)}
                  >
                    <Icon name="trash" className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* 出口：单出口 or 概率分支列表 */}
                <div className="mt-1.5 space-y-1">
                  {branches.length ? (
                    <>
                      <div className="flex items-center justify-between text-[11px] text-ink-faint">
                        <span>概率分支（{branches.length}）</span>
                        <span>权重是相对比例，0 表示这一支不会被抽到</span>
                      </div>

                      {branches.map((branch, bi) => (
                        <div key={branch.id} className="flex items-center gap-1">
                          <span className="w-3 shrink-0 text-center text-[10px] text-ink-faint">
                            {bi + 1}
                          </span>
                          <input
                            className="input w-16 shrink-0 text-right"
                            type="number"
                            min={0}
                            step={1}
                            value={branch.weight}
                            title="权重：相对比例，比如 3 和 1 就是 75% / 25%"
                            onChange={(e) =>
                              updateBranch(sceneId, node.id, opt.id, branch.id, {
                                weight: Number(e.target.value),
                              })
                            }
                          />
                          <span className="w-12 shrink-0 text-[10px] text-ink-faint">
                            {showPercent ? `= ${formatPercent(percents[bi] ?? 0)}` : '唯一分支'}
                          </span>
                          {targetSelect(branch.next, (next) =>
                            updateBranch(sceneId, node.id, opt.id, branch.id, { next }),
                          )}
                          {focusButton(branch.next)}
                          <button
                            className="btn btn-sm shrink-0"
                            title="删除这条分支"
                            onClick={() => removeBranch(sceneId, node.id, opt.id, branch.id)}
                          >
                            <Icon name="trash" className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="shrink-0 text-[11px] text-ink-faint">跳向</span>
                      {targetSelect(opt.next, (next) =>
                        updateOption(sceneId, node.id, opt.id, { next }),
                      )}
                      {focusButton(opt.next)}
                    </div>
                  )}

                  {/* 加分支 / 均分 */}
                  <div className="flex items-center gap-1">
                    <button
                      className="btn btn-sm"
                      title="让这个选项随机走向多个后续节点"
                      onClick={() => addBranch(sceneId, node.id, opt.id)}
                    >
                      <Icon name="plus" className="h-3.5 w-3.5" />
                      加分支
                    </button>
                    {showPercent ? (
                      <button
                        className="btn btn-sm"
                        title="把这几条分支的权重设成一样（等概率）"
                        onClick={() => evenBranches(sceneId, node.id, opt.id)}
                      >
                        均分权重
                      </button>
                    ) : null}
                    {unlinked ? (
                      <span className="flex items-center gap-1 text-[11px] text-amber-600">
                        <Icon name="alert" className="h-3 w-3" />
                        还没有出口
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {node.options.some((o) => (o.branches?.length ?? 0) === 0 && !o.next) ? (
          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-amber-600">
            <Icon name="alert" className="h-3 w-3" />
            还有选项没有指定后续节点
          </p>
        ) : null}
      </div>

      <p className="rounded-md bg-slate-50 p-2 text-[11px] leading-relaxed text-ink-faint">
        提示：每个选项在画布上都有一个连接点，拖线即可连线；已经有出口时再拖一条线就是<b>追加一个分支</b>。
        每条分支也有自己的连接点，从那里拖线是改这条分支的目标。
      </p>
    </div>
  );
}
