/**
 * 素材选择字段：下拉 + 预览
 */
import { type AssetCategory } from '@gal/shared';
import { CATEGORY_TEXT } from '../../../lib/assetUtils';
import { useProjectStore } from '../../../store/projectStore';
import { useAudioPreview } from '../../../hooks/useAudioPreview';
import { Icon } from '../../ui/Icon';
import AssetThumb from '../../ui/AssetThumb';

type Props = {
  label: string;
  category: AssetCategory;
  value: string;
  onChange: (assetId: string) => void;
  /** 允许留空（例如语音/立绘） */
  optional?: boolean;
  /** 点击"去上传"时切到左侧面板的哪个 Tab */
  onGoUpload?: () => void;
};

export default function AssetSelect({
  label,
  category,
  value,
  onChange,
  optional,
  onGoUpload,
}: Props) {
  const assets = useProjectStore((s) => s.data.story[category]);
  const asset = useProjectStore((s) => (value ? s.data.assets[value] : undefined));
  const togglePreview = useAudioPreview((s) => s.toggle);
  const isAudio = category === 'bgms' || category === 'ses' || category === 'voices';

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="field-label mb-0">{label}</label>
        {!assets.length && onGoUpload ? (
          <button className="text-[11px] text-brand-600 hover:underline" onClick={onGoUpload}>
            还没有素材，去上传
          </button>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5">
        {isAudio ? (
          <button
            className="btn btn-sm shrink-0"
            disabled={!asset?.dataUrl}
            title="试听"
            onClick={() => asset && togglePreview(asset)}
          >
            <Icon name="play" className="h-3.5 w-3.5" />
          </button>
        ) : (
          <AssetThumb assetId={value} size={30} />
        )}

        <select className="input flex-1" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">
            {optional ? `不使用${CATEGORY_TEXT[category]}` : `请选择${CATEGORY_TEXT[category]}`}
          </option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {!value && !optional ? (
        <p className="mt-1 text-[11px] text-amber-600">必填：不选的话导出时会报错</p>
      ) : null}
    </div>
  );
}
