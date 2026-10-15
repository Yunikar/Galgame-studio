/**
 * 游戏播放器（核心组件）
 *
 * 职责：把引擎状态画成舞台画面，把引擎事件变成音效/特效，
 *       并处理"点击 / 空格 / 回车推进"和选项选择。
 *
 * 它同时被两处使用：
 * - 编辑器底部实时预览（mode='preview'，通过 controllerRef 受控）
 * - 正式游戏（mode='game'，外层再套标题画面 / 存档 / 设置）
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import { buildStoryIndex, type Story } from '@gal/shared';
import { advance, chooseOption, createInitialState, simulateTo } from '../engine/engine';
import type { EngineState, EngineStep } from '../engine/types';
import type { AssetResolver } from '../lib/assetResolver';
import type { GameSettings } from '../lib/settings';
import { audioManager } from './audioManager';
import { useTypewriter } from './useTypewriter';
import { useEffects } from './useEffects';
import BackgroundLayer from './BackgroundLayer';
import SpriteLayer from './SpriteLayer';
import DialogueBox from './DialogueBox';
import ChoiceMenu from './ChoiceMenu';
import EffectLayer from './EffectLayer';

/** 外部（编辑器预览）可以调用的控制接口 */
export type GamePlayerController = {
  /** 推进一句 */
  advance: () => void;
  /** 选择一个选项 */
  choose: (optionId: string) => void;
  /** 重开 */
  restart: () => void;
  /** 当前引擎状态（存档用） */
  getState: () => EngineState;
  /** 当前所在节点 id */
  getNodeId: () => string | null;
};

export type GamePlayerProps = {
  story: Story;
  resolveAsset: AssetResolver;
  settings: GameSettings;
  /** 从哪个场景开始（默认剧本的起始场景） */
  startSceneId?: string;
  /** 从哪个节点开始（编辑器预览用；会自动预演前面的演出节点） */
  startNodeId?: string;
  /** 读档：直接用存档里的引擎状态恢复（优先级最高） */
  resumeState?: EngineState | null;
  mode?: 'game' | 'preview';
  /** 暂停时点击不推进（编辑器预览的暂停按钮） */
  paused?: boolean;
  /** 当前显示节点变化 */
  onNodeChange?: (nodeId: string | null) => void;
  /** 状态变化（自动存档用） */
  onStateChange?: (state: EngineState) => void;
  /** 到达结局 */
  onEnding?: (endingId: string) => void;
  /** 剧情意外走完（没有走到结局节点） */
  onEndOfStory?: () => void;
  /** 外部控制句柄 */
  controllerRef?: MutableRefObject<GamePlayerController | null>;
};

/** 震动关键帧 */
const SHAKE_KEYFRAMES: Keyframe[] = [
  { transform: 'translate(0, 0)' },
  { transform: 'translate(-9px, 4px)' },
  { transform: 'translate(8px, -6px)' },
  { transform: 'translate(-6px, -3px)' },
  { transform: 'translate(5px, 5px)' },
  { transform: 'translate(0, 0)' },
];

