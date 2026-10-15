/**
 * base64 工具：导出 exe 时把二进制传给 Rust 用
 * 单独成文件，方便在 Node（冒烟测试）和浏览器里都能跑。
 */

/** Uint8Array -> base64（分块处理，避免大文件时超出调用栈） */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/** dataURL -> 纯 base64 部分（省一次解码再编码） */
export function dataUrlToBase64(dataUrl: string): string {
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}
