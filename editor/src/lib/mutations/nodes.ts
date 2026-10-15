/**
 * 节点相关的纯函数变更：新增（支持自动串接）、修改、删除、连线、选项增删、概率分支
 */
import {
  NODE_LABELS,
  createBranch,
  getOptionTargets,
  hasOptionExit,
  isChainNode,
  uid,
  type ChoiceBranch,
  type ChoiceOption,
  type Scene,
  type StoryNode,
} from '@gal/shared';
import type { NodePosition, ProjectData } from '../../types/project';
import type { NodePatch } from '../../types/patch';
import { LAYOUT_COLUMN_GAP, autoLayoutScene } from '../autoLayout';
import { NODE_WIDTH, choiceOptionOffset, estimateNodeHeight } from '../nodeSize';

/** 在一张场景画布内部定位节点下标 */
function indexOf(nodes: StoryNode[], nodeId: string): number {
  return nodes.findIndex((n) => n.id === nodeId);
}

/** 更新某个场景的节点列表 */
function withNodes(data: ProjectData, sceneId: string, nodes: StoryNode[]): ProjectData {
  return {
    ...data,
    story: {
      ...data.story,
      scenes: data.story.scenes.map((s) => (s.id === sceneId ? { ...s, nodes } : s)),
    },
  };
}

/**
 * 维持一个不变量：选项的 next 永远等于第一个分支的 next。
 *
 * 这样导出后用旧版运行时打开、或者别的工具读 story.json，都还能沿第一条分支走下去，
 * 不会因为"看不懂 branches"而变成死路。
 */
function syncOptionNext(option: ChoiceOption): ChoiceOption {
  const branches = option.branches;
  if (!branches || !branches.length) return option;
  const first = branches[0]!.next;
  return option.next === first ? option : { ...option, next: first };
}

/** 读取节点的出口引用（用于删除时桥接），选项要把所有分支都算上 */
function outgoingRefs(node: StoryNode): string[] {
  if (node.type === 'choice') return node.options.flatMap((o) => getOptionTargets(o));
  if (node.type === 'jump' || node.type === 'ending') return [];
  return node.next ? [node.next] : [];
}

/** 把选项里所有指向 sourceIds 的出口改成 replacement（删除节点时桥接） */
function redirectOption(
  option: ChoiceOption,
  sourceIds: Set<string>,
  replacement: string | undefined,
): ChoiceOption {
  const next = sourceIds.has(option.next) ? (replacement ?? '') : option.next;
  let branches = option.branches;

  if (branches?.length) {
    let changed = false;
    const mapped = branches.map((b) => {
      if (!sourceIds.has(b.next)) return b;
      changed = true;
      return { ...b, next: replacement ?? '' };
    });
    if (changed) branches = mapped;
  }

  if (next === option.next && branches === option.branches) return option;
  return { ...option, next, branches };
}

/** 把 source 指向 target 的连线改成指向 replacement（删除节点时桥接） */
function redirectRefs(nodes: StoryNode[], sourceIds: Set<string>, replacement: string | undefined): StoryNode[] {
  return nodes.map((node) => {
    if (node.type === 'choice') {
      const options = node.options.map((o) => redirectOption(o, sourceIds, replacement));
      return options.some((o, i) => o !== node.options[i]) ? { ...node, options } : node;
    }
    if (node.type === 'jump' || node.type === 'ending') return node;
    return node.next && sourceIds.has(node.next) ? { ...node, next: replacement } : node;
  });
}

/**
 * 解析连线句柄。
 * - `opt:<选项id>`            选项主体连接点（拖出去 = 再加一条分支）
 * - `opt:<选项id>:<分支id>`   某个分支自己的连接点（拖出去 = 改这条分支的目标）
 */
function parseOptionHandle(handle: string | null | undefined): { optionId: string; branchId: string } {
  const raw = (handle ?? '').replace(/^opt:/, '');
  const sep = raw.indexOf(':');
  if (sep < 0) return { optionId: raw, branchId: '' };
  return { optionId: raw.slice(0, sep), branchId: raw.slice(sep + 1) };
}

