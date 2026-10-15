/**
 * 空状态占位：面板里没有内容时的引导
 */
import type { ReactNode } from 'react';
import { Icon } from './Icon';

type Props = {
  icon?: string;
  title: string;
  hint?: string;
  action?: ReactNode;
};

export default function EmptyState({ icon = 'info', title, hint, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line px-4 py-8 text-center">
      <Icon name={icon} className="h-6 w-6 text-ink-faint" />
      <div className="text-[13px] font-medium text-ink-soft">{title}</div>
      {hint ? <div className="max-w-[240px] text-xs leading-relaxed text-ink-faint">{hint}</div> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
