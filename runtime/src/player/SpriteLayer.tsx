/**
 * 立绘层：支持多个角色同时在台上，按 x / y / scale 自由摆放
 *
 * 层级：整个立绘层 z-index = 10，位于背景（0）之上、特效（20）与对话框（100）之下，
 *      立绘永远不可能盖住对话框（对话框的 z-index 见 shared/styles/game.css）。
 *      层内部再用 Z_ORDER 区分前后（中间的角色更靠前）。
 *
 * 定位规则（锚点 = 立绘的「底部中心」）：
 *   left: x%   top: y%   transform: translate(-50%, -100%) scale(s)
 *   —— 先平移到 (x%, y%)，再以底部中心为原点缩放，所以缩放不影响锚点位置。
 *
 * 兼容：x / y / scale 是新增的可选字段，逐字段回退 ——
 *      没有 x 的旧节点仍然按 position 算出旧的百分比，画面与老版本完全一致。
 */
import { useEffect, useRef, useState } from 'react';
import {
  SPRITE_BASE_HEIGHT_PERCENT,
  SPRITE_DEFAULT_SCALE,
  SPRITE_DEFAULT_Y,
  SPRITE_LEGACY_X,
  type SpritePosition,
  type Story,
} from '@gal/shared';
import type { ActiveEffectEntry, SpriteState } from '../engine/types';
import type { AssetResolver } from '../lib/assetResolver';

type Props = {
  story: Story;
  sprites: Record<string, SpriteState>;
  /** 正在生效的持续特效（只取 target='sprite' 的那些） */
  effects: ActiveEffectEntry[];
  resolveAsset: AssetResolver;
};

/** 立绘层在舞台里的层级：背景 0 < 立绘 10 < 特效 20 < 对话框 100 */
const SPRITE_LAYER_Z = 10;

/** 位置 -> 层内前后顺序（中间的角色更靠前一点） */
const Z_ORDER: Record<SpritePosition, number> = { left: 1, center: 3, right: 2 };

/** 转场 -> 动画类名 */
const ANIM: Record<string, string> = {
  none: '',
  fade: 'anim-fade',
  slideLeft: 'anim-slide-left',
  slideRight: 'anim-slide-right',
};

