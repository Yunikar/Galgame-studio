/**
 * 剧本数据模型定义（story.json 的唯一权威来源）
 * 编辑器与运行时都从这里引用，保证两侧结构永远一致。
 */

/** 转场方式 */
export type Transition = 'none' | 'fade' | 'slideLeft' | 'slideRight';

/** 立绘位置 */
export type SpritePosition = 'left' | 'center' | 'right';

/** 特效类型 */
export type EffectType = 'shake' | 'flash' | 'fadeOutIn' | 'blackAndWhite' | 'blur';

/** 特效作用对象 */
export type EffectTarget = 'screen' | 'dialogue' | 'sprite';

/** 素材引用（写入 story.json 的轻量结构，真正的文件放在 assets/ 目录） */
export type Asset = {
  id: string;
  /** 显示名，编辑器里用 */
  name: string;
  /** 相对游戏根目录的路径，如 assets/bg_1712345678.png */
  path: string;
};

/** 角色差分表情 */
export type CharacterExpression = {
  id: string;
  /** 如 "微笑" "生气" */
  name: string;
  assetId: string;
};

/** 角色 */
export type Character = {
  id: string;
  /** 显示名 */
  name: string;
  /** 名字颜色，如 "#ff88aa" */
  color?: string;
  sprites: {
    /** 基础立绘 assetId */
    base: string;
    /** 表情差分，叠加在 base 上 */
    expressions: CharacterExpression[];
  };
};

/** 对话节点 */
export type DialogueNode = {
  id: string;
  type: 'dialogue';
  /** 说话人角色 id，空表示旁白 */
  speaker?: string;
  text: string;
  /** 语音 assetId */
  voice?: string;
  /** 打字机速度覆盖（毫秒/字），0 表示瞬间显示 */
  speed?: number;
  next?: string;
};

/**
 * 选项的一个后续分支。
 * 一个选项可以挂多个分支，走到这个选项时按 weight 权重随机抽一条 —— 这就是"概率分支"。
 */
export type ChoiceBranch = {
  id: string;
  /** 后继节点 id */
  next: string;
  /**
   * 相对权重（>= 0），只是比例，不是百分比。
   * 比如 3 和 1 就是 75% / 25%；填 0 表示这一支不会被抽到。
   */
  weight: number;
};

/** 选项节点里的一个选项 */
export type ChoiceOption = {
  id: string;
  text: string;
  /**
   * 唯一出口。
   * - 没有 branches（旧项目 / 单分支）：就是它，行为与以前完全一致
   * - 有 branches：编辑器会把它同步成第一个分支的 next，
   *   这样即使导出后用旧版运行时打开，也还能沿第一条分支走下去
   */
  next: string;
  /**
   * 多个分支（按概率随机抽一条）。
   * 不填或空数组 = 完全走 next，老项目零影响。
   */
  branches?: ChoiceBranch[];
};

/** 选项节点 */
export type ChoiceNode = {
  id: string;
  type: 'choice';
  prompt?: string;
  options: ChoiceOption[];
};

/** 显示立绘 */
export type ShowSpriteNode = {
  id: string;
  type: 'showSprite';
  characterId: string;
  expressionId?: string;
  /**
   * 横向位置：0~100，相对舞台宽度的百分比（50 = 水平居中）。
   * 不填时回退到旧的 position（左 16% / 中 50% / 右 84%），保证旧项目画面不变。
   */
  x?: number;
  /**
   * 纵向位置：0~100，相对舞台高度的百分比，锚点在立绘的「底部中心」。
   * 100 = 站在舞台底边（旧版本的效果）。不填按 100 处理。
   */
  y?: number;
  /** 缩放倍数：1.0 = 原始大小（此时立绘高度为舞台的 78%）。不填按 1 处理 */
  scale?: number;
  /** 旧字段：左 / 中 / 右快捷位置，保留用于兼容旧项目 */
  position?: SpritePosition;
  transition?: Transition;
  next?: string;
};

/** 隐藏立绘 */
export type HideSpriteNode = {
  id: string;
  type: 'hideSprite';
  characterId: string;
  transition?: Transition;
  next?: string;
};

/** 切换背景 */
export type SetBackgroundNode = {
  id: string;
  type: 'setBackground';
  assetId: string;
  transition?: Transition;
  next?: string;
};

/** 播放 BGM */
export type PlayBgmNode = {
  id: string;
  type: 'playBgm';
  assetId: string;
  loop: boolean;
  /** 淡入秒数 */
  fadeIn?: number;
  next?: string;
};

