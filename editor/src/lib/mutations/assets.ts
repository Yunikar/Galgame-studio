/**
 * 素材相关的纯函数变更（增 / 删 / 改名 / 换文件）
 * 所有函数都是"输入旧项目 -> 返回新项目"，方便 store 统一做撤销重做。
 */
import type { Asset, AssetCategory, EditorAsset, Story } from '@gal/shared';
import type { ProjectData } from '../../types/project';

/** 取 story 里某一类素材数组 */
function listOf(story: Story, category: AssetCategory): Asset[] {
  return story[category];
}

/** 写回某一类素材数组 */
function withList(story: Story, category: AssetCategory, list: Asset[]): Story {
  return { ...story, [category]: list } as Story;
}

/** 新增素材：同时登记到 assets 表和 story 的分类数组 */
export function addAsset(data: ProjectData, asset: EditorAsset): ProjectData {
  const list = listOf(data.story, asset.category);
  return {
    ...data,
    assets: { ...data.assets, [asset.id]: asset },
    story: withList(data.story, asset.category, [
      ...list,
      { id: asset.id, name: asset.name, path: asset.path },
    ]),
  };
}

/**
 * 删除素材：除了从表里移除，还要把剧本里所有引用它的地方清理掉，
 * 否则会留下"引用了已删除素材"的悬空引用。
 */
export function removeAsset(data: ProjectData, category: AssetCategory, assetId: string): ProjectData {
  const { [assetId]: _removed, ...restAssets } = data.assets;
  const story = withList(
    data.story,
    category,
    listOf(data.story, category).filter((a) => a.id !== assetId),
  );
  return {
    ...data,
    assets: restAssets,
    story: clearAssetRefs(story, category, assetId),
  };
}

/** 清理剧本里对该素材的引用 */
export function clearAssetRefs(story: Story, category: AssetCategory, assetId: string): Story {
  if (category === 'sprites') {
    // 立绘：可能是某个角色的基础立绘，也可能是某个差分
    return {
      ...story,
      characters: story.characters.map((c) => ({
        ...c,
        sprites: {
          base: c.sprites.base === assetId ? '' : c.sprites.base,
          expressions: c.sprites.expressions.map((e) =>
            e.assetId === assetId ? { ...e, assetId: '' } : e,
          ),
        },
      })),
    };
  }

  const clearNodeValue = (nodes: Story['scenes'][number]['nodes']) =>
    nodes.map((node) => {
      if (category === 'backgrounds' && node.type === 'setBackground' && node.assetId === assetId) {
        return { ...node, assetId: '' };
      }
      if (category === 'bgms' && node.type === 'playBgm' && node.assetId === assetId) {
        return { ...node, assetId: '' };
      }
      if (category === 'ses' && node.type === 'playSe' && node.assetId === assetId) {
        return { ...node, assetId: '' };
      }
      if (category === 'voices' && node.type === 'dialogue' && node.voice === assetId) {
        return { ...node, voice: undefined };
      }
      return node;
    });

  return {
    ...story,
    scenes: story.scenes.map((scene) => ({ ...scene, nodes: clearNodeValue(scene.nodes) })),
  };
}

/** 重命名素材 */
export function renameAsset(data: ProjectData, category: AssetCategory, assetId: string, name: string): ProjectData {
  const asset = data.assets[assetId];
  return {
    ...data,
    assets: asset ? { ...data.assets, [assetId]: { ...asset, name } } : data.assets,
    story: withList(
      data.story,
      category,
      listOf(data.story, category).map((a) => (a.id === assetId ? { ...a, name } : a)),
    ),
  };
}

/** 重新上传：保留素材 id（引用不失效），只替换文件内容 */
export function replaceAssetBinary(data: ProjectData, assetId: string, next: EditorAsset): ProjectData {
  const asset = data.assets[assetId];
  if (!asset) return data;
  return {
    ...data,
    assets: { ...data.assets, [assetId]: { ...next, id: asset.id, name: asset.name } },
  };
}

/** 按分类取素材（保持 story 数组顺序） */
export function assetsOfCategory(data: ProjectData, category: AssetCategory): EditorAsset[] {
  return listOf(data.story, category)
    .map((a) => data.assets[a.id])
    .filter((a): a is EditorAsset => !!a);
}

/** 素材是否被剧本引用（删除前提示用） */
export function countAssetUsage(data: ProjectData, category: AssetCategory, assetId: string): number {
  let count = 0;

  // 开场图 / 标题画面背景也算背景素材的引用，
  // 否则选了图但没用在节点里，会被"清理未使用素材"误删
  if (category === 'backgrounds') {
    if (data.story.meta.openingImage === assetId) count += 1;
    if (data.story.meta.titleBackground === assetId) count += 1;
  }

  for (const scene of data.story.scenes) {
    for (const node of scene.nodes) {
      if (category === 'backgrounds' && node.type === 'setBackground' && node.assetId === assetId) count += 1;
      if (category === 'bgms' && node.type === 'playBgm' && node.assetId === assetId) count += 1;
      if (category === 'ses' && node.type === 'playSe' && node.assetId === assetId) count += 1;
      if (category === 'voices' && node.type === 'dialogue' && node.voice === assetId) count += 1;
      if (
        category === 'sprites' &&
        node.type === 'showSprite' &&
        data.story.characters.some(
          (c) =>
            c.id === node.characterId &&
            (c.sprites.base === assetId || c.sprites.expressions.some((e) => e.assetId === assetId)),
        )
      ) {
        count += 1;
      }
    }
  }
  return count;
}
