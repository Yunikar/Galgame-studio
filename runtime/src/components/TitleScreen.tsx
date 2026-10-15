/**
 * 标题画面：开始游戏 / 读取存档 / 设置
 */
import { useState } from 'react';

type Props = {
  title: string;
  /** 标题背景图（可选）。没有就用默认深色渐变 */
  backgroundSrc?: string;
  /** 是否已有存档 */
  hasSave: boolean;
  /** 结局收集情况 */
  endings: { id: string; name: string; reached: boolean }[];
  onStart: () => void;
  onLoad: () => void;
  onSettings: () => void;
};

export default function TitleScreen({
  title,
  backgroundSrc,
  hasSave,
  endings,
  onStart,
  onLoad,
  onSettings,
}: Props) {
  const reached = endings.filter((e) => e.reached).length;
  // 背景图加载失败时退回默认渐变底，不至于只剩黑屏
  const [bgBroken, setBgBroken] = useState(false);
  const showBg = !!backgroundSrc && !bgBroken;

  return (
    <div className="absolute inset-0 overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-black">
      {showBg ? (
        <>
          <img
            src={backgroundSrc}
            alt=""
            draggable={false}
            onError={() => setBgBroken(true)}
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* 压一层暗色遮罩，保证标题和菜单文字看得清 */}
          <div className="absolute inset-0 bg-black/45" />
        </>
      ) : null}

      <div className="relative flex h-full flex-col items-center justify-center">
        {/* 标题 */}
        <div className="mb-10 text-center">
          <h1 className="text-[42px] font-bold tracking-[0.18em] text-white drop-shadow-lg">{title || '未命名作品'}</h1>
          <div className="mx-auto mt-3 h-px w-40 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
        </div>

        {/* 菜单 */}
        <div className="flex flex-col gap-2.5">
          <button className="menu-btn" onClick={onStart}>
            开始游戏
          </button>
          <button className="menu-btn" onClick={onLoad} disabled={!hasSave} title={hasSave ? '' : '还没有存档'}>
            读取存档
          </button>
          <button className="menu-btn" onClick={onSettings}>
            设置
          </button>
        </div>

        {/* 结局收集 */}
        {endings.length ? (
          <div className="mt-10 text-center">
            <div className="text-[11px] tracking-widest text-white/40">
              结局收集 {reached} / {endings.length}
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              {endings.map((ending) => (
                <span
                  key={ending.id}
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] ${
                    ending.reached
                      ? 'border-amber-300/60 bg-amber-300/10 text-amber-200'
                      : 'border-white/15 text-white/30'
                  }`}
                >
                  {ending.reached ? ending.name : '？？？'}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="absolute bottom-4 text-[11px] text-white/25">
          点击 / 空格 / 回车可以推进对话
        </div>
      </div>
    </div>
  );
}
