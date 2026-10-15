/**
 * 当前激活场景：优先用用户选中的场景，失效时回退到起始场景
 */
import { useEffect } from 'react';
import type { Scene } from '@gal/shared';
import { useProjectStore } from '../store/projectStore';
import { useUiStore } from '../store/uiStore';

export function useActiveScene(): Scene | undefined {
  const scenes = useProjectStore((s) => s.data.story.scenes);
  const startSceneId = useProjectStore((s) => s.data.story.startSceneId);
  const activeSceneId = useUiStore((s) => s.activeSceneId);
  const selectScene = useUiStore((s) => s.selectScene);

  const scene = scenes.find((s) => s.id === activeSceneId) ?? scenes.find((s) => s.id === startSceneId) ?? scenes[0];

  // 首次渲染或场景被删除后，把激活场景纠正过来
  useEffect(() => {
    if (scene && scene.id !== activeSceneId) selectScene(scene.id, { keepNode: true });
  }, [scene, activeSceneId, selectScene]);

  return scene;
}
