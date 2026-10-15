/**
 * 生成 Tauri 需要的图标（不依赖任何图形库，直接手写 PNG / ICO）
 *
 * 为什么自己画：Tauri 打包要求 icons/ 目录里存在指定文件，
 * 而装 sharp / canvas 这类库只为了几张图标并不划算。
 * 这里用 zlib 手写一个合法的 PNG，再把 PNG 塞进 ICO 容器即可。
 *
 * 用法：node scripts/make-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');

/* ---------------- PNG 基础 ---------------- */

/** CRC32 查表 */
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** 组装一个 PNG 数据块 */
function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

/**
 * 把 RGBA 像素数组编码成 PNG。
 * @param {number} size 边长
 * @param {(x:number,y:number)=>[number,number,number,number]} paint 返回 [r,g,b,a]
 */
function encodePng(size, paint) {
  // 每行开头有一个 filter 字节（0 = 不滤波）
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let offset = 0;
  for (let y = 0; y < size; y += 1) {
    raw[offset] = 0;
    offset += 1;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = paint(x, y);
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      raw[offset + 3] = a;
      offset += 4;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 位深
  ihdr[9] = 6; // 颜色类型：RGBA
  ihdr[10] = 0; // 压缩方式
  ihdr[11] = 0; // 滤波方式
  ihdr[12] = 0; // 隔行扫描

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------------- 图标图形 ---------------- */

/** 圆角矩形的覆盖率（带一点抗锯齿，边缘更干净） */
function roundedRectCoverage(x, y, size, radius, inset) {
  const left = inset;
  const top = inset;
  const right = size - inset;
  const bottom = size - inset;
  // 到圆角矩形的有符号距离
  const cx = Math.min(Math.max(x + 0.5, left + radius), right - radius);
  const cy = Math.min(Math.max(y + 0.5, top + radius), bottom - radius);
  const dx = x + 0.5 - cx;
  const dy = y + 0.5 - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  // 直边区域直接判断是否在矩形内
  const insideBox = x + 0.5 >= left && x + 0.5 <= right && y + 0.5 >= top && y + 0.5 <= bottom;
  if (!insideBox) return 0;
  const d = dist - radius;
  if (d <= -0.5) return 1;
  if (d >= 0.5) return dist > radius + 0.5 ? 0 : 1;
  return 1 - (d + 0.5);
}

/** 图标的绘制函数：蓝紫渐变底 + 白色对话框 + 播放三角 */
function paintIcon(size) {
  const radius = size * 0.235;
  const inset = size * 0.055;

  // 对话框（白色圆角矩形）
  const boxInset = size * 0.22;
  const boxRadius = size * 0.075;
  // 三角（代替"下一句"的箭头）
  const triLeft = size * 0.41;
  const triRight = size * 0.66;
  const triTop = size * 0.34;
  const triBottom = size * 0.6;

  return (x, y) => {
    const bgAlpha = roundedRectCoverage(x, y, size, radius, inset);
    if (bgAlpha <= 0) return [0, 0, 0, 0];

    // 渐变底色：左上偏蓝，右下偏紫
    const t = (x + y) / (size * 2);
    const r = Math.round(59 + t * 40);
    const g = Math.round(110 - t * 30);
    const b = Math.round(214 + t * 20);

    const boxAlpha = roundedRectCoverage(x, y, size, boxRadius, boxInset);
    if (boxAlpha > 0) {
      // 对话框里的三角：在三角内部就用底色，形成镂空效果
      const px = x + 0.5;
      const py = y + 0.5;
      const inTriangle =
        py >= triTop && py <= triBottom && px >= triLeft && px <= triRight - ((py - triTop) / (triBottom - triTop)) * (triRight - triLeft) * 0.5;
      if (inTriangle) {
        return [r, g, b, Math.round(255 * bgAlpha)];
      }
      return [255, 255, 255, Math.round(255 * bgAlpha * boxAlpha)];
    }

    return [r, g, b, Math.round(255 * bgAlpha)];
  };
}

/* ---------------- ICO 容器 ---------------- */

/**
 * 把若干张 PNG 塞进 ICO 文件。
 * @param {{size:number, png:Buffer}[]} images
 */
function encodeIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  const entries = [];
  let offset = 6 + images.length * 16;

  for (const image of images) {
    const entry = Buffer.alloc(16);
    entry[0] = image.size >= 256 ? 0 : image.size; // 0 表示 256
    entry[1] = image.size >= 256 ? 0 : image.size;
    entry[2] = 0; // 调色板数量
    entry[3] = 0; // reserved
    entry.writeUInt16LE(1, 4); // 色彩平面
    entry.writeUInt16LE(32, 6); // 位深
    entry.writeUInt32LE(image.png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += image.png.length;
    entries.push(entry);
  }

  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

/* ---------------- 输出 ---------------- */

/** 把图标写到指定 src-tauri 目录 */
function writeIcons(srcTauriDir, label) {
  const dir = join(srcTauriDir, 'icons');
  mkdirSync(dir, { recursive: true });

  const sizes = [32, 128, 256];
  const rendered = sizes.map((size) => ({ size, png: encodePng(size, paintIcon(size)) }));

  writeFileSync(join(dir, '32x32.png'), rendered[0].png);
  writeFileSync(join(dir, '128x128.png'), rendered[1].png);
  writeFileSync(join(dir, '128x128@2x.png'), rendered[2].png);
  writeFileSync(join(dir, 'icon.png'), rendered[2].png);
  // Windows 用 ico（同时塞 32 与 256，任务栏/资源管理器都清晰）
  writeFileSync(join(dir, 'icon.ico'), encodeIco([rendered[0], rendered[2]]));
  // macOS / Linux 兜底
  writeFileSync(join(dir, 'icon.icns'), rendered[2].png);

  console.log(`[图标] ${label}：${sizes.join('/')}px PNG + icon.ico 已生成`);
}

writeIcons(join(repoRoot, 'editor', 'src-tauri'), '编辑器');
writeIcons(join(repoRoot, 'runtime', 'src-tauri'), '游戏播放器');
