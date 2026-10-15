/**
 * 音频管理：BGM（循环 + 淡入淡出）/ 音效 / 语音
 * 全局单例，避免多个组件各自 new Audio 造成重音。
 */
import type { GameSettings } from '../lib/settings';

class AudioManager {
  private bgmEl: HTMLAudioElement | null = null;
  private bgmSrc: string | null = null;
  private bgmFadeTimer: number | null = null;
  private voiceEl: HTMLAudioElement | null = null;
  private seEls: HTMLAudioElement[] = [];
  private volumes = { bgm: 0.7, se: 0.8, voice: 1 };
  /** 浏览器自动播放策略：首次用户手势前不要尝试播放 */
  private unlocked = false;

  /** 同步设置里的音量 */
  applySettings(settings: GameSettings): void {
    this.volumes = {
      bgm: settings.bgmVolume,
      se: settings.seVolume,
      voice: settings.voiceVolume,
    };
    if (this.bgmEl && !this.bgmFadeTimer) this.bgmEl.volume = this.volumes.bgm;
    if (this.voiceEl) this.voiceEl.volume = this.volumes.voice;
    for (const el of this.seEls) el.volume = this.volumes.se;
  }

  /** 用户第一次点击时调用，解锁音频播放 */
  unlock(): void {
    this.unlocked = true;
  }

  /** 播放 BGM */
  playBgm(src: string | undefined, loop: boolean, fadeInSeconds = 0): void {
    if (!src) return;
    // 同一首正在播放就不重头开始
    if (this.bgmSrc === src && this.bgmEl && !this.bgmEl.paused) return;

    this.stopBgm(0, true);
    const audio = new Audio(src);
    audio.loop = loop;
    audio.volume = fadeInSeconds > 0 ? 0 : this.volumes.bgm;
    this.bgmEl = audio;
    this.bgmSrc = src;

    void audio.play().catch(() => {
      // 自动播放被拦截：等用户再点一下时会重试
    });

    if (fadeInSeconds > 0) {
      this.fade(audio, 0, this.volumes.bgm, fadeInSeconds * 1000);
    }
  }

  /** 停止 BGM（fadeOutSeconds > 0 时淡出） */
  stopBgm(fadeOutSeconds = 0, immediate = false): void {
    const audio = this.bgmEl;
    if (!audio) {
      this.bgmSrc = null;
      return;
    }

    if (immediate || fadeOutSeconds <= 0) {
      this.clearFade();
      audio.pause();
      audio.src = '';
      this.bgmEl = null;
      this.bgmSrc = null;
      return;
    }

    const target = audio;
    this.bgmSrc = null;
    this.fade(target, target.volume, 0, fadeOutSeconds * 1000, () => {
      target.pause();
      target.src = '';
      if (this.bgmEl === target) this.bgmEl = null;
    });
  }

  /** 播放音效（一次性，可叠） */
  playSe(src: string | undefined): void {
    if (!src) return;
    const audio = new Audio(src);
    audio.volume = this.volumes.se;
    this.seEls.push(audio);
    audio.onended = () => {
      this.seEls = this.seEls.filter((el) => el !== audio);
    };
    void audio.play().catch(() => {
      this.seEls = this.seEls.filter((el) => el !== audio);
    });
  }

  /** 播放语音（同一时刻只留一条） */
  playVoice(src: string | undefined): void {
    this.stopVoice();
    if (!src) return;
    const audio = new Audio(src);
    audio.volume = this.volumes.voice;
    this.voiceEl = audio;
    void audio.play().catch(() => {
      if (this.voiceEl === audio) this.voiceEl = null;
    });
  }

  /** 停止语音 */
  stopVoice(): void {
    if (!this.voiceEl) return;
    this.voiceEl.pause();
    this.voiceEl.src = '';
    this.voiceEl = null;
  }

  /** 全部停止（回到标题时调用） */
  stopAll(): void {
    this.stopBgm(0, true);
    this.stopVoice();
    for (const el of this.seEls) {
      el.pause();
      el.src = '';
    }
    this.seEls = [];
  }

  /** 线性淡入淡出 */
  private fade(
    audio: HTMLAudioElement,
    from: number,
    to: number,
    durationMs: number,
    onDone?: () => void,
  ): void {
    this.clearFade();
    const steps = Math.max(1, Math.round(durationMs / 50));
    const delta = (to - from) / steps;
    let current = from;
    let count = 0;

    this.bgmFadeTimer = window.setInterval(() => {
      count += 1;
      current += delta;
      audio.volume = Math.min(1, Math.max(0, current));
      if (count >= steps) {
        this.clearFade();
        audio.volume = Math.min(1, Math.max(0, to));
        onDone?.();
      }
    }, 50);
  }

  private clearFade(): void {
    if (this.bgmFadeTimer !== null) {
      window.clearInterval(this.bgmFadeTimer);
      this.bgmFadeTimer = null;
    }
  }
}

/** 全局唯一的音频管理器 */
export const audioManager = new AudioManager();
