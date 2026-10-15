/**
 * 编辑器预览桥
 * 编辑器在新标签页打开运行时后，通过 postMessage 把当前剧本 + 素材塞进来。
 */
import { useEffect } from 'react';

export type PreviewPayload = {
  type: 'gal:preview';
  /** 剧本 JSON */
  story: unknown;
  /** assetId -> dataURL */
  assets: Record<string, string>;
  /** 从哪个节点开始（可空） */
  nodeId?: string;
  /** 节点所在场景 */
  sceneId?: string;
};

/** 判断消息是不是预览数据 */
function isPreviewPayload(data: unknown): data is PreviewPayload {
  return !!data && typeof data === 'object' && (data as { type?: string }).type === 'gal:preview';
}

/**
 * 监听编辑器的预览消息。
 * 编辑器会每隔 500ms 重发一次（共约 6 秒），保证运行时加载完就能收到。
 */
export function usePreviewBridge(onPayload: (payload: PreviewPayload) => void): void {
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!isPreviewPayload(event.data)) return;
      onPayload(event.data);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onPayload]);
}
