/**
 * 自动保存：项目有改动后延迟写回本地，避免每个字符都写一次存储
 */
import { useEffect } from 'react';
import { useProjectStore } from '../store/projectStore';

export function useAutoSave(delay = 1200): void {
  const dirty = useProjectStore((s) => s.dirty);
  const saveLocal = useProjectStore((s) => s.saveLocal);

  useEffect(() => {
    if (!dirty) return undefined;
    const timer = setTimeout(() => {
      void saveLocal();
    }, delay);
    return () => clearTimeout(timer);
  }, [dirty, delay, saveLocal]);
}

/** 启动时读取本地项目（只执行一次） */
export function useHydrateProject(): void {
  const hydrate = useProjectStore((s) => s.hydrate);
  const hydrated = useProjectStore((s) => s.hydrated);

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrate, hydrated]);
}
