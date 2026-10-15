/**
 * 舞台等比缩放
 *
 * 做法：外层容器（铺满窗口 / 预览面板）尺寸变化时，算出 scale，
 * 再用 transform: scale() 作用在固定 1280×720 的舞台上。
 * 好处：舞台内部所有元素（背景、立绘、对话框、字号）一起等比缩放，
 * 永远保持 16:9，不会因为窗口比例不对被压扁；而 UI 层不参与缩放。
 *
 * scale = min(容器宽 / 基准宽, 容器高 / 基准高)
 * 取小值保证舞台完整可见（长边留黑边）。
 */
import { useLayoutEffect, useRef, useState, type MutableRefObject } from 'react';

/** 舞台基准分辨率，必须与 shared/styles/game.css 里的 --stage-w / --stage-h 保持一致 */
export const STAGE_WIDTH = 1280;
export const STAGE_HEIGHT = 720;

export function useStageScale<T extends HTMLElement>(): {
  /** 挂到外层容器上 */
  ref: MutableRefObject<T | null>;
  /** 当前缩放系数，作用到 .stage 的 transform 上 */
  scale: number;
} {
  const ref = useRef<T | null>(null);
  const [scale, setScale] = useState(1);

  // 用 useLayoutEffect：首次渲染就先算好 scale，避免舞台先小后大地闪一下
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const compute = () => {
      const { clientWidth, clientHeight } = el;
      if (!clientWidth || !clientHeight) return;
      setScale(Math.min(clientWidth / STAGE_WIDTH, clientHeight / STAGE_HEIGHT));
    };

    compute();
    // 用 ResizeObserver 而不是 window.resize：
    // 编辑器里预览面板展开/收起时尺寸会变，但不会触发 window.resize
    const observer = new ResizeObserver(compute);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, scale };
}
