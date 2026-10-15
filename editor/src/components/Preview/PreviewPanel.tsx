/**
 * 底部实时预览面板
 * 内嵌 runtime 的播放器组件，从当前选中节点开始播放，可暂停 / 继续 / 重置。
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import PreviewStage, { type PreviewController } from '@runtime/components/PreviewStage';
import { PREVIEW_PHASE_LABELS, type PreviewPhase } from '@runtime/lib/previewPhase';
import { loadSettings, saveSettings, type GameSettings } from '@runtime/lib/settings';
import { useStageScale } from '@runtime/lib/useStageScale';
import SettingsPanel from '@runtime/components/SettingsPanel';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import { toast } from '../../store/toastStore';
import { Icon } from '../ui/Icon';
import { summarizeNode } from '../Graph/nodeSummary';

/** 运行时开发服务器的地址（可用环境变量覆盖） */
const RUNTIME_URL = (import.meta.env.VITE_RUNTIME_URL as string | undefined) ?? 'http://localhost:5174/';

/** 预览面板高度记在这里，下次打开还是这个高度 */
const HEIGHT_KEY = 'galgame-editor.previewHeight';
/** 「从标题画面开始」也记住，省得每次都重新勾 */
const FROM_TITLE_KEY = 'galgame-editor.previewFromTitle';
const DEFAULT_HEIGHT = 268;
/** 再矮就看不到画面了 */
const MIN_HEIGHT = 140;
/** 拖到最高时，上方至少留这么多像素给工具栏和画布，别把编辑器挤没了 */
const TOP_RESERVE = 132;

/** 把高度夹在合法范围内 */
function clampHeight(value: number): number {
  const max = Math.max(MIN_HEIGHT, window.innerHeight - TOP_RESERVE);
  return Math.min(Math.max(Math.round(value), MIN_HEIGHT), max);
}

/** 读取上次记住的高度 */
function readStoredHeight(): number {
  const raw = Number(localStorage.getItem(HEIGHT_KEY));
  return Number.isFinite(raw) && raw > 0 ? clampHeight(raw) : DEFAULT_HEIGHT;
}

/** 读取上次记住的「从标题画面开始」 */
function readStoredFromTitle(): boolean {
  return localStorage.getItem(FROM_TITLE_KEY) === '1';
}

