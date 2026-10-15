/**
 * 场景相关的纯函数变更
 */
import { createScene, uid } from '@gal/shared';
import type { ProjectData } from '../../types/project';

/** 新增场景并返回新项目与新场景 id */
export function addScene(data: ProjectData, name?: string): { data: ProjectData; sceneId: string } {
  const scene = createScene(name ?? `场景 ${data.story.scenes.length + 1}`);
  return {
    sceneId: scene.id,
    data: { ...data, story: { ...data.story, scenes: [...data.story.scenes, scene] } },
  };
}

/** 重命名场景 */
export function renameScene(data: ProjectData, sceneId: string, name: string): ProjectData {
  return {
    ...data,
    story: {
      ...data.story,
      scenes: data.story.scenes.map((s) => (s.id === sceneId ? { ...s, name } : s)),
    },
  };
}

/** 设为起始场景 */
export function setStartScene(data: ProjectData, sceneId: string): ProjectData {
  return { ...data, story: { ...data.story, startSceneId: sceneId } };
}

/** 复制场景（含节点 id 重写，避免和原场景冲突） */
export function duplicateScene(data: ProjectData, sceneId: string): { data: ProjectData; sceneId: string } {
  const source = data.story.scenes.find((s) => s.id === sceneId);
  if (!source) return { data, sceneId };

  const idMap = new Map<string, string>();
  const nodes = source.nodes.map((node) => {
    const nextId = uid(node.type);
    idMap.set(node.id, nextId);
    return { ...node, id: nextId };
  });

  // 场景内部的连线重新指向新 id；指向外部的连线保持原样
  const remapped = nodes.map((node) => {
    if (node.type === 'choice') {
      return {
        ...node,
        options: node.options.map((o) => ({
          ...o,
          id: uid('opt'),
          next: idMap.get(o.next) ?? o.next,
          // 概率分支也要重写 id 和目标，否则副本的分支会指回原场景的节点
          branches: o.branches?.map((b) => ({
            ...b,
            id: uid('branch'),
            next: idMap.get(b.next) ?? b.next,
          })),
        })),
      };
    }
    if (node.type === 'dialogue' || node.type === 'showSprite' || node.type === 'hideSprite' || node.type === 'setBackground' || node.type === 'playBgm' || node.type === 'stopBgm' || node.type === 'playSe' || node.type === 'effect' || node.type === 'effectOff') {
      return { ...node, next: node.next ? (idMap.get(node.next) ?? node.next) : undefined };
    }
    return node;
  });

  const scene = { id: uid('scene'), name: `${source.name} 副本`, nodes: remapped };
  const layout: typeof data.layout = {};
  for (const node of source.nodes) {
    const targetId = idMap.get(node.id);
    const pos = data.layout[node.id];
    if (targetId && pos) layout[targetId] = pos;
  }

  return {
    sceneId: scene.id,
    data: {
      ...data,
      story: { ...data.story, scenes: [...data.story.scenes, scene] },
      layout: { ...data.layout, ...layout },
    },
  };
}

/** 删除场景，并清掉所有指向它的跳转 */
export function removeScene(data: ProjectData, sceneId: string): ProjectData {
  const scenes = data.story.scenes.filter((s) => s.id !== sceneId);
  if (!scenes.length) return data; // 至少保留一个场景

  return {
    ...data,
    story: {
      ...data.story,
      scenes: scenes.map((scene) => ({
        ...scene,
        nodes: scene.nodes.map((node) =>
          node.type === 'jump' && node.targetSceneId === sceneId
            ? { ...node, targetSceneId: '' }
            : node,
        ),
      })),
      startSceneId:
        data.story.startSceneId === sceneId ? scenes[0].id : data.story.startSceneId,
    },
  };
}
