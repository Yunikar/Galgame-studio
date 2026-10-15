/**
 * id 生成工具
 */

let counter = 0;

/** 生成一个稳定唯一的 id（带业务前缀，方便调试时肉眼识别） */
export function uid(prefix = 'id'): string {
  counter += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${rand}`;
}

/** 从文件名里取出扩展名（小写，不含点） */
export function extOf(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx >= 0 ? filename.slice(idx + 1).toLowerCase() : '';
}

/** 去掉文件名的扩展名 */
export function baseNameOf(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx >= 0 ? filename.slice(0, idx) : filename;
}

/** 把素材名洗成安全的文件名片段 */
export function safeName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[\\/:*?"<>|\s]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 40);
  return cleaned || 'asset';
}
