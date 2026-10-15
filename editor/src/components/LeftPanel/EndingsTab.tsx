/**
 * 左侧面板 · 结局 Tab
 */
import { useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { toast } from '../../store/toastStore';
import { countEndingUsage } from '../../lib/mutations/endings';
import { Icon } from '../ui/Icon';
import EmptyState from '../ui/EmptyState';
import ConfirmDialog from '../ui/ConfirmDialog';

/** 单个结局行 */
function EndingRow({ endingId }: { endingId: string }) {
  const ending = useProjectStore((s) => s.data.story.endings.find((e) => e.id === endingId));
  const usage = useProjectStore((s) =>
    countEndingUsage(s.data, endingId),
  );
  const updateEnding = useProjectStore((s) => s.updateEnding);
  const removeEnding = useProjectStore((s) => s.removeEnding);
  const [confirming, setConfirming] = useState(false);

  if (!ending) return null;

  return (
    <div className="space-y-1.5 rounded-md border border-line bg-white p-2">
      <div className="flex items-center gap-1.5">
        <Icon name="flag" className="h-4 w-4 shrink-0 text-rose-500" />
        <input
          className="input flex-1"
          value={ending.name}
          placeholder="结局名，如 真结局"
          onChange={(e) => updateEnding(endingId, { name: e.target.value })}
        />
        <button className="btn btn-sm" title="删除结局" onClick={() => setConfirming(true)}>
          <Icon name="trash" className="h-3.5 w-3.5" />
        </button>
      </div>
      <input
        className="input"
        value={ending.description ?? ''}
        placeholder="结局描述（通关后显示，可留空）"
        onChange={(e) => updateEnding(endingId, { description: e.target.value })}
      />
      <div className="text-[10px] text-ink-faint">
        {usage > 0 ? `已有 ${usage} 个结局节点指向它` : '还没有节点指向它'}
      </div>

      <ConfirmDialog
        open={confirming}
        title={`删除结局「${ending.name}」？`}
        message={usage > 0 ? `有 ${usage} 个结局节点指向它，删除后这些节点需要重新指定结局。` : '这个结局还没有被使用。'}
        confirmText="删除"
        danger
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          removeEnding(endingId);
          setConfirming(false);
          toast('结局已删除', 'success');
        }}
      />
    </div>
  );
}

export default function EndingsTab() {
  const endingIds = useProjectStore((s) => s.data.story.endings.map((e) => e.id));
  const addEnding = useProjectStore((s) => s.addEnding);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-faint">共 {endingIds.length} 个结局</span>
        <button className="btn btn-sm btn-primary" onClick={() => addEnding()}>
          <Icon name="plus" className="h-3.5 w-3.5" />
          新增结局
        </button>
      </div>

      {endingIds.length ? (
        endingIds.map((id) => <EndingRow key={id} endingId={id} />)
      ) : (
        <EmptyState
          icon="flag"
          title="还没有结局"
          hint="每个故事至少要有一个结局，否则导出时会报错"
          action={
            <button className="btn btn-sm btn-primary" onClick={() => addEnding()}>
              <Icon name="plus" className="h-3.5 w-3.5" />
              新增结局
            </button>
          }
        />
      )}
    </div>
  );
}
