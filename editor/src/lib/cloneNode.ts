/**
 * 复制节点：生成一个全新的节点副本（含新的 id）
 */
import { uid, type StoryNode } from '@gal/shared';

export function cloneNode(node: StoryNode): StoryNode {
  const id = uid(node.type);

  if (node.type === 'choice') {
    return {
      ...node,
      id,
      options: node.options.map((o) => ({
        ...o,
        id: uid('opt'),
        // 概率分支也要换新 id，避免和原节点的分支撞车
        branches: o.branches?.map((b) => ({ ...b, id: uid('branch') })),
      })),
    };
  }

  return { ...node, id };
}
