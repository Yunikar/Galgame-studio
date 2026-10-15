/**
 * 校验结果抽屉：列出全部问题，点击可跳到对应节点
 */
import { type Issue } from '@gal/shared';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import { useValidation } from '../../hooks/useValidation';
import { Icon } from '../ui/Icon';

export default function ValidationDrawer() {
  const open = useUiStore((s) => s.validationOpen);
  const setOpen = useUiStore((s) => s.setValidationOpen);
  const setLeftTab = useUiStore((s) => s.setLeftTab);
  const requestFocus = useUiStore((s) => s.requestFocus);
  const activeSceneId = useUiStore((s) => s.activeSceneId);
  const scenes = useProjectStore((s) => s.data.story.scenes);
  const { issues, errors, warnings } = useValidation();

  if (!open) return null;

  /** 点击问题 -> 跳到对应位置 */
  const handleIssueClick = (issue: Issue) => {
    if (issue.focus === 'asset' && issue.category) {
      if (issue.category === 'characters') setLeftTab('characters');
      else if (issue.category === 'backgrounds') setLeftTab('backgrounds');
      else if (issue.category === 'sprites') setLeftTab('characters');
      else setLeftTab('audio');
      setOpen(false);
      return;
    }
    if (issue.focus === 'ending') {
      setLeftTab('endings');
      setOpen(false);
      return;
    }
    if (issue.nodeId && issue.sceneId) {
      requestFocus(issue.sceneId, issue.nodeId);
      setOpen(false);
    }
  };

  return (
    <div className="absolute inset-x-2 bottom-2 z-40 max-h-[45%] overflow-hidden rounded-lg border border-line bg-white shadow-pop">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          校验结果
          <span className="chip border-red-200 bg-red-50 text-red-600">{errors} 个错误</span>
          <span className="chip border-amber-200 bg-amber-50 text-amber-600">{warnings} 个提醒</span>
        </div>
        <button className="btn btn-sm" onClick={() => setOpen(false)}>
          <Icon name="close" className="h-3.5 w-3.5" />
          关闭
        </button>
      </div>

      <div className="max-h-[300px] overflow-y-auto p-2">
        {issues.length ? (
          <div className="space-y-1">
            {issues.map((issue, index) => {
              const scene = scenes.find((s) => s.id === issue.sceneId);
              const clickable = !!issue.focus;
              return (
                <button
                  key={index}
                  disabled={!clickable}
                  onClick={() => handleIssueClick(issue)}
                  className={`flex w-full items-start gap-2 rounded-md border px-2 py-1.5 text-left text-[12px] transition ${
                    issue.level === 'error'
                      ? 'border-red-100 bg-red-50/60'
                      : 'border-amber-100 bg-amber-50/60'
                  } ${clickable ? 'hover:border-brand-400' : ''}`}
                >
                  <Icon
                    name={issue.level === 'error' ? 'alert' : 'info'}
                    className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                      issue.level === 'error' ? 'text-red-500' : 'text-amber-500'
                    }`}
                  />
                  <span className="min-w-0 flex-1 leading-relaxed text-ink-soft">{issue.message}</span>
                  {scene ? (
                    <span className="shrink-0 text-[10px] text-ink-faint">
                      {scene.name}
                      {issue.sceneId === activeSceneId ? ' · 当前' : ''}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700">
            <Icon name="check" className="h-4 w-4" />
            全部通过，可以直接导出了
          </div>
        )}
      </div>
    </div>
  );
}
