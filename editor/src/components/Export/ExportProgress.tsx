/**
 * 导出进度条
 */
import { Icon } from '../ui/Icon';

type Props = {
  stage: string;
  /** 0-100 */
  percent: number;
};

export default function ExportProgress({ stage, percent }: Props) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));

  return (
    <div className="rounded-xl border border-line bg-white p-3">
      <div className="flex items-center gap-2 text-[12.5px] text-ink-soft">
        <Icon name="refresh" className="h-3.5 w-3.5 animate-spin text-brand-600" />
        <span>{stage || '正在准备…'}</span>
        <span className="ml-auto tabular-nums text-ink-faint">{clamped}%</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-brand-500 transition-[width] duration-200"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
