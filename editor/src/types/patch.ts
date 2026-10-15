/**
 * 节点属性补丁类型
 * 把 11 种节点的字段合并成一个"全可选"对象，属性面板改字段时用。
 */
import type {
  ChoiceNode,
  DialogueNode,
  EffectNode,
  EffectOffNode,
  EndingNode,
  HideSpriteNode,
  JumpNode,
  NodeCommonFields,
  PlayBgmNode,
  PlaySeNode,
  SetBackgroundNode,
  ShowSpriteNode,
  StopBgmNode,
} from '@gal/shared';

type Omit1<T> = Omit<T, 'id' | 'type'>;

export type AnyNodeFields = Omit1<DialogueNode> &
  Omit1<ChoiceNode> &
  Omit1<ShowSpriteNode> &
  Omit1<HideSpriteNode> &
  Omit1<SetBackgroundNode> &
  Omit1<PlayBgmNode> &
  Omit1<StopBgmNode> &
  Omit1<PlaySeNode> &
  Omit1<EffectNode> &
  Omit1<EffectOffNode> &
  Omit1<JumpNode> &
  Omit1<EndingNode> &
  // 节点名字是所有类型共有的可选字段（见 shared 的 NodeCommonFields）
  NodeCommonFields;

/** 节点字段补丁 */
export type NodePatch = Partial<AnyNodeFields>;
