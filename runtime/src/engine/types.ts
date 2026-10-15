/**
 * 引擎状态与事件类型
 * 引擎是纯逻辑（不碰 DOM、不碰 React），视图层只负责"把结果画出来 + 执行事件"。
 */
import type { EffectTarget, EffectType, SpritePosition, StoryNode, Transition } from '@gal/shared';

/** 舞台上正在显示的立绘 */
export type SpriteState = {
  characterId: string;
  expressionId?: string;
  /** 旧字段：左/中/右（没有 x 时用来算横向位置） */
  position?: SpritePosition;
  /** 自定义横向位置（0~100，舞台宽度百分比）；不填则用 position 推算 */
  x?: number;
  /** 自定义纵向位置（0~100，舞台高度百分比，锚点=底部中心）；不填按 100 */
  y?: number;
  /** 缩放倍数；不填按 1 */
  scale?: number;
  transition: Transition;
  /** 用于让视图层知道这是"新出现的"还是"已经在台上的" */
  entering: boolean;
};

/**
 * 正在生效的持续特效（震动 / 黑白 / 模糊）。
 * 放进 EngineState 意味着：存档 / 读档 / 预演时特效状态都能跟着走。
 */
export type ActiveEffectEntry = {
  effect: EffectType;
  target: EffectTarget;
  /** target='sprite' 时：作用在哪个角色的立绘上 */
  targetCharacterId?: string;
};

/** 引擎状态：存档时把这一坨整个存下来 */
export type EngineState = {
  /** 当前所在场景 */
  sceneId: string;
  /** 当前正在显示的节点（对话框上的那一句） */
  currentNodeId: string | null;
  /** 下一个要执行的节点；null 表示从场景第一个节点开始 */
  pendingNodeId: string | null;
  /**
   * 剧情链是否已经走完。
   * 用来区分两种情况：pendingNodeId 为 null 时，是要"从场景开头开始"，
   * 还是"这一段已经讲完了"。没有它会在链尾不停地从头重播同一句台词。
   */
  chainEnded: boolean;
  /** 当前背景 assetId */
  background: string | null;
  /** 当前背景切换用的转场 */
  backgroundTransition: Transition;
  /** 当前 BGM */
  bgm: { assetId: string; loop: boolean } | null;
  /** 台上的立绘，按角色 id 索引 */
  sprites: Record<string, SpriteState>;
  /** 正在生效的持续特效（旧存档没有这个字段，读取时按空数组处理） */
  effects: ActiveEffectEntry[];
  /** 已经触发过的结局（用于存档界面展示） */
  reachedEndings: string[];
};

/** 视图层需要执行的副作用 */
export type EngineEvent =
  | { kind: 'setBackground'; assetId: string; transition: Transition }
  | { kind: 'showSprite'; characterId: string; expressionId?: string; position?: SpritePosition; x?: number; y?: number; scale?: number; transition: Transition }
  | { kind: 'hideSprite'; characterId: string; transition: Transition }
  | { kind: 'playBgm'; assetId: string; loop: boolean; fadeIn: number }
  | { kind: 'stopBgm'; fadeOut: number }
  | { kind: 'playSe'; assetId: string }
  | { kind: 'playVoice'; assetId: string }
  /** 播放一次性特效（老项目的限时特效 / 新的闪白、淡出淡入） */
  | { kind: 'effect'; effect: EffectType; duration: number }
  | { kind: 'effectOn'; effect: EffectType; target: EffectTarget; targetCharacterId?: string }
  | { kind: 'effectOff'; effect?: EffectType };

/** 一次推进的结果类型 */
export type EngineStepType = 'dialogue' | 'choice' | 'ending' | 'end-of-story';

/** 推进结果 */
export type EngineStep = {
  type: EngineStepType;
  /** 需要玩家看到的节点（结束或异常时可能为空） */
  node?: StoryNode;
  /** 推进后的新状态 */
  state: EngineState;
  /** 这次推进过程中产生的副作用 */
  events: EngineEvent[];
};
