/**
 * 素材缩略图（图片） / 音频图标
 * 按 assetId 从项目里取 dataURL。
 */
import { useProjectStore } from '../../store/projectStore';
import { Icon } from '../ui/Icon';

type Props = {
  assetId?: string;
  size?: number;
  /** 无素材时显示的图标 */
  fallbackIcon?: string;
  className?: string;
};

export default function AssetThumb({ assetId, size = 48, fallbackIcon = 'image', className = '' }: Props) {
  const asset = useProjectStore((s) => (assetId ? s.data.assets[assetId] : undefined));

  const style = { width: size, height: size };

  if (!asset || !asset.dataUrl) {
    return (
      <div
        style={style}
        className={`flex shrink-0 items-center justify-center rounded-md border border-dashed border-line bg-slate-50 text-ink-faint ${className}`}
      >
        <Icon name={fallbackIcon} className="h-4 w-4" />
      </div>
    );
  }

  return (
    <img
      src={asset.dataUrl}
      alt={asset.name}
      style={style}
      title={`${asset.name}（${asset.path}）`}
      className={`shrink-0 rounded-md border border-line bg-slate-50 object-cover ${className}`}
    />
  );
}
