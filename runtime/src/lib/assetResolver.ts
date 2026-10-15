/**
 * 素材解析：把 assetId 变成 <img src> / <audio src> 能用的地址
 *
 * 三种运行环境：
 * 1. 编辑器内嵌预览：直接用 dataURL（由编辑器传进来）
 * 2. Web 版：素材是游戏目录下的 assets/xxx.png，用相对路径
 * 3. Tauri 桌面版：exe 同目录下的文件，用 Rust 命令读成 dataURL（不必开 asset 协议）
 */
import type { Asset, Story } from '@gal/shared';

/** assetId -> 可用地址 */
export type AssetResolver = (assetId: string) => string | undefined;

/** 是否运行在 Tauri 桌面容器 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** 固定映射（编辑器预览、Tauri 预读）用这个 */
export function createMapResolver(map: Record<string, string>): AssetResolver {
  return (assetId) => map[assetId];
}

/** Web 版：把 asset.path 解析成浏览器可用 URL */
export function createPathResolver(story: Story): AssetResolver {
  const byId = new Map<string, Asset>();
  for (const category of ['backgrounds', 'sprites', 'bgms', 'ses', 'voices'] as const) {
    for (const asset of story[category]) byId.set(asset.id, asset);
  }

  return (assetId) => {
    const asset = byId.get(assetId);
    if (!asset?.path) return undefined;
    try {
      // 相对当前页面解析：http(s) 与 file:// 都能用
      return new URL(asset.path, document.baseURI).href;
    } catch {
      return asset.path;
    }
  };
}

/** 收集剧本里所有素材路径 */
export function collectAssetPaths(story: Story): { id: string; path: string }[] {
  const list: { id: string; path: string }[] = [];
  for (const category of ['backgrounds', 'sprites', 'bgms', 'ses', 'voices'] as const) {
    for (const asset of story[category]) {
      if (asset.path) list.push({ id: asset.id, path: asset.path });
    }
  }
  return list;
}

/** base64 -> dataURL */
export function base64ToDataUrl(base64: string, mime: string): string {
  return `data:${mime};base64,${base64}`;
}

/** 根据文件扩展名猜 MIME（Tauri 读文件时用） */
export function mimeFromPath(path: string): string {
  const ext = path.slice(path.lastIndexOf('.') + 1).toLowerCase();
  const table: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    bmp: 'image/bmp',
    avif: 'image/avif',
    mp3: 'audio/mpeg',
    ogg: 'audio/ogg',
    wav: 'audio/wav',
    m4a: 'audio/mp4',
    aac: 'audio/aac',
    flac: 'audio/flac',
    opus: 'audio/opus',
  };
  return table[ext] ?? 'application/octet-stream';
}

/**
 * Tauri 桌面版：把游戏目录里的全部素材读成 dataURL。
 * 短篇游戏素材总量不大（几 MB~几十 MB），一次性读进内存最简单也最稳。
 */
export async function loadTauriAssetMap(
  story: Story,
  onProgress?: (done: number, total: number) => void,
): Promise<Record<string, string>> {
  const { invoke } = await import('@tauri-apps/api/core');
  const entries = collectAssetPaths(story);
  const map: Record<string, string> = {};
  let done = 0;

  await Promise.all(
    entries.map(async (entry) => {
      try {
        const base64 = await invoke<string | null>('read_game_file', { rel: entry.path });
        if (base64) map[entry.id] = base64ToDataUrl(base64, mimeFromPath(entry.path));
      } catch {
        // 单个素材读失败不影响整体，游戏里会显示占位
      } finally {
        done += 1;
        onProgress?.(done, entries.length);
      }
    }),
  );

  return map;
}

/** Tauri 桌面版：读取游戏目录下的 story.json */
export async function readTauriStory(): Promise<unknown | null> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const text = await invoke<string | null>('read_game_text_file', { rel: 'story.json' });
    if (!text) return null;
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}
