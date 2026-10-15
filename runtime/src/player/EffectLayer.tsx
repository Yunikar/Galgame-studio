/**
 * 特效层：闪白 / 淡出淡入用叠加层实现，
 * 震动 / 黑白 / 模糊由 GamePlayer 作用在舞台元素上（见 useEffects）。
 */
import type { ActiveEffect } from './useEffects';

type Props = {
  overlays: ActiveEffect[];
};

export default function EffectLayer({ overlays }: Props) {
  return (
    // 层级 20：盖住背景（0）和立绘（10），但不盖对话框（100）、选项（110）和 UI（200）
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 20 }}>
      {overlays.map((item) =>
        item.effect === 'flash' ? (
          <div key={item.key} className="anim-flash absolute inset-0 bg-white" />
        ) : item.effect === 'fadeOutIn' ? (
          <div
            key={item.key}
            className="absolute inset-0 bg-black"
            style={{
              animation: `gal-fade-out-in ${item.duration}s ease-in-out`,
            }}
          />
        ) : null,
      )}
    </div>
  );
}
