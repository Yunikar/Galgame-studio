/**
 * 左侧面板容器：Tab 切换 + 滚动内容区 + 底部状态条
 */
import { useUiStore, type LeftTab } from '../../store/uiStore';
import { useProjectStore } from '../../store/projectStore';
import { useAudioPreview } from '../../hooks/useAudioPreview';
import { formatBytes, totalAssetSize } from '../../lib/assetUtils';
import Tabs from '../ui/Tabs';
import CharactersTab from './CharactersTab';
import BackgroundsTab from './BackgroundsTab';
import AudioTabPanel from './AudioTab';
import EndingsTab from './EndingsTab';
import OverviewTab from './OverviewTab';

export default function ResourcePanel() {
  const leftTab = useUiStore((s) => s.leftTab);
  const setLeftTab = useUiStore((s) => s.setLeftTab);
  const story = useProjectStore((s) => s.data.story);
  const data = useProjectStore((s) => s.data);
  const stopPreview = useAudioPreview((s) => s.stop);
  const volume = useAudioPreview((s) => s.volume);
  const setVolume = useAudioPreview((s) => s.setVolume);

  const items: { key: LeftTab; label: string; count?: number }[] = [
    { key: 'characters', label: '角色', count: story.characters.length },
    { key: 'backgrounds', label: '背景', count: story.backgrounds.length },
    { key: 'audio', label: '音频', count: story.bgms.length + story.ses.length + story.voices.length },
    { key: 'endings', label: '结局', count: story.endings.length },
    { key: 'overview', label: '概览' },
  ];

  const size = totalAssetSize(data.assets);

  return (
    <div className="panel w-[300px] shrink-0">
      <div className="panel-header">资源管理</div>

      <div className="shrink-0 border-b border-line bg-slate-50 px-2 py-1.5">
        <Tabs
          items={items}
          value={leftTab}
          onChange={(key) => {
            // 切换 Tab 时停掉试听，避免声音在后台一直响
            stopPreview();
            setLeftTab(key);
          }}
          fill
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {leftTab === 'characters' ? <CharactersTab /> : null}
        {leftTab === 'backgrounds' ? <BackgroundsTab /> : null}
        {leftTab === 'audio' ? <AudioTabPanel /> : null}
        {leftTab === 'endings' ? <EndingsTab /> : null}
        {leftTab === 'overview' ? <OverviewTab /> : null}
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-line bg-slate-50 px-2.5 py-1.5 text-[11px] text-ink-faint">
        <span>素材占用 {formatBytes(size)}</span>
        <label className="flex items-center gap-1" title="试听音量">
          <span>试听音量</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            className="h-1 w-16 accent-brand-600"
            onChange={(e) => setVolume(Number(e.target.value))}
          />
        </label>
      </div>
    </div>
  );
}
