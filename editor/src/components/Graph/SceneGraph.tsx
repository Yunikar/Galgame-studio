/**
 * 场景画布（React Flow）
 * 每个 Scene 一张画布：节点可拖拽，连线表示 next 跳转。
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  MarkerType,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeTypes,
} from 'reactflow';
import { NODE_COLORS, branchPercents, formatPercent, isChainNode, validateStory, type Scene, type Story } from '@gal/shared';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import { autoLayoutScene } from '../../lib/autoLayout';
import { NODE_WIDTH } from '../../lib/nodeSize';
import { StoryNodeView, type StoryFlowNodeData } from './StoryNodeView';
import { toast } from '../../store/toastStore';

/** 节点类型表：必须定义在组件外，否则每次渲染都会重建 */
const NODE_TYPES: NodeTypes = { story: StoryNodeView };

type Props = {
  scene: Scene;
  story: Story;
  /** 校验出的问题数量（按节点 id 聚合） */
  issuesByNode: Map<string, number>;
};

function SceneGraphInner({ scene, story, issuesByNode }: Props) {
  const layout = useProjectStore((s) => s.data.layout);
  const setNodePosition = useProjectStore((s) => s.setNodePosition);
  const connectNodes = useProjectStore((s) => s.connectNodes);
  const disconnectNodes = useProjectStore((s) => s.disconnectNodes);
  const removeNode = useProjectStore((s) => s.removeNode);
  const setLayout = useProjectStore((s) => s.setLayout);
  const selectNode = useUiStore((s) => s.selectNode);
  const selectedNodeId = useUiStore((s) => s.selectedNodeId);
  const focusRequest = useUiStore((s) => s.focusRequest);
  const clearFocusRequest = useUiStore((s) => s.clearFocusRequest);
  const { setCenter, fitView } = useReactFlow();

  /** 没有手动摆过位置的节点，用自动布局兜底 */
  const fallbackLayout = useMemo(() => autoLayoutScene(scene), [scene]);

  const nodes: Node<StoryFlowNodeData>[] = useMemo(
    () =>
      scene.nodes.map((node, index) => ({
        id: node.id,
        type: 'story',
        position: layout[node.id] ?? fallbackLayout[node.id] ?? { x: 60, y: 60 },
        data: { node, story, index, issueCount: issuesByNode.get(node.id) ?? 0 },
        selected: node.id === selectedNodeId,
      })),
    [scene.nodes, layout, fallbackLayout, story, issuesByNode, selectedNodeId],
  );

  const edges: Edge[] = useMemo(() => {
    const ids = new Set(scene.nodes.map((n) => n.id));
    const result: Edge[] = [];

    for (const node of scene.nodes) {
      if (node.type === 'choice') {
        node.options.forEach((opt) => {
          const branches = opt.branches ?? [];

          // 没有分支：和以前完全一样，从选项主体的连接点拉一条线
          if (!branches.length) {
            if (!opt.next || !ids.has(opt.next)) return;
            result.push({
              id: `${node.id}:${opt.id}`,
              source: node.id,
              sourceHandle: `opt:${opt.id}`,
              target: opt.next,
              type: 'smoothstep',
              style: { stroke: NODE_COLORS.choice, strokeWidth: 1.6 },
              markerEnd: { type: MarkerType.ArrowClosed, color: NODE_COLORS.choice, width: 16, height: 16 },
            });
            return;
          }

          // 有概率分支：每个分支一条线；两条以上时在线中间标出概率
          const percents = branchPercents(branches);
          const showPercent = branches.length > 1;
          branches.forEach((branch, bi) => {
            if (!branch.next || !ids.has(branch.next)) return;
            result.push({
              id: `${node.id}:${opt.id}:${branch.id}`,
              source: node.id,
              sourceHandle: `opt:${opt.id}:${branch.id}`,
              target: branch.next,
              type: 'smoothstep',
              label: showPercent ? formatPercent(percents[bi] ?? 0) : undefined,
              labelBgPadding: [4, 2],
              labelBgBorderRadius: 4,
              labelBgStyle: { fill: '#ffffff', fillOpacity: 0.92 },
              labelStyle: { fill: NODE_COLORS.choice, fontSize: 10, fontWeight: 600 },
              style: { stroke: NODE_COLORS.choice, strokeWidth: 1.6 },
              markerEnd: { type: MarkerType.ArrowClosed, color: NODE_COLORS.choice, width: 16, height: 16 },
            });
          });
        });
        continue;
      }

      if (!isChainNode(node) || !node.next || !ids.has(node.next)) continue;
      result.push({
        id: `${node.id}:out`,
        source: node.id,
        sourceHandle: 'out',
        target: node.next,
        type: 'smoothstep',
        style: { stroke: '#94a3b8', strokeWidth: 1.6 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8', width: 16, height: 16 },
      });
    }

    return result;
  }, [scene.nodes]);

  /* ---------- 事件 ---------- */

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const change of changes) {
        if (change.type === 'position' && change.position && change.dragging) {
          // 拖拽过程中实时写回坐标，松手后位置就固定住了
          setNodePosition(change.id, change.position);
        }
        if (change.type === 'remove') {
          removeNode(scene.id, change.id);
          toast('节点已删除（可用 Ctrl+Z 撤销）', 'info');
        }
      }
    },
    [removeNode, scene.id, setNodePosition],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      for (const change of changes) {
        if (change.type === 'remove') {
          const edge = edges.find((e) => e.id === change.id);
          if (edge) disconnectNodes(scene.id, edge.source, edge.sourceHandle);
        }
      }
    },
    [disconnectNodes, edges, scene.id],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) {
        toast('不能连到自己身上', 'warning');
        return;
      }
      const { note } = connectNodes(scene.id, connection.source, connection.sourceHandle, connection.target);
      if (note) toast(note, 'info', '想看概率可以点开这个选项节点的属性面板');
    },
    [connectNodes, scene.id],
  );

  const onNodeClick = useCallback(
    (_: unknown, node: Node) => selectNode(scene.id, node.id),
    [scene.id, selectNode],
  );

  /* ---------- 外部请求定位到某节点 ---------- */
  const lastFocusAt = useRef(0);
  useEffect(() => {
    if (!focusRequest || focusRequest.sceneId !== scene.id) return;
    if (focusRequest.at === lastFocusAt.current) return;
    lastFocusAt.current = focusRequest.at;

    const position = layout[focusRequest.nodeId] ?? fallbackLayout[focusRequest.nodeId];
    if (!position) return;
    setCenter(position.x + NODE_WIDTH / 2, position.y + 60, { zoom: 1, duration: 400 });
    clearFocusRequest();
  }, [focusRequest, layout, fallbackLayout, scene.id, setCenter, clearFocusRequest]);

  /** 一键整理布局 */
  const handleAutoLayout = useCallback(() => {
    setLayout(autoLayoutScene(scene));
    // 节点坐标写回后要等一帧，React Flow 拿到新位置了再把视野对准全场
    // （否则整理完节点跑出屏幕，还得自己缩小去找）
    window.requestAnimationFrame(() => {
      void fitView({ padding: 0.2, duration: 400, maxZoom: 1 });
    });
    toast('已重新整理节点布局', 'success');
  }, [scene, setLayout, fitView]);

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={() => selectNode(scene.id, null)}
        fitView
        fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
        minZoom={0.2}
        maxZoom={1.8}
        defaultEdgeOptions={{ type: 'smoothstep' }}
        proOptions={{ hideAttribution: true }}
        className="bg-canvas"
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1.4} color="#cbd5e1" />
        <Controls showInteractive={false} className="!bottom-4 !left-4" />
        <MiniMap
          pannable
          zoomable
          className="!bottom-4 !right-4 !h-[110px] !w-[170px] rounded-md border border-line"
          nodeColor={(n) => NODE_COLORS[(n.data as StoryFlowNodeData).node.type]}
          maskColor="rgba(226,232,240,.6)"
        />
      </ReactFlow>

      {/* 画布右下角的快捷操作 */}
      <div className="pointer-events-none absolute right-4 top-4 z-10 flex flex-col items-end gap-1.5">
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-lg border border-line bg-white/95 px-1.5 py-1 shadow-card backdrop-blur">
          <button className="btn btn-sm" onClick={handleAutoLayout} title="按剧情顺序自动排列节点">
            整理布局
          </button>
        </div>
      </div>

      {!scene.nodes.length ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-lg border border-dashed border-slate-300 bg-white/80 px-6 py-5 text-center backdrop-blur">
            <div className="text-[13px] font-medium text-ink-soft">这个场景还没有节点</div>
            <div className="mt-1 text-xs text-ink-faint">
              用上方工具栏的「添加节点」开始写第一句台词吧
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** 给 React Flow 提供上下文（useReactFlow 需要） */
export default function SceneGraph(props: Props) {
  return (
    <ReactFlowProvider>
      <SceneGraphInner {...props} />
    </ReactFlowProvider>
  );
}

/** 提供给外部复用：把校验结果按节点聚合 */
export function useIssuesByNode(story: Story): Map<string, number> {
  return useMemo(() => {
    const issues = validateStory(story);
    const map = new Map<string, number>();
    for (const issue of issues) {
      if (!issue.nodeId) continue;
      map.set(issue.nodeId, (map.get(issue.nodeId) ?? 0) + 1);
    }
    return map;
  }, [story]);
}
