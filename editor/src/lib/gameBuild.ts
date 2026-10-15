/**
 * 游戏产物组装：把「运行时模板 + story.json + assets/」拼成一份可直接运行的完整游戏目录。
 *
 * 这份结果是「导出 Web 版（zip）」和「导出 exe」共用的中间产物，
 * 两种导出只差最后一步的打包方式，前面完全一致，避免两套逻辑走偏。
 *
 * 产出的目录结构：
 *   index.html        游戏页面（剧本已内联，双击即可玩）
 *   app.js            游戏运行时（已编译）
 *   story.json        纯剧本数据（静态托管 / exe 版读取用）
 *   assets/xxx.png    素材文件
 */
import type { ProjectData } from '../types/project';
import { uid } from '@gal/shared';
import { packStoryAndAssets, type ProblemAsset } from './buildStory';
import { buildIndexHtml } from './htmlTemplate';
import { bytesToBase64 } from './base64';

/** 产物里的一个文件 */
export type BuildFile = {
  path: string;
  bytes: Uint8Array;
  /** 同一份内容的 base64（导出 exe 时直接传给 Rust） */
  base64: string;
};

/** 由字节数组造产物文件（bytes 与 base64 都要带上） */
function makeFile(path: string, bytes: Uint8Array): BuildFile {
  return { path, bytes, base64: bytesToBase64(bytes) };
}

/** 组装过程中的进度回调 */
export type BuildProgressReporter = (stage: string, done: number, total: number) => void;

export type MissingAsset = ProblemAsset;

export type BuildReport = {
  /** 全部产物文件 */
  files: BuildFile[];
  /** 剧本 JSON 文本（同时会写进 files 里的 story.json） */
  storyJson: string;
  /** 引用了但没文件的素材，导出后游戏里会显示占位 */
  missingAssets: MissingAsset[];
  /** 内容为空的素材 */
  emptyAssets: MissingAsset[];
  /** 产物总字节数 */
  totalBytes: number;
};

/** 运行时模板在编辑器里的位置（由 scripts/build-web-template.mjs 拷进来） */
function templateBase(): string {
  const base = import.meta.env.BASE_URL || '/';
  return base.endsWith('/') ? `${base}runtime-web/` : `${base}/runtime-web/`;
}

/** 把相对资源路径解析成可 fetch 的绝对地址 */
function toUrl(relativePath: string): string {
  try {
    return new URL(relativePath, document.baseURI).href;
  } catch {
    return relativePath;
  }
}

type TemplateManifest = { files: string[]; totalSize?: number };

/** 读取模板清单 */
async function loadManifest(): Promise<TemplateManifest> {
  const url = toUrl(`${templateBase()}manifest.json`);
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(
      '找不到游戏运行时模板。请先在项目根目录执行 npm run build:template（它会编译 runtime 并复制到 editor/public/runtime-web）。',
    );
  }
  const parsed = (await response.json()) as TemplateManifest;
  if (!Array.isArray(parsed.files) || parsed.files.length === 0) {
    throw new Error('运行时模板清单是空的，请重新执行 npm run build:template');
  }
  return parsed;
}

/** 按清单把模板文件读成字节 */
async function loadTemplateFiles(
  manifest: TemplateManifest,
  onProgress?: BuildProgressReporter,
): Promise<Map<string, Uint8Array>> {
  const result = new Map<string, Uint8Array>();
  let done = 0;

  await Promise.all(
    manifest.files.map(async (file) => {
      const response = await fetch(toUrl(`${templateBase()}${file}`), { cache: 'no-store' });
      if (response.ok) result.set(file, new Uint8Array(await response.arrayBuffer()));
      done += 1;
      onProgress?.('准备运行时', done, manifest.files.length);
    }),
  );

  return result;
}

/** 收到 zip 的人打开这份说明就知道怎么玩 */
function readmeText(title: string): string {
  return [
    `《${title}》`,
    '',
    '【怎么玩】',
    '直接双击 index.html 就能开始游戏（推荐 Chrome / Edge 浏览器）。',
    '也可以把这个文件夹整个上传到任意静态网站托管，得到在线链接分享给别人。',
    '',
    '【怎么操作】',
    '鼠标点击、空格键或回车键：继续下一句',
    '出现选项时：点你想选的那一项',
    '右下角「设置」：调文字速度和各种音量',
    '右下角「存档」：有 3 个存档位和 1 个自动存档',
    '',
    '【注意】',
    '存档保存在浏览器本地，换浏览器或清理浏览器数据会丢失。',
  ].join('\r\n');
}

/**
 * 组装游戏产物。
 * @param data 编辑器项目数据
 * @param onProgress 进度回调（用于导出弹窗的进度条）
 */
export async function assembleGameBuild(
  data: ProjectData,
  onProgress?: BuildProgressReporter,
): Promise<BuildReport> {
  const manifest = await loadManifest();
  const templateFiles = await loadTemplateFiles(manifest, onProgress);

  const indexInTemplate = templateFiles.get('index.html');
  if (!indexInTemplate) {
    throw new Error('运行时模板里缺少 index.html，请重新执行 npm run build:template');
  }

  // 1. 整理剧本与素材
  onProgress?.('整理剧本', 0, 1);
  const pack = packStoryAndAssets(data.story, data.assets);

  // 1.5 注入游戏实例 ID：结局解锁记录用它做 key。
  // 每次导出都是新 ID → 新导出的游戏结局全锁，不同批次的导出互不污染。
  // 只写进导出产物，不改编辑器里的项目数据。
  pack.story.meta.gameId = uid();

  const files: BuildFile[] = [...pack.files];

  // 2. story.json
  const storyJson = JSON.stringify(pack.story, null, 2);
  files.push(makeFile('story.json', new TextEncoder().encode(storyJson)));

  // 3. 运行时模板（index.html 要改写，单独处理）
  for (const [name, bytes] of templateFiles) {
    if (name === 'index.html' || name === 'manifest.json') continue;
    files.push(makeFile(name, bytes));
  }

  // 4. index.html（标题 + 内联剧本 + 内联样式）
  const html = buildIndexHtml(
    new TextDecoder().decode(indexInTemplate),
    pack.story.meta.title || '我的作品',
    storyJson,
    templateFiles,
  );
  files.push(makeFile('index.html', new TextEncoder().encode(html)));

  // 5. 游玩说明
  files.push(makeFile('如何游玩.txt', new TextEncoder().encode(readmeText(pack.story.meta.title || '我的作品'))));

  const totalBytes = files.reduce((sum, file) => sum + file.bytes.byteLength, 0);
  onProgress?.('组装完成', 1, 1);

  return {
    files,
    storyJson,
    missingAssets: pack.missing,
    emptyAssets: pack.empty,
    totalBytes,
  };
}
