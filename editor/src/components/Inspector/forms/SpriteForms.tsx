/**
 * 立绘 / 背景相关节点表单
 */
import {
  POSITION_LABELS,
  SPRITE_BASE_HEIGHT_PERCENT,
  SPRITE_DEFAULT_SCALE,
  SPRITE_DEFAULT_Y,
  SPRITE_LEGACY_X,
  SPRITE_PRESET_X,
  SPRITE_SCALE_MAX,
  SPRITE_SCALE_MIN,
  SPRITE_SCALE_STEP,
  SPRITE_X_MAX,
  SPRITE_X_MIN,
  SPRITE_Y_MAX,
  SPRITE_Y_MIN,
  TRANSITION_LABELS,
  type HideSpriteNode,
  type SetBackgroundNode,
  type ShowSpriteNode,
  type SpritePosition,
} from '@gal/shared';
import { useProjectStore } from '../../../store/projectStore';
import { useUiStore } from '../../../store/uiStore';
import CharacterSelect from '../fields/CharacterSelect';
import AssetSelect from '../fields/AssetSelect';
import SelectField from '../fields/SelectField';
import NumberField from '../fields/NumberField';
import NextNodeField from '../fields/NextNodeField';
import type { NodeFormProps } from '../types';

/** 位置选项 */
const POSITION_OPTIONS = (['left', 'center', 'right'] as const).map((p) => ({
  value: p,
  label: POSITION_LABELS[p],
}));

/** 转场选项 */
const TRANSITION_OPTIONS = (['none', 'fade', 'slideLeft', 'slideRight'] as const).map((t) => ({
  value: t,
  label: TRANSITION_LABELS[t],
}));