/**
 * 新增节点。
 * afterNodeId 存在时会把新节点"串"在它后面，这是编辑器最常用的手感：
 * 选中一个节点 -> 新建 -> 自动接上。
 *
 * 锚点分三种情况：
 * - 链式节点：新节点继承锚点原本的 next，锚点自己改成指向新节点
 * - 选项节点：接到「第一个还没连线的选项」上；如果选项都连满了，
 *   就自动补一个新选项再接上（否则新节点会变成孤立的孤儿节点，用户会以为没生效）
 * - 跳转 / 结局节点：它们没有出口，新节点只能单独摆在画布上，通过 note 告知用户
 *
 * @returns note 是需要额外告诉用户的一句话（没有特别情况时为 undefined）
 */
export function addNode(
  data: ProjectData,
  sceneId: string,
  node: StoryNode,
  afterNodeId?: string | null,
): { data: ProjectData; nodeId: string; note?: string } {
  const scene = data.story.scenes.find((s) => s.id === sceneId);
  if (!scene) return { data, nodeId: node.id };

  let finalNode = node;
  let nodes = [...scene.nodes, node];
  let note: string | undefined;
  /** 锚点是选项节点时，新节点接在第几个选项上（用来对齐落点的高度） */
  let anchorOptionId: string | undefined;

  const anchorIndex = afterNodeId ? nodes.findIndex((n) => n.id === afterNodeId) : -1;
  const anchor = anchorIndex >= 0 ? nodes[anchorIndex] : undefined;

  if (anchor && anchor.type === 'choice') {
    const options = anchor.options.map((o) => ({ ...o }));
    // 已经有出口的选项（无论走 next 还是概率分支）都算连过了
    let optionIndex = options.findIndex((o) => !hasOptionExit(o));

    if (optionIndex < 0) {
      // 所有选项都已经有后续了：补一个新选项再接上，保证新节点不会掉在外面
      options.push({ id: uid('opt'), text: `选项${options.length + 1}`, next: '' });
      optionIndex = options.length - 1;
      note = `选项节点上的选项都已连线，已自动新增第 ${optionIndex + 1} 个选项并接上新节点`;
    }

    options[optionIndex] = { ...options[optionIndex]!, next: node.id };
    anchorOptionId = options[optionIndex]!.id;
    nodes[anchorIndex] = { ...anchor, options };
  } else if (anchor && isChainNode(anchor)) {
    // 链式节点：新节点若是链式节点，就把它原来的后续继承过来
    if (isChainNode(finalNode)) finalNode = { ...finalNode, next: anchor.next };
    nodes = nodes.map((n) => (n.id === anchor.id ? { ...n, next: finalNode.id } : n));
  } else if (anchor) {
    // 跳转 / 结局节点没有出口，接不上
    note = `「${NODE_LABELS[anchor.type]}」节点没有出口，新节点没有自动连线`;
  }

  // 用最终形态替换掉刚才 push 进去的那一份（可能已经补上了 next）
  nodes = nodes.map((n) => (n.id === finalNode.id ? finalNode : n));

  // 落点：接在锚点右边（对齐锚点高度），并且避开画布上已有的节点
  // —— 老实现是"按节点总数填格子"，12 个位置用完就从头开始，第 13 个节点会直接叠在第 1 个上
  const spot = findNodeSpot(data, scene, anchor, anchorOptionId, finalNode);
  const layout = data.layout[finalNode.id]
    ? data.layout
    : { ...data.layout, [finalNode.id]: spot };

  return { data: withNodes({ ...data, layout }, sceneId, nodes), nodeId: finalNode.id, note };
}

/** 画布上的一个占位矩形 */
type Rect = { x: number; y: number; w: number; h: number };

/** 两个矩形是否靠得太近（gap 是要求的最小空隙） */
function tooClose(a: Rect, b: Rect, gap: number): boolean {
  return (
    a.x < b.x + b.w + gap &&
    a.x + a.w + gap > b.x &&
    a.y < b.y + b.h + gap &&
    a.y + a.h + gap > b.y
  );
}

/**
 * 给新节点找一个不压到已有节点的落点。
 *
 * 基准点分三种：
 * - 接在链式节点后：落在它右边一列，高度对齐；
 * - 接在选项节点后：落在它右边一列，高度对齐**那个选项**（连线才是平的）；
 * - 没有锚点（画布上随手加一个）：从左上角开始按列铺开找空位。
 *
 * 找到的基准点如果被别人占了，就顺着往下找，直到找到空位。
 */
