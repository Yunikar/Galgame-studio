/**
 * 导出页面的 HTML 改写
 *
 * 单独成文件的原因：这段字符串处理最容易出错（正则、内联脚本转义），
 * 抽出来就能脱离浏览器直接跑测试。
 *
 * 改写要做三件事：
 * 1. 换成作品标题
 * 2. 内联剧本（file:// 下 fetch 会被浏览器拦掉，只能写死在页面里）
 * 3. 内联 CSS、把 module 入口换成带 defer 的普通脚本（file:// 不支持 ES module）
 */

/** 只做 HTML 转义，用于标题 */
export function escapeHtml(text: string): string {
  return text.replace(/[<>&]/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[ch] ?? ch);
}

/** 内联 JSON 时要避开会提前结束脚本标签的片段 */
export function escapeInlineJson(json: string): string {
  return json.replace(/<\//g, '<\\/').replace(/<!--/g, '<\\!--');
}

/** 从 href/src 里取出模板内的文件名（去掉 ./ 前缀与查询串） */
function fileNameOf(url: string): string {
  return url.replace(/^\.?\//, '').split('?')[0];
}

export type TemplateFiles = Map<string, Uint8Array>;

/**
 * 改写运行时模板的 index.html。
 * @param templateHtml 模板原始 HTML
 * @param title 作品标题
 * @param storyJson 剧本 JSON 文本
 * @param templateFiles 模板内所有文件（用于内联 CSS）
 */
export function buildIndexHtml(
  templateHtml: string,
  title: string,
  storyJson: string,
  templateFiles: TemplateFiles,
): string {
  const decoder = new TextDecoder();
  let html = templateHtml;

  // 1. 标题
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);

  // 2. 内联样式：<link rel="stylesheet" href="..."> -> <style>
  html = html.replace(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi, (tag) => {
    const href = /href=["']([^"']+)["']/i.exec(tag)?.[1];
    if (!href) return '';
    const bytes = templateFiles.get(fileNameOf(href));
    if (!bytes) return tag;
    return `<style>\n${decoder.decode(bytes)}\n</style>`;
  });

  // 3. 入口脚本：去掉 type="module"/crossorigin，并补上 defer
  //    普通脚本会立刻执行，那时 <div id="root"> 还没解析出来。
  let entryScript = '';
  html = html.replace(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>\s*<\/script>/gi, (tag, src: string) => {
    const name = fileNameOf(src);
    if (!templateFiles.has(name)) return tag;
    entryScript = `<script defer src="./${name}"></script>`;
    return entryScript;
  });

  // 4. 剧本内联脚本，必须排在入口脚本之前（入口要做完 HTML 解析才跑）
  const inline = `<script>window.__GALGAME_STORY__=${escapeInlineJson(storyJson)};</script>`;
  if (entryScript && html.includes(entryScript)) {
    html = html.replace(entryScript, `${inline}\n    ${entryScript}`);
  } else if (/<\/body>/i.test(html)) {
    html = html.replace(/<\/body>/i, `    ${inline}\n  </body>`);
  } else {
    html += inline;
  }

  return html;
}
