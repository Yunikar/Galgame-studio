/**
 * 角色相关的纯函数变更
 */
import { createCharacter, uid, type Character, type CharacterExpression } from '@gal/shared';
import type { ProjectData } from '../../types/project';

/** 新增角色，返回新项目 */
export function addCharacter(data: ProjectData, name?: string): ProjectData {
  const character = createCharacter(name ?? `角色 ${data.story.characters.length + 1}`);
  return { ...data, story: { ...data.story, characters: [...data.story.characters, character] } };
}

/** 更新角色字段 */
export function updateCharacter(data: ProjectData, id: string, patch: Partial<Character>): ProjectData {
  return {
    ...data,
    story: {
      ...data.story,
      characters: data.story.characters.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    },
  };
}

/** 删除角色，并清掉剧本里对它的引用 */
export function removeCharacter(data: ProjectData, id: string): ProjectData {
  return {
    ...data,
    story: {
      ...data.story,
      characters: data.story.characters.filter((c) => c.id !== id),
      scenes: data.story.scenes.map((scene) => ({
        ...scene,
        nodes: scene.nodes.map((node) => {
          if (node.type === 'dialogue' && node.speaker === id) return { ...node, speaker: undefined };
          if ((node.type === 'showSprite' || node.type === 'hideSprite') && node.characterId === id) {
            return { ...node, characterId: '' };
          }
          return node;
        }),
      })),
    },
  };
}

/** 设置角色基础立绘 */
export function setBaseSprite(data: ProjectData, characterId: string, assetId: string): ProjectData {
  return {
    ...data,
    story: {
      ...data.story,
      characters: data.story.characters.map((c) =>
        c.id === characterId ? { ...c, sprites: { ...c.sprites, base: assetId } } : c,
      ),
    },
  };
}

/** 新增差分表情 */
export function addExpression(
  data: ProjectData,
  characterId: string,
  expression?: Partial<CharacterExpression>,
): ProjectData {
  const next: CharacterExpression = {
    id: expression?.id ?? uid('expr'),
    name: expression?.name ?? '新差分',
    assetId: expression?.assetId ?? '',
  };
  return {
    ...data,
    story: {
      ...data.story,
      characters: data.story.characters.map((c) =>
        c.id === characterId
          ? { ...c, sprites: { ...c.sprites, expressions: [...c.sprites.expressions, next] } }
          : c,
      ),
    },
  };
}

/** 更新差分表情 */
export function updateExpression(
  data: ProjectData,
  characterId: string,
  expressionId: string,
  patch: Partial<CharacterExpression>,
): ProjectData {
  return {
    ...data,
    story: {
      ...data.story,
      characters: data.story.characters.map((c) =>
        c.id === characterId
          ? {
              ...c,
              sprites: {
                ...c.sprites,
                expressions: c.sprites.expressions.map((e) =>
                  e.id === expressionId ? { ...e, ...patch } : e,
                ),
              },
            }
          : c,
      ),
    },
  };
}

/** 删除差分表情，并清掉引用它的立绘节点 */
export function removeExpression(data: ProjectData, characterId: string, expressionId: string): ProjectData {
  return {
    ...data,
    story: {
      ...data.story,
      characters: data.story.characters.map((c) =>
        c.id === characterId
          ? {
              ...c,
              sprites: {
                ...c.sprites,
                expressions: c.sprites.expressions.filter((e) => e.id !== expressionId),
              },
            }
          : c,
      ),
      scenes: data.story.scenes.map((scene) => ({
        ...scene,
        nodes: scene.nodes.map((node) =>
          node.type === 'showSprite' && node.characterId === characterId && node.expressionId === expressionId
            ? { ...node, expressionId: undefined }
            : node,
        ),
      })),
    },
  };
}