export default function GamePlayer({
  story,
  resolveAsset,
  settings,
  startSceneId,
  startNodeId,
  resumeState,
  mode = 'game',
  paused,
  onNodeChange,
  onStateChange,
  onEnding,
  onEndOfStory,
  controllerRef,
}: GamePlayerProps) {
  const storyIndex = useMemo(() => buildStoryIndex(story), [story]);
  const stageRef = useRef<HTMLDivElement>(null);
  const effects = useEffects();

  /** 初始状态：读档 > 指定节点预演 > 从场景开头 */
  const initialState = useMemo(() => {
    if (resumeState) {
      // 读档：把游标拨回存档时正在显示的那一句，让它重新显示出来。
      // 旧存档没有 effects 字段，补成空数组，后面的代码就不用到处判空。
      const withEffects = { ...resumeState, effects: resumeState.effects ?? [] };
      return resumeState.currentNodeId
        ? { ...withEffects, pendingNodeId: resumeState.currentNodeId, chainEnded: false }
        : withEffects;
    }
    if (startNodeId) return simulateTo(storyIndex, startSceneId ?? story.startSceneId, startNodeId);
    return createInitialState(storyIndex, { sceneId: startSceneId });
  }, [resumeState, storyIndex, startSceneId, startNodeId, story.startSceneId]);

  const [step, setStep] = useState<EngineStep>(() => advance(storyIndex, initialState));

  const dialogueNode = step.type === 'dialogue' && step.node?.type === 'dialogue' ? step.node : null;
  const choiceNode = step.type === 'choice' && step.node?.type === 'choice' ? step.node : null;
  const ended = step.type === 'end-of-story';

  /* ---------------- 打字机 ---------------- */
  const speed = dialogueNode ? (dialogueNode.speed ?? settings.textSpeed) : settings.textSpeed;
  const typewriter = useTypewriter(dialogueNode?.text ?? '', speed, !!dialogueNode);

  /* ---------------- 音量同步 ---------------- */
  useEffect(() => {
    audioManager.applySettings(settings);
  }, [settings]);

  /* ---------------- 执行引擎事件（音频 / 特效） ---------------- */
  const lastAppliedRef = useRef<EngineStep | null>(null);
  useEffect(() => {
    // 同一个 step 只执行一次事件（防 React 双渲染导致音效重复播放）
    if (lastAppliedRef.current === step) return;
    lastAppliedRef.current = step;

    for (const event of step.events) {
      switch (event.kind) {
        case 'playBgm':
          audioManager.playBgm(resolveAsset(event.assetId), event.loop, event.fadeIn);
          break;
        case 'stopBgm':
          audioManager.stopBgm(event.fadeOut);
          break;
        case 'playSe':
          audioManager.playSe(resolveAsset(event.assetId));
          break;
        case 'playVoice':
          audioManager.playVoice(resolveAsset(event.assetId));
          break;
        case 'effect':
          effects.trigger(event.effect, event.duration);
          break;
        default:
          // 背景 / 立绘由 state 驱动渲染，这里不用处理
          break;
      }
    }
  }, [step, resolveAsset, effects]);

  /* ---------------- 震动动画 ---------------- */
  useEffect(() => {
    if (!effects.shake || !stageRef.current) return;
    const duration = Math.max(200, effects.shake.duration * 1000);
    stageRef.current.animate(SHAKE_KEYFRAMES, { duration, easing: 'ease-in-out' });
  }, [effects.shake]);

  /* ---------------- 对外回调 ---------------- */
  useEffect(() => {
    onNodeChange?.(step.node?.id ?? null);
  }, [step.node?.id, onNodeChange]);

  useEffect(() => {
    onStateChange?.(step.state);
  }, [step.state, onStateChange]);

  /* ---------------- 推进 ---------------- */
  const goNext = useCallback(() => {
    if (paused || ended) return;
    if (choiceNode) return; // 等待玩家选择

    // 台词还没打完：先补完
    if (dialogueNode && !typewriter.done) {
      typewriter.finish();
      return;
    }

    const next = advance(storyIndex, step.state);
    if (next.type === 'ending') {
      audioManager.stopVoice();
      if (next.node?.type === 'ending') onEnding?.(next.node.endingId);
    }
    if (next.type === 'end-of-story') {
      onEndOfStory?.();
    }
    setStep(next);
  }, [paused, ended, choiceNode, dialogueNode, typewriter, storyIndex, step.state, onEnding, onEndOfStory]);

  const choose = useCallback(
    (optionId: string) => {
      if (paused) return;
      const next = chooseOption(storyIndex, step.state, optionId);
      if (next.type === 'ending' && next.node?.type === 'ending') onEnding?.(next.node.endingId);
      if (next.type === 'end-of-story') onEndOfStory?.();
      setStep(next);
    },
    [paused, storyIndex, step.state, onEnding, onEndOfStory],
  );

  const restart = useCallback(() => {
    audioManager.stopVoice();
    effects.reset();
    lastAppliedRef.current = null;
    setStep(advance(storyIndex, initialState));
  }, [storyIndex, initialState, effects]);

  /* ---------------- 键盘操作 ---------------- */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goNext]);

  /* ---------------- 暴露控制接口 ---------------- */
  useEffect(() => {
    if (!controllerRef) return;
    controllerRef.current = {
      advance: goNext,
      choose,
      restart,
      getState: () => step.state,
      getNodeId: () => step.node?.id ?? null,
    };
  });

  /* ---------------- 打字机换行时停止上一句语音 ---------------- */
  useEffect(() => {
    return () => {
      audioManager.stopVoice();
    };
  }, [step.node?.id]);

  const speaker = dialogueNode?.speaker
    ? story.characters.find((c) => c.id === dialogueNode.speaker)
    : undefined;

  /*
   * 持续特效（震动 / 黑白 / 模糊）来自引擎状态，按作用对象拆开：
   *   screen   -> 作用在整个舞台（背景 + 立绘一起，不含对话框）
   *   dialogue -> 只作用在对话框上
   *   sprite   -> 只作用在指定角色的立绘上（见 SpriteLayer）
   * 老项目的"限时特效"仍由 useEffects 的事件驱动（effects.grayscale / blurPx），两路取并集。
   */
  const screenEffects = (step.state.effects ?? []).filter((e) => e.target === 'screen');
  const dialogueEffects = (step.state.effects ?? []).filter((e) => e.target === 'dialogue');
  const filterOf = (list: typeof screenEffects, extra: string) =>
    [
      extra,
      list.some((e) => e.effect === 'blackAndWhite') ? 'grayscale(1)' : '',
      list.some((e) => e.effect === 'blur') ? 'blur(6px)' : '',
    ]
      .filter(Boolean)
      .join(' ') || undefined;

  const stageFilter = filterOf(screenEffects, [effects.grayscale ? 'grayscale(1)' : '', effects.blurPx ? 'blur(6px)' : ''].filter(Boolean).join(' '));
  const stageShaking = screenEffects.some((e) => e.effect === 'shake');
  const dialogueFilter = filterOf(dialogueEffects, '');
  const dialogueShaking = dialogueEffects.some((e) => e.effect === 'shake');

  return (
    /*
     * 舞台内部的层级约定（从下到上，全部写死，别用 auto）：
     *   背景 0  →  立绘 10  →  特效 20  →  对话框 100  →  选项 110  →  结束提示 150  →  调试 160
     * 立绘永远在对话框下面；舞台外的 UI 层（存档/设置按钮）是 200。
     */
    <div
      ref={stageRef}
      className={`game-stage${stageShaking ? ' anim-shake-loop' : ''}`}
      style={{ filter: stageFilter, cursor: dialogueNode ? 'pointer' : 'default' }}
      onClick={goNext}
    >
      <BackgroundLayer
        assetId={step.state.background}
        transition={step.state.backgroundTransition}
        resolveAsset={resolveAsset}
      />

      <SpriteLayer
        story={story}
        sprites={step.state.sprites}
        effects={step.state.effects ?? []}
        resolveAsset={resolveAsset}
      />

      <EffectLayer overlays={effects.overlays} />

      {dialogueNode ? (
        <DialogueBox
          speakerName={speaker?.name}
          speakerColor={speaker?.color}
          narration={!dialogueNode.speaker}
          text={typewriter.shown}
          done={typewriter.done}
          effectFilter={dialogueFilter}
          shaking={dialogueShaking}
        />
      ) : null}

      {choiceNode ? (
        <ChoiceMenu prompt={choiceNode.prompt} options={choiceNode.options} onSelect={choose} />
      ) : null}

      {ended ? (
        // 层级 150：盖在对话框之上
        <div className="absolute inset-0 flex items-center justify-center bg-black/70" style={{ zIndex: 150 }}>
          <div className="text-center">
            <div className="text-lg text-white/85">这段剧情结束了</div>
            <div className="mt-1 text-xs text-white/50">
              剧本里没有走到「结局」节点，检查一下连线是否完整
            </div>
          </div>
        </div>
      ) : null}

      {/* 编辑器预览时的调试信息（层级 160，压在所有画面之上） */}
      {mode === 'preview' ? (
        <div className="pointer-events-none absolute left-3 top-3 rounded bg-black/55 px-2 py-1 text-[10px] leading-relaxed text-white/70 backdrop-blur" style={{ zIndex: 160 }}>
          <div>
            节点：{step.node?.type ?? '（无）'} · {step.node?.id?.slice(0, 14) ?? '-'}
          </div>
          <div>
            场景：{story.scenes.find((s) => s.id === step.state.sceneId)?.name ?? '-'} · 台上立绘{' '}
            {Object.keys(step.state.sprites).length}
          </div>
        </div>
      ) : null}
    </div>
  );
}
