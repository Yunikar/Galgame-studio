/**
 * 节点图上方工具栏：场景切换、场景管理、添加节点
 */
import { useEffect, useRef, useState } from 'react';
import { NODE_HINTS, NODE_ICONS, NODE_LABELS, type NodeType } from '@gal/shared';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import { toast } from '../../store/toastStore';
import { Icon } from '../ui/Icon';
import ConfirmDialog from '../ui/ConfirmDialog';

/** 添加节点菜单的分组 */
const GROUPS: { title: string; types: NodeType[] }[] = [
  { title: '剧情', types: ['dialogue', 'choice'] },
  { title: '演出', types: ['showSprite', 'hideSprite', 'setBackground', 'effect', 'effectOff'] },
  { title: '音频', types: ['playBgm', 'stopBgm', 'playSe'] },
  { title: '流程', types: ['jump', 'ending'] },
];

/** 添加节点下拉菜单 */
function AddNodeMenu({ sceneId }: { sceneId: string }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const addNode = useProjectStore((s) => s.addNode);
  const selectedNodeId = useUiStore((s) => s.selectedNodeId);
  const selectNode = useUiStore((s) => s.selectNode);
  const requestFocus = useUiStore((s) => s.requestFocus);

  useEffect(() => {
    if (!open) return undefined;
    const onClickOutside = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as globalThis.Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={wrapperRef}>
      <button className="btn btn-primary" onClick={() => setOpen((v) => !v)}>
        <Icon name="plus" className="h-3.5 w-3.5" />
        添加节点
        <Icon name="chevron" className={`h-3 w-3 transition ${open ? '-rotate-90' : 'rotate-90'}`} />
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-30 mt-1 w-[480px] rounded-lg border border-line bg-white p-2 shadow-pop">
          <div className="grid grid-cols-4 gap-2">
            {GROUPS.map((group) => (
              <div key={group.title}>
                <div className="mb-1 px-1 text-[11px] font-medium text-ink-faint">{group.title}</div>
                <div className="space-y-1">
                  {group.types.map((type) => (
                    <button
                      key={type}
                      className="flex w-full items-start gap-1.5 rounded-md px-1.5 py-1.5 text-left transition hover:bg-slate-100"
                      onClick={() => {
                        const { nodeId, note } = addNode(sceneId, type, selectedNodeId);
                        selectNode(sceneId, nodeId);
                        // 把视野挪到新节点：它可能落在画布上还没滚到的位置
                        requestFocus(sceneId, nodeId);
                        setOpen(false);
                        // note 有值时说明有特殊情况（比如选项都连满了），用黄色提示更醒目
                        toast(
                          `已添加「${NODE_LABELS[type]}」节点`,
                          note ? 'warning' : 'success',
                          note ?? NODE_HINTS[type],
                        );
                      }}
                    >
                      <span className="text-[13px] leading-5">{NODE_ICONS[type]}</span>
                      <span className="min-w-0">
                        <span className="block text-[12px] font-medium text-ink">{NODE_LABELS[type]}</span>
                        <span className="block text-[10px] leading-tight text-ink-faint">{NODE_HINTS[type]}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 border-t border-line px-1 pt-2 text-[11px] text-ink-faint">
            新节点会自动接在选中节点的后面（选中选项节点时，接到第一个还没连线的选项上）；
            也可以用鼠标从节点右侧圆点拖出连线
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function GraphToolbar({ sceneId }: { sceneId: string }) {
  const scenes = useProjectStore((s) => s.data.story.scenes);
  const startSceneId = useProjectStore((s) => s.data.story.startSceneId);
  const addScene = useProjectStore((s) => s.addScene);
  const duplicateScene = useProjectStore((s) => s.duplicateScene);
  const removeScene = useProjectStore((s) => s.removeScene);
  const setStartScene = useProjectStore((s) => s.setStartScene);
  const selectScene = useUiStore((s) => s.selectScene);
  const scene = scenes.find((s) => s.id === sceneId);
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-white px-2.5 py-1.5">
      {/* 场景切换 */}
      <span className="text-[12px] text-ink-faint">场景</span>
      <select
        className="input w-[190px] py-1"
        value={sceneId}
        onChange={(e) => selectScene(e.target.value)}
      >
        {scenes.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
            {s.id === startSceneId ? '（起始）' : ''}
          </option>
        ))}
      </select>

      <button
        className="btn btn-sm"
        title="新建场景"
        onClick={() => {
          const id = addScene();
          selectScene(id);
          toast('已新建场景', 'success');
        }}
      >
        <Icon name="plus" className="h-3.5 w-3.5" />
        场景
      </button>
      <button
        className="btn btn-sm"
        title="复制当前场景"
        onClick={() => {
          const id = duplicateScene(sceneId);
          selectScene(id);
          toast('已复制场景', 'success');
        }}
      >
        <Icon name="copy" className="h-3.5 w-3.5" />
      </button>
      <button className="btn btn-sm" title="删除当前场景" onClick={() => setConfirming(true)}>
        <Icon name="trash" className="h-3.5 w-3.5" />
      </button>

      <div className="mx-1 h-4 w-px bg-line" />

      <AddNodeMenu sceneId={sceneId} />

      <div className="ml-auto flex items-center gap-2">
        {scene ? (
          <span className="chip">
            {scene.nodes.length} 个节点 · 已完成 {scene.nodes.filter((n) => n.type === 'ending').length} 个结局节点
          </span>
        ) : null}
        {sceneId === startSceneId ? (
          <span className="chip border-emerald-200 bg-emerald-50 text-emerald-600">起始场景</span>
        ) : (
          <button
            className="btn btn-sm"
            onClick={() => {
              setStartScene(sceneId);
              toast('已设为起始场景', 'success');
            }}
          >
            设为起始场景
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirming}
        title={`删除场景「${scene?.name ?? ''}」？`}
        message={`场景里的 ${scene?.nodes.length ?? 0} 个节点会一起删除，指向它的跳转会被清空。`}
        confirmText="删除"
        danger
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          const fallback = scenes.find((s) => s.id !== sceneId);
          removeScene(sceneId);
          if (fallback) selectScene(fallback.id);
          setConfirming(false);
          toast('场景已删除', 'success');
        }}
      />
    </div>
  );
}
