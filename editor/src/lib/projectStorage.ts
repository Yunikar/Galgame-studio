/**
 * 本地持久化：
 * - 项目结构（story / layout / 素材元数据）存 localStorage，体积极小
 * - 素材二进制存 IndexedDB（localStorage 只有约 5MB，放不下图片音频）
 * 这样既满足"本地存储"的要求，又不会一上传几张图就爆配额。
 */
import { normalizeStory, type EditorAsset } from '@gal/shared';
import { PROJECT_FILE_VERSION, createProject, type ProjectData } from '../types/project';
import { getAllAssetRecords, putAssetRecord, clearAssetRecords, deleteAssetRecord } from './idb';

const LS_KEY = 'galgame-editor.project.v1';
/** 兼容旧键名，读取时顺带清理 */
const LEGACY_KEYS = ['galgame.project'];

/** localStorage 里存的轻量素材元数据（不含 dataUrl） */
type AssetMeta = Omit<EditorAsset, 'dataUrl'>;

type StoredProject = {
  fileVersion: string;
  story: ProjectData['story'];
  assetMeta: AssetMeta[];
  layout: ProjectData['layout'];
  savedAt: string;
};

/** 保存项目到本地 */
export async function saveProjectLocal(data: ProjectData): Promise<{ ok: boolean; message?: string }> {
  try {
    const assetMeta: AssetMeta[] = Object.values(data.assets).map(({ dataUrl: _d, ...meta }) => meta);
    const payload: StoredProject = {
      fileVersion: PROJECT_FILE_VERSION,
      story: data.story,
      assetMeta,
      layout: data.layout,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
  } catch (error) {
    return { ok: false, message: `项目结构保存失败（可能是浏览器存储被禁用）：${String(error)}` };
  }

  // 素材二进制写 IndexedDB
  try {
    const existing = new Set((await getAllAssetRecords()).map((r) => r.id));
    for (const asset of Object.values(data.assets)) {
      await putAssetRecord({ id: asset.id, dataUrl: asset.dataUrl });
      existing.delete(asset.id);
    }
    // 清掉已经不在项目里的素材，避免仓库越滚越大
    for (const orphanId of existing) await deleteAssetRecord(orphanId);
  } catch (error) {
    return { ok: false, message: `素材写入本地数据库失败：${String(error)}` };
  }

  return { ok: true };
}

/** 从本地读取项目 */
export async function loadProjectLocal(): Promise<ProjectData | null> {
  let raw = localStorage.getItem(LS_KEY);

  if (!raw) {
    for (const legacy of LEGACY_KEYS) {
      const legacyRaw = localStorage.getItem(legacy);
      if (legacyRaw) {
        raw = legacyRaw;
        localStorage.removeItem(legacy);
        break;
      }
    }
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredProject> & { assets?: Record<string, EditorAsset> };

    // 兼容更早的版本：assets 直接是 Record 且内嵌 dataUrl
    const metaList: AssetMeta[] = parsed.assetMeta
      ? parsed.assetMeta
      : Object.values(parsed.assets ?? {}).map(({ dataUrl: _d, ...meta }) => meta);

    const records = await getAllAssetRecords();
    const dataUrlById = new Map(records.map((r) => [r.id, r.dataUrl]));

    const assets: Record<string, EditorAsset> = {};
    for (const meta of metaList) {
      const dataUrl = dataUrlById.get(meta.id) ?? '';
      assets[meta.id] = { ...meta, dataUrl };
    }

    return {
      fileVersion: parsed.fileVersion ?? PROJECT_FILE_VERSION,
      story: normalizeStory(parsed.story),
      assets,
      layout: parsed.layout ?? {},
      savedAt: parsed.savedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/** 清空本地项目数据 */
export async function clearProjectLocal(): Promise<void> {
  localStorage.removeItem(LS_KEY);
  for (const legacy of LEGACY_KEYS) localStorage.removeItem(legacy);
  await clearAssetRecords();
}

/** 把 .galproj 文件内容解析成 ProjectData */
export function parseProjectFile(text: string): ProjectData {
  const parsed = JSON.parse(text) as Partial<ProjectData>;
  const assets: Record<string, EditorAsset> = {};
  for (const [id, asset] of Object.entries(parsed.assets ?? {})) {
    if (!asset) continue;
    assets[id] = {
      id: asset.id ?? id,
      name: asset.name ?? '素材',
      path: asset.path ?? `assets/${id}`,
      category: asset.category ?? 'backgrounds',
      dataUrl: asset.dataUrl ?? '',
      mime: asset.mime ?? 'application/octet-stream',
      size: asset.size ?? 0,
      duration: asset.duration ?? 0,
    };
  }

  return {
    fileVersion: parsed.fileVersion ?? PROJECT_FILE_VERSION,
    story: normalizeStory(parsed.story),
    assets,
    layout: parsed.layout ?? {},
    savedAt: parsed.savedAt ?? new Date().toISOString(),
  };
}

/** 把项目序列化成 .galproj 文本 */
export function stringifyProjectFile(data: ProjectData): string {
  return JSON.stringify({ ...data, savedAt: new Date().toISOString() }, null, 2);
}

export { createProject };