/** 停止 BGM */
export type StopBgmNode = {
  id: string;
  type: 'stopBgm';
  fadeOut?: number;
  next?: string;
};

/** 播放音效 */
export type PlaySeNode = {
  id: string;
  type: 'playSe';
  assetId: string;
  next?: string;
};

/** 画面特效（开启） */
export type EffectNode = {
  id: string;
  type: 'effect';
  effect: EffectType;
  /** 作用对象：整个画面 / 对话框 / 某个角色的立绘。不填 = 整个画面（老项目行为） */
  target?: EffectTarget;
  /** target='sprite' 时：作用在哪个角色的立绘上 */
  targetCharacterId?: string;
  /**
   * 旧版本字段：持续秒数。
   * 带 duration 的节点播放到时间自动结束（老项目行为完全不变）；
   * 新节点不写它：震动 / 黑白 / 模糊会一直生效，直到「特效关闭」节点把它关掉。
   * （闪白 / 淡出淡入是"播放一次就完"的特效，永远不需要关闭。）
   */
  duration?: number;
  next?: string;
};

/** 关闭特效 */
export type EffectOffNode = {
  id: string;
  type: 'effectOff';
  /** 要关闭的特效；不填 = 关闭全部特效 */
  effect?: EffectType;
  next?: string;
};

/** 跳转到其他场景 */
export type JumpNode = {
  id: string;
  type: 'jump';
  targetSceneId: string;
};

/** 进入结局 */
export type EndingNode = {
  id: string;
  type: 'ending';
  endingId: string;
};

/** 所有节点共有的可选字段 */
export type NodeCommonFields = {
  /** 作者给这个节点起的名字；留空时编辑器按"场景内序号"显示成 #1、#2…… */
  name?: string;
};

/** 所有节点类型的联合 */
export type StoryNode = (
  | DialogueNode
  | ChoiceNode
  | ShowSpriteNode
  | HideSpriteNode
  | SetBackgroundNode
  | PlayBgmNode
  | StopBgmNode
  | PlaySeNode
  | EffectNode
  | EffectOffNode
  | JumpNode
  | EndingNode
) &
  NodeCommonFields;

/** 节点类型字面量 */
export type NodeType = StoryNode['type'];

/** 带 next 的节点（用于图连线，可以串成一条链） */
export type ChainNode =
  | DialogueNode
  | ShowSpriteNode
  | HideSpriteNode
  | SetBackgroundNode
  | PlayBgmNode
  | StopBgmNode
  | PlaySeNode
  | EffectNode
  | EffectOffNode;

/** 场景：一段连续剧情，对应节点图里的一张画布 */
export type Scene = {
  id: string;
  /** 编辑器里显示的场景名 */
  name: string;
  nodes: StoryNode[];
};

/** 结局 */
export type Ending = {
  id: string;
  name: string;
  description?: string;
};

/** 完整剧本 */
export type Story = {
  meta: {
    title: string;
    version: string;
    /**
     * 开场图（可选）：标题画面出现之前先显示的一张图。
     * 存的是 backgrounds 素材的 id，不填就没有这个环节。
     */
    openingImage?: string;
    /** 开场图显示时长（秒），不填按 OPENING_DEFAULT_SECONDS 处理 */
    openingDuration?: number;
    /** 标题画面背景图（可选）：存的是 backgrounds 素材的 id，不填用默认深色渐变 */
    titleBackground?: string;
    /**
     * 游戏实例 ID（可选）：导出时由编辑器生成并写入导出的 story.json。
     * 结局解锁记录用它做 localStorage 的 key —— 每次导出都是新 ID，
     * 保证"新导出的游戏一打开结局全是锁定"，不同批次的导出互不污染。
     */
    gameId?: string;
  };
  characters: Character[];
  backgrounds: Asset[];
  /** 立绘素材（含差分），扩展字段：角色的 sprites.base / expressions 都指向这里 */
  sprites: Asset[];
  bgms: Asset[];
  ses: Asset[];
  voices: Asset[];
  scenes: Scene[];
  startSceneId: string;
  endings: Ending[];
};

/** 编辑器内部的素材记录：Asset 的超集，额外带上本地二进制（dataURL） */
export type EditorAsset = Asset & {
  /** 所属分类，决定它被写进 story 的哪个数组 */
  category: AssetCategory;
  /** data URL，编辑器预览/导出用；导出后不写入 story.json */
  dataUrl: string;
  mime: string;
  size: number;
  /** 音频时长（秒），图片为 0 */
  duration?: number;
};

/** 素材分类 */
export type AssetCategory = 'backgrounds' | 'sprites' | 'bgms' | 'ses' | 'voices';
