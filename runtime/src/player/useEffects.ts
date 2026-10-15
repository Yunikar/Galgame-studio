/**
 * 特效状态管理：把引擎发来的特效事件变成"当前生效的视觉状态"
 */
import { useCallback, useRef, useState } from 'react';
import type { EffectType } from '@gal/shared';

export type ActiveEffect = {
  /** 唯一 key，用于 React key 与重复触发 */
  key: number;
  effect: EffectType;
  duration: number;
};

export type EffectsState = {
  /** 触发一个特效 */
  trigger: (effect: EffectType, duration: number) => void;
  /** 当前所有生效中的特效 */
  active: ActiveEffect[];
  /** 需要叠加的叠加层（闪白 / 淡出淡入） */
  overlays: ActiveEffect[];
  /** 是否让画面变黑白 */
  grayscale: boolean;
  /** 模糊半径（px），0 表示不模糊 */
  blurPx: number;
  /** 最新一次震动特效的 key，用于触发 Web Animations 动画 */
  shake: { key: number; duration: number } | null;
  /** 清空所有特效（切换场景 / 重置时用） */
  reset: () => void;
};

export function useEffects(): EffectsState {
  const [active, setActive] = useState<ActiveEffect[]>([]);
  const [shake, setShake] = useState<{ key: number; duration: number } | null>(null);
  const keyRef = useRef(0);

  const trigger = useCallback((effect: EffectType, duration: number) => {
    keyRef.current += 1;
    const key = keyRef.current;

    // 震动不需要"持续渲染"，直接用一次性动画
    if (effect === 'shake') {
      setShake({ key, duration });
      return;
    }

    const item: ActiveEffect = { key, effect, duration: Math.max(0.1, duration) };
    setActive((prev) => [...prev, item]);
    window.setTimeout(() => {
      setActive((prev) => prev.filter((e) => e.key !== key));
    }, item.duration * 1000);
  }, []);

  const reset = useCallback(() => {
    setActive([]);
    setShake(null);
  }, []);

  return {
    trigger,
    active,
    overlays: active.filter((e) => e.effect === 'flash' || e.effect === 'fadeOutIn'),
    grayscale: active.some((e) => e.effect === 'blackAndWhite'),
    blurPx: active.some((e) => e.effect === 'blur') ? 6 : 0,
    shake,
    reset,
  };
}
