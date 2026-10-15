/**
 * 节点在画布上的展示文案
 */
import {
  EFFECT_LABELS,
  EFFECT_TARGET_LABELS,
  NODE_ICONS,
  NODE_LABELS,
  POSITION_LABELS,
  TRANSITION_LABELS,
  hasOptionExit,
  isOneShotEffect,
  type Story,
  type StoryNode,
} from '@gal/shared';

export type NodeSummary = {
  /** 顶部小标题：节点类型名 */
  label: string;
  /** 节点名：作者起的名字，没起名就是自动序号「#3」 */
  displayName: string;
  /** 主内容（对话正文 / 角色名 / 素材名） */
  title: string;
  /** 次要信息 */
  detail?: string;
  /** 状态标记 */
  tags: string[];
};

/**
 * 节点显示名：作者起的名字优先；没起名就用它在场景里的序号（从 1 开始）。
 * 拿不到序号时返回空串（调用方自己决定回退成什么）。
 */
export function nodeDisplayName(node: StoryNode, index?: number): string {
  const custom = node.name?.trim();
  if (custom) return custom;
  return typeof index === 'number' ? `#${index + 1}` : '';
}

/** 下拉列表里的一行节点文案：图标 + 类型 + 名字（或序号）+ 内容摘要 */
export function nodeOptionLabel(node: StoryNode, story: Story, index?: number): string {
  const summary = summarizeNode(node, story, index);
  const head = [NODE_LABELS[node.type], summary.displayName].filter(Boolean).join(' ');
  // 对话节点的 title 是说话人（旁白居多），认不出是哪一句，所以优先显示台词本身
  const content = node.type === 'dialogue' ? (summary.detail ?? summary.title) : summary.title;
  return `${NODE_ICONS[node.type]} ${head} · ${content}`;
}

/** 名称截断 */
function clip(text: string, max = 46): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

/** 取素材名 */
function assetName(story: Story, category: 'backgrounds' | 'bgms' | 'ses', id: string): string {
  if (!id) return '未选择';
  return story[category].find((a) => a.id === id)?.name ?? '素材已删除';
}

/** 取角色名 */
function charName(story: Story, id: string): string {
  if (!id) return '未指定角色';
  return story.characters.find((c) => c.id === id)?.name ?? '角色已删除';
}

/** 生成节点摘要 */
export function summarizeNode(node: StoryNode, story: Story, index?: number): NodeSummary {
  return { ...summarizeNodeBody(node, story), displayName: nodeDisplayName(node, index) };
}

/** 摘要正文（各类型分别处理；label / displayName 由 summarizeNode 统一补上） */
function summarizeNodeBody(node: StoryNode, story: Story): Omit<NodeSummary, 'displayName'> {
  const label = NODE_LABELS[node.type];
  const tags: string[] = [];

  switch (node.type) {
    case 'dialogue': {
      const speaker = node.speaker ? charName(story, node.speaker) : '旁白';
      if (!node.text.trim()) tags.push('空台词');
      if (node.voice) tags.push('有语音');
      if (typeof node.speed === 'number') tags.push(`速度 ${node.speed}ms`);
      return { label, title: speaker, detail: node.text.trim() ? clip(node.text) : '（还没写台词）', tags };
    }
    case 'choice': {
      if (!node.options.length) tags.push('没有选项');
      const missing = node.options.filter((o) => !hasOptionExit(o)).length;
      if (missing) tags.push(`${missing} 项未连线`);
      const branchTotal = node.options.reduce((n, o) => n + (o.branches?.length ?? 0), 0);
      if (branchTotal) tags.push(`${branchTotal} 个概率分支`);
      return {
        label,
        title: node.prompt?.trim() ? clip(node.prompt, 24) : '选择',
        detail:
          node.options
            .map((o) => {
              const count = o.branches?.length ?? 0;
              return count > 1 ? `${o.text || '（空选项）'}（${count} 分支）` : o.text;
            })
            .join(' / ') || '（还没有选项）',
        tags,
      };
    }
    case 'showSprite': {
      const character = story.characters.find((c) => c.id === node.characterId);
      const expr = character?.sprites.expressions.find((e) => e.id === node.expressionId);
      if (!character) tags.push('未指定角色');
      else if (!character.sprites.base) tags.push('缺立绘');
      // position 是可选的旧字段：新节点可能只写了 x/y
      const positionLabel = node.position ? POSITION_LABELS[node.position] : '自定义位置';
      return {
        label,
        title: charName(story, node.characterId),
        detail: `${expr ? expr.name : '基础立绘'} · ${positionLabel}${
          node.transition && node.transition !== 'none' ? ` · ${TRANSITION_LABELS[node.transition]}` : ''
        }`,
        tags,
      };
    }
    case 'hideSprite':
      return {
        label,
        title: charName(story, node.characterId),
        detail: `${TRANSITION_LABELS[node.transition ?? 'none']} 退场`,
        tags: node.characterId ? [] : ['未指定角色'],
      };
    case 'setBackground': {
      if (!node.assetId) tags.push('未选背景');
      return {
        label,
        title: assetName(story, 'backgrounds', node.assetId),
        detail: TRANSITION_LABELS[node.transition ?? 'fade'],
        tags,
      };
    }
    case 'playBgm': {
      if (!node.assetId) tags.push('未选音乐');
      return {
        label,
        title: assetName(story, 'bgms', node.assetId),
        detail: `${node.loop ? '循环' : '播放一次'}${node.fadeIn ? ` · 淡入 ${node.fadeIn}s` : ''}`,
        tags,
      };
    }
    case 'stopBgm':
      return { label, title: '停止背景音乐', detail: node.fadeOut ? `淡出 ${node.fadeOut}s` : '立即停止', tags };
    case 'playSe': {
      if (!node.assetId) tags.push('未选音效');
      return { label, title: assetName(story, 'ses', node.assetId), detail: '播放一次', tags };
    }
    case 'effect': {
      const legacy = typeof node.duration === 'number' && node.duration > 0;
      let detail: string;
      if (legacy) {
        detail = `旧版限时 ${node.duration}s`;
      } else if (isOneShotEffect(node.effect)) {
        detail = '播放一次';
      } else if (node.target === 'sprite') {
        detail = `持续 · ${charName(story, node.targetCharacterId ?? '')}的立绘`;
      } else {
        detail = `持续 · ${EFFECT_TARGET_LABELS[node.target ?? 'screen']}`;
      }
      return { label, title: EFFECT_LABELS[node.effect], detail, tags };
    }
    case 'effectOff':
      return {
        label,
        title: node.effect ? `关闭${EFFECT_LABELS[node.effect]}` : '关闭全部特效',
        detail: '画面恢复正常',
        tags,
      };
    case 'jump': {
      const scene = story.scenes.find((s) => s.id === node.targetSceneId);
      if (!scene) tags.push('未指定场景');
      return { label, title: scene?.name ?? '未指定场景', detail: '继续到另一个场景', tags };
    }
    case 'ending': {
      const ending = story.endings.find((e) => e.id === node.endingId);
      if (!ending) tags.push('未指定结局');
      return { label, title: ending?.name ?? '未指定结局', detail: '游戏结束', tags };
    }
    default:
      return { label, title: '', tags };
  }
}
