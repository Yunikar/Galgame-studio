/**
 * 顶部工具栏：项目级操作 + 校验 + 预览
 */
import { useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import { toast } from '../../store/toastStore';
import { useValidation } from '../../hooks/useValidation';
import { openTextFile, saveFile } from '../../lib/fileIO';
import { parseProjectFile, stringifyProjectFile } from '../../lib/projectStorage';
import { Icon } from '../ui/Icon';
import ConfirmDialog from '../ui/ConfirmDialog';

/** 项目文件过滤器 */
const PROJECT_FILTERS = [{ name: 'Galgame 项目', extensions: ['galproj', 'json'] }];

export default function TopToolbar() {
  const story = useProjectStore((s) => s.data.story);
  const data = useProjectStore((s) => s.data);
  const dirty = useProjectStore((s) => s.dirty);
  const saveLocal = useProjectStore((s) => s.saveLocal);
  const resetToEmpty = useProjectStore((s) => s.resetToEmpty);
  const replaceProject = useProjectStore((s) => s.replaceProject);
  const setTitle = useProjectStore((s) => s.setTitle);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const canUndo = useProjectStore((s) => s.past.length > 0);
  const canRedo = useProjectStore((s) => s.future.length > 0);

  const previewOpen = useUiStore((s) => s.previewOpen);
  const togglePreview = useUiStore((s) => s.togglePreview);
  const setValidationOpen = useUiStore((s) => s.setValidationOpen);
  const setExportOpen = useUiStore((s) => s.setExportOpen);
  const setGuideOpen = useUiStore((s) => s.setGuideOpen);

  const { errors, warnings } = useValidation();
  const [pendingNew, setPendingNew] = useState(false);

  /** 手动保存成 .galproj 文件 */
  const handleExportProjectFile = async () => {
    const text = stringifyProjectFile(data);
    const bytes = new TextEncoder().encode(text);
    const result = await saveFile(bytes, `${story.meta.title || '未命名作品'}.galproj`, 'application/json', PROJECT_FILTERS);
    if (result === 'saved' || result === 'downloaded') {
      toast('项目文件已导出', 'success', '下次可以用「打开」把它载入回来');
    } else if (result === 'failed') {
      toast('导出失败', 'error', '桌面版请检查文件写入权限');
    }
  };

  /** 打开 .galproj */
  const handleOpen = async () => {
    const picked = await openTextFile(PROJECT_FILTERS);
    if (!picked) return;
    try {
      const project = parseProjectFile(picked.text);
      replaceProject(project);
      const saved = await saveLocal();
      toast('项目已打开', saved.ok ? 'success' : 'warning', picked.name);
    } catch (error) {
      toast('这个文件打不开', 'error', String(error));
    }
  };

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-white px-3 shadow-sm">
      {/* 作品名 */}
      <div className="flex items-center gap-2">
        <span className="text-[15px] font-bold text-ink">Galgame 编辑器</span>
        <input
          className="input w-[200px] py-1"
          value={story.meta.title}
          placeholder="给作品起个名字"
          onChange={(e) => setTitle(e.target.value)}
        />
        <span className={`chip ${dirty ? 'border-amber-200 bg-amber-50 text-amber-600' : 'border-emerald-200 bg-emerald-50 text-emerald-600'}`}>
          {dirty ? '未保存' : '已保存'}
        </span>
      </div>

      <div className="mx-1 h-5 w-px bg-line" />

      {/* 项目操作 */}
      <button className="btn" onClick={() => setPendingNew(true)}>
        <Icon name="plus" className="h-3.5 w-3.5" />
        新建
      </button>
      <button className="btn" onClick={() => void handleOpen()}>
        <Icon name="folder" className="h-3.5 w-3.5" />
        打开
      </button>
      <button className="btn" onClick={() => void handleExportProjectFile()} title="导出 .galproj 工程文件">
        <Icon name="save" className="h-3.5 w-3.5" />
        保存工程
      </button>

      <div className="mx-1 h-5 w-px bg-line" />

      {/* 撤销重做 */}
      <button className="btn" disabled={!canUndo} onClick={undo} title="撤销 (Ctrl+Z)">
        <Icon name="undo" className="h-3.5 w-3.5" />
      </button>
      <button className="btn" disabled={!canRedo} onClick={redo} title="重做 (Ctrl+Shift+Z)">
        <Icon name="redo" className="h-3.5 w-3.5" />
      </button>

      {/* 右侧 */}
      <div className="ml-auto flex items-center gap-2">
        <button
          className={`btn ${errors ? 'border-red-300 text-red-600' : ''}`}
          onClick={() => setValidationOpen(true)}
          title="检查剧情是否完整"
        >
          <Icon name="check" className="h-3.5 w-3.5" />
          校验
          {errors ? <span className="rounded-full bg-red-500 px-1.5 text-[10px] text-white">{errors}</span> : null}
          {warnings ? (
            <span className="rounded-full bg-amber-400 px-1.5 text-[10px] text-white">{warnings}</span>
          ) : null}
        </button>

        <button
          className={`btn ${previewOpen ? 'border-brand-500 text-brand-600' : ''}`}
          onClick={() => togglePreview()}
          title="展开 / 收起底部预览"
        >
          <Icon name="film" className="h-3.5 w-3.5" />
          实时预览
        </button>

        <button
          className="btn btn-primary"
          onClick={() => setExportOpen(true)}
          title="导出成别人能直接玩的作品"
        >
          <Icon name="download" className="h-3.5 w-3.5" />
          导出作品
        </button>

        <button
          className="btn px-2"
          onClick={() => setGuideOpen(true)}
          title="新手引导"
        >
          <Icon name="help" className="h-3.5 w-3.5" />
        </button>
      </div>

      <ConfirmDialog
        open={pendingNew}
        title="新建项目？"
        message="当前项目会被清空（可以先「保存工程」备份一份）。"
        confirmText="新建"
        danger
        onCancel={() => setPendingNew(false)}
        onConfirm={async () => {
          await resetToEmpty();
          setPendingNew(false);
          toast('已新建空项目', 'success');
        }}
      />
    </header>
  );
}
