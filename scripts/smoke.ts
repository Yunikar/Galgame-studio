/**
 * 剧本引擎冒烟测试
 * 运行：npm run smoke
 * 作用：不需要浏览器，直接验证「校验规则 + 剧情推进 + 分支 + 结局」是否正确。
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildStoryIndex,
  branchPercents,
  createEmptyStory,
  createExampleStory,
  createNode,
  createScene,
  FLASH_SECONDS,
  formatPercent,
  normalizeStory,
  summarizeIssues,
  uid,
  validateStory,
  type ChoiceNode,
  type ChoiceOption,
  type EditorAsset,
  type Story,
  type StoryNode,
} from '@gal/shared';
import { advance, chooseOption, createInitialState, pickOptionTarget, simulateTo } from '../runtime/src/engine/engine';
import type { EngineState } from '../runtime/src/engine/types';
import { packStoryAndAssets } from '../editor/src/lib/buildStory';
import { buildIndexHtml, escapeInlineJson } from '../editor/src/lib/htmlTemplate';
import {
  addBranch,
  addNode,
  connectNodes,
  disconnectNodes,
  evenBranches,
  removeNode,
  updateBranch,
} from '../editor/src/lib/mutations/nodes';
import { nodeDisplayName, nodeOptionLabel, summarizeNode } from '../editor/src/components/Graph/nodeSummary';
import { createProject, type ProjectData } from '../editor/src/types/project';
import { countAssetUsage } from '../editor/src/lib/mutations/assets';
import { autoLayoutScene } from '../editor/src/lib/autoLayout';
import { estimateNodeHeight } from '../editor/src/lib/nodeSize';
import { cloneNode } from '../editor/src/lib/cloneNode';
import { duplicateScene } from '../editor/src/lib/mutations/scenes';
import { PREVIEW_PHASE_LABELS, resolveInitialPhase } from '../runtime/src/lib/previewPhase';

let failed = 0;
let passed = 0;

/** 断言工具 */
function check(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${name}${detail ? ` —— ${detail}` : ''}`);
  }
}

function section(title: string): void {
  console.log(`\n${title}`);
}

/** 一直推进到结局，返回走过的对话内容与结局 id */
function playThrough(
  story: Story,
  pick: (optionIndex: number, optionCount: number) => number = () => 0,
): { lines: string[]; endingId: string | null; steps: number; choices: number } {
  const index = buildStoryIndex(story);
  let state: EngineState = createInitialState(index);
  const lines: string[] = [];
  let endingId: string | null = null;
  let steps = 0;
  let choices = 0;

  // 注意：chooseOption 内部也会 advance，所以必须处理它返回的 step，不能丢掉
  let step = advance(index, state);
  state = step.state;

  while (steps < 500) {
    steps += 1;

    if (step.type === 'dialogue' && step.node?.type === 'dialogue') {
      lines.push(step.node.text);
      step = advance(index, state);
      state = step.state;
      continue;
    }

    if (step.type === 'choice' && step.node?.type === 'choice') {
      choices += 1;
      const chosen = pick(0, step.node.options.length);
      step = chooseOption(index, state, step.node.options[chosen].id);
      state = step.state;
      continue;
    }

    if (step.type === 'ending' && step.node?.type === 'ending') {
      endingId = step.node.endingId;
      break;
    }

    // end-of-story：剧情断了
    break;
  }

  return { lines, endingId, steps, choices };
}

/* ------------------------------------------------------------------ */
section('1. 示例剧本校验');
const example = createExampleStory();
const exampleIssues = validateStory(example);
const exampleSummary = summarizeIssues(exampleIssues);
check('示例剧本没有错误', exampleSummary.errors === 0, JSON.stringify(exampleIssues.filter((i) => i.level === 'error')));
check(
  '示例剧本只有少量提醒（无素材）',
  exampleSummary.warnings <= 5,
  `warnings=${exampleSummary.warnings}`,
);

/* ------------------------------------------------------------------ */
section('2. 走第一条分支（选第 1 个选项）');
const runA = playThrough(example, () => 0);
check('走到了结局', runA.endingId !== null, `steps=${runA.steps}`);
check('结局是「焦糖结局」', runA.endingId === 'ending_caramel', String(runA.endingId));
check('台词数量 = 7 句', runA.lines.length === 7, `lines=${runA.lines.length}`);
check('经过了 2 次选择', runA.choices === 2, `choices=${runA.choices}`);

/* ------------------------------------------------------------------ */
section('3. 走第二条分支（每次选最后一个选项）');
const runB = playThrough(example, (_i, count) => count - 1);
check('走到了另一个结局', runB.endingId === 'ending_alone', String(runB.endingId));
check('另一条分支 9 句台词', runB.lines.length === 9, `lines=${runB.lines.length}`);
check('两条分支的台词不同', runB.lines.join('|') !== runA.lines.join('|'));

/* ------------------------------------------------------------------ */
section('4. 校验能抓出错误剧本');
const broken: Story = (() => {
  const story = createEmptyStory('问题剧本');
  const scene = story.scenes[0];
  story.endings = [{ id: 'ending_x', name: '唯一结局' }];
  scene.nodes = [
    { id: 'd1', type: 'dialogue', text: '没有后续的台词', next: 'not_exist' },
    { id: 'b1', type: 'setBackground', assetId: 'missing_bg', transition: 'fade', next: undefined },
    {
      id: 'c1',
      type: 'choice',
      options: [{ id: 'o1', text: '未连线的选项', next: '' }],
    },
  ];
  return story;
})();
const brokenIssues = validateStory(broken);
const brokenSummary = summarizeIssues(brokenIssues);
const messages = brokenIssues.map((i) => i.message).join(' / ');
check('抓到了悬空节点', messages.includes('没有后继'), messages);
check('抓到了未设置的素材', messages.includes('引用的背景素材'), messages);
check('抓到了选项未连线', messages.includes('没有连线'), messages);
check('抓到了拿不到结局', messages.includes('没有任何线路能走到结局'), messages);
check('错误数量 >= 4', brokenSummary.errors >= 4, `errors=${brokenSummary.errors}`);

/* ------------------------------------------------------------------ */
section('5. 引擎容错：断链剧本不会死循环');
const dangling: Story = (() => {
  const story = createEmptyStory('断链');
  story.scenes[0].nodes = [{ id: 'd1', type: 'dialogue', text: '孤立的一句' }];
  return story;
})();
const danglingIndex = buildStoryIndex(dangling);
const danglingStep = advance(danglingIndex, createInitialState(danglingIndex));
check('第一句能正常显示', danglingStep.type === 'dialogue');
const afterDangling = advance(danglingIndex, danglingStep.state);
check('没有后续时安全结束', afterDangling.type === 'end-of-story', afterDangling.type);

/* ------------------------------------------------------------------ */
section('6. 引擎容错：空场景 / 不存在的场景');
const emptyStory = createEmptyStory('空场景');
const emptyIndex = buildStoryIndex(emptyStory);
const emptyStep = advance(emptyIndex, createInitialState(emptyIndex));
check('空场景安全结束', emptyStep.type === 'end-of-story', emptyStep.type);
const badScene = advance(emptyIndex, { ...createInitialState(emptyIndex), sceneId: 'no_such_scene' });
check('不存在的场景安全结束', badScene.type === 'end-of-story', badScene.type);

/* ------------------------------------------------------------------ */
section('7. 事件流：演出节点会产生对应事件');
const eventStory: Story = (() => {
  const story = createEmptyStory('事件剧本');
  const scene = createScene('演出');
  story.scenes = [scene];
  story.startSceneId = scene.id;
  story.endings = [{ id: 'e1', name: '结束' }];
  scene.nodes = [
    { id: 'bg', type: 'setBackground', assetId: 'bg_a', transition: 'fade', next: 'sp' },
    { id: 'sp', type: 'showSprite', characterId: 'c1', position: 'center', transition: 'fade', next: 'fx' },
    { id: 'fx', type: 'effect', effect: 'shake', duration: 0.4, next: 'say' },
    { id: 'say', type: 'dialogue', text: '震完了', next: 'end' },
    { id: 'end', type: 'ending', endingId: 'e1' },
  ];
  story.characters = [{ id: 'c1', name: '测试角色', sprites: { base: 'sprite_a', expressions: [] } }];
  story.backgrounds = [{ id: 'bg_a', name: '背景A', path: 'assets/bg_a.png' }];
  story.sprites = [{ id: 'sprite_a', name: '立绘A', path: 'assets/sprite_a.png' }];
  return story;
})();
const eventIndex = buildStoryIndex(eventStory);
const eventStep = advance(eventIndex, createInitialState(eventIndex));
const kinds = eventStep.events.map((e) => e.kind).join(',');
check('产生 background / showSprite / effect 三类事件', kinds === 'setBackground,showSprite,effect', kinds);
check('停在台词节点', eventStep.type === 'dialogue' && eventStep.node?.id === 'say', eventStep.type);
check('状态里记录了背景', eventStep.state.background === 'bg_a', String(eventStep.state.background));
check('状态里记录了立绘', !!eventStep.state.sprites.c1, JSON.stringify(eventStep.state.sprites));
const eventEnd = advance(eventIndex, eventStep.state);
check('台词之后到达结局', eventEnd.type === 'ending', eventEnd.type);

/* ------------------------------------------------------------------ */
section('8. 循环跳转不会卡死引擎');
const loopStory: Story = (() => {
  const story = createEmptyStory('死循环');
  const a = createScene('A');
  const b = createScene('B');
  story.scenes = [a, b];
  story.startSceneId = a.id;
  a.nodes = [{ id: uid('jump'), type: 'jump', targetSceneId: b.id }];
  b.nodes = [{ id: uid('jump'), type: 'jump', targetSceneId: a.id }];
  return story;
})();
const loopIndex = buildStoryIndex(loopStory);
const startedAt = Date.now();
const loopStep = advance(loopIndex, createInitialState(loopIndex));
check('互相跳转时能安全退出', loopStep.type === 'end-of-story', loopStep.type);
check('耗时在 1 秒内', Date.now() - startedAt < 1000, `${Date.now() - startedAt}ms`);

/* ------------------------------------------------------------------ */
section('9. 预演到指定节点（编辑器"从选中节点开始预览"）');
const prerollStory: Story = (() => {
  const story = createEmptyStory('预演剧本');
  const scene = createScene('预演');
  story.scenes = [scene];
  story.startSceneId = scene.id;
  story.endings = [{ id: 'e1', name: '结束' }];
  story.backgrounds = [{ id: 'bg1', name: '教室', path: 'assets/bg1.png' }];
  story.sprites = [{ id: 'sp1', name: '凛立绘', path: 'assets/sp1.png' }];
  story.characters = [{ id: 'c1', name: '凛', sprites: { base: 'sp1', expressions: [] } }];
  scene.nodes = [
    { id: 'bg', type: 'setBackground', assetId: 'bg1', transition: 'fade', next: 'show' },
    { id: 'show', type: 'showSprite', characterId: 'c1', position: 'center', transition: 'fade', next: 'line1' },
    { id: 'line1', type: 'dialogue', text: '第一句', next: 'line2' },
    { id: 'line2', type: 'dialogue', text: '第二句', next: 'line3' },
    { id: 'line3', type: 'dialogue', text: '第三句', next: 'end' },
    { id: 'end', type: 'ending', endingId: 'e1' },
  ];
  return story;
})();
const prerollIndex = buildStoryIndex(prerollStory);
const prerolled = simulateTo(prerollIndex, prerollStory.scenes[0].id, 'line3');
const prerollStep = advance(prerollIndex, prerolled);
check('预演后停在目标节点', prerollStep.node?.id === 'line3', String(prerollStep.node?.id));
check('预演把背景状态带过来了', prerollStep.state.background === 'bg1', String(prerollStep.state.background));
check('预演把立绘状态带过来了', !!prerollStep.state.sprites.c1);
check('预演不会播放被跳过节点的台词', prerollStep.type === 'dialogue');
const prerollRewound = simulateTo(prerollIndex, prerollStory.scenes[0].id, 'line1');
const prerollRewoundStep = advance(prerollIndex, prerollRewound);
check('预演到第一句也对', prerollRewoundStep.node?.id === 'line1', String(prerollRewoundStep.node?.id));

// 回归：目标节点在「选项」之后 / 是结局 / 场景 id 传错
// 旧实现遇到选项就返回 pendingNodeId:null + chainEnded:true，
// 下一次 advance() 会直接判定"剧情结束"，预览里显示"这段剧情结束了"。
const branchStory: Story = (() => {
  const story = createEmptyStory('分支预演剧本');
  const scene = createScene('分支');
  story.scenes = [scene];
  story.startSceneId = scene.id;
  story.endings = [{ id: 'e1', name: '结束' }];
  scene.nodes = [
    { id: 'b1', type: 'dialogue', text: '开场', next: 'b2' },
    {
      id: 'b2',
      type: 'choice',
      prompt: '选吧',
      options: [
        { id: 'o1', text: 'A', next: 'b3' },
        { id: 'o2', text: 'B', next: 'b4' },
      ],
    },
    { id: 'b3', type: 'dialogue', text: 'A 线', next: 'b5' },
    { id: 'b4', type: 'dialogue', text: 'B 线', next: 'b5' },
    { id: 'b5', type: 'ending', endingId: 'e1' },
  ];
  return story;
})();
const branchIndex = buildStoryIndex(branchStory);

const afterChoiceStep = advance(branchIndex, simulateTo(branchIndex, branchStory.scenes[0].id, 'b3'));
check('选项之后的节点也能预览（不会误报剧情结束）', afterChoiceStep.node?.id === 'b3', String(afterChoiceStep.node?.id));
check('选项之后的节点不是剧情结束', afterChoiceStep.type === 'dialogue', afterChoiceStep.type);

const branchEndingStep = advance(branchIndex, simulateTo(branchIndex, branchStory.scenes[0].id, 'b5'));
check('结局节点也能预览', branchEndingStep.type === 'ending', branchEndingStep.type);

const wrongSceneStep = advance(branchIndex, simulateTo(branchIndex, '不存在的场景', 'b3'));
check('场景 id 传错也能定位到目标节点', wrongSceneStep.node?.id === 'b3', String(wrongSceneStep.node?.id));

const choiceNodeStep = advance(branchIndex, simulateTo(branchIndex, branchStory.scenes[0].id, 'b2'));
check('选项节点本身也能预览', choiceNodeStep.type === 'choice', choiceNodeStep.type);

/* ------------------------------------------------------------------ */
section('10. 存档往返（读档后回到同一句）');
const saveIndex = buildStoryIndex(example);
const firstStep = advance(saveIndex, createInitialState(saveIndex));
// 模拟 localStorage + JSON 序列化
const roundTripped = JSON.parse(JSON.stringify(firstStep.state)) as EngineState;
const resumedState: EngineState = {
  ...roundTripped,
  pendingNodeId: roundTripped.currentNodeId,
  chainEnded: false,
};
const resumedStep = advance(saveIndex, resumedState);
check('读档后显示的还是同一句台词', resumedStep.node?.id === firstStep.node?.id, String(resumedStep.node?.id));
check('存档里保留了节点 id', roundTripped.currentNodeId === firstStep.node?.id);

/* ------------------------------------------------------------------ */
section('11. 存档工具（localStorage 往返）');
const memory = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, String(v)),
  removeItem: (k: string) => void memory.delete(k),
  clear: () => memory.clear(),
  key: (i: number) => [...memory.keys()][i] ?? null,
  get length() {
    return memory.size;
  },
} as Storage;

const { addReachedEnding, deleteSave, hasAnySave, loadReachedEndings, loadSaves, writeSave } =
  await import('../runtime/src/lib/saveStore');
const sampleSave = {
  slotId: 'slot1' as const,
  savedAt: new Date().toISOString(),
  sceneName: '序章',
  speakerName: '凛',
  text: '欢迎光临',
  state: firstStep.state,
};
check('写入存档成功', writeSave('测试作品', sampleSave).ok);
check('能读回存档', loadSaves('测试作品').slot1?.text === '欢迎光临');
check('不同作品互不干扰', Object.keys(loadSaves('另一个作品')).length === 0);
deleteSave('测试作品', 'slot1');
check('删除存档生效', !hasAnySave('测试作品'));

/* ---- 11.x 结局独立记录（打通即解锁，key 按 gameId 隔离） ---- */
check('新游戏（新 gameId）→ 结局全锁', loadReachedEndings({ gameId: 'game_new', title: '同一标题' }).length === 0);
check(
  '打通结局立即解锁（与存档无关）',
  addReachedEnding({ gameId: 'game_new', title: '同一标题' }, 'end1').includes('end1'),
);
check(
  '重复打通同一结局不重复记录',
  addReachedEnding({ gameId: 'game_new', title: '同一标题' }, 'end1').length === 1,
);
check(
  '第二个结局也解锁',
  addReachedEnding({ gameId: 'game_new', title: '同一标题' }, 'end2').length === 2,
);
check(
  '删光存档不影响结局记录（独立于存档）',
  (() => {
    deleteSave('同一标题', 'slot1');
    return loadReachedEndings({ gameId: 'game_new', title: '同一标题' }).length === 2;
  })(),
);
check(
  '不同 gameId（另一次导出）互不污染',
  loadReachedEndings({ gameId: 'game_other', title: '同一标题' }).length === 0,
);
check(
  '没有 gameId 时退回标题做身份（老数据兜底）',
  (() => {
    addReachedEnding({ title: '无ID作品' }, 'end1');
    return loadReachedEndings({ title: '无ID作品' }).includes('end1');
  })(),
);

/* ------------------------------------------------------------------ */
section('12. 导出：页面改写（双击 index.html 能玩的关键）');
const templateHtml = [
  '<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8" />',
  '<title>游戏</title>',
  '<script type="module" crossorigin src="./app.js"></script>',
  '<link rel="stylesheet" crossorigin href="./style.css">',
  '</head><body><div id="root"></div></body></html>',
].join('\n');

const templateFiles = new Map<string, Uint8Array>([
  ['app.js', new TextEncoder().encode('console.log("game")')],
  ['style.css', new TextEncoder().encode('.a{color:red}')],
  ['index.html', new TextEncoder().encode(templateHtml)],
]);

// 故意塞一个 </script>，验证内联剧本没有把页面脚本提前闭合
const dangerousStoryJson = JSON.stringify({
  meta: { title: '测试' },
  text: '危险片段</script><script>alert(1)</script>',
});

const builtHtml = buildIndexHtml(templateHtml, '星海咖啡馆', dangerousStoryJson, templateFiles);
check('标题被换成作品名', builtHtml.includes('<title>星海咖啡馆</title>'));
check('入口脚本去掉了 type="module"', !/type="module"/.test(builtHtml));
check('入口脚本带 defer（保证 root 已存在）', builtHtml.includes('<script defer src="./app.js"></script>'));
check('CSS 被内联进 <style>', builtHtml.includes('<style>') && builtHtml.includes('.a{color:red}'));
check('剧本被内联进页面', builtHtml.includes('window.__GALGAME_STORY__='));
check('剧本里的 </script> 已转义（不会提前闭合）', !builtHtml.includes('a</script>'));
check('内联剧本排在入口脚本之前', builtHtml.indexOf('__GALGAME_STORY__') < builtHtml.indexOf('<script defer'));
check('转义工具本身可用', escapeInlineJson('</script>') === '<\\/script>');

/* ------------------------------------------------------------------ */
section('13. 导出：剧本与素材打包');
const exportStory = createEmptyStory();
exportStory.meta.title = '打包测试';
// 空场景没有节点，塞一句台词让后面的索引检查有意义
exportStory.scenes[0].nodes.push({ id: 'n_open', type: 'dialogue', text: '打包也能跑', next: 'n_bg' });
exportStory.scenes[0].nodes.push({
  id: 'n_bg',
  type: 'setBackground',
  assetId: 'bg_a',
  transition: 'fade',
  next: 'n_end',
});
exportStory.scenes[0].nodes.push({ id: 'n_end', type: 'ending', endingId: 'e_done' });
exportStory.backgrounds = [
  { id: 'bg_a', name: '教室', path: 'assets/classroom_a.png' },
  { id: 'bg_b', name: '走廊', path: '' },
  { id: 'bg_c', name: '天台', path: 'assets/same.png' },
  { id: 'bg_d', name: '天台夜景', path: 'assets/same.png' },
];
exportStory.bgms = [{ id: 'bgm_a', name: '主题曲', path: 'assets/theme.mp3' }];
exportStory.ses = [{ id: 'se_lost', name: '缺失音效', path: 'assets/lost.mp3' }];

/** 造一条素材记录 */
function makeAsset(
  id: string,
  path: string,
  dataUrl: string,
  category: EditorAsset['category'] = 'backgrounds',
): EditorAsset {
  return {
    id,
    name: id,
    path,
    category,
    dataUrl,
    mime: dataUrl.startsWith('data:audio') ? 'audio/mpeg' : 'image/png',
    size: 4,
  };
}

const exportAssets: Record<string, EditorAsset> = {
  bg_a: makeAsset('bg_a', 'assets/classroom_a.png', 'data:image/png;base64,AAAA'),
  bg_b: makeAsset('bg_b', '', ''), // 内容为空
  bg_c: makeAsset('bg_c', 'assets/same.png', 'data:image/png;base64,BBBB'),
  bg_d: makeAsset('bg_d', 'assets/same.png', 'data:image/png;base64,CCCC'),
  bgm_a: makeAsset('bgm_a', 'assets/theme.mp3', 'data:audio/mpeg;base64,DDDD', 'bgms'),
  // se_lost 故意不提供记录
};

const pack = packStoryAndAssets(exportStory, exportAssets);
const packPaths = pack.files.map((f) => f.path);

check('有内容的素材都被打包', pack.files.length === 4, `实际 ${pack.files.length}`);
check('缺失的素材被单独列出', pack.missing.length === 1 && pack.missing[0].id === 'se_lost');
check('空内容素材被单独列出', pack.empty.length === 1 && pack.empty[0].id === 'bg_b');
check('空内容素材不会写进产物', !packPaths.includes('assets/classroom_a_b.png') && packPaths.length === 4);
check('同名素材自动改名，避免互相覆盖', new Set(packPaths).size === packPaths.length);
check('改名后仍然都在 assets/ 下', packPaths.every((p) => p.startsWith('assets/')));
check('没有 path 的素材补上了默认路径', pack.story.backgrounds[1].path.startsWith('assets/'));
check('打包用的是副本，没有改动原剧本', exportStory.backgrounds[1].path === '');

const packedStory = normalizeStory(JSON.parse(JSON.stringify(pack.story)) as unknown);
check('打包结果能被运行时归一化', packedStory.scenes.length === exportStory.scenes.length);
check('打包结果能建索引', buildStoryIndex(packedStory).nodeById.size === 3);
// base64 的 4 个字符解出 3 字节，4 个有内容的素材 = 12
check('素材总字节数被统计', pack.totalBytes === 12, `实际 ${pack.totalBytes}`);

/* ------------------------------------------------------------------ */
section('14. 导出：用真实的运行时模板跑一遍');
// 上面的测试用的是手写 HTML，可能和 Vite 实际产出的结构不一致。
// 这里直接读 runtime/dist-web 的真实产物，验证改写规则确实匹配得上。
const templateDir = join(process.cwd(), 'runtime', 'dist-web');
const realIndexPath = join(templateDir, 'index.html');

if (!existsSync(realIndexPath)) {
  console.log('  · 跳过：还没构建模板，先执行 npm run build:template');
} else {
  const realFiles = readdirSync(templateDir).filter((f) => f !== 'manifest.json');
  const realMap = new Map<string, Uint8Array>(
    realFiles.map((f) => [f, new Uint8Array(readFileSync(join(templateDir, f)))]),
  );
  const realHtml = new TextDecoder().decode(realMap.get('index.html')!);

  check('模板里确实有 <link rel="stylesheet">', /<link[^>]*stylesheet/i.test(realHtml));
  check('模板里确实是 module 脚本', /type="module"/i.test(realHtml));

  const realStoryJson = JSON.stringify(exportStory);
  const realBuilt = buildIndexHtml(realHtml, '真实模板测试', realStoryJson, realMap);

  check('真实模板：样式被内联，没有残留 link', !/<link[^>]*stylesheet/i.test(realBuilt));
  check('真实模板：不再有 module 脚本', !/type="module"/i.test(realBuilt));
  check('真实模板：有带 defer 的普通脚本', /<script defer src="\.\/[^"]+"><\/script>/.test(realBuilt));
  check('真实模板：没有 crossorigin 残留', !/crossorigin/i.test(realBuilt));

  // 从产物里把内联剧本抠出来，能解析回对象才算真的没问题
  const marker = 'window.__GALGAME_STORY__=';
  const at = realBuilt.indexOf(marker);
  const end = realBuilt.indexOf(';</script>', at);
  check('真实模板：内联剧本有起点和终点', at >= 0 && end > at);
  let reparsed: Story | null = null;
  try {
    reparsed = JSON.parse(realBuilt.slice(at + marker.length, end).replace(/<\\\//g, '</')) as Story;
  } catch {
    reparsed = null;
  }
  check('真实模板：内联剧本能被解析回来', reparsed !== null);
  check('真实模板：解析回来的标题正确', reparsed?.meta.title === '打包测试');
  check('真实模板：出口脚本体积合理', (realMap.get('app.js')?.byteLength ?? 0) > 50000);
}

/* ------------------------------------------------------------------ */
section('15. 导出：运行时在 file:// 下能读到内联剧本与素材路径');
// 模拟"用户双击 index.html"：页面里只有内联剧本，没有 http 服务，fetch 一律失败
const fakeWindow: Record<string, unknown> = { __GALGAME_STORY__: JSON.parse(JSON.stringify(exportStory)) };
(globalThis as unknown as { window: unknown }).window = fakeWindow;
(globalThis as unknown as { document: unknown }).document = { baseURI: 'file:///C:/games/mygame/index.html' };
// 真在 file:// 下 fetch 会抛错，这里如实模拟，确保代码不依赖它
(globalThis as unknown as { fetch: unknown }).fetch = () => {
  throw new Error('file:// 下不允许 fetch 本地文件');
};

const { loadGame } = await import('../runtime/src/lib/storyLoader');
const loaded = await loadGame();
check('运行时认出了内联剧本', loaded.source === 'static');
check('运行时读到了正确的作品', loaded.story.meta.title === '打包测试');
check('不需要 fetch 也能加载（file:// 可用）', loaded.story.scenes.length === exportStory.scenes.length);

const bgPath = loaded.story.backgrounds[0].path;
const resolved = loaded.resolveAsset('bg_a');
check('素材路径被解析成可用的 file:// 地址', resolved === `file:///C:/games/mygame/${bgPath}`, String(resolved));
check('缺失素材返回 undefined，不会崩', loaded.resolveAsset('不存在的东西') === undefined);

/* ------------------------------------------------------------------ */
section('16. 编辑器：新建节点自动接在选中节点后面');
/** 造一个测试项目：只有一个场景，节点就是传进来的这些 */
function projectOf(nodes: StoryNode[]): ProjectData {
  const scene = createScene('测试');
  scene.nodes = nodes;
  const story = createEmptyStory('自动连线测试');
  story.scenes = [scene];
  story.startSceneId = scene.id;
  return createProject(story);
}
const sceneIdOf = (data: ProjectData): string => data.story.scenes[0]!.id;
const nodeById = (data: ProjectData, id: string): StoryNode | undefined =>
  data.story.scenes[0]!.nodes.find((n) => n.id === id);
const nextOf = (data: ProjectData, id: string): string | undefined =>
  (nodeById(data, id) as { next?: string } | undefined)?.next;
const optionsOf = (data: ProjectData, id: string): ChoiceNode['options'] =>
  (nodeById(data, id) as ChoiceNode).options;

// 1) 链式节点：新节点继承锚点原来的 next，锚点改指向新节点
const chainProject = projectOf([
  { id: 'a', type: 'dialogue', text: 'A', next: 'c' },
  { id: 'c', type: 'dialogue', text: 'C' },
]);
const chainResult = addNode(chainProject, sceneIdOf(chainProject), createNode('dialogue'), 'a');
check('链式锚点：锚点改指向新节点', nextOf(chainResult.data, 'a') === chainResult.nodeId);
check('链式锚点：新节点继承了原来的后续', nextOf(chainResult.data, chainResult.nodeId) === 'c');
check('链式锚点：没有额外提示', chainResult.note === undefined, String(chainResult.note));

// 2) 选项节点：接到第一个还没连线的选项上
const choiceProject = projectOf([
  {
    id: 'ch',
    type: 'choice',
    options: [
      { id: 'o1', text: '甲', next: 'x' },
      { id: 'o2', text: '乙', next: '' },
    ],
  },
]);
const choiceResult = addNode(choiceProject, sceneIdOf(choiceProject), createNode('dialogue'), 'ch');
const choiceOptions = optionsOf(choiceResult.data, 'ch');
check('选项锚点：接到第一个空着的选项上', choiceOptions[1]!.next === choiceResult.nodeId, JSON.stringify(choiceOptions.map((o) => o.next)));
check('选项锚点：不动已经连好的选项', choiceOptions[0]!.next === 'x');
check('选项锚点：不会凭空多出选项', choiceOptions.length === 2, String(choiceOptions.length));

// 3) 选项都连满了：自动补一个新选项再接上（修复前这里根本接不上，新节点变成孤儿）
const fullProject = projectOf([
  {
    id: 'ch2',
    type: 'choice',
    options: [
      { id: 'f1', text: '甲', next: 'x' },
      { id: 'f2', text: '乙', next: 'y' },
    ],
  },
]);
const fullResult = addNode(fullProject, sceneIdOf(fullProject), createNode('dialogue'), 'ch2');
const fullOptions = optionsOf(fullResult.data, 'ch2');
check('选项都连满：自动新增一个选项', fullOptions.length === 3, String(fullOptions.length));
check('选项都连满：新节点接在新选项上', fullOptions[2]!.next === fullResult.nodeId, String(fullOptions[2]!.next));
check('选项都连满：给出了提示', typeof fullResult.note === 'string', String(fullResult.note));

// 4) 跳转 / 结局节点没有出口，只能单独摆着，但要有提示
const endingProject = projectOf([{ id: 'e', type: 'ending', endingId: 'en1' }]);
const endingResult = addNode(endingProject, sceneIdOf(endingProject), createNode('dialogue'), 'e');
check(
  '结局锚点：不会误连，并给出提示',
  typeof endingResult.note === 'string' && endingResult.note.includes('没有出口'),
  String(endingResult.note),
);

// 5) 新节点本身是选项 / 结局时，不该被塞 next
const lineProject = projectOf([{ id: 'd', type: 'dialogue', text: 'D', next: 'z' }]);
const inserted = addNode(lineProject, sceneIdOf(lineProject), createNode('choice'), 'd');
const insertedNode = nodeById(inserted.data, inserted.nodeId) as ChoiceNode;
check('插入选项节点：不会给它写 next', !('next' in insertedNode));
check('插入选项节点：锚点指向它', nextOf(inserted.data, 'd') === inserted.nodeId);

/* ------------------------------------------------------------------ */
section('17. 编辑器：节点命名与自动序号');
const namedStory: Story = (() => {
  const story = createEmptyStory('命名测试');
  const scene = createScene('命名场景');
  scene.nodes = [
    { id: 'p1', type: 'dialogue', text: '第一句' },
    { id: 'p2', type: 'dialogue', text: '第二句', name: '关键台词' },
    { id: 'p3', type: 'dialogue', text: '第三句', name: '   ' },
  ];
  story.scenes = [scene];
  story.startSceneId = scene.id;
  return story;
})();
const [p1, p2, p3] = namedStory.scenes[0]!.nodes as StoryNode[];
check('没起名的节点显示自动序号', nodeDisplayName(p1!, 0) === '#1', nodeDisplayName(p1!, 0));
check('起了名的节点显示名字', nodeDisplayName(p2!, 1) === '关键台词', nodeDisplayName(p2!, 1));
check('名字只有空格时按没起名处理', nodeDisplayName(p3!, 2) === '#3', nodeDisplayName(p3!, 2));
check('拿不到序号时退回空串', nodeDisplayName(p1!) === '', `"${nodeDisplayName(p1!)}"`);
check('摘要里带上序号', summarizeNode(p1!, namedStory, 0).displayName === '#1');
check('摘要里带名字', summarizeNode(p2!, namedStory, 1).displayName === '关键台词');
const optLabel = nodeOptionLabel(p2!, namedStory, 1);
check(
  '下拉文案里既有名字也有内容摘要',
  optLabel.includes('关键台词') && optLabel.includes('第二句'),
  optLabel,
);
check('没起名的下拉文案里是序号', nodeOptionLabel(p1!, namedStory, 0).includes('#1'), nodeOptionLabel(p1!, namedStory, 0));

// 存取往返：旧项目里没有 name 的节点要能正常读，有 name 的要保留
const namedRoundTrip = normalizeStory(JSON.parse(JSON.stringify(namedStory)));
const [r1, r2] = namedRoundTrip.scenes[0]!.nodes as StoryNode[];
check('没有 name 的老节点读回来不报错', r1!.type === 'dialogue');
check('节点名在存取往返后保留', r2!.name === '关键台词', String(r2!.name));

/* ------------------------------------------------------------------ */
section('18. 进场画面：开场图与标题背景');

// normalizeStory 会重建 meta，这里重点验证可选字段不会被重建时丢掉
const metaStory = normalizeStory({
  meta: {
    title: '带进场画面的作品',
    version: '1.0.0',
    openingImage: 'bg_open',
    openingDuration: 4,
    titleBackground: 'bg_title',
    gameId: 'game_abc',
  },
  scenes: [],
});
check('开场图在归一化后保留', metaStory.meta.openingImage === 'bg_open', String(metaStory.meta.openingImage));
check('开场时长在归一化后保留', metaStory.meta.openingDuration === 4, String(metaStory.meta.openingDuration));
check('标题背景在归一化后保留', metaStory.meta.titleBackground === 'bg_title', String(metaStory.meta.titleBackground));
check('游戏实例 ID 在归一化后保留（导出的游戏每次启动都得是同一个 ID，否则解锁记录会丢）', metaStory.meta.gameId === 'game_abc', String(metaStory.meta.gameId));

const metaRoundTrip = normalizeStory(JSON.parse(JSON.stringify(metaStory)));
check(
  '往返一遍这些字段都还在（防止重开编辑器丢背景）',
  metaRoundTrip.meta.openingImage === 'bg_open' &&
    metaRoundTrip.meta.openingDuration === 4 &&
    metaRoundTrip.meta.titleBackground === 'bg_title' &&
    metaRoundTrip.meta.gameId === 'game_abc',
  JSON.stringify(metaRoundTrip.meta),
);

// 向后兼容：老项目的 meta 里没有这几个字段，读进来不能凭空多出键
const legacyMeta = normalizeStory({ meta: { title: '老项目', version: '1.0.0' }, scenes: [] });
check('老项目不会凭空多出开场图字段', !('openingImage' in legacyMeta.meta), JSON.stringify(legacyMeta.meta));
check('老项目不会凭空多出开场时长字段', !('openingDuration' in legacyMeta.meta), JSON.stringify(legacyMeta.meta));
check('老项目不会凭空多出标题背景字段', !('titleBackground' in legacyMeta.meta), JSON.stringify(legacyMeta.meta));
check('老项目不会凭空多出游戏 ID 字段', !('gameId' in legacyMeta.meta), JSON.stringify(legacyMeta.meta));

// 脏数据：类型不对 / 空串一律忽略，不要把坏值带进渲染
const dirtyMeta = normalizeStory({
  meta: { title: '脏数据', version: '1.0.0', openingImage: 123, openingDuration: 'abc', titleBackground: '' },
  scenes: [],
});
check('开场图类型不对时忽略', !('openingImage' in dirtyMeta.meta), JSON.stringify(dirtyMeta.meta));
check('开场时长不是数字时忽略', !('openingDuration' in dirtyMeta.meta), JSON.stringify(dirtyMeta.meta));
check('标题背景为空串时忽略', !('titleBackground' in dirtyMeta.meta), JSON.stringify(dirtyMeta.meta));

// 开场图 / 标题背景也算背景素材的引用，不能被"清理未使用素材"误删
const metaProject = createProject(
  normalizeStory({
    meta: {
      title: '素材引用',
      version: '1.0.0',
      openingImage: 'bg_open',
      openingDuration: 4,
      titleBackground: 'bg_title',
    },
    scenes: [],
    backgrounds: [
      { id: 'bg_open', name: '开场图', path: 'assets/bg_open.png' },
      { id: 'bg_title', name: '标题背景', path: 'assets/bg_title.png' },
      { id: 'bg_unused', name: '没人用', path: 'assets/bg_unused.png' },
    ],
  }),
);
check(
  '开场图算作已使用的背景素材',
  countAssetUsage(metaProject, 'backgrounds', 'bg_open') === 1,
  String(countAssetUsage(metaProject, 'backgrounds', 'bg_open')),
);
check(
  '标题背景算作已使用的背景素材',
  countAssetUsage(metaProject, 'backgrounds', 'bg_title') === 1,
  String(countAssetUsage(metaProject, 'backgrounds', 'bg_title')),
);
check(
  '没被引用的背景仍然计 0（还能正常清理）',
  countAssetUsage(metaProject, 'backgrounds', 'bg_unused') === 0,
  String(countAssetUsage(metaProject, 'backgrounds', 'bg_unused')),
);

// 导出打包：三个字段要能跟着 story.json 走
const metaPack = packStoryAndAssets(metaProject.story, metaProject.assets);
check('导出打包后开场图字段仍在', metaPack.story.meta.openingImage === 'bg_open', String(metaPack.story.meta.openingImage));
check('导出打包后开场时长字段仍在', metaPack.story.meta.openingDuration === 4, String(metaPack.story.meta.openingDuration));
check('导出打包后标题背景字段仍在', metaPack.story.meta.titleBackground === 'bg_title', String(metaPack.story.meta.titleBackground));

/* ------------------------------------------------------------------ */
section('19. 内嵌预览：从标题画面开始');
const titlePhase = resolveInitialPhase(true, true);
check('勾选 + 配了开场图 → 先播开场图', titlePhase === 'opening', titlePhase);
const noOpeningPhase = resolveInitialPhase(true, false);
check('勾选 + 没配开场图 → 直接进标题画面', noOpeningPhase === 'title', noOpeningPhase);
const plainPhase = resolveInitialPhase(false, true);
check('不勾选 → 和以前一样直接进游戏画面（配了开场图也跳过）', plainPhase === 'playing', plainPhase);
const plainNoOpening = resolveInitialPhase(false, false);
check('不勾选 + 没配开场图 → 直接进游戏画面', plainNoOpening === 'playing', plainNoOpening);
// 阶段名要能显示出来，别是 undefined
check(
  '三个预览阶段都有中文名',
  !!PREVIEW_PHASE_LABELS.opening && !!PREVIEW_PHASE_LABELS.title && !!PREVIEW_PHASE_LABELS.playing,
  JSON.stringify(PREVIEW_PHASE_LABELS),
);

/* ------------------------------------------------------------------ */
section('20. 选项的概率分支');

/* ---- 20.1 权重抽取：注入固定随机数，验证边界与分布 ---- */
const threeToOne: ChoiceOption = {
  id: 'o',
  text: '走哪边',
  next: 'A',
  branches: [
    { id: 'b1', next: 'A', weight: 3 },
    { id: 'b2', next: 'B', weight: 1 },
  ],
};
check('权重 3:1 —— 随机数 0 落在第一支', pickOptionTarget(threeToOne, () => 0) === 'A');
check('权重 3:1 —— 随机数 0.74 仍在第一支', pickOptionTarget(threeToOne, () => 0.74) === 'A');
check('权重 3:1 —— 随机数 0.76 切到第二支', pickOptionTarget(threeToOne, () => 0.76) === 'B');
check('随机数接近 1 时落在最后一支（浮点兜底）', pickOptionTarget(threeToOne, () => 0.9999999) === 'B');

// 用固定种子的伪随机跑一批，验证的是"分布"而不只是边界
let branchSeed = 7;
const seededRandom = () => {
  branchSeed = (branchSeed * 1103515245 + 12345) % 2147483648;
  return branchSeed / 2147483648;
};
let hitFirst = 0;
const BRANCH_ROUNDS = 4000;
for (let i = 0; i < BRANCH_ROUNDS; i += 1) {
  if (pickOptionTarget(threeToOne, seededRandom) === 'A') hitFirst += 1;
}
const hitRatio = hitFirst / BRANCH_ROUNDS;
check(
  '权重 3:1 跑 4000 次的占比接近 75%',
  Math.abs(hitRatio - 0.75) < 0.03,
  `${(hitRatio * 100).toFixed(1)}%`,
);

// 权重 0 的分支永远抽不到
check(
  '权重 0 的分支永远抽不到（随机数取 0 也走另一支）',
  pickOptionTarget(
    {
      id: 'o',
      text: '',
      next: 'A',
      branches: [
        { id: 'z1', next: 'A', weight: 0 },
        { id: 'z2', next: 'B', weight: 5 },
      ],
    },
    () => 0,
  ) === 'B',
);

// 权重全为 0 → 等概率，不卡死
const allZeroOption: ChoiceOption = {
  id: 'o',
  text: '',
  next: '',
  branches: [
    { id: 'z1', next: 'A', weight: 0 },
    { id: 'z2', next: 'B', weight: 0 },
  ],
};
check('权重全是 0 → 等概率（0.2 落到第一支）', pickOptionTarget(allZeroOption, () => 0.2) === 'A');
check('权重全是 0 → 等概率（0.6 落到第二支）', pickOptionTarget(allZeroOption, () => 0.6) === 'B');

// 向后兼容：没有 branches 就完全走 next
const legacyOption: ChoiceOption = { id: 'o', text: '甲', next: 'OLD' };
check('没有 branches：完全走 next（老项目行为不变）', pickOptionTarget(legacyOption, () => 0.9) === 'OLD');
check(
  '只有一条分支：走那一条，而不是 next',
  pickOptionTarget({ ...legacyOption, branches: [{ id: 'b', next: 'ONLY', weight: 1 }] }, () => 0.9) === 'ONLY',
);
check(
  '分支没有目标时退回 next（不会卡死）',
  pickOptionTarget({ ...legacyOption, branches: [{ id: 'b', next: '', weight: 1 }] }, () => 0.9) === 'OLD',
);

/* ---- 20.2 真跑一遍分支剧情 ---- */
const probStory = projectOf([
  {
    id: 'ch',
    type: 'choice',
    options: [
      {
        id: 'o1',
        text: '往哪走',
        next: 'L',
        branches: [
          { id: 'bL', next: 'L', weight: 1 },
          { id: 'bR', next: 'R', weight: 1 },
        ],
      },
    ],
  },
  { id: 'L', type: 'dialogue', text: '走了左边' },
  { id: 'R', type: 'dialogue', text: '走了右边' },
]).story;
const probIndex = buildStoryIndex(probStory);
const atChoiceStep = advance(probIndex, createInitialState(probIndex));
check('推进到选项节点会停下', atChoiceStep.type === 'choice', atChoiceStep.type);
check(
  '随机数 0.9 落到第二支 → 显示右边那句',
  chooseOption(probIndex, atChoiceStep.state, 'o1', () => 0.9).node?.id === 'R',
  String(chooseOption(probIndex, atChoiceStep.state, 'o1', () => 0.9).node?.id),
);
check(
  '随机数 0.1 落到第一支 → 显示左边那句',
  chooseOption(probIndex, atChoiceStep.state, 'o1', () => 0.1).node?.id === 'L',
  String(chooseOption(probIndex, atChoiceStep.state, 'o1', () => 0.1).node?.id),
);
const branchIssues = validateStory(probStory);
check(
  '分支后面的节点不会被误报成"走不到"',
  !branchIssues.some((i) => i.message.includes('不会被执行')),
  branchIssues.map((i) => i.message).join(' | '),
);

/* ---- 20.3 编辑器：加分支 / 拖线追加 / 断线 / 删节点 ---- */
const branchBase = projectOf([
  { id: 'ch', type: 'choice', options: [{ id: 'o1', text: '甲', next: 'x' }] },
  { id: 'x', type: 'dialogue', text: 'X' },
  { id: 'y', type: 'dialogue', text: 'Y' },
]);
const branchSceneId = sceneIdOf(branchBase);

// 从单出口改成两条分支
const addedBranches = addBranch(branchBase, branchSceneId, 'ch', 'o1');
const addedOpt = optionsOf(addedBranches, 'ch')[0]!;
check('加分支：原来的出口变成第一个分支', addedOpt.branches?.[0]?.next === 'x', JSON.stringify(addedOpt.branches));
check('加分支：新增一个空槽位', addedOpt.branches?.[1]?.next === '', JSON.stringify(addedOpt.branches));
check('加分支：next 镜像第一个分支（导出给旧版运行时也能走）', addedOpt.next === 'x', String(addedOpt.next));

// 从选项主体的连接点拖线 → 追加分支，不覆盖原来的
const appended = connectNodes(branchBase, branchSceneId, 'ch', 'opt:o1', 'y');
const appendedOpt = optionsOf(appended.data, 'ch')[0]!;
check('拖线追加：原连线保留为第一个分支', appendedOpt.branches?.[0]?.next === 'x');
check('拖线追加：新目标成为第二个分支', appendedOpt.branches?.[1]?.next === 'y');
check('拖线追加：给出提示（否则用户会以为连线被覆盖了）', typeof appended.note === 'string', String(appended.note));

// 从分支自己的连接点拖线 → 只改那一条
const secondBranchId = appendedOpt.branches![1]!.id;
const rewired = connectNodes(appended.data, branchSceneId, 'ch', `opt:o1:${secondBranchId}`, 'x');
const rewiredOpt = optionsOf(rewired.data, 'ch')[0]!;
check('分支连接点拖线：只改这一条', rewiredOpt.branches?.[1]?.next === 'x');
check('分支连接点拖线：第一条不受影响', rewiredOpt.branches?.[0]?.next === 'x');
check('分支连接点拖线：不会多出分支', rewiredOpt.branches?.length === 2, String(rewiredOpt.branches?.length));

// 断线 = 删掉那一条分支
const firstBranchId = appendedOpt.branches![0]!.id;
const cutOne = disconnectNodes(appended.data, branchSceneId, 'ch', `opt:o1:${firstBranchId}`);
const cutOpt = optionsOf(cutOne, 'ch')[0]!;
check('删分支：只剩一条', cutOpt.branches?.length === 1, String(cutOpt.branches?.length));
check('删分支：next 同步到剩下的那条', cutOpt.next === 'y', String(cutOpt.next));

// 删光分支 → 退回单出口形态
const lastBranchId = cutOpt.branches![0]!.id;
const cutAll = disconnectNodes(cutOne, branchSceneId, 'ch', `opt:o1:${lastBranchId}`);
const cutAllOpt = optionsOf(cutAll, 'ch')[0]!;
check('删光分支：退回单出口形态', cutAllOpt.branches === undefined && cutAllOpt.next === '');

// 删节点：指向它的分支要一起清掉
const removedTarget = removeNode(appended.data, branchSceneId, 'y');
check(
  '删掉目标节点：指向它的分支被清空',
  optionsOf(removedTarget, 'ch')[0]!.branches?.every((b) => b.next !== 'y') === true,
  JSON.stringify(optionsOf(removedTarget, 'ch')[0]!.branches),
);

// 改权重 / 均分
const weighted = updateBranch(appended.data, branchSceneId, 'ch', 'o1', firstBranchId, { weight: 9 });
check('改权重生效', optionsOf(weighted, 'ch')[0]!.branches?.[0]?.weight === 9);
const evened = evenBranches(weighted, branchSceneId, 'ch', 'o1');
check('均分权重：两边都变成 1', optionsOf(evened, 'ch')[0]!.branches?.every((b) => b.weight === 1) === true);

/* ---- 20.4 校验规则 ---- */
const badBranchStory = projectOf([
  {
    id: 'ch',
    type: 'choice',
    options: [
      {
        id: 'o1',
        text: '甲',
        next: 'x',
        branches: [
          { id: 'b1', next: 'x', weight: 1 },
          { id: 'b2', next: '已经删掉的节点', weight: 1 },
        ],
      },
    ],
  },
  { id: 'x', type: 'dialogue', text: 'X' },
]).story;
const badBranchIssues = validateStory(badBranchStory);
check(
  '分支指向已删除的节点 → 报错',
  badBranchIssues.some((i) => i.level === 'error' && i.message.includes('已删除')),
  badBranchIssues.map((i) => i.message).join(' | '),
);

const zeroWeightStory = projectOf([
  {
    id: 'ch',
    type: 'choice',
    options: [
      {
        id: 'o1',
        text: '甲',
        next: 'x',
        branches: [
          { id: 'b1', next: 'x', weight: 0 },
          { id: 'b2', next: 'x', weight: 0 },
        ],
      },
    ],
  },
  { id: 'x', type: 'dialogue', text: 'X' },
]).story;
check(
  '分支权重全是 0 → 给出警告（引擎会按等概率跑）',
  validateStory(zeroWeightStory).some((i) => i.level === 'warning' && i.message.includes('权重')),
  JSON.stringify(validateStory(zeroWeightStory).map((i) => i.message)),
);

const emptyBranchStory = projectOf([
  {
    id: 'ch',
    type: 'choice',
    options: [
      {
        id: 'o1',
        text: '甲',
        next: 'x',
        branches: [
          { id: 'b1', next: 'x', weight: 1 },
          { id: 'b2', next: '', weight: 1 },
        ],
      },
    ],
  },
  { id: 'x', type: 'dialogue', text: 'X' },
]).story;
check(
  '分支没有指定目标 → 报错',
  validateStory(emptyBranchStory).some((i) => i.level === 'error' && i.message.includes('没有指定后续节点')),
  JSON.stringify(validateStory(emptyBranchStory).map((i) => i.message)),
);

/* ---- 20.5 百分比显示 + 老项目兼容 ---- */
check(
  '权重 3:1 显示成 75% / 25%',
  JSON.stringify(branchPercents([{ id: 'a', next: '', weight: 3 }, { id: 'b', next: '', weight: 1 }])) ===
    JSON.stringify([75, 25]),
  JSON.stringify(branchPercents([{ id: 'a', next: '', weight: 3 }, { id: 'b', next: '', weight: 1 }])),
);
check(
  '权重全 0 显示成等概率 50% / 50%',
  JSON.stringify(branchPercents([{ id: 'a', next: '', weight: 0 }, { id: 'b', next: '', weight: 0 }])) ===
    JSON.stringify([50, 50]),
);
check('formatPercent：整数不带小数', formatPercent(75) === '75%', formatPercent(75));
check('formatPercent：除不尽保留一位', formatPercent(100 / 3) === '33.3%', formatPercent(100 / 3));

// 老项目导入：不该凭空多出 branches 字段
const legacyImported = normalizeStory({
  meta: { title: '老项目', version: '1.0.0' },
  scenes: [
    {
      id: 's1',
      name: '序章',
      nodes: [{ id: 'ch', type: 'choice', options: [{ id: 'o1', text: '甲', next: 'x' }] }],
    },
  ],
  startSceneId: 's1',
});
const legacyImportedOpt = (legacyImported.scenes[0]!.nodes[0] as ChoiceNode).options[0]!;
check(
  '导入老项目：不会凭空多出 branches 字段',
  legacyImportedOpt.branches === undefined && legacyImportedOpt.next === 'x',
  JSON.stringify(legacyImportedOpt),
);

/* ---- 20.6 连带修的三处：自动布局 / 复制场景 / 复制节点 ---- */
const branchScene = projectOf([
  {
    id: 'ch',
    type: 'choice',
    options: [
      {
        id: 'o1',
        text: '甲',
        next: 'a',
        branches: [
          { id: 'b1', next: 'a', weight: 3 },
          { id: 'b2', next: 'b', weight: 1 },
        ],
      },
    ],
  },
  { id: 'a', type: 'dialogue', text: 'A' },
  { id: 'b', type: 'dialogue', text: 'B' },
]);
const sceneLayout = autoLayoutScene(branchScene.story.scenes[0]!);
check(
  '自动布局：分支目标横向展开到选项节点右侧（不再被当成孤立节点丢到最后一列）',
  sceneLayout.a!.x > sceneLayout.ch!.x && sceneLayout.b!.x > sceneLayout.ch!.x,
  JSON.stringify(sceneLayout),
);

/* ---- 20.7 整理布局的质量：不重叠 + 不交叉 ---- */
// 场景：两条互不相干的支线（A / B）+ 一个很高的选项节点 + 一个孤立节点
const qualityData = projectOf([
  { id: 'a1', type: 'dialogue', text: 'A1', next: 'a2' },
  { id: 'a2', type: 'dialogue', text: 'A2', next: 'a3' },
  { id: 'a3', type: 'dialogue', text: 'A3' },
  { id: 'b1', type: 'dialogue', text: 'B1', next: 'b2' },
  { id: 'b2', type: 'dialogue', text: 'B2', next: 'b3' },
  { id: 'b3', type: 'dialogue', text: 'B3' },
  {
    id: 'big',
    type: 'choice',
    options: [1, 2, 3].map((i) => ({
      id: `o${i}`,
      text: `选项${i}`,
      next: '',
      branches: [
        { id: `o${i}b1`, next: '', weight: 1 },
        { id: `o${i}b2`, next: '', weight: 1 },
      ],
    })),
  },
  { id: 'orphan', type: 'dialogue', text: '孤立' },
]);
const qualityScene = qualityData.story.scenes[0]!;
const qualityLayout = autoLayoutScene(qualityScene);

// 按列分组，检查同列纵向间距是否够（用估算的节点高度判定，选项节点很高）
const columnOf = new Map<number, { id: string; y: number; h: number }[]>();
for (const n of qualityScene.nodes) {
  const p = qualityLayout[n.id]!;
  const list = columnOf.get(p.x) ?? [];
  list.push({ id: n.id, y: p.y, h: estimateNodeHeight(n) });
  columnOf.set(p.x, list);
}
let squeezed = 0;
for (const list of columnOf.values()) {
  list.sort((p, q) => p.y - q.y);
  for (let i = 1; i < list.length; i += 1) {
    if (list[i]!.y - list[i - 1]!.y < list[i - 1]!.h) squeezed += 1;
  }
}
check(
  '整理布局：同列节点不会互相压住（含很高的选项节点）',
  squeezed === 0,
  `被压住 ${squeezed} 处`,
);

/** 某节点在它那列里是从上往下第几个 */
const orderInColumn = (id: string): number => {
  const p = qualityLayout[id]!;
  const list = (columnOf.get(p.x) ?? []).sort((a, b) => a.y - b.y).map((i) => i.id);
  return list.indexOf(id);
};
check(
  '整理布局：A / B 两条独立链在 x 方向左右分开、互不相交',
  qualityLayout.a1!.x === qualityLayout.a2!.x &&
    qualityLayout.a2!.x === qualityLayout.a3!.x &&
    qualityLayout.b1!.x === qualityLayout.b2!.x &&
    qualityLayout.b2!.x === qualityLayout.b3!.x &&
    qualityLayout.a3!.x < qualityLayout.b1!.x,
  ['a1', 'b1', 'a2', 'b2', 'a3', 'b3'].map((id) => `${id}=(${Math.round(qualityLayout[id]!.x)}, ${Math.round(qualityLayout[id]!.y)})`).join(' '),
);
check(
  '整理布局：每个节点都拿到了坐标（漏掉的节点会掉到默认位置、又压成一团）',
  qualityScene.nodes.every((n) => qualityLayout[n.id] !== undefined),
  JSON.stringify(Object.keys(qualityLayout)),
);
check(
  '整理布局：重复整理结果稳定（连点两次不会来回乱跳）',
  JSON.stringify(autoLayoutScene(qualityScene)) === JSON.stringify(qualityLayout),
);

/* ---- 20.8 新增节点的默认落点 ---- */
// 老实现是"按节点总数填 12 个格子"，第 13 个节点会直接盖在第 1 个上
let addProj = projectOf([{ id: 'seed', type: 'dialogue', text: '起点' }]);
const addSceneId = sceneIdOf(addProj);
const addedIds: string[] = [];
for (let i = 0; i < 16; i += 1) {
  const result = addNode(addProj, addSceneId, createNode('dialogue'), null);
  addProj = result.data;
  addedIds.push(result.nodeId);
}
const uniqueSpots = new Set(addedIds.map((id) => `${addProj.layout[id]!.x},${addProj.layout[id]!.y}`));
check(
  '新增节点：连续加 16 个各有各的位置（老实现第 13 个会盖在第 1 个上）',
  uniqueSpots.size === addedIds.length,
  `${uniqueSpots.size}/${addedIds.length} 个不重复位置`,
);

// 选中锚点后新增：应该接在锚点右边一列、和锚点同高
const anchorProj = projectOf([{ id: 'anchor', type: 'dialogue', text: '锚点' }]);
const anchorFallback = autoLayoutScene(anchorProj.story.scenes[0]!)['anchor']!;
const afterAnchor = addNode(anchorProj, sceneIdOf(anchorProj), createNode('dialogue'), 'anchor');
const anchorSpot = afterAnchor.data.layout[afterAnchor.nodeId]!;
check(
  '新增节点：接在锚点右边一列、和锚点同高',
  anchorSpot.x > anchorFallback.x && anchorSpot.y === anchorFallback.y,
  `锚点 (${anchorFallback.x}, ${anchorFallback.y}) → 新节点 (${anchorSpot.x}, ${anchorSpot.y})`,
);

// 选中选项节点后新增：接到第一个空选项上，落点对准那个选项的高度
const choiceProj = projectOf([
  {
    id: 'chX',
    type: 'choice',
    options: [
      { id: 'x1', text: '一', next: '' },
      { id: 'x2', text: '二', next: '' },
    ],
  },
]);
const afterChoice = addNode(choiceProj, sceneIdOf(choiceProj), createNode('dialogue'), 'chX');
const choiceNode = nodeById(afterChoice.data, 'chX') as ChoiceNode;
const choiceFallback = autoLayoutScene(choiceProj.story.scenes[0]!)['chX']!;
const choiceSpot = afterChoice.data.layout[afterChoice.nodeId]!;
check(
  '新增节点：接在选项节点上时接到了第一个空选项',
  choiceNode.options[0]!.next === afterChoice.nodeId,
  JSON.stringify(choiceNode.options.map((o) => o.next)),
);
check(
  '新增节点：落点在选项节点右边、竖向没有偏出这个节点',
  choiceSpot.x > choiceFallback.x &&
    choiceSpot.y >= choiceFallback.y &&
    choiceSpot.y < choiceFallback.y + estimateNodeHeight(choiceNode),
  `选项节点 (${choiceFallback.x}, ${choiceFallback.y}) 高 ${estimateNodeHeight(choiceNode)} → 新节点 (${choiceSpot.x}, ${choiceSpot.y})`,
);

const dupResult = duplicateScene(branchScene, sceneIdOf(branchScene));
const dupScene = dupResult.data.story.scenes.find((s) => s.id === dupResult.sceneId)!;
const dupChoice = dupScene.nodes.find((n) => n.type === 'choice') as ChoiceNode;
const dupIds = new Set(dupScene.nodes.map((n) => n.id));
check(
  '复制场景：分支指向副本里的新节点（不是原场景的）',
  dupChoice.options[0]!.branches!.every((b) => dupIds.has(b.next)),
  JSON.stringify(dupChoice.options[0]!.branches),
);
check(
  '复制场景：分支 id 也换新',
  dupChoice.options[0]!.branches![0]!.id !== 'b1',
  dupChoice.options[0]!.branches![0]!.id,
);

const clonedChoice = cloneNode(branchScene.story.scenes[0]!.nodes[0]!) as ChoiceNode;
check(
  '复制节点：概率分支也换新 id',
  clonedChoice.options[0]!.branches![0]!.id !== 'b1',
  clonedChoice.options[0]!.branches![0]!.id,
);
check(
  '复制节点：分支目标保持不变（复制节点不重写连线，和原逻辑一致）',
  clonedChoice.options[0]!.branches![0]!.next === 'a',
  clonedChoice.options[0]!.branches![0]!.next,
);

/* ------------------------------------------------------------------ */
section('21. 特效：开启 / 关闭 / 作用对象');

/* ---- 21.1 引擎：持续特效进状态，「特效关闭」把它移除 ---- */
const fxStory: Story = (() => {
  const story = createEmptyStory('特效剧本');
  const scene = createScene('特效');
  story.scenes = [scene];
  story.startSceneId = scene.id;
  story.endings = [{ id: 'e1', name: '结束' }];
  story.characters = [{ id: 'c1', name: '凛', sprites: { base: '', expressions: [] } }];
  scene.nodes = [
    { id: 'on1', type: 'effect', effect: 'blur', target: 'screen', next: 'on2' },
    { id: 'on2', type: 'effect', effect: 'blackAndWhite', target: 'sprite', targetCharacterId: 'c1', next: 'on3' },
    { id: 'on3', type: 'effect', effect: 'shake', target: 'dialogue', next: 'say1' },
    { id: 'say1', type: 'dialogue', text: '开着特效说话', next: 'off' },
    { id: 'off', type: 'effectOff', effect: 'blur', next: 'say2' },
    { id: 'say2', type: 'dialogue', text: '模糊关掉了', next: 'offall' },
    { id: 'offall', type: 'effectOff', next: 'end' },
    { id: 'end', type: 'ending', endingId: 'e1' },
  ];
  return story;
})();
const fxIndex = buildStoryIndex(fxStory);
const fxStep1 = advance(fxIndex, createInitialState(fxIndex));
check('三个持续特效都进引擎状态', fxStep1.state.effects.length === 3, JSON.stringify(fxStep1.state.effects));
check(
  '作用在立绘上的特效带角色 id',
  fxStep1.state.effects.some((e) => e.effect === 'blackAndWhite' && e.target === 'sprite' && e.targetCharacterId === 'c1'),
  JSON.stringify(fxStep1.state.effects),
);
check('开启时发出 effectOn 事件', fxStep1.events.some((e) => e.kind === 'effectOn'));
const fxStep2 = advance(fxIndex, fxStep1.state);
check(
  '关闭指定特效：只关那一种',
  fxStep2.state.effects.length === 2 && fxStep2.state.effects.every((e) => e.effect !== 'blur'),
  JSON.stringify(fxStep2.state.effects),
);
check('关闭时发出 effectOff 事件', fxStep2.events.some((e) => e.kind === 'effectOff'));
const fxStep3 = advance(fxIndex, fxStep2.state);
check('关闭节点不指定特效 = 全部关闭', fxStep3.state.effects.length === 0, JSON.stringify(fxStep3.state.effects));

/* ---- 21.2 重复开启 / 老项目兼容 ---- */
const fxDupStory: Story = (() => {
  const story = createEmptyStory('重复特效');
  const scene = createScene('S');
  story.scenes = [scene];
  story.startSceneId = scene.id;
  scene.nodes = [
    { id: 'a', type: 'effect', effect: 'blur', target: 'screen', next: 'b' },
    { id: 'b', type: 'effect', effect: 'blur', target: 'screen', next: 'say' },
    { id: 'say', type: 'dialogue', text: '只有一层模糊' },
  ];
  return story;
})();
const fxDupIndex = buildStoryIndex(fxDupStory);
const fxDupStep = advance(fxDupIndex, createInitialState(fxDupIndex));
check(
  '同一对象重复开同一种特效不会叠加',
  fxDupStep.state.effects.filter((e) => e.effect === 'blur').length === 1,
  JSON.stringify(fxDupStep.state.effects),
);

const fxLegacyStory: Story = (() => {
  const story = createEmptyStory('老特效');
  const scene = createScene('S');
  story.scenes = [scene];
  story.startSceneId = scene.id;
  scene.nodes = [
    { id: 'fx', type: 'effect', effect: 'shake', duration: 0.4, next: 'say' },
    { id: 'say', type: 'dialogue', text: '老行为不变' },
  ];
  return story;
})();
const fxLegacyIndex = buildStoryIndex(fxLegacyStory);
const fxLegacyStep = advance(fxLegacyIndex, createInitialState(fxLegacyIndex));
check(
  '老项目限时特效：仍发一次性事件（带原时长）',
  fxLegacyStep.events.some((e) => e.kind === 'effect' && e.effect === 'shake' && e.duration === 0.4),
  JSON.stringify(fxLegacyStep.events),
);
check('老项目限时特效：不进特效状态', fxLegacyStep.state.effects.length === 0);

const fxFlashStory: Story = (() => {
  const story = createEmptyStory('闪白');
  const scene = createScene('S');
  story.scenes = [scene];
  story.startSceneId = scene.id;
  scene.nodes = [
    { id: 'fx', type: 'effect', effect: 'flash', target: 'screen', next: 'say' },
    { id: 'say', type: 'dialogue', text: '闪一下就完' },
  ];
  return story;
})();
const fxFlashStep = advance(buildStoryIndex(fxFlashStory), createInitialState(buildStoryIndex(fxFlashStory)));
check(
  '闪白（无时长）：播放一次，固定时长',
  fxFlashStep.events.some((e) => e.kind === 'effect' && e.effect === 'flash' && e.duration === FLASH_SECONDS),
  JSON.stringify(fxFlashStep.events),
);
check('闪白不进特效状态（本来就不需要关）', fxFlashStep.state.effects.length === 0);

/* ---- 21.3 存档兼容 ---- */
const fxRoundTrip = JSON.parse(JSON.stringify(fxStep1.state)) as EngineState;
const fxResumeStep = advance(fxIndex, fxRoundTrip);
check(
  '特效状态随存档往返：读档后继续关特效',
  fxResumeStep.state.effects.length === 2 && fxResumeStep.node?.id === 'say2',
  JSON.stringify({ effects: fxResumeStep.state.effects.length, node: fxResumeStep.node?.id }),
);
const fxLegacySave = JSON.parse(JSON.stringify(fxStep1.state)) as Record<string, unknown>;
delete fxLegacySave.effects;
let legacySaveOk = true;
try {
  advance(fxIndex, fxLegacySave as unknown as EngineState);
} catch {
  legacySaveOk = false;
}
check('旧存档没有 effects 字段也不会崩', legacySaveOk);

/* ---- 21.4 编辑器：新建节点 / 自动连线 / 摘要 ---- */
const fxNew = createNode('effect');
check(
  '新建特效节点：默认震动、作用于整个画面、不带时长',
  fxNew.type === 'effect' && fxNew.effect === 'shake' && fxNew.target === 'screen' && fxNew.duration === undefined,
  JSON.stringify(fxNew),
);
const fxOffNew = createNode('effectOff');
check('新建特效关闭节点：默认关闭全部', fxOffNew.type === 'effectOff' && fxOffNew.effect === undefined, JSON.stringify(fxOffNew));

const fxAnchorProject = projectOf([{ id: 'a', type: 'dialogue', text: 'A', next: undefined }]);
const fxAdded = addNode(fxAnchorProject, sceneIdOf(fxAnchorProject), createNode('effectOff'), 'a');
check(
  '特效关闭节点是链式节点，会自动接在选中节点后面',
  nextOf(fxAdded.data, 'a') === fxAdded.nodeId && nodeById(fxAdded.data, fxAdded.nodeId)?.type === 'effectOff',
  JSON.stringify({ next: nextOf(fxAdded.data, 'a'), nodeId: fxAdded.nodeId }),
);

const fxSumOn = summarizeNode(fxStory.scenes[0]!.nodes[0]!, fxStory);
check('节点摘要：持续特效显示作用对象', fxSumOn.detail === '持续 · 整个画面', fxSumOn.detail);
const fxSumSprite = summarizeNode(fxStory.scenes[0]!.nodes[1]!, fxStory);
check('节点摘要：立绘特效显示角色名', fxSumSprite.detail === '持续 · 凛的立绘', fxSumSprite.detail);
const fxSumOff = summarizeNode(fxStory.scenes[0]!.nodes[4]!, fxStory);
check('节点摘要：关闭节点显示关闭哪个', fxSumOff.title === '关闭模糊' && fxSumOff.label === '特效关闭', JSON.stringify(fxSumOff));
const fxSumLegacy = summarizeNode(fxLegacyStory.scenes[0]!.nodes[0]!, fxLegacyStory);
check('节点摘要：旧版限时特效标注出来', fxSumLegacy.detail === '旧版限时 0.4s', fxSumLegacy.detail);

/* ---- 21.5 校验 ---- */
const fxBadSpriteStory = projectOf([
  { id: 'fx', type: 'effect', effect: 'blur', target: 'sprite', next: undefined },
]).story;
check(
  '特效作用于立绘但没选角色 → 报错',
  validateStory(fxBadSpriteStory).some((i) => i.level === 'error' && i.message.includes('没有指定角色')),
  JSON.stringify(validateStory(fxBadSpriteStory).map((i) => i.message)),
);
const fxNoOffStory = projectOf([{ id: 'fx', type: 'effect', effect: 'blur', target: 'screen' }]).story;
check(
  '有持续特效但没有「特效关闭」节点 → 提醒',
  validateStory(fxNoOffStory).some((i) => i.level === 'warning' && i.message.includes('持续到剧情结束')),
  JSON.stringify(validateStory(fxNoOffStory).map((i) => i.message)),
);
const fxWithOffStory = projectOf([
  { id: 'fx', type: 'effect', effect: 'blur', target: 'screen', next: 'off' },
  { id: 'off', type: 'effectOff', next: undefined },
]).story;
check(
  '加了「特效关闭」节点后不再提醒',
  !validateStory(fxWithOffStory).some((i) => i.message.includes('持续到剧情结束')),
);
check(
  '旧版限时特效不触发"没关闭"提醒',
  !validateStory(fxLegacyStory).some((i) => i.message.includes('持续到剧情结束')),
);

/* ---- 21.6 导入归一化：新字段不丢 ---- */
const fxImported = normalizeStory({
  meta: { title: '特效导入', version: '1.0.0' },
  scenes: [
    {
      id: 's1',
      name: 'S',
      nodes: [
        { id: 'on', type: 'effect', effect: 'blur', target: 'sprite', targetCharacterId: 'c1', next: 'off' },
        { id: 'off', type: 'effectOff', effect: 'blur', next: undefined },
      ],
    },
  ],
  startSceneId: 's1',
});
const fxImportedOn = fxImported.scenes[0]!.nodes[0]!;
const fxImportedOff = fxImported.scenes[0]!.nodes[1]!;
check(
  '导入：target / targetCharacterId 保留',
  fxImportedOn.type === 'effect' && fxImportedOn.target === 'sprite' && fxImportedOn.targetCharacterId === 'c1',
  JSON.stringify(fxImportedOn),
);
check(
  '导入：特效关闭节点原样保留',
  fxImportedOff.type === 'effectOff' && fxImportedOff.effect === 'blur',
  JSON.stringify(fxImportedOff),
);

/* ------------------------------------------------------------------ */
console.log(`\n结果：${passed} 项通过，${failed} 项失败`);
if (failed > 0) process.exitCode = 1;
