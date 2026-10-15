/**
 * 游戏设置：文字速度、三类音量、全屏
 * 存在 localStorage，编辑器预览与正式游戏共用同一套类型。
 */
export type GameSettings = {
  /** 打字机速度：毫秒 / 字，0 = 瞬间显示 */
  textSpeed: number;
  /** BGM 音量 0~1 */
  bgmVolume: number;
  /** 音效音量 0~1 */
  seVolume: number;
  /** 语音音量 0~1 */
  voiceVolume: number;
  /** 是否全屏（仅桌面版生效） */
  fullscreen: boolean;
};

export const DEFAULT_SETTINGS: GameSettings = {
  textSpeed: 28,
  bgmVolume: 0.7,
  seVolume: 0.8,
  voiceVolume: 1,
  fullscreen: false,
};

const STORAGE_KEY = 'galgame.settings.v1';

/** 读取设置（容错：坏数据回落到默认值） */
export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<GameSettings>;
    return {
      textSpeed:
        typeof parsed.textSpeed === 'number' && parsed.textSpeed >= 0
          ? parsed.textSpeed
          : DEFAULT_SETTINGS.textSpeed,
      bgmVolume: clamp01(parsed.bgmVolume ?? DEFAULT_SETTINGS.bgmVolume),
      seVolume: clamp01(parsed.seVolume ?? DEFAULT_SETTINGS.seVolume),
      voiceVolume: clamp01(parsed.voiceVolume ?? DEFAULT_SETTINGS.voiceVolume),
      fullscreen: !!parsed.fullscreen,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** 保存设置 */
export function saveSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // 存储不可用时静默失败，不影响游戏进行
  }
}

/** 限制到 0~1 */
export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
