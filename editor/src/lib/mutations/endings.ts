/**
 * 结局相关的纯函数变更
 */
import { createEnding, type Ending } from '@gal/shared';
import type { ProjectData } from '../../types/project';

/** 新增结局 */
export function addEnding(data: ProjectData, name?: string): ProjectData {
  const ending = createEnding(name ?? `结局 ${data.story.endings.length + 1}`);
  return { ...data, story: { ...data.story, endings: [...data.story.endings, ending] } };
}

/** 更新结局 */
export function updateEnding(data: ProjectData, id: string, patch: Partial<Ending>): ProjectData {
  return {
    ...data,
    story: {
      ...data.story,
      endings: data.story.endings.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    },
  };
}

/** 删除结局，并清掉引用它的结局节点 */
export function removeEnding(data: ProjectData, id: string): ProjectData {
  return {
    ...data,
    story: {
      ...data.story,
      endings: data.story.endings.filter((e) => e.id !== id),
      scenes: data.story.scenes.map((scene) => ({
        ...scene,
        nodes: scene.nodes.map((node) =>
          node.type === 'ending' && node.endingId === id ? { ...node, endingId: '' } : node,
        ),
      })),
    },
  };
}

/** 找出引用了某个结局的节点数量（删除前提示用） */
export function countEndingUsage(data: ProjectData, endingId: string): number {
  let count = 0;
  for (const scene of data.story.scenes) {
    for (const node of scene.nodes) {
      if (node.type === 'ending' && node.endingId === endingId) count += 1;
    }
  }
  return count;
}