/** 显示立绘 */
export function ShowSpriteForm({ node, sceneId, onChange, onFocusNode }: NodeFormProps<ShowSpriteNode>) {
  const setLeftTab = useUiStore((s) => s.setLeftTab);
  const character = useProjectStore((s) =>
    s.data.story.characters.find((c) => c.id === node.characterId),
  );
  const assets = useProjectStore((s) => s.data.assets);

  const expressionOptions = [
    { value: '', label: '基础立绘' },
    ...(character?.sprites.expressions ?? []).map((e) => ({
      value: e.id,
      label: e.assetId ? e.name : `${e.name}（未上传图片）`,
    })),
  ];

  /**
   * 当前生效的位置参数。
   * 没设置过就显示出「回退后的值」，和运行时渲染保持一致 ——
   * 比如老节点的 position=left 且没有 x，这里显示的就是回退值 16。
   */
  const x = node.x ?? SPRITE_LEGACY_X[node.position ?? 'center'];
  const y = node.y ?? SPRITE_DEFAULT_Y;
  const scale = node.scale ?? SPRITE_DEFAULT_SCALE;

  /** 缩略图用的图片：基础立绘 + 当前选中的差分 */
  const baseSrc = character?.sprites.base ? assets[character.sprites.base]?.dataUrl : undefined;
  const expressionSrc = (() => {
    const assetId = character?.sprites.expressions.find((e) => e.id === node.expressionId)?.assetId;
    return assetId ? assets[assetId]?.dataUrl : undefined;
  })();

  /** 点「左 / 中 / 右」：把 X 设成对应的快捷预设值 */
  const applyPreset = (position: SpritePosition) => {
    onChange({ position, x: SPRITE_PRESET_X[position] });
  };

  return (
    <div className="space-y-3">
      <CharacterSelect
        label="角色"
        value={node.characterId}
        onChange={(id) => onChange({ characterId: id, expressionId: undefined })}
        onGoUpload={() => setLeftTab('characters')}
      />

      {character ? (
        <>
          {!character.sprites.base ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-700">
              「{character.name}」还没有上传基础立绘，去左侧「角色」里上传后才能显示。
            </p>
          ) : null}
          <SelectField
            label="表情差分"
            value={node.expressionId ?? ''}
            options={expressionOptions}
            onChange={(v) => onChange({ expressionId: v || undefined })}
            hint="差分是叠加在基础立绘上的表情图，可选"
          />
        </>
      ) : null}

      <SelectField
        label="位置（快捷预设）"
        mode="segmented"
        value={node.position ?? ''}
        options={POSITION_OPTIONS}
        onChange={(v) => applyPreset(v as SpritePosition)}
        hint="点一下就把下面的 X 设成 25 / 50 / 75，再拖滑块可以做更细的调整"
      />

      <NumberField
        label="X 坐标"
        unit="%"
        min={SPRITE_X_MIN}
        max={SPRITE_X_MAX}
        step={1}
        value={x}
        onChange={(v) => onChange({ x: v })}
        hint="横向位置：0 = 最左，100 = 最右，50 = 居中"
      />

      <NumberField
        label="Y 坐标"
        unit="%"
        min={SPRITE_Y_MIN}
        max={SPRITE_Y_MAX}
        step={1}
        value={y}
        onChange={(v) => onChange({ y: v })}
        hint="纵向位置：坐标锚点在立绘的「底部中心」，100 就是站在舞台底边"
      />

      <NumberField
        label="缩放"
        unit="倍"
        min={SPRITE_SCALE_MIN}
        max={SPRITE_SCALE_MAX}
        step={SPRITE_SCALE_STEP}
        value={scale}
        onChange={(v) => onChange({ scale: v })}
        hint="1.0 = 原始大小（立绘高度约为舞台的 78%）"
      />

      <SpritePreview
        x={x}
        y={y}
        scale={scale}
        baseSrc={baseSrc}
        expressionSrc={expressionSrc}
        characterName={character?.name}
      />

      <SelectField
        label="出场转场"
        value={node.transition ?? 'fade'}
        options={TRANSITION_OPTIONS}
        onChange={(v) => onChange({ transition: v as ShowSpriteNode['transition'] })}
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

/**
 * 位置预览缩略图
 * 用和运行时完全相同的一套定位公式把立绘画在缩小版的 16:9 舞台上，
 * 方便作者一边拖滑块一边看效果。底部那条黑条是对话框示意，
 * 提醒"立绘永远在对话框下面"。
 */
function SpritePreview({
  x,
  y,
  scale,
  baseSrc,
  expressionSrc,
  characterName,
}: {
  x: number;
  y: number;
  scale: number;
  baseSrc?: string;
  expressionSrc?: string;
  characterName?: string;
}) {
  return (
    <div>
      <label className="field-label">位置预览</label>
      <div
        className="relative w-full overflow-hidden rounded-md border border-line"
        style={{
          aspectRatio: '16 / 9',
          backgroundColor: '#1f2937',
          // 10% 网格，方便判断坐标
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.09) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.09) 1px, transparent 1px)',
          backgroundSize: '10% 10%',
        }}
      >
        {/* 立绘：与运行时同一套 transform */}
        <div
          className="absolute"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            transform: `translate(-50%, -100%) scale(${scale})`,
            transformOrigin: 'bottom center',
            height: `${SPRITE_BASE_HEIGHT_PERCENT}%`,
            zIndex: 10,
          }}
        >
          {baseSrc ? (
            <div className="relative h-full">
              <img src={baseSrc} alt="" className="h-full w-auto object-contain" draggable={false} />
              {expressionSrc ? (
                <img
                  src={expressionSrc}
                  alt=""
                  className="absolute inset-0 h-full w-full object-contain"
                  draggable={false}
                />
              ) : null}
            </div>
          ) : (
            // 没上传立绘时用一块占位，至少能看出位置和大小
            <div className="flex h-full w-[42px] items-center justify-center rounded-t border border-dashed border-white/45 bg-black/25 px-0.5 text-center text-[8px] leading-tight text-white/55">
              {characterName ? `${characterName}` : '未指定角色'}
            </div>
          )}
        </div>

        {/* 锚点标记 */}
        <div
          className="absolute h-1.5 w-1.5 rounded-full bg-rose-400 ring-1 ring-white/70"
          style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)', zIndex: 120 }}
        />

        {/* 对话框示意（层级比立绘高） */}
        <div
          className="absolute bottom-1 left-2 right-2 flex h-4 items-center justify-center rounded border border-white/25 bg-black/70 text-[8px] text-white/55"
          style={{ zIndex: 100 }}
        >
          对话框（立绘在它下面）
        </div>
      </div>
      <p className="mt-1 text-[11px] text-ink-faint">
        红点就是坐标锚点，也就是立绘底部中心的位置
      </p>
    </div>
  );
}

/** 隐藏立绘 */
export function HideSpriteForm({ node, sceneId, onChange, onFocusNode }: NodeFormProps<HideSpriteNode>) {
  const setLeftTab = useUiStore((s) => s.setLeftTab);

  return (
    <div className="space-y-3">
      <CharacterSelect
        label="要隐藏的角色"
        value={node.characterId}
        onChange={(id) => onChange({ characterId: id })}
        onGoUpload={() => setLeftTab('characters')}
      />
      <SelectField
        label="退场转场"
        value={node.transition ?? 'fade'}
        options={TRANSITION_OPTIONS}
        onChange={(v) => onChange({ transition: v as HideSpriteNode['transition'] })}
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

/** 切换背景 */
export function SetBackgroundForm({ node, sceneId, onChange, onFocusNode }: NodeFormProps<SetBackgroundNode>) {
  const setLeftTab = useUiStore((s) => s.setLeftTab);

  return (
    <div className="space-y-3">
      <AssetSelect
        label="背景图"
        category="backgrounds"
        value={node.assetId}
        onChange={(id) => onChange({ assetId: id })}
        onGoUpload={() => setLeftTab('backgrounds')}
      />
      <SelectField
        label="转场"
        value={node.transition ?? 'fade'}
        options={TRANSITION_OPTIONS}
        onChange={(v) => onChange({ transition: v as SetBackgroundNode['transition'] })}
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
