/**
 * 节点图自动布局：用户点「整理布局」时调用。
 *
 * 布局原则：
 * - 链式节点（dialogue / showSprite / effect …）沿主链**从上到下**排；
 * - 遇到选项节点时，每个选项分支向**右侧扇开**，各占一列，
 *   分支内部再继续向下生长；
 * - 同一列的节点保持上下顺序，高的节点（选项）不会压住邻居。
 *
 * 这样整理后像一棵横向展开的剧情树：主线纵向推进，分支向右展开，
 * 解决了旧算法把多个概率分支全部叠在同一列的问题。
 */
import { getOptionTargets, type Scene, type StoryNode } from '@gal/shared';
import { NODE_WIDTH, estimateNodeHeight } from './nodeSize';
import type { NodePosition } from '../types/project';

/** 列间距：节点宽 228 + 留白 */
const COLUMN_GAP = NODE_WIDTH + 80;
/** 同列相邻节点之间的空隙 */
const ROW_GAP = 40;
const ORIGIN_X = 60;
const ORIGIN_Y = 60;

/** 取节点的所有出口（选项要把每个概率分支都算上） */
function exitsOf(node: StoryNode): string[] {
  if (node.type === 'choice') return node.options.flatMap((o) => getOptionTargets(o));
  if (node.type === 'jump' || node.type === 'ending') return [];
  return node.next ? [node.next] : [];
}

/** 构建「节点 -> 直接后继」的索引 */
function buildChildren(scene: Scene): Map<string, string[]> {
  const ids = new Set(scene.nodes.map((n) => n.id));
  const map = new Map<string, string[]>();
  for (const node of scene.nodes) {
    map.set(node.id, exitsOf(node).filter((id) => ids.has(id)));
  }
  return map;
}

/** 计算每个节点的入度（只考虑场景内的边） */
function computeInDegree(scene: Scene): Map<string, number> {
  const ids = new Set(scene.nodes.map((n) => n.id));
  const indeg = new Map<string, number>();
  for (const node of scene.nodes) indeg.set(node.id, 0);
  for (const node of scene.nodes) {
    for (const nextId of exitsOf(node)) {
      if (ids.has(nextId)) indeg.set(nextId, (indeg.get(nextId) ?? 0) + 1);
    }
  }
  return indeg;
}

/** 估算一棵子树占用的总宽度（以像素为单位） */
function measureSubtree(
  nodeId: string,
  children: Map<string, string[]>,
  visited: Set<string>,
): number {
  if (visited.has(nodeId)) return 0;
  visited.add(nodeId);

  const childIds = children.get(nodeId) ?? [];
  if (!childIds.length) return NODE_WIDTH;

  // 链式节点：子树宽度 = 下一个节点的宽度（列不变）
  if (childIds.length === 1) {
    const childWidth = measureSubtree(childIds[0]!, children, new Set(visited));
    return Math.max(NODE_WIDTH, childWidth);
  }

  // 选项节点：各分支子树宽度之和 + 间隙
  let total = 0;
  for (const childId of childIds) {
    total += measureSubtree(childId, children, new Set(visited));
  }
  total += (childIds.length - 1) * COLUMN_GAP;
  return Math.max(NODE_WIDTH, total);
}

/** 估算一棵子树占用的总高度（以像素为单位） */
function measureSubtreeHeight(
  scene: Scene,
  nodeId: string,
  children: Map<string, string[]>,
  visited: Set<string>,
): number {
  if (visited.has(nodeId)) return 0;
  visited.add(nodeId);

  const node = scene.nodes.find((n) => n.id === nodeId);
  if (!node) return 0;

  const childIds = children.get(nodeId) ?? [];
  const selfHeight = estimateNodeHeight(node);
  if (!childIds.length) return selfHeight;

  // 链式节点：高度 = 自身 + 空隙 + 子节点高度
  if (childIds.length === 1) {
    return selfHeight + ROW_GAP + measureSubtreeHeight(scene, childIds[0]!, children, new Set(visited));
  }

  // 选项节点：高度 = 自身 + 空隙 + 各分支高度之和 + 分支间空隙
  let childrenHeight = 0;
  for (const childId of childIds) {
    childrenHeight += measureSubtreeHeight(scene, childId, children, new Set(visited));
  }
  childrenHeight += (childIds.length - 1) * ROW_GAP;
  return selfHeight + ROW_GAP + childrenHeight;
}