function findNodeSpot(
  data: ProjectData,
  scene: Scene,
  anchor: StoryNode | undefined,
  anchorOptionId: string | undefined,
  node: StoryNode,
): NodePosition {
  const fallback = autoLayoutScene(scene);
  const rects: Rect[] = scene.nodes.map((n) => {
    const position = data.layout[n.id] ?? fallback[n.id] ?? { x: 60, y: 60 };
    return { x: position.x, y: position.y, w: NODE_WIDTH, h: estimateNodeHeight(n) };
  });

  const size = { w: NODE_WIDTH, h: estimateNodeHeight(node) };
  /** 找一列里最靠上的空位；这一列塞满了返回 null */
  const freeYInColumn = (x: number): number | null => {
    for (let step = 0; step < 200; step += 1) {
      const y = 60 + step * 16;
      if (!rects.some((r) => tooClose({ x, y, ...size }, r, 20))) return y;
    }
    return null;
  };

  // 有锚点：贴着锚点往下顺延
  if (anchor) {
    const anchorPosition = data.layout[anchor.id] ?? fallback[anchor.id] ?? { x: 60, y: 60 };
    const offsetY =
      anchor.type === 'choice' && anchorOptionId ? choiceOptionOffset(anchor, anchorOptionId) : 40;
    const x = anchorPosition.x + LAYOUT_COLUMN_GAP;
    const startY = anchorPosition.y + offsetY - 40;
    for (let step = 0; step < 200; step += 1) {
      const y = startY + step * 16;
      if (!rects.some((r) => tooClose({ x, y, ...size }, r, 20))) return { x, y };
    }
  } else {
    // 没锚点：从左上角按列铺开（每列最多 3 个），别让新节点在一条竖线上越排越远
    const perColumn = 3;
    for (let column = 0; column < 12; column += 1) {
      const x = 60 + column * LAYOUT_COLUMN_GAP;
      const used = rects.filter((r) => Math.abs(r.x - x) < 1).length;
      if (used >= perColumn) continue;
      const y = freeYInColumn(x);
      if (y !== null) return { x, y };
    }
  }

  // 实在找不到（画布被塞满了）：放到最下面
  const bottom = rects.reduce((max, r) => Math.max(max, r.y + r.h), 0);
  return { x: 60, y: bottom + 48 };
}

/** 修改节点字段 */
export function updateNode(
  data: ProjectData,
  sceneId: string,
  nodeId: string,
  patch: NodePatch,
): ProjectData {
  const scene = data.story.scenes.find((s) => s.id === sceneId);
  if (!scene) return data;
  const nodes = scene.nodes.map((n) => (n.id === nodeId ? ({ ...n, ...patch } as StoryNode) : n));
  return withNodes(data, sceneId, nodes);
}

/** 删除节点：把指向它的连线桥接到它原本的后续节点，避免剧情断链 */
export function removeNode(data: ProjectData, sceneId: string, nodeId: string): ProjectData {
  const scene = data.story.scenes.find((s) => s.id === sceneId);
  if (!scene) return data;

  const target = scene.nodes.find((n) => n.id === nodeId);
  if (!target) return data;

  const refs = outgoingRefs(target);
  const replacement = refs.length === 1 ? refs[0] : undefined;

  let nodes = scene.nodes.filter((n) => n.id !== nodeId);
  nodes = redirectRefs(nodes, new Set([nodeId]), replacement);

  const { [nodeId]: _drop, ...layout } = data.layout;
  return withNodes({ ...data, layout }, sceneId, nodes);
}

/**
 * 连线。
 *
 * 选项节点上的规则（这是"概率分支"的手感所在）：
 * - 从**某个分支**的连接点拖线 → 改那一条分支的目标
 * - 从**选项主体**的连接点拖线 → 选项还没有出口时就是第一条出口；
 *   已经有出口了则**追加一个分支**（不会把原来的连线冲掉）
 *
 * @returns note 是需要额外告诉用户的一句话
 */
