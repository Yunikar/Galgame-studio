/**
 * 剧本索引与遍历工具
 * 运行时和编辑器校验都依赖这里的"场景 -> 节点"查找能力。
 */
import { getNextId, getOptionTargets, isChainNode } from './story';
import type { Scene, Story, StoryNode } from './types';

/** 剧本索引：把嵌套结构拍平，便于 O(1) 查找 */
export type StoryIndex = {
  story: Story;
  sceneById: Map<string, Scene>;
  /** 节点 id -> { 节点, 所属场景 } */
  nodeById: Map<string, { node: StoryNode; scene: Scene }>;
};

/** 建立索引 */
export function buildStoryIndex(story: Story): StoryIndex {
  const sceneById = new Map<string, Scene>();
  const nodeById = new Map<string, { node: StoryNode; scene: Scene }>();

  for (const scene of story.scenes) {
    sceneById.set(scene.id, scene);
    for (const node of scene.nodes) {
      // 节点 id 全局唯一，若重复则后者覆盖前者（校验阶段会报出来）
      nodeById.set(node.id, { node, scene });
    }
  }

  return { story, sceneById, nodeById };
}

/** 取下一个节点的 id（选项/跳转/结局节点没有唯一后续，返回 undefined） */
export function nextNodeIdOf(node: StoryNode): string | undefined {
  return getNextId(node);
}

/** 沿 next 链找到节点所在场景中的下一个节点对象；跨场景不自动跟随 */
export function findNode(index: StoryIndex, nodeId: string): StoryNode | undefined {
  return index.nodeById.get(nodeId)?.node;
}

/** 场景里按顺序找节点（用节点图顺序定位"下一段"很常用） */
export function nodeOrderInScene(scene: Scene, nodeId: string): number {
  return scene.nodes.findIndex((n) => n.id === nodeId);
}

/** 取场景第一个节点，作为"没有连线时的默认起点" */
export function firstNodeOf(scene: Scene | undefined): StoryNode | undefined {
  return scene?.nodes[0];
}

/** 从某节点开始，收集它向后可达的所有节点（含跨场景 jump），用于"这段剧情会不会走到结局"判断 */
export function collectReachable(index: StoryIndex, startNodeId: string): Set<string> {
  const visited = new Set<string>();
  const queue: string[] = [startNodeId];

  while (queue.length) {
    const currentId = queue.shift()!;
    if (!currentId || visited.has(currentId)) continue;
    visited.add(currentId);

    const entry = index.nodeById.get(currentId);
    if (!entry) continue;
    const node = entry.node;

    if (node.type === 'choice') {
      // 一个选项可能挂着多个概率分支，每条都要算进可达范围
      for (const opt of node.options) {
        for (const target of getOptionTargets(opt)) queue.push(target);
      }
    } else if (node.type === 'jump') {
      const target = index.sceneById.get(node.targetSceneId);
      if (target) for (const n of target.nodes) queue.push(n.id);
    } else {
      const next = getNextId(node);
      if (next) queue.push(next);
    }
  }

  return visited;
}

/** 从起点场景开始，收集整个剧本里可达的节点（用于"孤岛节点"检测） */
export function collectReachableFromStart(index: StoryIndex): Set<string> {
  const startScene = index.sceneById.get(index.story.startSceneId);
  const visited = new Set<string>();
  if (!startScene) return visited;

  const queue: string[] = startScene.nodes.map((n) => n.id);
  while (queue.length) {
    const id = queue.shift()!;
    if (!id || visited.has(id)) continue;
    const sub = collectReachable(index, id);
    for (const s of sub) {
      if (!visited.has(s)) {
        visited.add(s);
        queue.push(s);
      }
    }
  }
  return visited;
}

/** 节点是否"有出口"（有 next，或是 choice/jump/ending 这类终止型节点） */
export function hasExit(node: StoryNode): boolean {
  if (!isChainNode(node)) return true;
  return !!node.next;
}
