/**
 * 剧情引擎：把节点图"跑起来"
 *
 * 核心规则：
 * - advance() 从 pendingNodeId 开始执行，一路执行"不需要玩家操作"的节点
 *   （立绘、背景、音频、特效、跳转），直到遇到需要玩家参与的节点：
 *     对话 -> 停下等待点击
 *     选项 -> 停下等待选择
 *     结局 -> 停下并结束
 * - 每次都返回完整的 EngineState，方便直接存档
 */
import { buildStoryIndex, FADE_OUT_IN_SECONDS, FLASH_SECONDS, isOneShotEffect, type ChoiceOption, type StoryIndex } from '@gal/shared';
import type { EngineEvent, EngineState, EngineStep } from './types';

/** 单次推进最多执行多少节点，防止剧本里形成死循环 */
const MAX_STEPS = 2000;

/** 创建初始状态 */
export function createInitialState(storyIndex: StoryIndex, options?: { sceneId?: string; nodeId?: string }): EngineState {
  const sceneId =
    options?.sceneId && storyIndex.sceneById.has(options.sceneId)
      ? options.sceneId
      : storyIndex.story.startSceneId;

  return {
    sceneId,
    currentNodeId: null,
    pendingNodeId: options?.nodeId ?? null,
    chainEnded: false,
    background: null,
    backgroundTransition: 'fade',
    bgm: null,
    sprites: {},
    effects: [],
    reachedEndings: [],
  };
}

/** 从某个节点开始游戏的初始状态 */
export function createStateFromNode(storyIndex: StoryIndex, sceneId: string, nodeId?: string): EngineState {
  return createInitialState(storyIndex, { sceneId, nodeId });
}

/**
 * 推进剧情。
 * 返回的 state 是"新状态"，调用方应当整体替换旧状态。
 *
 * @param options.skipInteraction 为 true 时连"对话"也自动跳过（不返回、直接往下走）。
 *        用途：编辑器预览"从当前节点开始播放"时，先把前面节点的背景/立绘状态跑出来，
 *        这样一进入就能看到正确的舞台画面。
 * @param options.stopAtNodeId 配合 skipInteraction 使用：走到这个节点就停下（预演终点）。
 */
