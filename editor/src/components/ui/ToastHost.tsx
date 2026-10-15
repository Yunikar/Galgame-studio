/**
 * 轻提示容器：右下角堆叠显示
 */
import { useToastStore } from '../../store/toastStore';
import type { ToastLevel } from '../../store/uiStore';
import { Icon } from './Icon';

/** 级别 -> 样式与图标 */
const STYLE: Record<ToastLevel, { box: string; icon: string; color: string }> = {
  success: { box: 'border-emerald-200 bg-emerald-50', icon: 'check', color: 'text-emerald-600' },
  error: { box: 'border-red-200 bg-red-50', icon: 'alert', color: 'text-red-600' },
  warning: { box: 'border-amber-200 bg-amber-50', icon: 'alert', color: 'text-amber-600' },
  info: { box: 'border-brand-200 bg-brand-50', icon: 'info', color: 'text-brand-600' },
};

export default function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[340px] flex-col gap-2">
      {toasts.map((t) => {
        const style = STYLE[t.level];
        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2 shadow-pop ${style.box}`}
          >
            <Icon name={style.icon} className={`mt-0.5 h-4 w-4 shrink-0 ${style.color}`} />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-ink">{t.message}</div>
              {t.detail ? <div className="mt-0.5 text-xs text-ink-faint">{t.detail}</div> : null}
            </div>
            <button
              className="shrink-0 rounded p-0.5 text-ink-faint hover:bg-black/5 hover:text-ink"
              onClick={() => dismiss(t.id)}
              title="关闭"
            >
              <Icon name="close" className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