export function connectNodes(
  data: ProjectData,
  sceneId: string,
  sourceId: string,
  sourceHandle: string | null | undefined,
  targetId: string,
): { data: ProjectData; note?: string } {
  const scene = data.story.scenes.find((s) => s.id === sceneId);
  if (!scene) return { data };
  if (!scene.nodes.some((n) => n.id === targetId)) return { data };

  let note: string | undefined;

  const nodes = scene.nodes.map((node) => {
    if (node.id !== sourceId) return node;

    if (node.type === 'choice') {
      const { optionId, branchId } = parseOptionHandle(sourceHandle);
      const options = node.options.map((opt) => {
        if (opt.id !== optionId) return opt;

        // ① 从分支自己的连接点拖过来：改这条分支的目标
        if (branchId) {
          const branches = (opt.branches ?? []).map((b) =>
            b.id === branchId ? { ...b, next: targetId } : b,
          );
          return syncOptionNext({ ...opt, branches });
        }

        // ② 选项还没有任何出口：这就是第一条出口
        if (!opt.branches?.length && !opt.next) {
          return { ...opt, next: targetId };
        }

        // ③ 已经有出口了：追加一个分支（原来那条保留成第一个分支）
        const branches: ChoiceBranch[] = opt.branches?.length
          ? [...opt.branches, createBranch(targetId)]
          : [createBranch(opt.next), createBranch(targetId)];
        note = `已追加为第 ${branches.length} 个分支（现在共 ${branches.length} 条路，默认等概率）`;
        return syncOptionNext({ ...opt, branches });
      });
      return { ...node, options };
    }

    if (node.type === 'jump' || node.type === 'ending') return node;
    return { ...node, next: targetId };
  });

  return { data: withNodes(data, sceneId, nodes), note };
}

/**
 * 断开连线。
 * - 有分支标记：删掉那一条分支（最后一条被删掉时退回单出口形态）
 * - 没有分支标记：清空选项的出口
 */
export function disconnectNodes(
  data: ProjectData,
  sceneId: string,
  sourceId: string,
  sourceHandle: string | null | undefined,
): ProjectData {
  const scene = data.story.scenes.find((s) => s.id === sceneId);
  if (!scene) return data;

  const nodes = scene.nodes.map((node) => {
    if (node.id !== sourceId) return node;

    if (node.type === 'choice') {
      const { optionId, branchId } = parseOptionHandle(sourceHandle);
      const options = node.options.map((opt) => {
        if (opt.id !== optionId) return opt;

        if (branchId) {
          const branches = (opt.branches ?? []).filter((b) => b.id !== branchId);
          // 分支删光了就退回"只有 next"的老形态，避免留下空 branches
          if (!branches.length) return { ...opt, next: '', branches: undefined };
          return syncOptionNext({ ...opt, branches });
        }

        return { ...opt, next: '', branches: undefined };
      });
      return { ...node, options };
    }

    if (node.type === 'jump' || node.type === 'ending') return node;
    return { ...node, next: undefined };
  });

  return withNodes(data, sceneId, nodes);
}

/* ------------------------------------------------------------------ *
 * 概率分支：增 / 改 / 删 / 均分
 * ------------------------------------------------------------------ */

/** 在一个选项上追加一个空分支（原先是单出口的话，先把那条出口转成第一个分支） */
export function addBranch(
  data: ProjectData,
  sceneId: string,
  nodeId: string,
  optionId: string,
): ProjectData {
  const scene = data.story.scenes.find((s) => s.id === sceneId);
  if (!scene) return data;

  const nodes = scene.nodes.map((node) => {
    if (node.id !== nodeId || node.type !== 'choice') return node;
    const options = node.options.map((opt) => {
      if (opt.id !== optionId) return opt;
      // 已有分支 → 直接追加；原来有单出口 → 先把它转成第一个分支；完全没连线 → 只加一个空槽
      const branches: ChoiceBranch[] = opt.branches?.length
        ? [...opt.branches, createBranch('')]
        : opt.next
          ? [createBranch(opt.next), createBranch('')]
          : [createBranch('')];
      return syncOptionNext({ ...opt, branches });
    });
    return { ...node, options };
  });

  return withNodes(data, sceneId, nodes);
}

/** 修改某个分支的目标节点 / 权重 */
export function updateBranch(
  data: ProjectData,
  sceneId: string,
  nodeId: string,
  optionId: string,
  branchId: string,
  patch: { next?: string; weight?: number },
): ProjectData {
  const scene = data.story.scenes.find((s) => s.id === sceneId);
  if (!scene) return data;

  const nodes = scene.nodes.map((node) => {
    if (node.id !== nodeId || node.type !== 'choice') return node;
    const options = node.options.map((opt) => {
      if (opt.id !== optionId) return opt;
      const branches = (opt.branches ?? []).map((b) =>
        b.id === branchId ? { ...b, ...patch } : b,
      );
      return syncOptionNext({ ...opt, branches });
    });
    return { ...node, options };
  });

  return withNodes(data, sceneId, nodes);
}

