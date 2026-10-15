/**
 * 节点卡片在画布上的尺寸估算。
 *
 * ⚠️ 这里的数字必须和 StoryNodeView 的样式对得上 —— 估小了会直接表现为
 * 「整理布局之后节点还是压在一起」。宁可估大一点，多留白比重叠好。
 *
 * 用途：自动布局（算同列间距）、新节点落点（避开已有节点）。
 */
import type { ChoiceNode, ChoiceOption, StoryNode } from '@gal/shared';

/** 卡片宽度：StoryNodeView 里写死的 w-[228px] */
export const NODE_WIDTH = 228;

/* 卡片内部的高度构成（px，对照 StoryNodeView 的 class） */
/** 头部：px-2.5 py-1.5 + 一行文字 + 下边框 */
const HEADER_H = 30;
/** 主体上下内边距：px-2.5 py-2 */
const BODY_PAD_H = 16;
/** 主内容一行（text-[12.5px] font-semibold） */
const TITLE_H = 19;
/** 次要信息两行（line-clamp-2 text-[11.5px] leading-relaxed）——按最坏情况算满两行 */
const DETAIL_H = 36;
/** 选项列表的顶部间隔 + 每个选项块自身的高度 */
const OPTION_LIST_GAP = 4;
const OPTION_ROW_H = 28;
/** 选项块里概率分支区的顶部（虚线 + pt-1）与每条分支一行 */
const BRANCH_AREA_TOP = 5;
const BRANCH_ROW_H = 16;

/** 一个选项块的高度（本体那一行 + 有分支时的分支列表） */
function optionHeight(option: ChoiceOption): number {
  const branches = option.branches?.length ?? 0;
  return OPTION_ROW_H + (branches ? BRANCH_AREA_TOP + branches * BRANCH_ROW_H : 0);
}

/** 估算节点卡片高度：所有类型都有「主内容 + 次要信息」两行，选项节点再叠加选项列表 */
export function estimateNodeHeight(node: StoryNode): number {
  const base = HEADER_H + BODY_PAD_H + TITLE_H + DETAIL_H;
  if (node.type !== 'choice') return base;
  return base + OPTION_LIST_GAP + node.options.reduce((sum, o) => sum + optionHeight(o), 0);
}

/**
 * 选项在卡片内的垂直中点（相对卡片顶部）。
 * 新节点接到某个选项上时，落点对准这个选项，连线才是平的。
 * 找不到该选项时返回卡片中部。
 */
export function choiceOptionOffset(node: ChoiceNode, optionId: string): number {
  const base = HEADER_H + BODY_PAD_H + TITLE_H + DETAIL_H + OPTION_LIST_GAP;
  let y = base;
  for (const option of node.options) {
    const height = optionHeight(option);
    if (option.id === optionId) return y + height / 2;
    y += height;
  }
  return HEADER_H + estimateNodeHeight(node) / 2;
}
