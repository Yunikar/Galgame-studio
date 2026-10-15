/**
 * 剧本校验：导出前的体检
 * 规则覆盖需求里点名的三类问题：悬空节点、未设置的素材、没有结局的线路。
 */
import { EFFECT_LABELS, NODE_LABELS, isOneShotEffect } from './constants';
import { buildStoryIndex, collectReachableFromStart, hasExit } from './flow';
import { isChainNode } from './story';
import type { Asset, AssetCategory, Story, StoryNode } from './types';

export type IssueLevel = 'error' | 'warning';

/** 问题指向的资源分类（比素材分类多一个"角色"，方便点问题时定位到角色 Tab） */
export type IssueCategory = AssetCategory | 'characters';

export type Issue = {
  level: IssueLevel;
  message: string;
  sceneId?: string;
  nodeId?: string;
  /** 点击问题时编辑器把焦点切到哪里 */
  focus?: 'node' | 'asset' | 'ending' | 'story';
  /** 焦点对应的素材分类（focus=asset 时有效） */
  category?: IssueCategory;
};

/** 汇总校验结果 */
export function summarizeIssues(issues: Issue[]): { errors: number; warnings: number } {
  return {
    errors: issues.filter((i) => i.level === 'error').length,
    warnings: issues.filter((i) => i.level === 'warning').length,
  };
}

/** 取某类素材表 */
export function assetListOf(story: Story, category: AssetCategory): Asset[] {
  return story[category] ?? [];
}

/** 素材 id 是否存在于指定分类 */
export function assetExists(
  story: Story,
  category: AssetCategory,
  assetId: string | undefined,
): boolean {
  if (!assetId) return false;
  return assetListOf(story, category).some((a) => a.id === assetId);
}

/** 根据节点里引用的素材，反查它应该属于哪个分类 */
function categoriesForNode(node: StoryNode): { category: AssetCategory; assetId?: string; label: string }[] {
  switch (node.type) {
    case 'setBackground':
      return [{ category: 'backgrounds', assetId: node.assetId, label: '背景' }];
    case 'playBgm':
      return [{ category: 'bgms', assetId: node.assetId, label: 'BGM' }];
    case 'playSe':
      return [{ category: 'ses', assetId: node.assetId, label: '音效' }];
    default:
      return [];
  }
}

/**
 * 校验整个剧本。
 * 返回的 Issue 列表已按"错误优先"排序，编辑器可直接展示。
 */
