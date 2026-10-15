/**
 * 文件读写：统一浏览器 / Tauri 桌面版两条路径
 *
 * 浏览器：File System Access API（优先）+ 下载兜底
 * Tauri：文件操作全部由 Rust 命令完成（save_bytes / save_text / open_text），
 *        前端只负责传数据，不用关心权限和路径作用域。
 */

/** 是否运行在 Tauri 桌面容器里 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** 是否支持 File System Access API（Chrome / Edge） */
export function supportsFileSystemAccess(): boolean {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
}

export type FileFilter = { name: string; extensions: string[] };
export type SaveOutcome = 'saved' | 'downloaded' | 'cancelled' | 'failed';

/** 浏览器下载兜底 */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // 稍后释放，避免下载被中断
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Uint8Array -> base64（传给 Rust 用） */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/** 判断 Rust 返回的错误是不是"用户取消了对话框" */
function isCancelled(error: unknown): boolean {
  return String(error).includes('cancelled');
}

/**
 * 保存二进制文件。
 * 三种环境自动选择最合适的方式。
 */
export async function saveFile(
  bytes: Uint8Array,
  suggestedName: string,
  mime: string,
  filters: FileFilter[],
): Promise<SaveOutcome> {
  // 1. Tauri 桌面版：交给 Rust 弹系统对话框并落盘
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const path = await invoke<string | null>('save_bytes', {
        data: bytesToBase64(bytes),
        suggestedName,
        filterName: filters[0]?.name ?? null,
        filterExt: filters[0]?.extensions ?? null,
      });
      return path ? 'saved' : 'cancelled';
    } catch (error) {
      if (isCancelled(error)) return 'cancelled';
      console.error('[保存] Tauri 写文件失败', error);
      return 'failed';
    }
  }

  // 2. 浏览器 + File System Access API
  if (supportsFileSystemAccess()) {
    try {
      const handle = await (
        window as unknown as {
          showSaveFilePicker: (opts: unknown) => Promise<{
            createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>;
          }>;
        }
      ).showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: filters[0]?.name ?? '文件',
            accept: { [mime]: filters[0]?.extensions.map((e) => `.${e}`) ?? [] },
          },
        ],
      });
      const writable = await handle.createWritable();
      // 复制一份独立的 ArrayBuffer，规避 SharedArrayBuffer 类型问题
      const buffer = new Uint8Array(bytes).buffer;
      await writable.write(new Blob([buffer], { type: mime }));
      await writable.close();
      return 'saved';
    } catch (error) {
      const name = (error as { name?: string })?.name;
      if (name === 'AbortError') return 'cancelled';
      // 其他错误（如权限）退回下载
      triggerDownload(new Blob([new Uint8Array(bytes).buffer], { type: mime }), suggestedName);
      return 'downloaded';
    }
  }

  // 3. 下载兜底
  triggerDownload(new Blob([new Uint8Array(bytes).buffer], { type: mime }), suggestedName);
  return 'downloaded';
}

/**
 * 打开一个文本文件。
 * 返回 null 表示用户取消。
 */
export async function openTextFile(filters: FileFilter[]): Promise<{ name: string; text: string } | null> {
  // 1. Tauri 桌面版
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<{ name: string; text: string } | null>('open_text', {
        filterName: filters[0]?.name ?? null,
        filterExt: filters[0]?.extensions ?? null,
      });
      return result;
    } catch (error) {
      if (isCancelled(error)) return null;
      console.error('[打开] Tauri 读取失败', error);
      return null;
    }
  }

  // 2. 浏览器 + File System Access API
  if (supportsFileSystemAccess()) {
    try {
      const handles = await (
        window as unknown as {
          showOpenFilePicker: (opts: unknown) => Promise<{ getFile: () => Promise<File>; name: string }[]>;
        }
      ).showOpenFilePicker({
        multiple: false,
        types: [
          {
            description: filters[0]?.name ?? '文件',
            accept: { 'application/json': filters[0]?.extensions.map((e) => `.${e}`) ?? [] },
          },
        ],
      });
      const handle = handles[0];
      const file = await handle.getFile();
      return { name: handle.name, text: await file.text() };
    } catch (error) {
      const name = (error as { name?: string })?.name;
      if (name === 'AbortError') return null;
      // 退回 input 选择
    }
  }

  return openViaInput(filters);
}

/** input[type=file] 兜底 */
function openViaInput(filters: FileFilter[]): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = filters[0]?.extensions.map((e) => `.${e}`).join(',') ?? '*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      resolve({ name: file.name, text: await file.text() });
    };
    // 用户直接关掉选择框时不会触发 change，靠 focus 兜底
    window.addEventListener(
      'focus',
      () => {
        setTimeout(() => {
          if (!input.files?.length) resolve(null);
        }, 500);
      },
      { once: true },
    );
    input.click();
  });
}
