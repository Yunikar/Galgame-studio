/**
 * 存档 / 读档面板：3 个手动存档位 + 1 个自动存档位
 */
import { SLOT_IDS, SLOT_LABELS, type SaveData, type SlotId } from '../lib/saveStore';

type Props = {
  mode: 'save' | 'load';
  saves: Partial<Record<SlotId, SaveData>>;
  onSave: (slotId: SlotId) => void;
  onLoad: (slotId: SlotId) => void;
  onDelete: (slotId: SlotId) => void;
  onClose: () => void;
  /** 存档模式下展示"当前进度"用于确认 */
  currentSummary?: { sceneName: string; text: string };
};

/** 时间格式化 */
function formatTime(iso: string): string {
  try {
    const date = new Date(iso);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      date.getDate(),
    ).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  } catch {
    return iso;
  }
}

export default function SaveLoadPanel({
  mode,
  saves,
  onSave,
  onLoad,
  onDelete,
  onClose,
  currentSummary,
}: Props) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-[620px] max-w-[94%] rounded-xl border border-white/15 bg-slate-900/95 p-5 text-white shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-wide">{mode === 'save' ? '保存进度' : '读取进度'}</h2>
          <button className="rounded border border-white/25 px-2.5 py-1 text-xs hover:bg-white/10" onClick={onClose}>
            关闭
          </button>
        </div>

        <div className="space-y-2">
          {SLOT_IDS.map((slotId) => {
            const save = saves[slotId];
            const isAuto = slotId === 'auto';

            return (
              <div
                key={slotId}
                className={`flex items-center gap-3 rounded-lg border p-3 transition ${
                  save ? 'border-white/15 bg-white/[0.04]' : 'border-dashed border-white/15'
                }`}
              >
                <div className="w-[68px] shrink-0 text-[13px] font-medium text-white/80">
                  {SLOT_LABELS[slotId]}
                </div>

                <div className="min-w-0 flex-1">
                  {save ? (
                    <>
                      <div className="truncate text-[13px] text-white/85" title={save.text}>
                        {save.speakerName ? `${save.speakerName}：` : ''}
                        {save.text || '（无台词）'}
                      </div>
                      <div className="mt-0.5 text-[11px] text-white/40">
                        {save.sceneName} · {formatTime(save.savedAt)}
                      </div>
                    </>
                  ) : (
                    <div className="text-[12px] text-white/30">
                      {isAuto ? '自动存档会在剧情推进时自动记录' : '空存档位'}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 gap-1.5">
                  {mode === 'save' ? (
                    <button
                      className="rounded border border-white/25 px-3 py-1 text-xs hover:bg-white/10 disabled:opacity-40"
                      disabled={isAuto}
                      title={isAuto ? '自动存档位不用手动保存' : ''}
                      onClick={() => onSave(slotId)}
                    >
                      保存
                    </button>
                  ) : (
                    <button
                      className="rounded border border-sky-400/60 bg-sky-400/15 px-3 py-1 text-xs text-sky-100 hover:bg-sky-400/25 disabled:opacity-30"
                      disabled={!save}
                      onClick={() => onLoad(slotId)}
                    >
                      读取
                    </button>
                  )}
                  <button
                    className="rounded border border-white/20 px-2.5 py-1 text-xs text-white/60 hover:bg-white/10 disabled:opacity-25"
                    disabled={!save}
                    onClick={() => onDelete(slotId)}
                  >
                    删除
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {mode === 'save' && currentSummary ? (
          <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-3 text-[11px] leading-relaxed text-white/50">
            将保存当前进度：
            <span className="ml-1 text-white/75">
              {currentSummary.sceneName} · {currentSummary.text.slice(0, 40)}
              {currentSummary.text.length > 40 ? '…' : ''}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
