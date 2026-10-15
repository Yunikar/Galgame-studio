/**
 * "下一个节点"字段：用下拉选择后续节点（等价于画布上连线）
 */
import { useProjectStore } from '../../../store/projectStore';
import { nodeOptionLabel } from '../../Graph/nodeSummary';
import { Icon } from '../../ui/Icon';

type Props = {
  sceneId: string;
  value: string | undefined;
  onChange: (next: string | undefined) => void;
  onFocusNode?: (nodeId: string) => void;
  label?: string;
  /** 排除的节点（例如不能连自己） */
  excludeNodeId?: string;
  optional?: boolean;
};

export default function NextNodeField({
  sceneId,
  value,
  onChange,
  onFocusNode,
  label = '下一个节点',
  excludeNodeId,
  optional,
}: Props) {
  const scene = useProjectStore((s) => s.data.story.scenes.find((x) => x.id === sceneId));
  const story = useProjectStore((s) => s.data.story);
  const target = scene?.nodes.find((n) => n.id === value);
  const broken = !!value && !target;

  const candidates = (scene?.nodes ?? []).filter((n) => n.id !== excludeNodeId);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="field-label mb-0">{label}</label>
        {target && onFocusNode ? (
          <button className="text-[11px] text-brand-600 hover:underline" onClick={() => onFocusNode(target.id)}>
            在画布上定位
          </button>
        ) : null}
      </div>

      <select
        className={`input ${broken ? 'border-red-400' : ''}`}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || undefined)}
      >
        <option value="">{optional ? '（不连线）' : '（未连线）'}</option>
        {candidates.map((n) => (
          <option key={n.id} value={n.id}>
            {nodeOptionLabel(n, story, scene?.nodes.findIndex((x) => x.id === n.id) ?? -1)}
          </option>
        ))}
      </select>

      {broken ? (
        <p className="mt-1 flex items-center gap-1 text-[11px] text-red-600">
          <Icon name="alert" className="h-3 w-3" />
          原来连的节点已被删除，请重新选择
        </p>
      ) : null}
      {!value && !optional ? (
        <p className="mt-1 text-[11px] text-amber-600">必须选一个后续节点，否则剧情会卡在这里</p>
      ) : null}
    </div>
  );
}
