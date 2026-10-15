/**
 * 导出结果：成功摘要 / 失败原因
 */
import { Icon } from '../ui/Icon';
import type { MissingAsset } from '../../lib/gameBuild';
import { formatBytes } from '../../lib/assetUtils';

export type ExportOutcomeView =
  | { kind: 'success'; title: string; lines: string[]; missing: MissingAsset[]; empty: MissingAsset[]; bytes: number; fileCount: number }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string };

type Props = {
  view: ExportOutcomeView;
  onRetry: () => void;
  onClose: () => void;
};

/** 把缺失素材列表压成一行提示 */
function assetHint(list: MissingAsset[]): string {
  const names = list.slice(0, 3).map((a) => `${a.label}「${a.name}」`).join('、');
  return list.length > 3 ? `${names} 等 ${list.length} 项` : names;
}

export default function ExportResult({ view, onRetry, onClose }: Props) {
  if (view.kind === 'cancelled') {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-line bg-white p-3 text-[12.5px] text-ink-soft">
        <Icon name="info" className="h-3.5 w-3.5" />
        已取消，没有生成文件。
        <button className="btn ml-auto" onClick={onRetry}>
          再来一次
        </button>
      </div>
    );
  }

  if (view.kind === 'error') {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-3">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-red-700">
          <Icon name="alert" className="h-4 w-4" />
          导出失败
        </div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-red-700">{view.message}</p>
        <div className="mt-3 flex gap-2">
          <button className="btn" onClick={onRetry}>
            重试
          </button>
          <button className="btn" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-emerald-800">
        <Icon name="check" className="h-4 w-4" />
        {view.title}
      </div>

      <ul className="mt-2 space-y-1 text-[12px] leading-relaxed text-emerald-900">
        <li>
          共 {view.fileCount} 个文件，合计 {formatBytes(view.bytes)}
        </li>
        {view.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      {view.missing.length ? (
        <div className="mt-2.5 flex gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-[11.5px] leading-relaxed text-amber-800">
          <Icon name="alert" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>有素材找不到文件，游戏里会显示占位图：{assetHint(view.missing)}</span>
        </div>
      ) : null}

      {view.empty.length ? (
        <div className="mt-2 flex gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-[11.5px] leading-relaxed text-amber-800">
          <Icon name="alert" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>有素材内容为空，需要重新上传：{assetHint(view.empty)}</span>
        </div>
      ) : null}

      <div className="mt-3 flex gap-2">
        <button className="btn" onClick={onRetry}>
          再导出一份
        </button>
        <button className="btn btn-primary" onClick={onClose}>
          完成
        </button>
      </div>
    </div>
  );
}
