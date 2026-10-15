/**
 * 剧本工厂函数与容错归一化
 * 编辑器"新建项目/新建节点"以及"导入旧项目"都走这里，避免各处重复写默认值。
 */
import { EFFECT_DEFAULT_TARGET, STORY_VERSION } from './constants';
import { uid } from './ids';
import type {
  Asset,
  Character,
  ChainNode,
  ChoiceBranch,
  ChoiceOption,
  EffectType,
  Ending,
  NodeType,
  Scene,
  Story,
  StoryNode,
} from './types';

/** 判断节点是否属于"链式节点"（有 next 指针） */
export function isChainNode(node: StoryNode): node is ChainNode {
  return node.type !== 'choice' && node.type !== 'jump' && node.type !== 'ending';
}

/** 读取节点的 next 指针（没有则返回 undefined） */
export function getNextId(node: StoryNode): string | undefined {
  return isChainNode(node) ? node.next : undefined;
}

/** 写回节点的 next 指针（对 choice/jump/ending 无效，调用方需自行判断） */
export function setNextId(node: StoryNode, next?: string): StoryNode {
  if (!isChainNode(node)) return node;
  return { ...node, next };
}

/* ------------------------------------------------------------------ *
 * 选项的多分支（概率分支）
 * ------------------------------------------------------------------ */

/** 新建一个分支（默认权重 1） */
export function createBranch(next = '', weight = 1): ChoiceBranch {
  return { id: uid('branch'), next, weight };
}

/**
 * 取一个选项的所有出口。
 * 有 branches 就用 branches（此时 next 只是镜像，不参与）；否则退回 next。
 * 单分支和"没配分支"在调用方看来是统一的。
 */
export function getOptionTargets(option: ChoiceOption): string[] {
  const branches = option.branches;
  if (!branches || !branches.length) return option.next ? [option.next] : [];
  return branches.map((b) => b.next).filter(Boolean);
}

/** 一个选项是否已经有出口（用于"新建节点时接到哪里"的判断） */
export function hasOptionExit(option: ChoiceOption): boolean {
  return getOptionTargets(option).length > 0;
}

/** 把分支权重换算成百分比（与入参一一对应）。权重全无效时按等概率算 */
export function branchPercents(branches: readonly ChoiceBranch[]): number[] {
  const weights = branches.map((b) => (Number.isFinite(b.weight) && b.weight > 0 ? b.weight : 0));
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) {
    const even = branches.length ? 100 / branches.length : 0;
    return branches.map(() => even);
  }
  return weights.map((w) => (w / total) * 100);
}

/** 百分比显示文案：整数不带小数（60%），否则保留一位（33.3%） */
export function formatPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
}

/** 新建一个场景 */
export function createScene(name = '新场景'): Scene {
  return { id: uid('scene'), name, nodes: [] };
}

/** 按类型创建带默认值的节点 */
export function createNode(type: NodeType): StoryNode {
  const id = uid(type);
  switch (type) {
    case 'dialogue':
      return { id, type, text: '', next: undefined };
    case 'choice':
      return {
        id,
        type,
        options: [
          { id: uid('opt'), text: '选项一', next: '' },
          { id: uid('opt'), text: '选项二', next: '' },
        ],
      };
    case 'showSprite':
      return { id, type, characterId: '', position: 'center', transition: 'fade' };
    case 'hideSprite':
      return { id, type, characterId: '', transition: 'fade' };
    case 'setBackground':
      return { id, type, assetId: '', transition: 'fade' };
    case 'playBgm':
      return { id, type, assetId: '', loop: true, fadeIn: 1 };
    case 'stopBgm':
      return { id, type, fadeOut: 1 };
    case 'playSe':
      return { id, type, assetId: '' };
    case 'effect':
      // 不写 duration：新节点走"开启后持续生效，直到「特效关闭」"的新模型
      return { id, type, effect: 'shake' as EffectType, target: EFFECT_DEFAULT_TARGET };
    case 'effectOff':
      // 不填 effect = 关闭全部特效
      return { id, type };
    case 'jump':
      return { id, type, targetSceneId: '' };
    case 'ending':
      return { id, type, endingId: '' };
    default:
      return { id, type: 'dialogue', text: '' };
  }
}

/** 新建一个角色 */
export function createCharacter(name = '新角色'): Character {
  return {
    id: uid('char'),
    name,
    color: '#e11d48',
    sprites: { base: '', expressions: [] },
  };
}

