/**
 * 轻提示（Toast）状态：导出结果、校验结果、错误提示都走这里
 */
import { create } from 'zustand';
import { uid } from '@gal/shared';
import type { Toast, ToastLevel } from './uiStore';

type ToastStore = {
  toasts: Toast[];
  push: (message: string, level?: ToastLevel, detail?: string) => string;
  dismiss: (id: string) => void;
};

/** 不同级别停留时间（毫秒），错误留久一点 */
const DURATION: Record<ToastLevel, number> = {
  success: 2600,
  info: 2600,
  warning: 4200,
  error: 5200,
};

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  push: (message, level = 'info', detail) => {
    const id = uid('toast');
    set((state) => ({ toasts: [...state.toasts, { id, message, level, detail }] }));
    setTimeout(() => get().dismiss(id), DURATION[level]);
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

/** 在非组件环境里弹提示 */
export function toast(message: string, level: ToastLevel = 'info', detail?: string): string {
  return useToastStore.getState().push(message, level, detail);
}
