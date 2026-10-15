/**
 * 编辑器整体布局
 * 顶部工具栏 / 左侧资源 / 中间节点图 / 右侧属性 / 底部实时预览
 */
import { useHydrateProject, useAutoSave } from './hooks/useAutoSave';
import { useShortcuts } from './hooks/useShortcuts';
import { useActiveScene } from './hooks/useActiveScene';
import { useValidation } from './hooks/useValidation';
import { useProjectStore } from './store/projectStore';
import { useUiStore } from './store/uiStore';
import TopToolbar from './components/Toolbar/TopToolbar';
import ResourcePanel from './components/LeftPanel/ResourcePanel';
import GraphToolbar from './components/Graph/GraphToolbar';
import SceneGraph from './components/Graph/SceneGraph';
import InspectorPanel from './components/Inspector/InspectorPanel';
import ValidationDrawer from './components/Validation/ValidationDrawer';
import PreviewPanel from './components/Preview/PreviewPanel';
import ExportDialog from './components/Export/ExportDialog';
import GuideDialog from './components/Guide/GuideDialog';
import ToastHost from './components/ui/ToastHost';

export default function App() {
  useHydrateProject();
  useAutoSave();
  useShortcuts();

  const scene = useActiveScene();
  const validation = useValidation();
  const story = useProjectStore((s) => s.data.story);
  const selectedNodeId = useUiStore((s) => s.selectedNodeId);
  const previewOpen = useUiStore((s) => s.previewOpen);

  const nodeIssues = selectedNodeId ? (validation.byNode.get(selectedNodeId) ?? []) : [];

  /** 每个节点的"问题数量"，用于在节点上打角标 */
  const issuesByNode = new Map<string, number>();
  validation.byNode.forEach((list, nodeId) => issuesByNode.set(nodeId, list.length));

  return (
    <div className="flex h-full flex-col">
      <TopToolbar />

      <main className="flex min-h-0 flex-1 gap-2 p-2">
        <ResourcePanel />

        <section className="panel min-w-0 flex-1">
          {scene ? (
            <>
              <GraphToolbar sceneId={scene.id} />
              <div className="relative min-h-0 flex-1">
                <SceneGraph scene={scene} story={story} issuesByNode={issuesByNode} />
                <ValidationDrawer />
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-ink-faint">没有可编辑的场景</div>
          )}
        </section>

        <InspectorPanel sceneId={scene?.id ?? ''} nodeIssues={nodeIssues} />
      </main>

      {previewOpen ? <PreviewPanel /> : null}

      <ExportDialog />
      <GuideDialog />
      <ToastHost />
    </div>
  );
}
