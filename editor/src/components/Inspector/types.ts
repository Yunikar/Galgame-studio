/**
 * 属性面板各表单的统一入参
 */
import type { StoryNode } from '@gal/shared';
import type { NodePatch } from '../../types/patch';

export type NodeFormProps<T extends StoryNode = StoryNode> = {
  node: T;
  sceneId: string;
  /** 修改节点字段 */
  onChange: (patch: NodePatch) => void;
  /** 选中并跳转到另一个节点（用于选择"下一个节点"后定位） */
  onFocusNode?: (nodeId: string) => void;
};
