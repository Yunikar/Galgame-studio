/**
 * 音频试听按钮
 */
import type { EditorAsset } from '@gal/shared';
import { useAudioPreview } from '../../hooks/useAudioPreview';
import { Icon } from './Icon';

type Props = {
  asset: EditorAsset;
  className?: string;
};

export default function AudioPreviewButton({ asset, className = '' }: Props) {
  const playingId = useAudioPreview((s) => s.playingId);
  const toggle = useAudioPreview((s) => s.toggle);
  const playing = playingId === asset.id;

  return (
    <button
      type="button"
      title={playing ? '停止试听' : '试听'}
      className={`btn btn-sm ${playing ? 'border-brand-500 text-brand-600' : ''} ${className}`}
      disabled={!asset.dataUrl}
      onClick={() => toggle(asset)}
    >
      <Icon name={playing ? 'stop' : 'play'} className="h-3.5 w-3.5" />
      {playing ? '停止' : '试听'}
    </button>
  );
}
