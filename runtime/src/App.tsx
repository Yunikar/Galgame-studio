/**
 * 游戏运行时外壳
 * 负责：加载剧本 -> 标题画面 -> 游戏画面（含存档/设置） -> 结局画面
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  normalizeStory,
  OPENING_DEFAULT_SECONDS,
  OPENING_FADE_SECONDS,
  OPENING_MAX_SECONDS,
  OPENING_MIN_SECONDS,
  type StoryNode,
} from '@gal/shared';
import { loadGame, type LoadedGame } from './lib/storyLoader';
import { usePreviewBridge } from './lib/previewBridge';
import { loadSettings, saveSettings, type GameSettings } from './lib/settings';
import { useStageScale } from './lib/useStageScale';
import {
  addReachedEnding,
  deleteSave,
  loadReachedEndings,
  loadSaves,
  writeSave,
  type SaveData,
  type SlotId,
} from './lib/saveStore';
import { audioManager } from './player/audioManager';
import GamePlayer, { type GamePlayerController } from './player/GamePlayer';
import type { EngineState } from './engine/types';
import TitleScreen from './components/TitleScreen';
import OpeningScreen from './components/OpeningScreen';
import EndingScreen from './components/EndingScreen';
import SaveLoadPanel from './components/SaveLoadPanel';
import SettingsPanel from './components/SettingsPanel';

type Phase = 'loading' | 'opening' | 'title' | 'playing' | 'ending';
type Panel = null | 'save' | 'load' | 'settings';

/** 把开场图时长限制在允许范围内 */
function clampOpeningSeconds(seconds: number): number {
  return Math.min(OPENING_MAX_SECONDS, Math.max(OPENING_MIN_SECONDS, seconds));
}

/** 从节点里取出"存档界面要显示的一句话" */
function describeNode(
  game: LoadedGame,
  nodeId: string | null,
): { sceneName: string; speakerName: string; text: string } {
  if (!nodeId) return { sceneName: '', speakerName: '', text: '' };

  for (const scene of game.story.scenes) {
    const node: StoryNode | undefined = scene.nodes.find((n) => n.id === nodeId);
    if (!node) continue;

    if (node.type === 'dialogue') {
      const speaker = node.speaker
        ? game.story.characters.find((c) => c.id === node.speaker)?.name ?? ''
        : '';
      return { sceneName: scene.name, speakerName: speaker, text: node.text };
    }
    if (node.type === 'choice') {
      return { sceneName: scene.name, speakerName: '', text: node.prompt ?? '（选择）' };
    }
    return { sceneName: scene.name, speakerName: '', text: `（${node.type} 节点）` };
  }

  return { sceneName: '', speakerName: '', text: '' };
}

