/**
 * 全局常量与中文文案表
 */
import type { EffectTarget, EffectType, NodeType, SpritePosition, Transition } from './types';

/** 剧本 schema 版本 */
export const STORY_VERSION = '1.0.0';

/** 节点类型 -> 中文名 */
export const NODE_LABELS: Record<NodeType, string> = {
  dialogue: '对话',
  choice: '选项',
  showSprite: '显示立绘',
  hideSprite: '隐藏立绘',
  setBackground: '切换背景',
  playBgm: '播放BGM',
  stopBgm: '停止BGM',
  playSe: '播放音效',
  effect: '特效',
  effectOff: '特效关闭',
  jump: '跳转场景',
  ending: '结局',
};

/** 节点类型 -> 节点图颜色（浅色主题下也能看清） */
export const NODE_COLORS: Record<NodeType, string> = {
  dialogue: '#3b82f6',
  choice: '#f59e0b',
  showSprite: '#8b5cf6',
  hideSprite: '#a78bfa',
  setBackground: '#14b8a6',
  playBgm: '#ec4899',
  stopBgm: '#f472b6',
  playSe: '#0ea5e9',
  effect: '#ef4444',
  effectOff: '#f87171',
  jump: '#64748b',
  ending: '#dc2626',
};

/** 节点类型 -> 图标（emoji，避免额外图标库） */
export const NODE_ICONS: Record<NodeType, string> = {
  dialogue: '💬',
  choice: '🔀',
  showSprite: '🧍',
  hideSprite: '🚪',
  setBackground: '🖼️',
  playBgm: '🎵',
  stopBgm: '🔇',
  playSe: '🔔',
  effect: '✨',
  effectOff: '🚫',
  jump: '↪️',
  ending: '🏁',
};

/** 节点类型的简要说明（新建菜单、引导用） */
export const NODE_HINTS: Record<NodeType, string> = {
  dialogue: '一段台词，可以指定说话人和语音',
  choice: '给玩家几个选项，各自跳向不同后续',
  showSprite: '在左/中/右显示某个角色的立绘',
  hideSprite: '让某个角色的立绘退场',
  setBackground: '切换场景背景图',
  playBgm: '播放背景音乐，可设置循环和淡入',
  stopBgm: '淡出并停止背景音乐',
  playSe: '播放一次性音效',
  effect: '开启震动、闪白等画面特效，可选作用在整个画面、对话框或某个立绘上',
  effectOff: '关掉一个（或全部）持续中的特效，让画面恢复正常',
  jump: '跳到另一个场景继续',
  ending: '结束游戏并结算一个结局',
};

/** 位置中文名 */
export const POSITION_LABELS: Record<SpritePosition, string> = {
  left: '左',
  center: '中',
  right: '右',
};

/* ---------------- 立绘位置 / 缩放（编辑器属性面板与运行时共用） ---------------- */

/** 立绘横向取值范围（%） */
export const SPRITE_X_MIN = 0;
export const SPRITE_X_MAX = 100;
/** 立绘纵向取值范围（%） */
export const SPRITE_Y_MIN = 0;
export const SPRITE_Y_MAX = 100;
/** 立绘缩放范围 */
export const SPRITE_SCALE_MIN = 0.3;
export const SPRITE_SCALE_MAX = 2;
export const SPRITE_SCALE_STEP = 0.05;

/** 立绘默认位置：水平居中、贴舞台底边；默认缩放 1.0 */
export const SPRITE_DEFAULT_X = 50;
export const SPRITE_DEFAULT_Y = 100;
export const SPRITE_DEFAULT_SCALE = 1;

/** 立绘基准高度：占舞台高度的百分比（1.0 缩放时的大小） */
export const SPRITE_BASE_HEIGHT_PERCENT = 78;

/**
 * 旧节点没有 x 字段时，position 对应的横向百分比。
 * ⚠️ 这几个值是老版本的渲染结果，改了会让旧项目的立绘位置发生变化，不要动。
 */
export const SPRITE_LEGACY_X: Record<SpritePosition, number> = {
  left: 16,
  center: 50,
  right: 84,
};

/** 属性面板点「左 / 中 / 右」时写入的 x 快捷预设值 */
export const SPRITE_PRESET_X: Record<SpritePosition, number> = {
  left: 25,
  center: 50,
  right: 75,
};

/* ---------------- 开场图 / 标题画面背景 ---------------- */

/** 开场图不填时长时的默认显示秒数 */
export const OPENING_DEFAULT_SECONDS = 2.5;
/** 开场图显示时长的可设置范围（秒） */
export const OPENING_MIN_SECONDS = 0.5;
export const OPENING_MAX_SECONDS = 20;
export const OPENING_SECONDS_STEP = 0.5;
/** 开场图淡入 / 淡出的时长（秒） */
export const OPENING_FADE_SECONDS = 0.6;

/** 转场中文名 */
export const TRANSITION_LABELS: Record<Transition, string> = {
  none: '无',
  fade: '淡入',
  slideLeft: '左滑',
  slideRight: '右滑',
};

/** 特效中文名 */
export const EFFECT_LABELS: Record<EffectType, string> = {
  shake: '震动',
  flash: '闪白',
  fadeOutIn: '淡出淡入',
  blackAndWhite: '黑白',
  blur: '模糊',
};

/* ---------------- 特效：开启 / 关闭 模型 ---------------- */

/** 特效作用对象中文名 */
export const EFFECT_TARGET_LABELS: Record<EffectTarget, string> = {
  screen: '整个画面',
  dialogue: '对话框',
  sprite: '某个角色的立绘',
};

/** 新建特效节点时默认的作用对象 */
export const EFFECT_DEFAULT_TARGET: EffectTarget = 'screen';

/**
 * "播放一次就完"的特效（闪白 / 淡出淡入）：触发后自己结束，不需要也不能用「特效关闭」关。
 * 其余（震动 / 黑白 / 模糊）是持续特效：开启后一直生效，直到被「特效关闭」节点关掉。
 */
export const ONE_SHOT_EFFECTS: readonly EffectType[] = ['flash', 'fadeOutIn'];

/** 判断是否"播放一次就完"的特效 */
export function isOneShotEffect(effect: EffectType): boolean {
  return ONE_SHOT_EFFECTS.includes(effect);
}

/** 闪白的固定时长（秒） */
export const FLASH_SECONDS = 0.4;
/** 淡出淡入的固定时长（秒） */
export const FADE_OUT_IN_SECONDS = 1.6;

/** 素材分类中文名 */
export const CATEGORY_LABELS = {
  characters: '角色',
  backgrounds: '背景',
  sprites: '立绘',
  bgms: 'BGM',
  ses: '音效',
  voices: '语音',
  endings: '结局',
} as const;
