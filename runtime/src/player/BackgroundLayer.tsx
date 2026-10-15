/**
 * 背景层：支持淡入 / 左右滑动的转场
 * 做法是保留"上一张 + 当前张"两层，新层播放动画、旧层留在下面。
 */
import { useEffect, useRef, useState } from 'react';
import type { Transition } from '@gal/shared';
import type { AssetResolver } from '../lib/assetResolver';

type Props = {
  assetId: string | null;
  transition: Transition;
  resolveAsset: AssetResolver;
};

/** 转场 -> 动画类名 */
const ANIM: Record<Transition, string> = {
  none: '',
  fade: 'anim-fade',
  slideLeft: 'anim-slide-left',
  slideRight: 'anim-slide-right',
};

export default function BackgroundLayer({ assetId, transition, resolveAsset }: Props) {
  const src = assetId ? resolveAsset(assetId) : undefined;

  const [layers, setLayers] = useState<{ key: number; src?: string; anim: string }[]>(() => [
    { key: 0, src, anim: '' },
  ]);
  const keyRef = useRef(0);
  const currentSrcRef = useRef(src);

  useEffect(() => {
    if (src === currentSrcRef.current) return;
    currentSrcRef.current = src;
    keyRef.current += 1;
    const key = keyRef.current;
    const anim = ANIM[transition] ?? '';

    setLayers((prev) => [...prev.slice(-1), { key, src, anim }]);
    // 动画结束后把旧层丢掉，避免堆积
    const timer = window.setTimeout(() => {
      setLayers((prev) => prev.filter((l) => l.key === key));
    }, 480);
    return () => window.clearTimeout(timer);
  }, [src, transition]);

  return (
    // 层级：背景 0 < 立绘 10 < 特效 20 < 对话框 100（见 SpriteLayer / game.css）
    <div className="absolute inset-0 overflow-hidden bg-black" style={{ zIndex: 0 }}>
      {layers.map((layer, index) => (
        <div
          key={layer.key}
          className={`absolute inset-0 ${index === layers.length - 1 ? layer.anim : ''}`}
        >
          {layer.src ? (
            <img src={layer.src} alt="" className="h-full w-full object-cover" draggable={false} />
          ) : (
            // 没有背景素材时用渐变占位，保证画面不是纯黑
            <div className="h-full w-full bg-gradient-to-br from-slate-800 via-slate-900 to-black" />
          )}
        </div>
      ))}
    </div>
  );
}
