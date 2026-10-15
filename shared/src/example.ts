/**
 * 内置示例剧本
 * 用途：运行时在没有 story.json 时的兜底数据；编辑器"新建示例项目"。
 * 刻意不引用任何素材，保证零素材也能直接跑通全流程。
 */
import { STORY_VERSION } from './constants';
import type { Story, StoryNode } from './types';

/** 序章场景 id */
export const EXAMPLE_INTRO_SCENE = 'scene_intro';
/** 结局分支场景 id */
export const EXAMPLE_BRANCH_SCENE = 'scene_branch';

/** 简单的台词节点工厂，让示例剧本读起来像剧本 */
function line(id: string, text: string, speaker?: string, next?: string): StoryNode {
  return { id, type: 'dialogue', text, speaker, next };
}

/** 生成示例剧本（每次调用返回全新对象，避免被修改后互相污染） */
export function createExampleStory(): Story {
  return {
    meta: { title: '星海咖啡馆的午后', version: STORY_VERSION },
    characters: [
      {
        id: 'char_rin',
        name: '凛',
        color: '#e11d48',
        sprites: { base: '', expressions: [] },
      },
      {
        id: 'char_me',
        name: '店长',
        color: '#0f766e',
        sprites: { base: '', expressions: [] },
      },
    ],
    backgrounds: [],
    sprites: [],
    bgms: [],
    ses: [],
    voices: [],
    scenes: [
      {
        id: EXAMPLE_INTRO_SCENE,
        name: '序章 · 风铃',
        nodes: [
          line('n_intro_1', '下午三点，星海咖啡馆。门口的风铃在没有风的门边轻轻响了一声。', undefined, 'n_intro_2'),
          line('n_intro_2', '欢迎光临……啊，是你。今天也来躲清闲？', 'char_rin', 'n_intro_choice'),
          {
            id: 'n_intro_choice',
            type: 'choice',
            prompt: '要怎么回应她？',
            options: [
              { id: 'opt_smile', text: '笑着打个招呼', next: 'n_smile_1' },
              { id: 'opt_silent', text: '假装没听见，先找位置坐下', next: 'n_silent_1' },
            ],
          },
          line('n_smile_1', '……笑得这么开心，今天遇上什么好事了？', 'char_rin', 'n_smile_2'),
          { id: 'n_smile_2', type: 'effect', effect: 'flash', duration: 0.35, next: 'n_smile_3' },
          line('n_smile_3', '算了，先坐下吧。招牌布丁还剩最后一个，算你今天走运。', 'char_rin', 'n_smile_4'),
          line('n_smile_4', '她把布丁端过来，杯碟轻轻磕在桌面上，焦糖的香气先一步到了。', undefined, 'n_smile_jump'),
          { id: 'n_smile_jump', type: 'jump', targetSceneId: EXAMPLE_BRANCH_SCENE },
          line('n_silent_1', '……？', 'char_rin', 'n_silent_2'),
          line('n_silent_2', '空气安静了三秒。窗外有自行车铃铛响过。', undefined, 'n_silent_3'),
          line('n_silent_3', '喂，你倒是说句话啊。再这样我就当你要点最贵的那款了。', 'char_rin', 'n_silent_4'),
          line('n_silent_4', '她坐到了对面，托着腮看你，发梢落在围裙的系带旁边。', undefined, 'n_silent_jump'),
          { id: 'n_silent_jump', type: 'jump', targetSceneId: EXAMPLE_BRANCH_SCENE },
        ],
      },
      {
        id: EXAMPLE_BRANCH_SCENE,
        name: '第二章 · 布丁',
        nodes: [
          line('n_branch_1', '布丁的关键词大概是：焦糖、微苦，还有她假装不经意偷看你的那一眼。', undefined, 'n_branch_choice'),
          {
            id: 'n_branch_choice',
            type: 'choice',
            prompt: '最后一口，怎么办？',
            options: [
              { id: 'opt_share', text: '把最后一口推给她', next: 'n_share_1' },
              { id: 'opt_self', text: '自己吃掉', next: 'n_self_1' },
            ],
          },
          line('n_share_1', '……嗯，我确实没吃饱。谢啦。', 'char_rin', 'n_share_2'),
          { id: 'n_share_2', type: 'effect', effect: 'fadeOutIn', duration: 0.9, next: 'n_end_true' },
          { id: 'n_end_true', type: 'ending', endingId: 'ending_caramel' },
          line('n_self_1', '你这个人啊……杯子都刮出声了，是有多喜欢。', 'char_rin', 'n_self_2'),
          line('n_self_2', '她叹了口气，转身去擦咖啡机了。窗外天色暗下来一点。', undefined, 'n_end_normal'),
          { id: 'n_end_normal', type: 'ending', endingId: 'ending_alone' },
        ],
      },
    ],
    startSceneId: EXAMPLE_INTRO_SCENE,
    endings: [
      { id: 'ending_caramel', name: '焦糖结局', description: '你把最后一口让了出去。' },
      { id: 'ending_alone', name: '独食结局', description: '布丁很甜，但桌子对面安静了一会儿。' },
    ],
  };
}
