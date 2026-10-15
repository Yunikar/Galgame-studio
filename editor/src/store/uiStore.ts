/**
 * 编辑器界面状态（与项目数据无关的部分）
 */
import { create } from 'zustand';

/** 左侧面板的 Tab */
export type LeftTab = 'characters' | 'backgrounds' | 'audio' | 'endings' | 'overview';
/** 音频 Tab 下的二级分类 */
export type AudioTab = 'bgms' | 'ses' | 'voices';

export type ToastLevel = 'success' | 'error' | 'warning' | 'info';

export type Toast = {
  id: string;
  message: string;
  level: ToastLevel;
  /** 可选的详情行 */
  detail?: string;
};

export type UiStore = {
  activeSceneId: string | null;
  selectedNodeId: string | null;
  leftTab: LeftTab;
  audioTab: AudioTab;
  previewOpen: boolean;
  /** 预览时是否从选中节点开始（否则从开场开始） */
  previewFromSelected: boolean;
  /** 每次点击预览自增，用来强制重启播放器 */
  previewToken: number;
  validationOpen: boolean;
  exportOpen: boolean;
  guideOpen: boolean;
  /** 外部要求把画布焦点移到某个节点 */
  focusRequest: { sceneId: string; nodeId: string; at: number } | null;
  /** 用户是否手动改过场景，用于"跟随项目"逻辑 */
  sceneTouched: boolean;

  selectScene: (sceneId: string, options?: { keepNode?: boolean }) => void;
  selectNode: (sceneId: string, nodeId: string | null) => void;
  setLeftTab: (tab: LeftTab) => void;
  setAudioTab: (tab: AudioTab) => void;
  togglePreview: (open?: boolean) => void;
  setPreviewFromSelected: (value: boolean) => void;
  restartPreview: () => void;
  setValidationOpen: (open: boolean) => void;
  setExportOpen: (open: boolean) => void;
  setGuideOpen: (open: boolean) => void;
  requestFocus: (sceneId: string, nodeId: string) => void;
  clearFocusRequest: () => void;
};

export const useUiStore = create<UiStore>((set) => ({
  activeSceneId: null,
  selectedNodeId: null,
  leftTab: 'characters',
  audioTab: 'bgms',
  previewOpen: true,
  previewFromSelected: false,
  previewToken: 0,
  validationOpen: false,
  exportOpen: false,
  guideOpen: false,
  focusRequest: null,
  sceneTouched: false,

  selectScene: (sceneId, options) =>
    set((state) => ({
      activeSceneId: sceneId,
      selectedNodeId: options?.keepNode ? state.selectedNodeId : null,
      sceneTouched: true,
    })),

  selectNode: (sceneId, nodeId) =>
    set({ activeSceneId: sceneId, selectedNodeId: nodeId, sceneTouched: true }),

  setLeftTab: (tab) => set({ leftTab: tab }),
  setAudioTab: (tab) => set({ audioTab: tab }),
  togglePreview: (open) => set((state) => ({ previewOpen: open ?? !state.previewOpen })),
  setPreviewFromSelected: (value) => set({ previewFromSelected: value }),
  restartPreview: () => set((state) => ({ previewToken: state.previewToken + 1 })),
  setValidationOpen: (open) => set({ validationOpen: open }),
  setExportOpen: (open) => set({ exportOpen: open }),
  setGuideOpen: (open) => set({ guideOpen: open }),
  requestFocus: (sceneId, nodeId) =>
    set({ activeSceneId: sceneId, selectedNodeId: nodeId, sceneTouched: true, focusRequest: { sceneId, nodeId, at: Date.now() } }),
  clearFocusRequest: () => set({ focusRequest: null }),
}));
