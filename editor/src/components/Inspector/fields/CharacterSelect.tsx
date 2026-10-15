/**
 * 角色选择字段
 */
import { useProjectStore } from '../../../store/projectStore';
import { Icon } from '../../ui/Icon';
import AssetThumb from '../../ui/AssetThumb';

type Props = {
  label: string;
  value: string;
  onChange: (characterId: string) => void;
  /** 允许留空（对话节点留空 = 旁白） */
  optional?: boolean;
  emptyText?: string;
  onGoUpload?: () => void;
};

export default function CharacterSelect({
  label,
  value,
  onChange,
  optional,
  emptyText = '请选择角色',
  onGoUpload,
}: Props) {
  const characters = useProjectStore((s) => s.data.story.characters);
  const baseSprite = useProjectStore(
    (s) => s.data.story.characters.find((c) => c.id === value)?.sprites.base,
  );

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="field-label mb-0">{label}</label>
        {!characters.length && onGoUpload ? (
          <button className="text-[11px] text-brand-600 hover:underline" onClick={onGoUpload}>
            还没有角色，去创建
          </button>
        ) : null}
      </div>

      <div className="flex items-center gap-1.5">
        <AssetThumb assetId={baseSprite} size={30} fallbackIcon="user" />
        <select className="input flex-1" value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{optional ? emptyText : '请选择角色'}</option>
          {characters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {!characters.length ? (
        <p className="mt-1 flex items-start gap-1 text-[11px] text-amber-600">
          <Icon name="alert" className="mt-0.5 h-3 w-3 shrink-0" />
          还没有角色，先去左侧「角色」里建一个
        </p>
      ) : null}
    </div>
  );
}
