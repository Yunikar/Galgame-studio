/**
 * 内嵌预览的阶段机：开场图 → 标题画面 → 游戏画面。
 *
 * 它是独立运行时（App.tsx）的裁剪版，只保留"看画面"需要的部分：
 * 没有存档系统、没有结局收集，所以标题画面的「读取存档」恒为不可用。
 *
 * 编辑器底部预览默认直接从游戏画面开始（fromTitle=false）；
 * 勾选「从标题画面开始」后才走这套流程，用来核对开场图和标题背景。
 */
import {
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import {
  OPENING_DEFAULT_SECONDS,
  OPENING_FADE_SECONDS,
  OPENING_MAX_SECONDS,
  OPENING_MIN_SECONDS,
  type Story,
} from '@gal/shared';
import type { AssetResolver } from '../lib/assetResolver';
import { resolveInitialPhase, type PreviewPhase } from '../lib/previewPhase';
import type { GameSettings } from '../lib/settings';
import GamePlayer, { type GamePlayerController } from '../player/GamePlayer';
import OpeningScreen from './OpeningScreen';
import TitleScreen from './TitleScreen';

/** 预览需要外部控制的能力（比完整控制器少，预览不涉及存档） */
export type PreviewController = Pick<GamePlayerController, 'advance' | 'choose' | 'restart'>;

/** 把开场图时长限制在允许范围内（与独立运行时保持一致） */
function clampOpeningSeconds(seconds: number): number {
  return Math.min(OPENING_MAX_SECONDS, Math.max(OPENING_MIN_SECONDS, seconds));
}

type Props = {
  story: Story;
  resolveAsset: AssetResolver;
  settings: GameSettings;
  /** 从哪个场景开始（仅 fromTitle=false 时生效） */
  startSceneId?: string;
  /** 从哪个节点开始（仅 fromTitle=false 时生效） */
  startNodeId?: string;
  /** 暂停时点击不推进 */
  paused?: boolean;
  /** true = 先播开场图 / 标题画面再进游戏；false = 直接进游戏画面 */
  fromTitle?: boolean;
  controllerRef?: MutableRefObject<PreviewController | null>;
  /** 游戏画面里节点的变化 */
  onNodeChange?: (nodeId: string | null) => void;
  /** 阶段变化（工具栏显示用） */
  onPhaseChange?: (phase: PreviewPhase) => void;
  /** 标题画面点「设置」：交给外层的设置面板 */
  onOpenSettings?: () => void;
};

export default function PreviewStage({
  story,
  resolveAsset,
  settings,
  startSceneId,
  startNodeId,
  paused,
  fromTitle = false,
  controllerRef,
  onNodeChange,
  onPhaseChange,
  onOpenSettings,
}: Props) {
  /** 开场图 / 标题背景：素材解析不出来就当没配 */
  const openingSrc = story.meta.openingImage
    ? resolveAsset(story.meta.openingImage)
    : undefined;
  const titleBackgroundSrc = story.meta.titleBackground
    ? resolveAsset(story.meta.titleBackground)
    : undefined;
  const openingSeconds = clampOpeningSeconds(
    story.meta.openingDuration ?? OPENING_DEFAULT_SECONDS,
  );

  const [phase, setPhase] = useState<PreviewPhase>(() =>
    resolveInitialPhase(fromTitle, !!openingSrc),
  );
  /** 在游戏画面就地重置时自增，用来重建播放器（不经过标题画面） */
  const [runId, setRunId] = useState(0);
  const gameControllerRef = useRef<GamePlayerController | null>(null);

  // 回调每次渲染都可能是新函数，用 ref 存住，避免下面那个 effect 反复触发
  const callbacksRef = useRef({ onNodeChange, onPhaseChange });
  useEffect(() => {
    callbacksRef.current = { onNodeChange, onPhaseChange };
  });

  // 阶段变化：通知外层，并清空"当前节点"（标题/开场阶段没有节点）
  useEffect(() => {
    callbacksRef.current.onPhaseChange?.(phase);
    if (phase !== 'playing') callbacksRef.current.onNodeChange?.(null);
  }, [phase]);

  // 把外部控制句柄接进来：预览只需要「推进 / 选选项 / 重置」
  useEffect(() => {
    if (!controllerRef) return;
    controllerRef.current = {
      advance: () => gameControllerRef.current?.advance(),
      choose: (optionId) => gameControllerRef.current?.choose(optionId),
      restart: () => {
        // 从标题开始时，"重置" = 回到标题画面
        // （和独立运行时一致：开场图只在启动游戏时播一次）
        if (fromTitle) setPhase('title');
        else setRunId((v) => v + 1);
      },
    };
    return () => {
      controllerRef.current = null;
    };
  }, [controllerRef, fromTitle]);

  return (
    <>
      {phase === 'opening' && openingSrc ? (
        <OpeningScreen
          src={openingSrc}
          durationMs={openingSeconds * 1000}
          fadeMs={OPENING_FADE_SECONDS * 1000}
          onDone={() => setPhase('title')}
        />
      ) : null}

      {phase === 'title' ? (
        <TitleScreen
          title={story.meta.title}
          backgroundSrc={titleBackgroundSrc}
          // 预览没有存档系统，读档按钮恒为不可用
          hasSave={false}
          endings={[]}
          onStart={() => setPhase('playing')}
          onLoad={() => undefined}
          onSettings={() => onOpenSettings?.()}
        />
      ) : null}

      {phase === 'playing' ? (
        <GamePlayer
          key={`run:${runId}`}
          story={story}
          resolveAsset={resolveAsset}
          settings={settings}
          // 从标题进来时一律从剧本开头走，忽略"从选中节点开始"
          startSceneId={fromTitle ? undefined : startSceneId}
          startNodeId={fromTitle ? undefined : startNodeId}
          mode="preview"
          paused={paused}
          controllerRef={gameControllerRef}
          onNodeChange={onNodeChange}
        />
      ) : null}
    </>
  );
}
