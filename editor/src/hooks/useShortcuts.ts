/**
 * 全局快捷键
 * Ctrl+S 保存工程 / Ctrl+Z 撤销 / Ctrl+Shift+Z 重做
 * Ctrl+E 导出作品 / F1 新手引导 / Esc 取消选中
 */
import { useEffect } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useUiStore } from '../store/uiStore';
import { toast } from '../store/toastStore';
import { saveFile } from '../lib/fileIO';
import { stringifyProjectFile } from '../lib/projectStorage';

export function useShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      const mod = e.ctrlKey || e.metaKey;

      // Ctrl+S：导出工程文件
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        const { data } = useProjectStore.getState();
        const bytes = new TextEncoder().encode(stringifyProjectFile(data));
        void saveFile(bytes, `${data.story.meta.title || '未命名作品'}.galproj`, 'application/json', [
          { name: 'Galgame 项目', extensions: ['galproj', 'json'] },
        ]).then((result) => {
          if (result === 'saved' || result === 'downloaded') toast('工程文件已导出', 'success');
        });
        return;
      }

      // Ctrl+Z / Ctrl+Shift+Z：撤销重做（输入框内保留浏览器默认行为）
      if (mod && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault();
        if (e.shiftKey) useProjectStore.getState().redo();
        else useProjectStore.getState().undo();
        return;
      }

      // Ctrl+Y 也作为重做
      if (mod && e.key.toLowerCase() === 'y' && !typing) {
        e.preventDefault();
        useProjectStore.getState().redo();
        return;
      }

      // Ctrl+E：打开导出弹窗
      if (mod && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        useUiStore.getState().setExportOpen(true);
        return;
      }

      // F1：新手引导
      if (e.key === 'F1') {
        e.preventDefault();
        useUiStore.getState().setGuideOpen(true);
        return;
      }

      // Esc：取消节点选中
      if (e.key === 'Escape' && !typing) {
        const { activeSceneId, selectNode } = useUiStore.getState();
        if (activeSceneId) selectNode(activeSceneId, null);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
}