export function advance(
  storyIndex: StoryIndex,
  state: EngineState,
  options?: { skipInteraction?: boolean; stopAtNodeId?: string },
): EngineStep {
  const skipInteraction = options?.skipInteraction === true;
  const stopAtNodeId = options?.stopAtNodeId;
  const events: EngineEvent[] = [];
  // 旧存档可能没有 effects 字段，这里兜底成空数组
  let next: EngineState = { ...state, sprites: { ...state.sprites }, effects: [...(state.effects ?? [])] };

  let sceneId = state.sceneId;
  let pendingNodeId = state.pendingNodeId;
  let chainEnded = state.chainEnded;
  let steps = 0;

  while (steps < MAX_STEPS) {
    steps += 1;

    const scene = storyIndex.sceneById.get(sceneId);
    if (!scene) {
      return { type: 'end-of-story', state: next, events };
    }

    // 0. 已经走到链尾：没有后续节点了
    if (!pendingNodeId && chainEnded) {
      return {
        type: 'end-of-story',
        state: { ...next, sceneId, pendingNodeId: null, chainEnded: true },
        events,
      };
    }

    // 1. 确定本次要执行的节点
    const targetId = pendingNodeId ?? scene.nodes[0]?.id ?? null;
    if (!targetId) {
      // 场景是空的 / 剧情链断了
      return {
        type: 'end-of-story',
        state: { ...next, sceneId, pendingNodeId: null, chainEnded: true },
        events,
      };
    }

    const entry = storyIndex.nodeById.get(targetId);
    if (!entry) {
      return { type: 'end-of-story', state: next, events };
    }

    const node = entry.node;
    // 节点实际所属场景（跨场景连线时纠正过来）
    sceneId = entry.scene.id;

    switch (node.type) {
      // ---------- 需要玩家参与：停下 ----------
      case 'dialogue': {
        if (node.voice) events.push({ kind: 'playVoice', assetId: node.voice });
        next = {
          ...next,
          sceneId,
          currentNodeId: node.id,
          pendingNodeId: node.next ?? null,
          chainEnded: !node.next,
        };
        // 预演模式：跳过对话继续往下走，只为把舞台状态跑出来
        if (skipInteraction) {
          if (stopAtNodeId && node.id === stopAtNodeId) {
            return { type: 'dialogue', node, state: next, events };
          }
          pendingNodeId = node.next ?? null;
          chainEnded = !node.next;
          continue;
        }
        return { type: 'dialogue', node, state: next, events };
      }

      case 'choice': {
        next = { ...next, sceneId, currentNodeId: node.id, pendingNodeId: null, chainEnded: true };
        return { type: 'choice', node, state: next, events };
      }

      case 'ending': {
        const reachedEndings = state.reachedEndings.includes(node.endingId)
          ? state.reachedEndings
          : [...state.reachedEndings, node.endingId];
        next = {
          ...next,
          sceneId,
          currentNodeId: node.id,
          pendingNodeId: null,
          chainEnded: true,
          reachedEndings,
        };
        return { type: 'ending', node, state: next, events };
      }

      // ---------- 不需要玩家参与：执行并继续 ----------
      case 'jump': {
        const target = storyIndex.sceneById.get(node.targetSceneId);
        if (!target) return { type: 'end-of-story', state: next, events };
        sceneId = target.id;
        pendingNodeId = null;
        chainEnded = false; // 进入新场景，从头开始执行
        next = { ...next, sceneId, pendingNodeId: null, chainEnded: false };
        continue;
      }

      case 'setBackground': {
        const transition = node.transition ?? 'fade';
        next = { ...next, sceneId, background: node.assetId || null, backgroundTransition: transition };
        if (node.assetId) events.push({ kind: 'setBackground', assetId: node.assetId, transition });
        pendingNodeId = node.next ?? null;
        chainEnded = !node.next;
        continue;
      }

      case 'showSprite': {
        const transition = node.transition ?? 'fade';
        next = {
          ...next,
          sceneId,
          sprites: {
            ...next.sprites,
            [node.characterId]: {
              characterId: node.characterId,
              expressionId: node.expressionId,
              position: node.position,
              // 自定义位置 / 缩放：可能为 undefined，交给渲染层逐字段回退
              x: node.x,
              y: node.y,
              scale: node.scale,
              transition,
              entering: !state.sprites[node.characterId],
            },
          },
        };
        events.push({
          kind: 'showSprite',
          characterId: node.characterId,
          expressionId: node.expressionId,
          position: node.position,
          x: node.x,
          y: node.y,
          scale: node.scale,
          transition,
        });
        pendingNodeId = node.next ?? null;
        chainEnded = !node.next;
        continue;
      }

      case 'hideSprite': {
        const transition = node.transition ?? 'fade';
        const sprites = { ...next.sprites };
        delete sprites[node.characterId];
        next = { ...next, sceneId, sprites };
        events.push({ kind: 'hideSprite', characterId: node.characterId, transition });
        pendingNodeId = node.next ?? null;
        chainEnded = !node.next;
        continue;
      }

      case 'playBgm': {
        const fadeIn = node.fadeIn ?? 0;
        next = { ...next, sceneId, bgm: { assetId: node.assetId, loop: node.loop } };
        if (node.assetId) events.push({ kind: 'playBgm', assetId: node.assetId, loop: node.loop, fadeIn });
        pendingNodeId = node.next ?? null;
        chainEnded = !node.next;
        continue;
      }

      case 'stopBgm': {
        next = { ...next, sceneId, bgm: null };
        events.push({ kind: 'stopBgm', fadeOut: node.fadeOut ?? 0 });
        pendingNodeId = node.next ?? null;
        chainEnded = !node.next;
        continue;
      }

      case 'playSe': {
        if (node.assetId) events.push({ kind: 'playSe', assetId: node.assetId });
        pendingNodeId = node.next ?? null;
        chainEnded = !node.next;
        continue;
      }

      case 'effect': {
        const target = node.target ?? 'screen';
        const hasLegacyDuration = typeof node.duration === 'number' && node.duration > 0;

        if (hasLegacyDuration || isOneShotEffect(node.effect)) {
          // 限时特效（老项目）或"播放一次就完"的特效（闪白 / 淡出淡入）：
          // 发一次性事件，由视图层自己计时结束，不进引擎状态
          const duration = hasLegacyDuration
            ? (node.duration as number)
            : node.effect === 'flash'
              ? FLASH_SECONDS
              : FADE_OUT_IN_SECONDS;
          events.push({ kind: 'effect', effect: node.effect, duration });
        } else {
          // 持续特效（震动 / 黑白 / 模糊）：进引擎状态，一直生效直到「特效关闭」。
          // 同一个作用对象上的同一种特效只保留一条（重复开启 = 刷新）。
          const entry = {
            effect: node.effect,
            target,
            targetCharacterId: node.target === 'sprite' ? node.targetCharacterId : undefined,
          };
          const effects = next.effects.filter(
            (e) =>
              !(
                e.effect === entry.effect &&
                e.target === entry.target &&
                e.targetCharacterId === entry.targetCharacterId
              ),
          );
          next = { ...next, sceneId, effects: [...effects, entry] };
          events.push({ kind: 'effectOn', ...entry });
        }
        pendingNodeId = node.next ?? null;
        chainEnded = !node.next;
        continue;
      }

      case 'effectOff': {
        // 不指定 effect = 全部关闭；指定了就只关那一种（所有作用对象上的）
        const effects = node.effect ? next.effects.filter((e) => e.effect !== node.effect) : [];
        next = { ...next, sceneId, effects };
        events.push({ kind: 'effectOff', effect: node.effect });
        pendingNodeId = node.next ?? null;
        chainEnded = !node.next;
        continue;
      }

      default:
        return { type: 'end-of-story', state: next, events };
    }
  }

  // 超过步数上限，按"剧情异常结束"处理
  return { type: 'end-of-story', state: next, events };
}