/**
 * 递归布局。
 *
 * @param nodeId     当前节点
 * @param x          当前节点左上角 x
 * @param y          当前节点左上角 y
 * @param scene      当前场景
 * @param children   子节点索引
 * @param positions  输出位置
 * @param placed     已经放置过的节点（防止共享子图被重复布局）
 * @returns          这棵树实际占用的总宽度
 */
function layoutSubtree(
  nodeId: string,
  x: number,
  y: number,
  scene: Scene,
  children: Map<string, string[]>,
  positions: Record<string, NodePosition>,
  placed: Set<string>,
): number {
  if (placed.has(nodeId)) return 0;
  placed.add(nodeId);

  const node = scene.nodes.find((n) => n.id === nodeId);
  if (!node) return 0;

  const childIds = children.get(nodeId) ?? [];
  const nodeHeight = estimateNodeHeight(node);
  positions[nodeId] = { x, y };

  if (!childIds.length) return NODE_WIDTH;

  // 链式节点：后继接在正下方，同一列
  if (childIds.length === 1) {
    const childWidth = layoutSubtree(
      childIds[0]!,
      x,
      y + nodeHeight + ROW_GAP,
      scene,
      children,
      positions,
      placed,
    );
    return Math.max(NODE_WIDTH, childWidth);
  }

  // 选项节点：每个分支各占一列，从当前节点右边开始横向扇开。
  // 为了让连线尽量平，分支按子树高度错落排列：矮的分支在上，高的在下。
  let branchX = x + COLUMN_GAP;
  let branchY = y + nodeHeight + ROW_GAP;
  let totalWidth = COLUMN_GAP;

  for (const childId of childIds) {
    const childWidth = measureSubtree(childId, children, new Set(placed));
    layoutSubtree(childId, branchX, branchY, scene, children, positions, placed);
    branchX += childWidth + COLUMN_GAP;
    const childHeight = measureSubtreeHeight(scene, childId, children, new Set(placed));
    branchY += childHeight + ROW_GAP;
    totalWidth += childWidth + COLUMN_GAP;
  }

  return Math.max(NODE_WIDTH, totalWidth - COLUMN_GAP);
}

/** 生成布局 */
export function autoLayoutScene(scene: Scene): Record<string, NodePosition> {
  const children = buildChildren(scene);
  const indeg = computeInDegree(scene);

  const positions: Record<string, NodePosition> = {};
  const placed = new Set<string>();

  // 根节点：入度为 0。没有根时拿第一个节点兜底
  const roots = scene.nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0);
  const orderedRoots = roots.length ? roots : scene.nodes.length ? [scene.nodes[0]] : [];

  let currentX = ORIGIN_X;
  for (const root of orderedRoots) {
    const rootWidth = layoutSubtree(root.id, currentX, ORIGIN_Y, scene, children, positions, placed);
    currentX += rootWidth + COLUMN_GAP;
  }

  // 孤立节点统一放在最下面一排
  let orphanY = ORIGIN_Y;
  for (const node of scene.nodes) {
    if (!positions[node.id]) {
      positions[node.id] = { x: ORIGIN_X, y: orphanY };
      orphanY += estimateNodeHeight(node) + ROW_GAP;
    }
  }

  return positions;
}

/** 新节点落点时用到的列间距（与自动布局保持一致） */
export const LAYOUT_COLUMN_GAP = COLUMN_GAP;
