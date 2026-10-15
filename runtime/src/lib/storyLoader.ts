/**
 * 剧本加载：按环境决定从哪里拿 story
 * 优先级：编辑器注入 / 页面内联（导出的 Web 版）/ Tauri 游戏目录 / 页面同目录 story.json / 内置示例
 */
import { createExampleStory, normalizeStory, type Story } from '@gal/shared';
import { createPathResolver, isTauri, loadTauriAssetMap, readTauriStory, type AssetResolver } from './assetResolver';

/**
 * 页面内联的剧本。
 * 导出的 Web 版会把剧本直接写进 index.html，这样用户双击打开（file:// 协议）
 * 也能正常玩——因为 file:// 下浏览器会拦截 fetch，读不到 story.json。
 */
declare global {
  interface Window {
    __GALGAME_STORY__?: unknown;
  }
}

export type LoadedGame = {
  story: Story;
  resolveAsset: AssetResolver;
  /** 数据来源，显示在调试信息里 */
  source: 'editor' | 'tauri' | 'static' | 'example';
};

/** 从静态文件读 story.json（Web 版） */
async function fetchStoryJson(): Promise<unknown | null> {
  try {
    const response = await fetch(new URL('story.json', document.baseURI).href, { cache: 'no-store' });
    if (!response.ok) return null;
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

/**
 * 加载游戏数据。
 * 编辑器预览时可以先注入 story，再调用它。
 */
export async function loadGame(options?: {
  /** 编辑器注入的剧本（优先使用） */
  injectedStory?: unknown;
  /** 编辑器注入的素材映射 */
  injectedAssets?: Record<string, string>;
}): Promise<LoadedGame> {
  // 1. 编辑器注入
  if (options?.injectedStory) {
    return {
      story: normalizeStory(options.injectedStory),
      resolveAsset: (assetId) => options.injectedAssets?.[assetId],
      source: 'editor',
    };
  }

  // 2. 页面内联剧本（导出的 Web 版）：优先级高于读文件，保证 file:// 可用
  if (window.__GALGAME_STORY__) {
    const story = normalizeStory(window.__GALGAME_STORY__);
    return { story, resolveAsset: createPathResolver(story), source: 'static' };
  }

  // 3. Tauri 桌面版：exe 同目录
  if (isTauri()) {
    const raw = await readTauriStory();
    if (raw) {
      const story = normalizeStory(raw);
      const map = await loadTauriAssetMap(story);
      return { story, resolveAsset: (assetId) => map[assetId], source: 'tauri' };
    }
  }

  // 4. 页面同目录的 story.json（Web 版导出 / 静态托管）
  const raw = await fetchStoryJson();
  if (raw) {
    const story = normalizeStory(raw);
    return { story, resolveAsset: createPathResolver(story), source: 'static' };
  }

  // 5. 兜底：内置示例
  const story = createExampleStory();
  return { story, resolveAsset: createPathResolver(story), source: 'example' };
}
