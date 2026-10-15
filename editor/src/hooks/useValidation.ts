/**
 * 校验结果 hook：整个编辑器共享一份校验数据
 */
import { useMemo } from 'react';
import { summarizeIssues, validateStory, type Issue } from '@gal/shared';
import { useProjectStore } from '../store/projectStore';

export type ValidationResult = {
  issues: Issue[];
  errors: number;
  warnings: number;
  /** 节点 id -> 该节点的问题 */
  byNode: Map<string, Issue[]>;
  /** 场景 id -> 该场景的问题 */
  byScene: Map<string, Issue[]>;
};

export function useValidation(): ValidationResult {
  const story = useProjectStore((s) => s.data.story);

  return useMemo(() => {
    const issues = validateStory(story);
    const byNode = new Map<string, Issue[]>();
    const byScene = new Map<string, Issue[]>();

    for (const issue of issues) {
      if (issue.nodeId) {
        byNode.set(issue.nodeId, [...(byNode.get(issue.nodeId) ?? []), issue]);
      }
      if (issue.sceneId) {
        byScene.set(issue.sceneId, [...(byScene.get(issue.sceneId) ?? []), issue]);
      }
    }

    const { errors, warnings } = summarizeIssues(issues);
    return { issues, errors, warnings, byNode, byScene };
  }, [story]);
}
