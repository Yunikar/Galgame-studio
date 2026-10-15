/**
 * 二次确认弹窗：删除类操作统一走这里
 */
import type { ReactNode } from 'react';

type Props = {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = '确定',
  cancelText = '取消',
  danger,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4" onClick={onCancel}>
      <div
        className="w-[420px] max-w-full rounded-xl border border-line bg-white p-4 shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[15px] font-semibold text-ink">{title}</div>
        <div className="mt-2 text-[13px] leading-relaxed text-ink-soft">{message}</div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn" onClick={onCancel}>
            {cancelText}
          </button>
          <button className={danger ? 'btn btn-danger' : 'btn btn-primary'} onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
