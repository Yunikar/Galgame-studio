/**
 * 设置面板：文字速度、三类音量、全屏
 */
import { useEffect, useState } from 'react';
import { audioManager } from '../player/audioManager';
import type { GameSettings } from '../lib/settings';

type Props = {
  settings: GameSettings;
  onChange: (settings: GameSettings) => void;
  onClose: () => void;
  /** 是否显示全屏选项（桌面版 / 支持全屏的浏览器） */
  showFullscreen?: boolean;
};

/** 文字速度的档位说明 */
function speedLabel(value: number): string {
  if (value <= 0) return '瞬间显示';
  if (value <= 15) return '很快';
  if (value <= 30) return '标准';
  if (value <= 60) return '较慢';
  return '很慢';
}

export default function SettingsPanel({ settings, onChange, onClose, showFullscreen = true }: Props) {
  /** 全屏状态跟随浏览器实际状态 */
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const update = (patch: Partial<GameSettings>) => {
    const next = { ...settings, ...patch };
    onChange(next);
    // 音量改动立即生效
    audioManager.applySettings(next);
  };

  /** 切换全屏 */
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      } else {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      }
    } catch {
      // 某些环境不允许全屏，忽略
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-[440px] max-w-[92%] rounded-xl border border-white/15 bg-slate-900/95 p-5 text-white shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-wide">设置</h2>
          <button className="rounded border border-white/25 px-2.5 py-1 text-xs hover:bg-white/10" onClick={onClose}>
            关闭
          </button>
        </div>

        <div className="space-y-4 text-sm">
          {/* 文字速度 */}
          <div>
            <div className="mb-1 flex justify-between">
              <span className="text-white/80">文字速度</span>
              <span className="text-xs text-white/50">
                {speedLabel(settings.textSpeed)}（{settings.textSpeed} 毫秒/字）
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={2}
              value={settings.textSpeed}
              className="w-full accent-sky-400"
              onChange={(e) => update({ textSpeed: Number(e.target.value) })}
            />
          </div>

          <Slider
            label="BGM 音量"
            value={settings.bgmVolume}
            onChange={(v) => update({ bgmVolume: v })}
          />
          <Slider
            label="音效音量"
            value={settings.seVolume}
            onChange={(v) => update({ seVolume: v })}
            onTest={() => audioManager.playSe(undefined)}
          />
          <Slider
            label="语音音量"
            value={settings.voiceVolume}
            onChange={(v) => update({ voiceVolume: v })}
          />

          {showFullscreen ? (
            <div className="flex items-center justify-between border-t border-white/10 pt-3">
              <span className="text-white/80">全屏显示</span>
              <button
                className={`rounded border px-3 py-1 text-xs transition ${
                  isFullscreen
                    ? 'border-sky-400 bg-sky-400/20 text-sky-200'
                    : 'border-white/25 text-white/70 hover:bg-white/10'
                }`}
                onClick={() => void toggleFullscreen()}
              >
                {isFullscreen ? '退出全屏' : '进入全屏'}
              </button>
            </div>
          ) : null}
        </div>

        <p className="mt-4 text-[11px] leading-relaxed text-white/35">
          设置会自动保存在本机。分辨率和窗口大小由游戏容器决定，无需手动调整。
        </p>
      </div>
    </div>
  );
}

/** 音量滑块 */
function Slider({
  label,
  value,
  onChange,
  onTest,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  onTest?: () => void;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between">
        <span className="text-white/80">{label}</span>
        <span className="text-xs text-white/50">{Math.round(value * 100)}%</span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={value}
          className="w-full accent-sky-400"
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {onTest ? (
          <button
            className="shrink-0 rounded border border-white/20 px-2 py-0.5 text-[11px] hover:bg-white/10"
            onClick={onTest}
          >
            测试
          </button>
        ) : null}
      </div>
    </div>
  );
}