/** 新建一个结局 */
export function createEnding(name = '新结局'): Ending {
  return { id: uid('ending'), name, description: '' };
}

/** 新建空剧本 */
export function createEmptyStory(title = '我的第一个 Galgame'): Story {
  const first = createScene('序章');
  return {
    meta: { title, version: STORY_VERSION },
    characters: [],
    backgrounds: [],
    sprites: [],
    bgms: [],
    ses: [],
    voices: [],
    scenes: [first],
    startSceneId: first.id,
    endings: [],
  };
}

/** 判断一个对象像不像 Asset */
function asAsset(raw: unknown): Asset | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.id !== 'string') return null;
  return {
    id: obj.id,
    name: typeof obj.name === 'string' ? obj.name : obj.id,
    path: typeof obj.path === 'string' ? obj.path : '',
  };
}

function asAssetList(raw: unknown): Asset[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(asAsset).filter((a): a is Asset => a !== null);
}

/**
 * 挑出 meta 里的可选字段。
 * ⚠️ normalizeStory 会重建 meta，这里漏掉哪个字段，那个字段就会在"重开编辑器/导入项目"时丢失。
 */
function pickOptionalMeta(meta: Story['meta'] | undefined): Partial<Story['meta']> {
  const out: Partial<Story['meta']> = {};
  if (typeof meta?.openingImage === 'string' && meta.openingImage) {
    out.openingImage = meta.openingImage;
  }
  if (typeof meta?.openingDuration === 'number' && Number.isFinite(meta.openingDuration)) {
    out.openingDuration = meta.openingDuration;
  }
  if (typeof meta?.titleBackground === 'string' && meta.titleBackground) {
    out.titleBackground = meta.titleBackground;
  }
  if (typeof meta?.gameId === 'string' && meta.gameId) {
    out.gameId = meta.gameId;
  }
  return out;
}

/**
 * 把任意来源的 JSON 归一化成合法 Story。
 * 导入 .galproj 或旧版本 story.json 时使用，缺字段就补默认值，不抛异常。
 */
export function normalizeStory(raw: unknown): Story {
  const obj = (raw ?? {}) as Partial<Story> & Record<string, unknown>;
  const base = createEmptyStory();

  const meta = (obj.meta ?? {}) as Story['meta'];
  const scenes: Scene[] = Array.isArray(obj.scenes)
    ? obj.scenes
        .filter((s): s is Scene => !!s && typeof s === 'object')
        .map((s) => ({
          id: typeof s.id === 'string' ? s.id : uid('scene'),
          name: typeof s.name === 'string' ? s.name : '未命名场景',
          nodes: Array.isArray(s.nodes) ? (s.nodes as StoryNode[]).filter(Boolean) : [],
        }))
    : base.scenes;

  const characters: Character[] = Array.isArray(obj.characters)
    ? obj.characters.map((c) => ({
        id: c?.id ?? uid('char'),
        name: c?.name ?? '未命名角色',
        color: c?.color,
        sprites: {
          base: c?.sprites?.base ?? '',
          expressions: Array.isArray(c?.sprites?.expressions)
            ? c.sprites.expressions.map((e) => ({
                id: e?.id ?? uid('expr'),
                name: e?.name ?? '差分',
                assetId: e?.assetId ?? '',
              }))
            : [],
        },
      }))
    : [];

  const endings: Ending[] = Array.isArray(obj.endings)
    ? obj.endings.map((e) => ({
        id: e?.id ?? uid('ending'),
        name: e?.name ?? '结局',
        description: e?.description,
      }))
    : [];

  const story: Story = {
    meta: {
      title: typeof meta?.title === 'string' && meta.title ? meta.title : base.meta.title,
      version: typeof meta?.version === 'string' ? meta.version : STORY_VERSION,
      ...pickOptionalMeta(meta),
    },
    characters,
    backgrounds: asAssetList(obj.backgrounds),
    sprites: asAssetList(obj.sprites),
    bgms: asAssetList(obj.bgms),
    ses: asAssetList(obj.ses),
    voices: asAssetList(obj.voices),
    scenes: scenes.length ? scenes : base.scenes,
    startSceneId:
      typeof obj.startSceneId === 'string' && scenes.some((s) => s.id === obj.startSceneId)
        ? obj.startSceneId
        : (scenes[0]?.id ?? base.startSceneId),
    endings,
  };

  return story;
}

/** 深拷贝剧本（避免撤销栈里出现共享引用） */
export function cloneStory(story: Story): Story {
  return JSON.parse(JSON.stringify(story)) as Story;
}
