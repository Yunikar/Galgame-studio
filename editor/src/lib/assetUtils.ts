/**
 * 素材工具：把用户选择的 File 变成编辑器可用的 EditorAsset，
 * 以及 dataURL <-> Blob/Uint8Array 的互转（导出 zip / exe 时需要）。
 */
import { baseNameOf, extOf, safeName, uid, type AssetCategory, type EditorAsset } from '@gal/shared';

/** 素材大类 */
export type AssetKind = 'image' | 'audio' | 'unknown';

/** 根据 MIME 判断素材类别 */
export function kindOfMime(mime: string, filename = ''): AssetKind {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  const ext = extOf(filename);
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif'].includes(ext)) return 'image';
  if (['mp3', 'ogg', 'wav', 'm4a', 'aac', 'flac', 'opus'].includes(ext)) return 'audio';
  return 'unknown';
}

/** 各分类期望的素材类型，用于上传时提示 */
export const CATEGORY_KIND: Record<AssetCategory, AssetKind> = {
  backgrounds: 'image',
  sprites: 'image',
  bgms: 'audio',
  ses: 'audio',
  voices: 'audio',
};

/** 分类中文名 */
export const CATEGORY_TEXT: Record<AssetCategory, string> = {
  backgrounds: '背景图',
  sprites: '立绘',
  bgms: '背景音乐',
  ses: '音效',
  voices: '语音',
};

/** 读成 dataURL */
export function readFileAsDataURL(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** dataURL -> Uint8Array（导出文件时用） */
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',');
  const meta = dataUrl.slice(0, comma);
  const body = dataUrl.slice(comma + 1);
  if (meta.includes(';base64')) {
    const binary = atob(body);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  // 非 base64（少见）：按 URL 解码
  return new TextEncoder().encode(decodeURIComponent(body));
}

/** 探测音频时长（秒），失败返回 0 */
export function probeAudioDuration(dataUrl: string): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    let settled = false;
    const done = (value: number) => {
      if (settled) return;
      settled = true;
      audio.src = '';
      resolve(value);
    };
    audio.addEventListener('loadedmetadata', () =>
      done(Number.isFinite(audio.duration) ? audio.duration : 0),
    );
    audio.addEventListener('error', () => done(0));
    // 兜底：3 秒还没结果就放弃探测，避免卡住上传流程
    setTimeout(() => done(0), 3000);
    audio.src = dataUrl;
  });
}

/** File -> EditorAsset */
export async function fileToEditorAsset(
  file: File,
  category: AssetCategory,
  displayName?: string,
): Promise<EditorAsset> {
  const mime = file.type || 'application/octet-stream';
  const kind = kindOfMime(mime, file.name);
  const dataUrl = await readFileAsDataURL(file);
  const ext = extOf(file.name) || (kind === 'image' ? 'png' : kind === 'audio' ? 'mp3' : 'bin');
  const id = uid(kind === 'audio' ? 'snd' : 'img');
  const name = displayName?.trim() || baseNameOf(file.name);
  const path = `assets/${safeName(name)}_${id.slice(-6)}.${ext}`;

  return {
    id,
    name,
    path,
    category,
    dataUrl,
    mime,
    size: file.size,
    duration: kind === 'audio' ? await probeAudioDuration(dataUrl) : 0,
  };
}

/** 人类可读的文件大小 */
export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/** 人类可读的时长 */
export function formatDuration(seconds: number | undefined): string {
  if (!seconds || seconds <= 0) return '--:--';
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** 统计素材总体积 */
export function totalAssetSize(assets: Record<string, EditorAsset>): number {
  return Object.values(assets).reduce((sum, a) => sum + (a.size || 0), 0);
}