export default function App() {
  const [phase, setPhase] = useState<Phase>('loading');
  /** 舞台等比缩放的容器与系数 */
  const { ref: rootRef, scale } = useStageScale<HTMLDivElement>();
  const [game, setGame] = useState<LoadedGame | null>(null);
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const [panel, setPanel] = useState<Panel>(null);
  const [saves, setSaves] = useState<Partial<Record<SlotId, SaveData>>>({});
  /** 已解锁结局：独立记录（打通立即解锁，跟存档无关） */
  const [reached, setReached] = useState<string[]>([]);
  const [endingNode, setEndingNode] = useState<{ name: string; description?: string } | null>(null);
  /** 每次开新游戏 / 读档都自增，用来强制重建播放器 */
  const [runId, setRunId] = useState(0);
  const [resumeState, setResumeState] = useState<EngineState | null>(null);
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  /** 编辑器预览指定的起点 */
  const [previewStart, setPreviewStart] = useState<{ sceneId?: string; nodeId?: string } | null>(null);

  const controllerRef = useRef<GamePlayerController | null>(null);
  const autoSaveTimer = useRef<number | null>(null);
  const storyTitle = game?.story.meta.title ?? '';

  /* ---------------- 加载游戏数据 ---------------- */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const loaded = await loadGame();
      if (cancelled) return;
      setGame(loaded);
      setSaves(loadSaves(loaded.story.meta.title));
      setReached(loadReachedEndings(loaded.story.meta));
      // 配了开场图、且素材能解析出来，就先播开场图；否则直接进标题画面
      const openingId = loaded.story.meta.openingImage;
      setPhase(openingId && loaded.resolveAsset(openingId) ? 'opening' : 'title');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ---------------- 设置持久化 ---------------- */
  useEffect(() => {
    saveSettings(settings);
    audioManager.applySettings(settings);
  }, [settings]);

  /* ---------------- 编辑器预览：接收注入的剧本 ---------------- */
  usePreviewBridge(
    useCallback((payload) => {
      const story = normalizeStory(payload.story);
      setGame({
        story,
        resolveAsset: (assetId) => payload.assets?.[assetId],
        source: 'editor',
      });
      setSaves(loadSaves(story.meta.title));
      // 预览打通结局不计入解锁记录（避免编辑器里测试把正式记录弄脏）
      setReached([]);
      setResumeState(null);
      setCurrentNodeId(null);
      setPreviewStart({ sceneId: payload.sceneId, nodeId: payload.nodeId });
      setRunId((v) => v + 1);
      audioManager.unlock();
      setPhase('playing');
    }, []),
  );

  /* ---------------- 自动存档 ---------------- */
  const handleStateChange = useCallback(
    (state: EngineState) => {
      if (!game) return;
      if (autoSaveTimer.current !== null) window.clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = window.setTimeout(() => {
        const info = describeNode(game, state.currentNodeId);
        writeSave(game.story.meta.title, {
          slotId: 'auto',
          savedAt: new Date().toISOString(),
          sceneName: info.sceneName,
          speakerName: info.speakerName,
          text: info.text,
          state,
        });
        setSaves(loadSaves(game.story.meta.title));
      }, 900);
    },
    [game],
  );

  /* ---------------- 开始 / 读档 / 结局 ---------------- */
  const startGame = useCallback(() => {
    audioManager.unlock();
    setResumeState(null);
    setRunId((v) => v + 1);
    setCurrentNodeId(null);
    setPhase('playing');
  }, []);

  const handleLoad = useCallback(
    (slotId: SlotId) => {
      const save = saves[slotId];
      if (!save) return;
      audioManager.unlock();
      audioManager.stopAll();
      setResumeState(save.state);
      setRunId((v) => v + 1);
      setCurrentNodeId(null);
      setPanel(null);
      setPhase('playing');
    },
    [saves],
  );

  const handleSave = useCallback(
    (slotId: SlotId) => {
      if (!game) return;
      const state = controllerRef.current?.getState() ?? null;
      if (!state) return;
      const info = describeNode(game, state.currentNodeId);
      const result = writeSave(game.story.meta.title, {
        slotId,
        savedAt: new Date().toISOString(),
        sceneName: info.sceneName,
        speakerName: info.speakerName,
        text: info.text,
        state,
      });
      setSaves(loadSaves(game.story.meta.title));
      setPanel(null);
      if (!result.ok) console.warn('[存档] 写入失败', result.message);
    },
    [game],
  );

  const handleEnding = useCallback(
    (endingId: string) => {
      if (!game) return;
      const ending = game.story.endings.find((e) => e.id === endingId);
      setEndingNode({
        name: ending?.name ?? '结局',
        description: ending?.description,
      });
      // 结局记录独立于存档：打通立即解锁（编辑器预览除外，不记录）
      if (game.source !== 'editor') {
        setReached(addReachedEnding(game.story.meta, endingId));
      }
      // 结局画面期间不再需要延迟自动存档，清掉排队中的那个
      if (autoSaveTimer.current !== null) {
        window.clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = null;
      }
      audioManager.stopAll();
      setPhase('ending');
    },
    [game],
  );

  const backToTitle = useCallback(() => {
    audioManager.stopAll();
    setEndingNode(null);
    setResumeState(null);
    setCurrentNodeId(null);
    setPhase('title');
  }, []);

  const endingsForTitle = useMemo(() => {
    if (!game) return [];
    return game.story.endings.map((e) => ({ id: e.id, name: e.name, reached: reached.includes(e.id) }));
  }, [game, reached]);

  const currentSummary = useMemo(() => {
    if (!game) return undefined;
    const info = describeNode(game, currentNodeId);
    return { sceneName: info.sceneName, text: info.text };
  }, [game, currentNodeId]);

  /* ---------------- 进场画面（可选） ---------------- */
  /** 开场图；素材解析不出来就当没配，直接进标题 */
  const openingSrc = game?.story.meta.openingImage
    ? game.resolveAsset(game.story.meta.openingImage)
    : undefined;
  /** 标题画面背景图 */
  const titleBackgroundSrc = game?.story.meta.titleBackground
    ? game.resolveAsset(game.story.meta.titleBackground)
    : undefined;
  /** 开场图停留秒数（编辑器里可调，这里再做一次范围保护） */
  const openingSeconds = clampOpeningSeconds(
    game?.story.meta.openingDuration ?? OPENING_DEFAULT_SECONDS,
  );
  /** 开场图播完进标题；从游戏里返回标题不重播 */
  const enterTitle = useCallback(() => setPhase('title'), []);

  /* ---------------- 渲染 ----------------
   * 分层结构（务必保持）：
   *   .player-root  铺满窗口
   *   ├─ .stage     固定 1280×720，等比缩放 —— 只放"画面"（背景/立绘/对话框）
   *   └─ .ui-overlay 不缩放，贴窗口边角 —— 只放"控件"（按钮/存档面板/设置面板）
   */
  return (
    <div className="player-root" ref={rootRef}>
      {/* 舞台层：等比缩放，永远 16:9 */}
      <div className="stage" style={{ transform: `scale(${scale})` }}>
        {phase === 'loading' ? (
          <div className="absolute inset-0 flex items-center justify-center text-white/50">
            正在载入剧本…
          </div>
        ) : null}

        {phase === 'opening' && openingSrc ? (
          <OpeningScreen
            src={openingSrc}
            durationMs={openingSeconds * 1000}
            fadeMs={OPENING_FADE_SECONDS * 1000}
            onDone={enterTitle}
          />
        ) : null}

        {phase === 'title' && game ? (
          <TitleScreen
            title={game.story.meta.title}
            backgroundSrc={titleBackgroundSrc}
            hasSave={Object.keys(saves).length > 0}
            endings={endingsForTitle}
            onStart={startGame}
            onLoad={() => setPanel('load')}
            onSettings={() => setPanel('settings')}
          />
        ) : null}

        {phase === 'playing' && game ? (
          <GamePlayer
            key={runId}
            story={game.story}
            resolveAsset={game.resolveAsset}
            settings={settings}
            resumeState={resumeState}
            startSceneId={previewStart?.sceneId}
            startNodeId={previewStart?.nodeId}
            mode="game"
            controllerRef={controllerRef}
            onNodeChange={setCurrentNodeId}
            onStateChange={handleStateChange}
            onEnding={handleEnding}
          />
        ) : null}

        {phase === 'ending' && endingNode ? (
          <EndingScreen
            endingName={endingNode.name}
            description={endingNode.description}
            reached={reached.length}
            total={game?.story.endings.length ?? 0}
            onBackToTitle={backToTitle}
          />
        ) : null}

      </div>

      {/* UI 层：尺寸固定、贴窗口边角，不随舞台缩放 */}
      <div className="ui-overlay">
        {phase === 'playing' && game ? (
          <>
            {/* 右上角功能按钮 */}
            <div className="absolute right-3 top-3 flex gap-1.5">
              <button className="rounded border border-white/25 bg-black/40 px-2.5 py-1 text-xs text-white/80 backdrop-blur hover:bg-white/15" onClick={() => setPanel('save')}>
                存档
              </button>
              <button className="rounded border border-white/25 bg-black/40 px-2.5 py-1 text-xs text-white/80 backdrop-blur hover:bg-white/15" onClick={() => setPanel('load')}>
                读档
              </button>
              <button className="rounded border border-white/25 bg-black/40 px-2.5 py-1 text-xs text-white/80 backdrop-blur hover:bg-white/15" onClick={() => setPanel('settings')}>
                设置
              </button>
              <button className="rounded border border-white/25 bg-black/40 px-2.5 py-1 text-xs text-white/80 backdrop-blur hover:bg-white/15" onClick={backToTitle}>
                标题
              </button>
            </div>

            {game.source !== 'tauri' && game.source !== 'static' ? (
              <div className="absolute bottom-2 right-3 text-[10px] text-white/30">
                数据来源：{game.source === 'example' ? '内置示例剧本' : '编辑器预览'}
              </div>
            ) : null}
          </>
        ) : null}

        {/* 存档 / 读档面板：固定尺寸，不随舞台缩放 */}
        {(panel === 'save' || panel === 'load') && phase !== 'title' ? (
          <SaveLoadPanel
            mode={panel}
            saves={saves}
            currentSummary={currentSummary}
            onSave={handleSave}
            onLoad={handleLoad}
            onDelete={(slotId) => {
              deleteSave(storyTitle, slotId);
              setSaves(loadSaves(storyTitle));
            }}
            onClose={() => setPanel(null)}
          />
        ) : null}

        {/* 标题画面上的读档面板 */}
        {panel === 'load' && phase === 'title' ? (
          <SaveLoadPanel
            mode="load"
            saves={saves}
            onSave={() => undefined}
            onLoad={handleLoad}
            onDelete={(slotId) => {
              deleteSave(storyTitle, slotId);
              setSaves(loadSaves(storyTitle));
            }}
            onClose={() => setPanel(null)}
          />
        ) : null}

        {panel === 'settings' ? (
          <SettingsPanel
            settings={settings}
            onChange={setSettings}
            onClose={() => setPanel(null)}
          />
        ) : null}
      </div>
    </div>
  );
}
