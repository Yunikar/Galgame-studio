/**
 * 项目状态（zustand）
 * 所有修改都通过 mutate() 走不可变更新，并在改动前压入撤销栈。
 */
import { create } from 'zustand';
import {
  createEmptyStory,
  createExampleStory,
  type AssetCategory,
  type Character,
  type CharacterExpression,
  type EditorAsset,
  type Ending,
  type NodeType,
  type Story,
  type StoryNode,
  createNode,
} from '@gal/shared';
import type { NodePosition, ProjectData } from '../types/project';
import type { NodePatch } from '../types/patch';
import { createProject } from '../types/project';
import * as assetOps from '../lib/mutations/assets';
import * as charOps from '../lib/mutations/characters';
import * as endingOps from '../lib/mutations/endings';
import * as sceneOps from '../lib/mutations/scenes';
import * as nodeOps from '../lib/mutations/nodes';
import { clearProjectLocal, loadProjectLocal, saveProjectLocal } from '../lib/projectStorage';

/** 撤销栈上限 */
const HISTORY_LIMIT = 60;

export type ProjectStore = {
  data: ProjectData;
  /** 是否有未保存到本地的改动 */
  dirty: boolean;
  lastSavedAt: string | null;
  /** 本地数据是否已经读取完成 */
  hydrated: boolean;
  past: ProjectData[];
  future: ProjectData[];

  /* ---------- 基础操作 ---------- */
  mutate: (fn: (data: ProjectData) => ProjectData, options?: { history?: boolean }) => void;
  replaceProject: (data: ProjectData, options?: { history?: boolean }) => void;
  undo: () => void;
  redo: () => void;

  /* ---------- 生命周期 ---------- */
  hydrate: () => Promise<void>;
  saveLocal: () => Promise<{ ok: boolean; message?: string }>;
  resetToEmpty: () => Promise<void>;
  loadExample: () => Promise<void>;

  /* ---------- 剧本元信息 ---------- */
  setTitle: (title: string) => void;
  /** 更新 meta 里的可选字段（开场图、标题背景等），传 undefined 表示清空 */
  setMeta: (patch: Partial<Story['meta']>) => void;

  /* ---------- 素材 ---------- */
  addAsset: (asset: EditorAsset) => void;
  removeAsset: (category: AssetCategory, assetId: string) => void;
  renameAsset: (category: AssetCategory, assetId: string, name: string) => void;
  replaceAsset: (assetId: string, asset: EditorAsset) => void;

  /* ---------- 角色 ---------- */
  addCharacter: (name?: string) => void;
  updateCharacter: (id: string, patch: Partial<Character>) => void;
  removeCharacter: (id: string) => void;
  setBaseSprite: (characterId: string, assetId: string) => void;
  addExpression: (characterId: string, expression?: Partial<CharacterExpression>) => void;
  updateExpression: (characterId: string, expressionId: string, patch: Partial<CharacterExpression>) => void;
  removeExpression: (characterId: string, expressionId: string) => void;

  /* ---------- 结局 ---------- */
  addEnding: (name?: string) => void;
  updateEnding: (id: string, patch: Partial<Ending>) => void;
  removeEnding: (id: string) => void;

  /* ---------- 场景 ---------- */
  addScene: (name?: string) => string;
  duplicateScene: (sceneId: string) => string;
  renameScene: (sceneId: string, name: string) => void;
  removeScene: (sceneId: string) => void;
  setStartScene: (sceneId: string) => void;

  /* ---------- 节点 ---------- */
  /** 新增节点；note 是需要额外提示用户的一句话（例如"选项都连满了，已自动加了一个选项"） */
  addNode: (
    sceneId: string,
    type: NodeType,
    afterNodeId?: string | null,
  ) => { nodeId: string; note?: string };
  /** 插入一个已经构造好的节点（复制节点时用） */
  insertNode: (sceneId: string, node: StoryNode, afterNodeId?: string | null) => void;
  updateNode: (sceneId: string, nodeId: string, patch: NodePatch) => void;
  removeNode: (sceneId: string, nodeId: string) => void;
  /** 连线；返回的 note 是要提示用户的一句话（例如"已追加为第 2 个分支"） */
  connectNodes: (
    sceneId: string,
    sourceId: string,
    sourceHandle: string | null | undefined,
    targetId: string,
  ) => { note?: string };
  disconnectNodes: (sceneId: string, sourceId: string, sourceHandle: string | null | undefined) => void;
  addOption: (sceneId: string, nodeId: string) => void;
  updateOption: (sceneId: string, nodeId: string, optionId: string, patch: { text?: string; next?: string }) => void;
  removeOption: (sceneId: string, nodeId: string, optionId: string) => void;
  moveOption: (sceneId: string, nodeId: string, optionId: string, delta: number) => void;
  /* ---------- 概率分支 ---------- */
  addBranch: (sceneId: string, nodeId: string, optionId: string) => void;
  updateBranch: (
    sceneId: string,
    nodeId: string,
    optionId: string,
    branchId: string,
    patch: { next?: string; weight?: number },
  ) => void;
  removeBranch: (sceneId: string, nodeId: string, optionId: string, branchId: string) => void;
  /** 把某个选项下的分支权重均分 */
  evenBranches: (sceneId: string, nodeId: string, optionId: string) => void;
  setNodePosition: (nodeId: string, position: NodePosition) => void;
  setLayout: (layout: Record<string, NodePosition>) => void;
  setStoryNode: (sceneId: string, nodeId: string, node: StoryNode) => void;
};