/** 删除一个分支 */
export function removeBranch(
  data: ProjectData,
  sceneId: string,
  nodeId: string,
  optionId: string,
  branchId: string,
): ProjectData {
  const scene = data.story.scenes.find((s) => s.id === sceneId);
  if (!scene) return data;

  const nodes = scene.nodes.map((node) => {
    if (node.id !== nodeId || node.type !== 'choice') return node;
    const options = node.options.map((opt) => {
      if (opt.id !== optionId) return opt;
      const branches = (opt.branches ?? []).filter((b) => b.id !== branchId);
      if (!branches.length) return { ...opt, next: '', branches: undefined };
      return syncOptionNext({ ...opt, branches });
    });
    return { ...node, options };
  });

  return withNodes(data, sceneId, nodes);
}

/** 把某个选项下的分支权重均分（全部设成 1，等比例就是等概率） */
export function evenBranches(
  data: ProjectData,
  sceneId: string,
  nodeId: string,
  optionId: string,
): ProjectData {
  const scene = data.story.scenes.find((s) => s.id === sceneId);
  if (!scene) return data;

  const nodes = scene.nodes.map((node) => {
    if (node.id !== nodeId || node.type !== 'choice') return node;
    const options = node.options.map((opt) => {
      if (opt.id !== optionId || !opt.branches?.length) return opt;
      return { ...opt, branches: opt.branches.map((b) => ({ ...b, weight: 1 })) };
    });
    return { ...node, options };
  });

  return withNodes(data, sceneId, nodes);
}

/** 新增选项 */
export function addOption(data: ProjectData, sceneId: string, nodeId: string): ProjectData {
  const scene = data.story.scenes.find((s) => s.id === sceneId);
  if (!scene) return data;
  const nodes = scene.nodes.map((node) =>
    node.id === nodeId && node.type === 'choice'
      ? { ...node, options: [...node.options, { id: uid('opt'), text: '新选项', next: '' }] }
      : node,
  );
  return withNodes(data, sceneId, nodes);
}

/** 修改选项 */
export function updateOption(
  data: ProjectData,
  sceneId: string,
  nodeId: string,
  optionId: string,
  patch: { text?: string; next?: string },
): ProjectData {
  const scene = data.story.scenes.find((s) => s.id === sceneId);
  if (!scene) return data;
  const nodes = scene.nodes.map((node) =>
    node.id === nodeId && node.type === 'choice'
      ? { ...node, options: node.options.map((o) => (o.id === optionId ? { ...o, ...patch } : o)) }
      : node,
  );
  return withNodes(data, sceneId, nodes);
}

/** 删除选项 */
export function removeOption(data: ProjectData, sceneId: string, nodeId: string, optionId: string): ProjectData {
  const scene = data.story.scenes.find((s) => s.id === sceneId);
  if (!scene) return data;
  const nodes = scene.nodes.map((node) =>
    node.id === nodeId && node.type === 'choice'
      ? { ...node, options: node.options.filter((o) => o.id !== optionId) }
      : node,
  );
  return withNodes(data, sceneId, nodes);
}

/** 上移 / 下移选项 */
export function moveOption(
  data: ProjectData,
  sceneId: string,
  nodeId: string,
  optionId: string,
  delta: number,
): ProjectData {
  const scene = data.story.scenes.find((s) => s.id === sceneId);
  if (!scene) return data;

  const nodes = scene.nodes.map((node) => {
    if (node.id !== nodeId || node.type !== 'choice') return node;
    const idx = node.options.findIndex((o) => o.id === optionId);
    const target = idx + delta;
    if (idx < 0 || target < 0 || target >= node.options.length) return node;
    const options = [...node.options];
    [options[idx], options[target]] = [options[target], options[idx]];
    return { ...node, options };
  });

  return withNodes(data, sceneId, nodes);
}

/** 记录节点拖拽后的位置 */
export function setNodePosition(data: ProjectData, nodeId: string, position: NodePosition): ProjectData {
  return { ...data, layout: { ...data.layout, [nodeId]: position } };
}

/** 批量写入布局 */
export function setLayout(data: ProjectData, layout: Record<string, NodePosition>): ProjectData {
  return { ...data, layout: { ...data.layout, ...layout } };
}

/** 从场景里按 id 取节点 */
export function findNodeIn(data: ProjectData, sceneId: string, nodeId: string): StoryNode | undefined {
  return data.story.scenes.find((s) => s.id === sceneId)?.nodes.find((n) => n.id === nodeId);
}

export { indexOf };