export function validateStory(story: Story): Issue[] {
  const issues: Issue[] = [];
  const index = buildStoryIndex(story);

  // 1. 基础结构
  if (!story.meta.title.trim()) {
    issues.push({ level: 'warning', message: '剧本还没有标题，标题画面会显示"未命名作品"', focus: 'story' });
  }
  if (!story.scenes.length) {
    issues.push({ level: 'error', message: '剧本里一个场景都没有，至少需要创建一个场景', focus: 'story' });
    return orderIssues(issues);
  }
  if (!index.sceneById.has(story.startSceneId)) {
    issues.push({ level: 'error', message: '起始场景不存在，请在场景下拉里指定「起始场景」', focus: 'story' });
  }
  if (!story.endings.length) {
    issues.push({ level: 'error', message: '还没有定义任何结局，游戏将无法正常结束', focus: 'ending' });
  }

  // 2. 逐场景逐节点
  const nodeIdCount = new Map<string, number>();
  for (const scene of story.scenes) {
    if (!scene.nodes.length) {
      issues.push({
        level: 'warning',
        message: `场景「${scene.name}」里没有任何节点`,
        sceneId: scene.id,
      });
      continue;
    }

    for (const node of scene.nodes) {
      nodeIdCount.set(node.id, (nodeIdCount.get(node.id) ?? 0) + 1);

      // 2.1 链式节点：出口检查（悬空节点）
      if (isChainNode(node) && !hasExit(node)) {
        issues.push({
          level: 'error',
          message: `「${scene.name}」里的${NODE_LABELS[node.type]}节点没有后继：剧情会在这里卡住，请连线到下一个节点或结局`,
          sceneId: scene.id,
          nodeId: node.id,
          focus: 'node',
        });
      }

      // 2.2 连线指向的目标必须存在
      if (isChainNode(node) && node.next && !index.nodeById.has(node.next)) {
        issues.push({
          level: 'error',
          message: `「${scene.name}」里的${NODE_LABELS[node.type]}节点连线指向了一个已删除的节点`,
          sceneId: scene.id,
          nodeId: node.id,
          focus: 'node',
        });
      }

      // 2.3 分支节点：每个选项都要有落点（一个选项可能挂多个概率分支）
      if (node.type === 'choice') {
        if (!node.options.length) {
          issues.push({
            level: 'error',
            message: `「${scene.name}」里有一个选项节点没有任何选项`,
            sceneId: scene.id,
            nodeId: node.id,
            focus: 'node',
          });
        }
        node.options.forEach((opt, i) => {
          const optionName = `选项「${opt.text || `第 ${i + 1} 项`}」`;
          const branches = opt.branches ?? [];

          // 没有分支：和以前完全一样的单出口检查
          if (!branches.length) {
            if (!opt.next) {
              issues.push({
                level: 'error',
                message: `「${scene.name}」${optionName}没有连线到后续节点`,
                sceneId: scene.id,
                nodeId: node.id,
                focus: 'node',
              });
            } else if (!index.nodeById.has(opt.next)) {
              issues.push({
                level: 'error',
                message: `「${scene.name}」${optionName}指向了已删除的节点`,
                sceneId: scene.id,
                nodeId: node.id,
                focus: 'node',
              });
            }
            return;
          }

          // 概率分支：逐条检查落点和权重
          let reachable = 0;
          let usableWeight = 0;
          branches.forEach((branch, bi) => {
            const branchName = `${optionName}的第 ${bi + 1} 个分支`;
            if (!branch.next) {
              issues.push({
                level: 'error',
                message: `「${scene.name}」${branchName}没有指定后续节点`,
                sceneId: scene.id,
                nodeId: node.id,
                focus: 'node',
              });
            } else if (!index.nodeById.has(branch.next)) {
              issues.push({
                level: 'error',
                message: `「${scene.name}」${branchName}指向了已删除的节点`,
                sceneId: scene.id,
                nodeId: node.id,
                focus: 'node',
              });
            } else {
              reachable += 1;
            }

            if (!Number.isFinite(branch.weight) || branch.weight < 0) {
              issues.push({
                level: 'error',
                message: `「${scene.name}」${branchName}的权重不是有效数字（填 0 或正数）`,
                sceneId: scene.id,
                nodeId: node.id,
                focus: 'node',
              });
            } else if (branch.weight > 0) {
              usableWeight += 1;
            }
          });

          // 权重全为 0 不会卡死（引擎按等概率抽），但多半不是作者的本意
          if (reachable > 0 && !usableWeight) {
            issues.push({
              level: 'warning',
              message: `「${scene.name}」${optionName}的所有分支权重都是 0，游戏里会按等概率随机；填正数才能控制比例`,
              sceneId: scene.id,
              nodeId: node.id,
              focus: 'node',
            });
          }
        });
      }

      // 2.4 素材类节点：必须选素材，且素材必须存在
      for (const ref of categoriesForNode(node)) {
        if (!ref.assetId) {
          issues.push({
            level: 'error',
            message: `「${scene.name}」里的${NODE_LABELS[node.type]}节点还没有选择${ref.label}`,
            sceneId: scene.id,
            nodeId: node.id,
            focus: 'node',
          });
        } else if (!assetExists(story, ref.category, ref.assetId)) {
          issues.push({
            level: 'error',
            message: `「${scene.name}」里的${NODE_LABELS[node.type]}节点引用的${ref.label}素材已被删除`,
            sceneId: scene.id,
            nodeId: node.id,
            focus: 'node',
          });
        }
      }

      // 2.5 立绘节点
      if (node.type === 'showSprite') {
        const character = story.characters.find((c) => c.id === node.characterId);
        if (!character) {
          issues.push({
            level: 'error',
            message: `「${scene.name}」里的显示立绘节点没有指定角色`,
            sceneId: scene.id,
            nodeId: node.id,
            focus: 'node',
          });
        } else {
          if (!character.sprites.base) {
            issues.push({
              level: 'error',
              message: `角色「${character.name}」还没有上传基础立绘`,
              sceneId: scene.id,
              nodeId: node.id,
              focus: 'asset',
              category: 'characters',
            });
          }
          if (node.expressionId) {
            const expr = character.sprites.expressions.find((e) => e.id === node.expressionId);
            if (!expr) {
              issues.push({
                level: 'warning',
                message: `角色「${character.name}」指定的表情差分已被删除，将回退为基础立绘`,
                sceneId: scene.id,
                nodeId: node.id,
                focus: 'node',
              });
            } else if (!expr.assetId) {
              issues.push({
                level: 'warning',
                message: `角色「${character.name}」的差分「${expr.name}」还没有上传图片`,
                sceneId: scene.id,
                nodeId: node.id,
                focus: 'node',
              });
            }
          }
        }
      }

      if (node.type === 'hideSprite' && !story.characters.some((c) => c.id === node.characterId)) {
        issues.push({
          level: 'warning',
          message: `「${scene.name}」里的隐藏立绘节点没有指定角色`,
          sceneId: scene.id,
          nodeId: node.id,
          focus: 'node',
        });
      }

      // 2.5b 特效节点：作用在立绘上时必须指定角色
      if (node.type === 'effect' && node.target === 'sprite' && !story.characters.some((c) => c.id === node.targetCharacterId)) {
        issues.push({
          level: 'error',
          message: `「${scene.name}」里的特效「${EFFECT_LABELS[node.effect]}」选择了作用在立绘上，但没有指定角色，特效不会生效`,
          sceneId: scene.id,
          nodeId: node.id,
          focus: 'node',
        });
      }

      // 2.6 对话节点的语音
      if (node.type === 'dialogue' && node.voice && !assetExists(story, 'voices', node.voice)) {
        issues.push({
          level: 'warning',
          message: `「${scene.name}」有一句台词引用的语音已被删除`,
          sceneId: scene.id,
          nodeId: node.id,
          focus: 'node',
        });
      }

      // 2.7 对话节点空文本
      if (node.type === 'dialogue' && !node.text.trim()) {
        issues.push({
          level: 'warning',
          message: `「${scene.name}」里有一句空台词，游戏里会显示空白对话框`,
          sceneId: scene.id,
          nodeId: node.id,
          focus: 'node',
        });
      }

      // 2.8 跳转 / 结局
      if (node.type === 'jump' && !index.sceneById.has(node.targetSceneId)) {
        issues.push({
          level: 'error',
          message: `「${scene.name}」里的跳转节点没有指定目标场景`,
          sceneId: scene.id,
          nodeId: node.id,
          focus: 'node',
        });
      }
      if (node.type === 'ending' && !story.endings.some((e) => e.id === node.endingId)) {
        issues.push({
          level: 'error',
          message: `「${scene.name}」里的结局节点没有指定结局（或结局已被删除）`,
          sceneId: scene.id,
          nodeId: node.id,
          focus: 'node',
        });
      }
    }
  }

  // 3. 全局：节点 id 重复
  for (const [id, count] of nodeIdCount) {
    if (count > 1) {
      issues.push({
        level: 'warning',
        message: `有 ${count} 个节点的 id 重复（${id}），可能导致剧情跳转错乱`,
        focus: 'story',
      });
    }
  }

  // 4. 全局：有没有线路能走到结局
  const reachable = collectReachableFromStart(index);
  const canReachEnding = [...reachable].some((id) => index.nodeById.get(id)?.node.type === 'ending');
  if (!canReachEnding) {
    issues.push({
      level: 'error',
      message: '没有任何线路能走到结局：请从起始场景出发，一路连线到一个「结局」节点',
      focus: 'story',
    });
  }

  // 5. 全局：不可达节点（孤岛）
  for (const scene of story.scenes) {
    for (const node of scene.nodes) {
      if (!reachable.has(node.id) && node.type !== 'ending') {
        issues.push({
          level: 'warning',
          message: `「${scene.name}」里的${NODE_LABELS[node.type]}节点不会被执行（从开始游戏走不到这里）`,
          sceneId: scene.id,
          nodeId: node.id,
          focus: 'node',
        });
      }
    }
  }

  // 6. 资源体检
  if (!story.characters.length) {
    issues.push({ level: 'warning', message: '还没有创建任何角色，全部台词会以旁白显示', focus: 'asset', category: 'characters' });
  }
  if (!story.backgrounds.length) {
    issues.push({ level: 'warning', message: '还没有上传任何背景图，游戏画面会是纯色背景', focus: 'asset', category: 'backgrounds' });
  }
  for (const character of story.characters) {
    if (!character.name.trim()) {
      issues.push({ level: 'warning', message: '有角色还没填名字', focus: 'asset', category: 'characters' });
    }
  }

  // 7. 全局：持续特效有没有办法被关掉
  //    震动 / 黑白 / 模糊开启后会一直生效；剧本里连一个「特效关闭」都没有，
  //    多半是作者忘了关（画面会一直震 / 一直模糊到结局）。粗粒度提醒，不做链路分析。
  const hasSustainedEffect = story.scenes.some((scene) =>
    scene.nodes.some(
      (node) => node.type === 'effect' && !node.duration && !isOneShotEffect(node.effect),
    ),
  );
  const hasEffectOff = story.scenes.some((scene) => scene.nodes.some((node) => node.type === 'effectOff'));
  if (hasSustainedEffect && !hasEffectOff) {
    issues.push({
      level: 'warning',
      message: '有持续生效的特效（震动/黑白/模糊），但剧本里没有「特效关闭」节点，特效会一直持续到剧情结束',
      focus: 'story',
    });
  }

  return orderIssues(issues);
}

/** 错误排前面，方便用户先看关键问题 */
function orderIssues(issues: Issue[]): Issue[] {
  return [...issues].sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1));
}
