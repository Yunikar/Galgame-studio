/**
 * 对话节点属性表单
 */
import type { DialogueNode } from '@gal/shared';
import { useUiStore } from '../../../store/uiStore';
import CharacterSelect from '../fields/CharacterSelect';
import AssetSelect from '../fields/AssetSelect';
import NumberField from '../fields/NumberField';
import NextNodeField from '../fields/NextNodeField';
import type { NodeFormProps } from '../types';

export default function DialogueForm({ node, sceneId, onChange, onFocusNode }: NodeFormProps<DialogueNode>) {
  const setLeftTab = useUiStore((s) => s.setLeftTab);
  const setAudioTab = useUiStore((s) => s.setAudioTab);

  return (
    <div className="space-y-3">
      <CharacterSelect
        label="说话人"
        value={node.speaker ?? ''}
        optional
        emptyText="旁白（不显示说话人）"
        onChange={(id) => onChange({ speaker: id || undefined })}
        onGoUpload={() => setLeftTab('characters')}
      />

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="field-label mb-0">台词</label>
          <span className="text-[11px] text-ink-faint">{node.text.length} 字</span>
        </div>
        <textarea
          className="input min-h-[92px] resize-y leading-relaxed"
          value={node.text}
          placeholder="在这里写台词，支持换行"
          onChange={(e) => onChange({ text: e.target.value })}
        />
      </div>

      <AssetSelect
        label="语音"
        category="voices"
        value={node.voice ?? ''}
        optional
        onChange={(id) => onChange({ voice: id || undefined })}
        onGoUpload={() => {
          setLeftTab('audio');
          setAudioTab('voices');
        }}
      />

      <NumberField
        label="打字速度"
        unit="毫秒 / 字"
        value={node.speed}
        min={0}
        max={120}
        step={5}
        allowEmpty
        hint="留空则使用游戏设置里的全局速度；0 表示瞬间显示"
        onChange={(v) => onChange({ speed: v })}
      />

      <NextNodeField
        sceneId={sceneId}
        value={node.next}
        onChange={(next) => onChange({ next })}
        onFocusNode={onFocusNode}
      />
    </div>
  );
}
