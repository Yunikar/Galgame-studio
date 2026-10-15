/**
 * 导出作品弹窗
 *
 * 流程：选导出方式 → 校验提醒 → 组装产物（带进度）→ 保存 → 结果摘要
 */
import { useEffect, useMemo, useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';
import { toast } from '../../store/toastStore';
import { useValidation } from '../../hooks/useValidation';
import { formatBytes, totalAssetSize } from '../../lib/assetUtils';
import { exportWebZip } from '../../lib/exportWeb';
import { exportExe, exeSupported } from '../../lib/exportExe';
import ExportKindCard, { type ExportKind } from './ExportKindCard';
import ExportProgress from './ExportProgress';
import ExportResult, { type ExportOutcomeView } from './ExportResult';
import { Icon } from '../ui/Icon';

type Running = { stage: string; percent: number };
type Result = { view: ExportOutcomeView } | null;

export default function ExportDialog() {
  const open = useUiStore((s) => s.exportOpen);
  const setOpen = useUiStore((s) => s.setExportOpen);
  const setValidationOpen = useUiStore((s) => s.setValidationOpen);

  const data = useProjectStore((s) => s.data);
  const title = data.story.meta.title?.trim() || '未命名作品';
  const { errors, warnings } = useValidation();

  const [kind, setKind] = useState<ExportKind>('web');
  const [running, setRunning] = useState<Running | null>(null);
  const [result, setResult] = useState<Result>(null);
  /** 有错误时，用户是否已经确认"我知道有错，仍然导出" */
  const [forced, setForced] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const canExportExe = exeSupported();

  // 打开时重置状态
  useEffect(() => {
    if (open) {
      setRunning(null);
      setResult(null);
      setForced(false);
      setShowErrors(false);
      setKind(canExportExe ? 'web' : 'web');
    }
  }, [open, canExportExe]);

  /** 预估体积：素材 + 运行时（约 0.2MB） */
  const sizeHint = useMemo(() => {
    const assets = totalAssetSize(data.assets);
    return formatBytes(assets + 220 * 1024);
  }, [data.assets]);

  const blocked = errors > 0 && !forced;
  const busy = running !== null;

  const handleExport = async () => {
    setResult(null);
    const onProgress = (stage: string, done: number, total: number) =>
      setRunning({ stage, percent: total > 0 ? (done / total) * 100 : 0 });

    try {
      if (kind === 'web') {
        setRunning({ stage: '准备运行时', percent: 0 });
        const { outcome, report, filename } = await exportWebZip(data, onProgress);
        setRunning(null);

        if (outcome === 'cancelled') {
          setResult({ view: { kind: 'cancelled' } });
          return;
        }
        if (outcome === 'failed') {
          setResult({ view: { kind: 'error', message: '写入文件失败，桌面版请检查文件夹权限。' } });
          return;
        }
        setResult({
          view: {
            kind: 'success',
            title: outcome === 'downloaded' ? `已下载 ${filename}` : `已保存 ${filename}`,
            lines: [
              '解压后双击 index.html 就能玩，也可以整个文件夹上传到静态托管做在线分享。',
              '想发给朋友的话，把 zip 直接发过去即可。',
            ],
            missing: report.missingAssets,
            empty: report.emptyAssets,
            bytes: report.totalBytes,
            fileCount: report.files.length,
          },
        });
        toast('导出成功', 'success', filename);
        return;
      }

      // exe
      setRunning({ stage: '准备运行时', percent: 0 });
      const outcome = await exportExe(data, onProgress);
      setRunning(null);

      if (outcome.kind === 'cancelled') {
        setResult({ view: { kind: 'cancelled' } });
        return;
      }
      if (outcome.kind === 'error') {
        setResult({ view: { kind: 'error', message: outcome.message } });
        return;
      }
      setResult({
        view: {
          kind: 'success',
          title: '已生成 Windows 程序',
          lines: [`位置：${outcome.directory}`, `双击 ${outcome.exeName} 即可开始游戏。`],
          missing: outcome.report.missingAssets,
          empty: outcome.report.emptyAssets,
          bytes: outcome.report.totalBytes,
          fileCount: outcome.report.files.length,
        },
      });
      toast('exe 已生成', 'success', outcome.exeName);
    } catch (error) {
      setRunning(null);
      setResult({ view: { kind: 'error', message: error instanceof Error ? error.message : String(error) } });
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-4"
      onClick={() => {
        if (!busy) setOpen(false);
      }}
    >
      <div
        className="flex max-h-[86vh] w-[560px] max-w-full flex-col overflow-hidden rounded-xl border border-line bg-panel shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Icon name="download" className="h-4 w-4 text-brand-600" />
          <span className="text-[15px] font-semibold text-ink">导出《{title}》</span>
          <button
            className="btn ml-auto px-2 py-1"
            disabled={busy}
            onClick={() => setOpen(false)}
            title="关闭"
          >
            <Icon name="close" className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* 内容 */}
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          <ExportKindCard
            active={kind}
            disabled={busy}
            sizeHint={sizeHint}
            webSupported
            exeSupported={canExportExe}
            onPick={(next) => {
              setKind(next);
              setResult(null);
            }}
          />

          {/* 校验提醒 */}
          {errors > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-center gap-2 text-[12.5px] font-semibold text-amber-800">
                <Icon name="alert" className="h-3.5 w-3.5" />
                还有 {errors} 处问题可能让玩家卡住
                <button
                  className="ml-auto text-[11.5px] font-normal underline"
                  onClick={() => {
                    setOpen(false);
                    setValidationOpen(true);
                  }}
                >
                  去看看
                </button>
              </div>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-amber-800">
                常见的是节点没连线、选项没接后续、跳转没指定目标。也可以先导出，之后再修。
              </p>
              {blocked ? (
                <button className="btn mt-2" onClick={() => setForced(true)}>
                  我了解，仍然导出
                </button>
              ) : (
                <div className="mt-2 flex items-center gap-1.5 text-[11.5px] text-amber-700">
                  <Icon name="check" className="h-3 w-3" />
                  已确认可以导出
                </div>
              )}
            </div>
          ) : null}

          {warnings > 0 && errors === 0 ? (
            <button
              className="flex w-full items-center gap-2 rounded-xl border border-line bg-white p-2.5 text-left text-[12px] text-ink-soft hover:border-amber-300"
              onClick={() => setShowErrors((v) => !v)}
            >
              <Icon name="info" className="h-3.5 w-3.5 text-amber-500" />
              有 {warnings} 条提醒（不影响导出）
              <Icon name="chevron" className={`ml-auto h-3 w-3 transition ${showErrors ? 'rotate-90' : ''}`} />
            </button>
          ) : null}

          {showErrors ? (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11.5px] leading-relaxed text-ink-soft">
              例如有素材还没选、某个场景没有连到结局。游戏能跑，但内容可能不完整。
            </p>
          ) : null}

          {running ? <ExportProgress stage={running.stage} percent={running.percent} /> : null}

          {result ? (
            <ExportResult
              view={result.view}
              onRetry={() => {
                setResult(null);
                void handleExport();
              }}
              onClose={() => setOpen(false)}
            />
          ) : null}
        </div>

        {/* 底部操作 */}
        <div className="flex items-center gap-2 border-t border-line px-4 py-3">
          <span className="text-[11.5px] text-ink-faint">
            素材 {Object.keys(data.assets).length} 个 · 场景 {data.story.scenes.length} 个 · 结局{' '}
            {data.story.endings.length} 个
          </span>
          <button className="btn ml-auto" disabled={busy} onClick={() => setOpen(false)}>
            关闭
          </button>
          <button
            className="btn btn-primary"
            disabled={busy || blocked}
            onClick={() => {
              setResult(null);
              void handleExport();
            }}
          >
            {busy ? '导出中…' : kind === 'web' ? '导出 zip' : '生成 exe'}
          </button>
        </div>
      </div>
    </div>
  );
}
