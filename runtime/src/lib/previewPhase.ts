/**
 * 内嵌预览的起始阶段判定。
 *
 * 单独放一个纯模块（不依赖任何 React 组件），
 * 这样测试脚本可以直接 import 它做回归验证。
 */

/** 预览当前处在哪个阶段 */
export type PreviewPhase = 'opening' | 'title' | 'playing';

/** 阶段的中文名（工具栏提示用） */
export const PREVIEW_PHASE_LABELS: Record<PreviewPhase, string> = {
  opening: '开场图',
  title: '标题画面',
  playing: '游戏画面',
};

/**
 * 预览第一帧该显示什么。
 *
 * - 没勾「从标题画面开始」：和以前一样，直接进游戏画面
 * - 勾了、且剧本配了开场图（且素材能解析出来）：先播开场图
 * - 勾了但没配开场图：直接进标题画面
 */
export function resolveInitialPhase(fromTitle: boolean, hasOpeningImage: boolean): PreviewPhase {
  if (!fromTitle) return 'playing';
  return hasOpeningImage ? 'opening' : 'title';
}