/** 单个角色立绘 */
function SpriteImage({
  characterId,
  expressionId,
  position,
  x,
  y,
  scale,
  transition,
  story,
  spriteEffects,
  resolveAsset,
}: {
  characterId: string;
  expressionId?: string;
  position?: SpritePosition;
  x?: number;
  y?: number;
  scale?: number;
  transition: string;
  story: Story;
  /** 作用在这个角色立绘上的持续特效 */
  spriteEffects: ActiveEffectEntry[];
  resolveAsset: AssetResolver;
}) {
  const character = story.characters.find((c) => c.id === characterId);
  const baseSrc = character?.sprites.base ? resolveAsset(character.sprites.base) : undefined;
  const expression = character?.sprites.expressions.find((e) => e.id === expressionId);
  const expressionSrc = expression?.assetId ? resolveAsset(expression.assetId) : undefined;

  // 逐字段回退：老节点只有 position，没有 x/y/scale
  const left = x ?? SPRITE_LEGACY_X[position ?? 'center'];
  const top = y ?? SPRITE_DEFAULT_Y;
  const spriteScale = scale ?? SPRITE_DEFAULT_SCALE;

  // 特效滤镜（黑白 / 模糊）只影响这一个人
  const effectFilter = [
    spriteEffects.some((e) => e.effect === 'blackAndWhite') ? 'grayscale(1)' : '',
    spriteEffects.some((e) => e.effect === 'blur') ? 'blur(6px)' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const shaking = spriteEffects.some((e) => e.effect === 'shake');

  return (
    // 外层：定位 + 缩放（锚点在底部中心）
    <div
      className="absolute"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        // 锚点落在立绘底部中心，缩放时锚点不动
        transform: `translate(-50%, -100%) scale(${spriteScale})`,
        transformOrigin: 'bottom center',
        zIndex: Z_ORDER[position ?? 'center'],
        // 立绘基准高度约占舞台 78%，宽度不限，保持比例
        height: `${SPRITE_BASE_HEIGHT_PERCENT}%`,
      }}
    >
      {/*
        特效层：滤镜 + 持续震动。
        单独一层是因为 shake 和入场动画的 keyframes 都会写 transform，
        挤在同一层会互相覆盖（slide 跳位的教训）。
      */}
      <div
        className={shaking ? 'anim-shake-loop' : undefined}
        style={{ height: '100%', filter: effectFilter || undefined }}
      >
        {/*
          内层：出场动画。
          ⚠️ 动画必须放在内层：slide 的关键帧会整体覆盖 transform，
          放在外层会把上面的定位/缩放一起冲掉，导致立绘入场瞬间跳位。
        */}
        <div className={`relative h-full ${ANIM[transition] ?? ''}`}>
        {baseSrc ? (
          <>
            <img src={baseSrc} alt="" className="h-full w-auto object-contain drop-shadow-2xl" draggable={false} />
            {/* 差分覆盖在基础立绘的同尺寸位置上 */}
            {expressionSrc ? (
              <img
                src={expressionSrc}
                alt=""
                className="absolute inset-0 h-full w-full object-contain"
                draggable={false}
              />
            ) : null}
          </>
        ) : (
          // 没上传立绘时的占位：显示角色名，方便作者发现漏传素材
          <div className="flex h-full w-[160px] items-center justify-center rounded-t-xl border border-dashed border-white/40 bg-black/30 text-center text-xs text-white/60">
            {character?.name ?? '未指定角色'}
            <br />
            （缺立绘）
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

/** 退场中的立绘需要记住的字段 */
type LeavingSprite = Pick<SpriteState, 'characterId' | 'position' | 'x' | 'y' | 'scale'> & {
  transition: string;
};

export default function SpriteLayer({ story, sprites, effects, resolveAsset }: Props) {
  const list = Object.values(sprites);
  /** 记录已经退场的角色，让它们播完退场动画再移除 */
  const [leaving, setLeaving] = useState<LeavingSprite[]>([]);
  const previousRef = useRef<Record<string, SpriteState>>(sprites);

  useEffect(() => {
    const previous = previousRef.current;
    const removed = Object.values(previous).filter((s) => !sprites[s.characterId]);
    if (removed.length) {
      setLeaving((prev) => [
        ...prev,
        ...removed.map((s) => ({
          characterId: s.characterId,
          position: s.position,
          x: s.x,
          y: s.y,
          scale: s.scale,
          transition: 'anim-fade',
        })),
      ]);
      const timer = window.setTimeout(() => {
        setLeaving((prev) => prev.filter((l) => !removed.some((r) => r.characterId === l.characterId)));
      }, 400);
      previousRef.current = sprites;
      return () => window.clearTimeout(timer);
    }
    previousRef.current = sprites;
    return undefined;
  }, [sprites]);

  return (
    <div className="absolute inset-0" style={{ zIndex: SPRITE_LAYER_Z }}>
      {list.map((sprite) => (
        <SpriteImage
          key={sprite.characterId}
          characterId={sprite.characterId}
          expressionId={sprite.expressionId}
          position={sprite.position}
          x={sprite.x}
          y={sprite.y}
          scale={sprite.scale}
          transition={sprite.entering ? (sprite.transition ?? 'fade') : 'none'}
          story={story}
          spriteEffects={effects.filter((e) => e.target === 'sprite' && e.targetCharacterId === sprite.characterId)}
          resolveAsset={resolveAsset}
        />
      ))}

      {/* 退场中的立绘：淡出 */}
      {leaving.map((item) => (
        <div key={`leaving-${item.characterId}`} className="absolute inset-0 opacity-0 transition-opacity duration-300">
          <SpriteImage
            characterId={item.characterId}
            position={item.position}
            x={item.x}
            y={item.y}
            scale={item.scale}
            transition={item.transition}
            story={story}
            spriteEffects={[]}
            resolveAsset={resolveAsset}
          />
        </div>
      ))}
    </div>
  );
}