/**
 * 从选项的多个分支里按权重抽一个目标节点。
 *
 * 规则（从旧到新逐层兼容）：
 * - 没有 branches：直接用 next（老项目的行为，完全不变）
 * - branches 只有一条有效分支：用它
 * - branches 多条：按 weight 占比随机抽
 * - 权重全都无效（没填 / 全是 0）：按等概率抽（不会卡死）
 *
 * random 可注入，测试里喂固定随机数就能验证分布，不用靠运气。
 * 单独导出是为了能被测试直接调用。
 */
export function pickOptionTarget(
  option: ChoiceOption,
  random: () => number = Math.random,
): string | undefined {
  const branches = (option.branches ?? []).filter((b) => !!b.next);
  if (!branches.length) return option.next || undefined;
  if (branches.length === 1) return branches[0]!.next;

  const weights = branches.map((b) =>
    Number.isFinite(b.weight) && b.weight > 0 ? b.weight : 0,
  );
  const total = weights.reduce((sum, w) => sum + w, 0);

  // 权重全无效：等概率
  if (total <= 0) {
    const index = Math.min(branches.length - 1, Math.floor(random() * branches.length));
    return branches[index]!.next;
  }

  let remain = random() * total;
  for (let i = 0; i < branches.length; i += 1) {
    remain -= weights[i]!;
    if (remain < 0) return branches[i]!.next;
  }
  // 浮点误差兜底：落到最后一条
  return branches[branches.length - 1]!.next;
}

/**
 * 选择某个选项后继续推进。
 * optionId 不存在时返回当前状态（不推进）。
 */
export function chooseOption(
  storyIndex: StoryIndex,
  state: EngineState,
  optionId: string,
  random: () => number = Math.random,
): EngineStep {
  const current = state.currentNodeId ? storyIndex.nodeById.get(state.currentNodeId)?.node : undefined;
  if (!current || current.type !== 'choice') {
    return { type: 'end-of-story', state, events: [] };
  }

  const option = current.options.find((o) => o.id === optionId);
  // 选项没接线：直接结束，避免卡死
  const target = option ? pickOptionTarget(option, random) : undefined;
  if (!target) {
    return { type: 'end-of-story', state, events: [] };
  }

  const next: EngineState = { ...state, pendingNodeId: target };
  return advance(storyIndex, next);
}

/** 便捷方法：用剧本直接建立索引 */
export function createIndex(story: Parameters<typeof buildStoryIndex>[0]): StoryIndex {
  return buildStoryIndex(story);
}

/**
 * 预演到指定节点：从场景开头一路执行（跳过对话）把舞台状态（背景 / 立绘 / BGM）跑出来，
 * 返回"到达目标节点时的状态"，让接下来的 advance() 正好显示这个节点。
 * 用于编辑器"从选中节点开始预览"。
 *
 * ⚠️ 这里有个曾经踩过的坑：**预演走不到目标节点时，也必须把游标拨到目标节点上**。
 * advance() 遇到「选项」节点会停下（无法自动替玩家选），并返回
 * pendingNodeId: null / chainEnded: true 的状态 —— 而这两个值正好是
 * advance() 判定"剧情结束"的条件，于是预览里一进去就显示"这段剧情结束了"。
 * 所以凡是位于选项分支里、或者没跟主链连起来的节点，都会踩到这个坑。
 */
export function simulateTo(storyIndex: StoryIndex, sceneId: string, nodeId: string): EngineState {
  // 以目标节点真正所属的场景为准：跨场景选中时传进来的 sceneId 可能是错的
  const targetSceneId = storyIndex.nodeById.get(nodeId)?.scene.id ?? sceneId;

  let state = createInitialState(storyIndex, { sceneId: targetSceneId });

  for (let i = 0; i < MAX_STEPS; i += 1) {
    const step = advance(storyIndex, state, { skipInteraction: true, stopAtNodeId: nodeId });

    // 正常走到目标节点：把游标拨回目标本身，让下一次 advance() 显示它
    if (step.state.currentNodeId === nodeId) {
      return { ...step.state, pendingNodeId: nodeId, chainEnded: false };
    }

    // 先收下这一步跑出来的舞台状态（背景 / 立绘 / BGM 都在里面）
    state = step.state;

    // 选项节点无法自动选择、或者已经走到场景末尾：停止预演
    if (step.type === 'choice' || step.type === 'end-of-story') break;
  }

  // 兜底：目标节点不在"从场景头开始的主链"上（在选项分支里、或是单独摆的节点），
  // 预演拿不到它的舞台状态，但至少要保证它能被播放出来——把游标直接指向它。
  return {
    ...state,
    sceneId: targetSceneId,
    currentNodeId: null,
    pendingNodeId: nodeId,
    chainEnded: false,
  };
}