export default function PreviewPanel() {
  const story = useProjectStore((s) => s.data.story);
  const assets = useProjectStore((s) => s.data.assets);
  const selectedNodeId = useUiStore((s) => s.selectedNodeId);
  const activeSceneId = useUiStore((s) => s.activeSceneId);
  const previewFromSelected = useUiStore((s) => s.previewFromSelected);
  const setPreviewFromSelected = useUiStore((s) => s.setPreviewFromSelected);
  const previewToken = useUiStore((s) => s.previewToken);
  const togglePreview = useUiStore((s) => s.togglePreview);

  const [paused, setPaused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  /** 预览当前阶段（游戏画面 / 标题画面 / 开场图） */
  const [previewPhase, setPreviewPhase] = useState<PreviewPhase>('playing');

  const controllerRef = useRef<PreviewController | null>(null);
  /** 舞台等比缩放（与外层容器尺寸联动） */
  const { ref: stageRef, scale } = useStageScale<HTMLDivElement>();

  /* ---------------- 是否从标题画面开始 ---------------- */
  const [fromTitle, setFromTitle] = useState(readStoredFromTitle);

  // 记住这个开关，下次打开编辑器还是同样行为
  useEffect(() => {
    localStorage.setItem(FROM_TITLE_KEY, fromTitle ? '1' : '0');
  }, [fromTitle]);


  /* ---------------- 预览面板高度（可拖拽调整） ---------------- */
  const [panelHeight, setPanelHeight] = useState(readStoredHeight);
  const [dragging, setDragging] = useState(false);
  /** 拖拽起点；null 表示当前没在拖 */
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  // 记住高度，下次打开还是这么大
  useEffect(() => {
    localStorage.setItem(HEIGHT_KEY, String(panelHeight));
  }, [panelHeight]);

  // 窗口被缩小的时候，别让预览面板把编辑器挤没了
  useEffect(() => {
    const onResize = () => setPanelHeight((h) => clampHeight(h));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  /** 按住拖拽条开始调整高度 */
  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = { startY: e.clientY, startHeight: panelHeight };
    setDragging(true);
    // 抓住指针：鼠标拖到面板外面，事件也还发到这里，不会中途断掉
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    // 面板在窗口底部，鼠标往上（clientY 变小）就是变高
    setPanelHeight(clampHeight(drag.startHeight + (drag.startY - e.clientY)));
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    setDragging(false);
    // 指针被系统取消时捕获会自动释放，这里先判断一下，免得抛错
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  /** 双击，在"默认高度"和"尽量大"之间切换 */
  const handleDoubleClick = () => {
    const max = Math.max(MIN_HEIGHT, window.innerHeight - TOP_RESERVE);
    setPanelHeight((h) => (h > DEFAULT_HEIGHT + 40 ? DEFAULT_HEIGHT : max));
  };

  /** assetId -> dataURL */
  const resolveAsset = useMemo(
    () => (assetId: string) => assets[assetId]?.dataUrl,
    [assets],
  );

  /** 起点 */
  const start = useMemo(() => {
    // 从标题画面开始时，一律从剧本开头走（忽略选中节点）
    if (fromTitle) return { sceneId: story.startSceneId, nodeId: undefined };
    if (previewFromSelected && selectedNodeId) {
      return { sceneId: activeSceneId ?? story.startSceneId, nodeId: selectedNodeId };
    }
    return { sceneId: story.startSceneId, nodeId: undefined };
  }, [fromTitle, previewFromSelected, selectedNodeId, activeSceneId, story.startSceneId]);

  /** 换起点 / 重置 / 切换开关时重建舞台 */
  const playerKey = `${previewToken}:${fromTitle ? 'title' : 'node'}:${start.sceneId}:${start.nodeId ?? 'start'}`;

  const currentNode = useMemo(() => {
    if (!currentNodeId) return null;
    for (const scene of story.scenes) {
      const node = scene.nodes.find((n) => n.id === currentNodeId);
      if (node) return { scene, node };
    }
    return null;
  }, [currentNodeId, story.scenes]);

  /** 当前节点在它场景里的摘要（含节点名 / 自动序号） */
  const currentNodeSummary = useMemo(() => {
    if (!currentNode) return null;
    const index = currentNode.scene.nodes.findIndex((n) => n.id === currentNode.node.id);
    return summarizeNode(currentNode.node, story, index);
  }, [currentNode, story]);

  /** 在新标签页打开运行时并注入剧本 */
  const openInNewTab = () => {
    const win = window.open(RUNTIME_URL, '_blank');
    if (!win) {
      toast('新标签页被浏览器拦截了', 'warning', '请允许本站点弹出窗口');
      return;
    }

    const assetMap: Record<string, string> = {};
    for (const asset of Object.values(assets)) assetMap[asset.id] = asset.dataUrl;

    const payload = {
      type: 'gal:preview',
      story,
      assets: assetMap,
      nodeId: previewFromSelected ? selectedNodeId ?? undefined : undefined,
      sceneId: previewFromSelected ? activeSceneId ?? undefined : undefined,
    };

    // 对方页面加载需要时间，重复发几次更稳
    let tries = 0;
    const timer = window.setInterval(() => {
      win.postMessage(payload, '*');
      tries += 1;
      if (tries >= 12) window.clearInterval(timer);
    }, 500);

    toast('已在新标签页打开预览', 'success', `目标地址：${RUNTIME_URL}`);
  };

  return (
    <section
      className="relative mx-2 mb-2 flex shrink-0 flex-col overflow-hidden rounded-lg border border-line bg-white shadow-card"
      style={{ height: panelHeight }}
    >
      {/* 拖拽条：按住往上拖即可放大预览画面（双击在默认高度 / 最大之间切换） */}
      <div
        className="preview-resize-handle"
        data-dragging={dragging}
        title="按住往上拖：放大预览画面（双击：默认高度 / 最大）"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
      />

      {/* 头部工具栏 */}
      <div className="flex h-9 shrink-0 items-center gap-1.5 border-b border-line px-2.5">
        <Icon name="film" className="h-4 w-4 text-ink-faint" />
        <span className="text-[13px] font-semibold">实时预览</span>

        <div className="mx-1 h-4 w-px bg-line" />

        <button className="btn btn-sm" onClick={() => controllerRef.current?.advance()} title="推进一句">
          <Icon name="play" className="h-3.5 w-3.5" />
          推进
        </button>
        <button
          className={`btn btn-sm ${paused ? 'border-amber-400 text-amber-600' : ''}`}
          onClick={() => setPaused((v) => !v)}
          title="暂停后点击画面不会推进"
        >
          <Icon name={paused ? 'play' : 'stop'} className="h-3.5 w-3.5" />
          {paused ? '继续' : '暂停'}
        </button>
        <button
          className="btn btn-sm"
          onClick={() => {
            controllerRef.current?.restart();
            setPaused(false);
          }}
          title={fromTitle ? '回到标题画面' : '从头（或从选中节点）重新开始'}
        >
          <Icon name="refresh" className="h-3.5 w-3.5" />
          重置
        </button>

        <div className="mx-1 h-4 w-px bg-line" />

        <label className="flex items-center gap-1 text-[12px] text-ink-soft">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-brand-600"
            checked={previewFromSelected}
            disabled={!selectedNodeId || fromTitle}
            onChange={(e) => setPreviewFromSelected(e.target.checked)}
          />
          从选中节点开始
          {fromTitle ? (
            <span className="text-ink-faint">（与「从标题画面开始」互斥）</span>
          ) : !selectedNodeId ? (
            <span className="text-ink-faint">（先在画布上选一个节点）</span>
          ) : null}
        </label>

        <label
          className="flex items-center gap-1 text-[12px] text-ink-soft"
          title="先播开场图（如果配了）和标题画面，再进游戏；用来核对进场画面设置"
        >
          <input
            type="checkbox"
            className="h-3.5 w-3.5 accent-brand-600"
            checked={fromTitle}
            onChange={(e) => setFromTitle(e.target.checked)}
          />
          从标题画面开始
        </label>

        <div className="ml-auto flex items-center gap-1.5">
          {/* 标题 / 开场阶段没有"当前节点"，改显示阶段名 */}
          {fromTitle && previewPhase !== 'playing' ? (
            <span className="chip" title="预览正在开场图 / 标题画面阶段">
              阶段：{PREVIEW_PHASE_LABELS[previewPhase]}
            </span>
          ) : currentNode && currentNodeSummary ? (
            <span
              className="chip max-w-[300px] truncate"
              title={`${currentNode.scene.name} · ${currentNodeSummary.label} ${currentNodeSummary.displayName} —— ${currentNodeSummary.title}`}
            >
              {currentNode.scene.name} · {currentNodeSummary.label} {currentNodeSummary.displayName}
            </span>
          ) : null}
          <button className="btn btn-sm" onClick={() => setShowSettings(true)}>
            <Icon name="settings" className="h-3.5 w-3.5" />
            播放设置
          </button>
          <button className="btn btn-sm" onClick={openInNewTab} title="在独立标签页里跑完整游戏">
            <Icon name="external" className="h-3.5 w-3.5" />
            新标签页
          </button>
          <button className="btn btn-sm" onClick={() => togglePreview(false)}>
            收起
          </button>
        </div>
      </div>

      {/* 播放器：外层只负责量尺寸，内层是固定 1280×720 的舞台，等比缩放
          （与独立运行时同一套分层，保证预览效果一致） */}
      <div className="stage-viewport min-h-0 flex-1" ref={stageRef}>
        <div className="stage" style={{ transform: `scale(${scale})` }}>
          <PreviewStage
            key={playerKey}
            story={story}
            resolveAsset={resolveAsset}
            settings={settings}
            startSceneId={start.sceneId}
            startNodeId={start.nodeId}
            fromTitle={fromTitle}
            paused={paused}
            controllerRef={controllerRef}
            onNodeChange={setCurrentNodeId}
            onPhaseChange={setPreviewPhase}
            onOpenSettings={() => setShowSettings(true)}
          />
        </div>

        {showSettings ? (
          <SettingsPanel
            settings={settings}
            onChange={(next) => {
              setSettings(next);
              saveSettings(next);
            }}
            onClose={() => setShowSettings(false)}
            showFullscreen={false}
          />
        ) : null}
      </div>
    </section>
  );
}
