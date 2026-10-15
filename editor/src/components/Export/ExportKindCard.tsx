/**
 * 导出方式选项卡：Web 版 / Windows exe
 */
import { Icon } from '../ui/Icon';

export type ExportKind = 'web' | 'exe';

type Props = {
  active: ExportKind;
  disabled?: boolean;
  /** 预估体积文案，如 "约 12.4 MB" */
  sizeHint?: string;
  webSupported: boolean;
  exeSupported: boolean;
  onPick: (kind: ExportKind) => void;
};

export default function ExportKindCard({
  active,
  disabled,
  sizeHint,
  webSupported,
  exeSupported,
  onPick,
}: Props) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onPick('web')}
        className={`rounded-xl border p-3 text-left transition ${
          active ? 'border-brand-500 bg-brand-50/60 shadow-sm' : 'border-line bg-white hover:border-brand-300'
        } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        <div className="flex items-center gap-2">
          <Icon name="external" className="h-4 w-4 text-brand-600" />
          <span className="text-[13px] font-semibold text-ink">网页版（zip）</span>
        </div>
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-soft">
          打包成一个压缩包，解压后双击 <code className="rounded bg-slate-100 px-1">index.html</code> 就能玩。
          也可以上传到任意网站托管，把链接分享给别人。
        </p>
        {sizeHint ? <div className="mt-2 text-[11px] text-ink-faint">预计 {sizeHint}</div> : null}
        {!webSupported ? (
          <div className="mt-2 flex items-center gap-1 text-[11px] text-amber-600">
            <Icon name="alert" className="h-3 w-3" />
            当前环境不支持保存文件
          </div>
        ) : null}
      </button>

      <button
        type="button"
        disabled={disabled || !exeSupported}
        onClick={() => onPick('exe')}
        className={`rounded-xl border p-3 text-left transition ${
          active ? 'border-brand-500 bg-brand-50/60 shadow-sm' : 'border-line bg-white hover:border-brand-300'
        } ${disabled || !exeSupported ? 'cursor-not-allowed opacity-60' : ''}`}
      >
        <div className="flex items-center gap-2">
          <Icon name="download" className="h-4 w-4 text-brand-600" />
          <span className="text-[13px] font-semibold text-ink">Windows 程序（exe）</span>
        </div>
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-soft">
          生成一个不需要安装任何东西的 <code className="rounded bg-slate-100 px-1">.exe</code>，
          双击即玩，可以直接发给朋友。
        </p>
        {!exeSupported ? (
          <div className="mt-2 flex items-center gap-1 text-[11px] text-ink-faint">
            <Icon name="info" className="h-3 w-3" />
            需要用编辑器桌面版
          </div>
        ) : (
          <div className="mt-2 text-[11px] text-ink-faint">输出到你自己选的文件夹</div>
        )}
      </button>
    </div>
  );
}