/** 初始项目：内置示例剧本，打开编辑器就能立刻玩 */
const initialData = createProject(createExampleStory());

export const useProjectStore = create<ProjectStore>((set, get) => ({
  data: initialData,
  dirty: false,
  lastSavedAt: null,
  hydrated: false,
  past: [],
  future: [],

  mutate: (fn, options) => {
    const { data, past } = get();
    const next = fn(data);
    if (next === data) return;

    const useHistory = options?.history !== false;
    set({
      data: next,
      dirty: true,
      past: useHistory ? [...past, data].slice(-HISTORY_LIMIT) : past,
      future: useHistory ? [] : get().future,
    });
  },

  replaceProject: (data, options) => {
    const useHistory = options?.history !== false;
    set((state) => ({
      data,
      dirty: true,
      past: useHistory ? [...state.past, state.data].slice(-HISTORY_LIMIT) : state.past,
      future: [],
    }));
  },

  undo: () => {
    const { past, data, future } = get();
    if (!past.length) return;
    const previous = past[past.length - 1];
    set({
      data: previous,
      past: past.slice(0, -1),
      future: [data, ...future].slice(0, HISTORY_LIMIT),
      dirty: true,
    });
  },

  redo: () => {
    const { future, data, past } = get();
    if (!future.length) return;
    const next = future[0];
    set({
      data: next,
      future: future.slice(1),
      past: [...past, data].slice(-HISTORY_LIMIT),
      dirty: true,
    });
  },

  hydrate: async () => {
    const loaded = await loadProjectLocal();
    if (loaded) {
      set({ data: loaded, hydrated: true, dirty: false, lastSavedAt: loaded.savedAt, past: [], future: [] });
      return;
    }
    // 首次打开：把示例项目存下来，用户直接有东西可玩
    set({ hydrated: true });
    await get().saveLocal();
  },

  saveLocal: async () => {
    const result = await saveProjectLocal(get().data);
    if (result.ok) {
      set({ dirty: false, lastSavedAt: new Date().toISOString() });
    }
    return result;
  },

  resetToEmpty: async () => {
    const data = createProject(createEmptyStory());
    set({ data, past: [], future: [], dirty: true, lastSavedAt: null });
    await clearProjectLocal();
    await saveProjectLocal(data);
    set({ dirty: false, lastSavedAt: new Date().toISOString() });
  },

  loadExample: async () => {
    const data = createProject(createExampleStory());
    set({ data, past: [], future: [], dirty: true });
    await saveProjectLocal(data);
    set({ dirty: false, lastSavedAt: new Date().toISOString() });
  },

  setTitle: (title) =>
    get().mutate((data) => ({ ...data, story: { ...data.story, meta: { ...data.story.meta, title } } })),

  setMeta: (patch) =>
    get().mutate((data) => ({ ...data, story: { ...data.story, meta: { ...data.story.meta, ...patch } } })),

  addAsset: (asset) => get().mutate((data) => assetOps.addAsset(data, asset)),
  removeAsset: (category, assetId) => get().mutate((data) => assetOps.removeAsset(data, category, assetId)),
  renameAsset: (category, assetId, name) =>
    get().mutate((data) => assetOps.renameAsset(data, category, assetId, name)),
  replaceAsset: (assetId, asset) => get().mutate((data) => assetOps.replaceAssetBinary(data, assetId, asset)),

  addCharacter: (name) => get().mutate((data) => charOps.addCharacter(data, name)),
  updateCharacter: (id, patch) => get().mutate((data) => charOps.updateCharacter(data, id, patch)),
  removeCharacter: (id) => get().mutate((data) => charOps.removeCharacter(data, id)),
  setBaseSprite: (characterId, assetId) =>
    get().mutate((data) => charOps.setBaseSprite(data, characterId, assetId)),
  addExpression: (characterId, expression) =>
    get().mutate((data) => charOps.addExpression(data, characterId, expression)),
  updateExpression: (characterId, expressionId, patch) =>
    get().mutate((data) => charOps.updateExpression(data, characterId, expressionId, patch)),
  removeExpression: (characterId, expressionId) =>
    get().mutate((data) => charOps.removeExpression(data, characterId, expressionId)),

  addEnding: (name) => get().mutate((data) => endingOps.addEnding(data, name)),
  updateEnding: (id, patch) => get().mutate((data) => endingOps.updateEnding(data, id, patch)),
  removeEnding: (id) => get().mutate((data) => endingOps.removeEnding(data, id)),

  addScene: (name) => {
    let sceneId = '';
    get().mutate((data) => {
      const result = sceneOps.addScene(data, name);
      sceneId = result.sceneId;
      return result.data;
    });
    return sceneId;
  },
  duplicateScene: (sceneId) => {
    let newId = sceneId;
    get().mutate((data) => {
      const result = sceneOps.duplicateScene(data, sceneId);
      newId = result.sceneId;
      return result.data;
    });
    return newId;
  },
  renameScene: (sceneId, name) => get().mutate((data) => sceneOps.renameScene(data, sceneId, name)),
  removeScene: (sceneId) => get().mutate((data) => sceneOps.removeScene(data, sceneId)),
  setStartScene: (sceneId) => get().mutate((data) => sceneOps.setStartScene(data, sceneId)),

  addNode: (sceneId, type, afterNodeId) => {
    const node = createNode(type);
    // note 是在 mutate 的更新函数里算出来的，用闭包带出来给调用方提示
    let note: string | undefined;
    get().mutate((data) => {
      const result = nodeOps.addNode(data, sceneId, node, afterNodeId);
      note = result.note;
      return result.data;
    });
    return { nodeId: node.id, note };
  },
  insertNode: (sceneId, node, afterNodeId) =>
    get().mutate((data) => nodeOps.addNode(data, sceneId, node, afterNodeId).data),
  updateNode: (sceneId, nodeId, patch) =>
    get().mutate((data) => nodeOps.updateNode(data, sceneId, nodeId, patch)),
  removeNode: (sceneId, nodeId) => get().mutate((data) => nodeOps.removeNode(data, sceneId, nodeId)),
  connectNodes: (sceneId, sourceId, sourceHandle, targetId) => {
    // note 是在 mutate 的更新函数里算出来的，用闭包带出来
    let note: string | undefined;
    get().mutate((data) => {
      const result = nodeOps.connectNodes(data, sceneId, sourceId, sourceHandle, targetId);
      note = result.note;
      return result.data;
    });
    return { note };
  },
  disconnectNodes: (sceneId, sourceId, sourceHandle) =>
    get().mutate((data) => nodeOps.disconnectNodes(data, sceneId, sourceId, sourceHandle)),
  addOption: (sceneId, nodeId) => get().mutate((data) => nodeOps.addOption(data, sceneId, nodeId)),
  updateOption: (sceneId, nodeId, optionId, patch) =>
    get().mutate((data) => nodeOps.updateOption(data, sceneId, nodeId, optionId, patch)),
  removeOption: (sceneId, nodeId, optionId) =>
    get().mutate((data) => nodeOps.removeOption(data, sceneId, nodeId, optionId)),
  moveOption: (sceneId, nodeId, optionId, delta) =>
    get().mutate((data) => nodeOps.moveOption(data, sceneId, nodeId, optionId, delta)),
  addBranch: (sceneId, nodeId, optionId) =>
    get().mutate((data) => nodeOps.addBranch(data, sceneId, nodeId, optionId)),
  updateBranch: (sceneId, nodeId, optionId, branchId, patch) =>
    get().mutate((data) => nodeOps.updateBranch(data, sceneId, nodeId, optionId, branchId, patch)),
  removeBranch: (sceneId, nodeId, optionId, branchId) =>
    get().mutate((data) => nodeOps.removeBranch(data, sceneId, nodeId, optionId, branchId)),
  evenBranches: (sceneId, nodeId, optionId) =>
    get().mutate((data) => nodeOps.evenBranches(data, sceneId, nodeId, optionId)),
  setNodePosition: (nodeId, position) =>
    get().mutate((data) => nodeOps.setNodePosition(data, nodeId, position), { history: false }),
  setLayout: (layout) => get().mutate((data) => nodeOps.setLayout(data, layout), { history: true }),
  setStoryNode: (sceneId, nodeId, node) =>
    get().mutate((data) => {
      const scene = data.story.scenes.find((s) => s.id === sceneId);
      if (!scene) return data;
      return {
        ...data,
        story: {
          ...data.story,
          scenes: data.story.scenes.map((s) =>
            s.id === sceneId ? { ...s, nodes: s.nodes.map((n) => (n.id === nodeId ? node : n)) } : s,
          ),
        },
      };
    }),
}));
