/**
 * 音频试听：全局只保留一个播放器，切歌时自动停止上一首
 */
import { create } from 'zustand';
import type { EditorAsset } from '@gal/shared';

type AudioPreviewStore = {
  playingId: string | null;
  /** 试听音量 0~1 */
  volume: number;
  setVolume: (v: number) => void;
  toggle: (asset: EditorAsset) => void;
  stop: () => void;
};

/** 复用同一个 audio 元素，避免多路同时响 */
let audioEl: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement {
  if (!audioEl) {
    audioEl = new Audio();
    audioEl.preload = 'auto';
  }
  return audioEl;
}

export const useAudioPreview = create<AudioPreviewStore>((set, get) => ({
  playingId: null,
  volume: 0.7,

  setVolume: (v) => {
    set({ volume: v });
    if (audioEl) audioEl.volume = v;
  },

  toggle: (asset) => {
    const { playingId } = get();
    const audio = getAudio();

    if (playingId === asset.id) {
      audio.pause();
      set({ playingId: null });
      return;
    }

    if (!asset.dataUrl) return;
    audio.src = asset.dataUrl;
    audio.volume = get().volume;
    audio.currentTime = 0;
    audio.onended = () => set({ playingId: null });
    void audio.play().catch(() => set({ playingId: null }));
    set({ playingId: asset.id });
  },

  stop: () => {
    const audio = getAudio();
    audio.pause();
    audio.currentTime = 0;
    set({ playingId: null });
  },
}));
