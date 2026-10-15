/**
 * 左侧面板 · 角色 Tab
 * 管理角色的名字、名字颜色、基础立绘与表情差分。
 */
import { useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useUploadAssets } from '../../hooks/useUploadAssets';
import { Icon } from '../ui/Icon';
import UploadButton from '../ui/UploadButton';
import EmptyState from '../ui/EmptyState';
import ConfirmDialog from '../ui/ConfirmDialog';
import AssetThumb from '../ui/AssetThumb';
import { toast } from '../../store/toastStore';

/** 统计某角色被多少节点使用 */
function useCharacterUsage(characterId: string): number {
  return useProjectStore((s) =>
    s.data.story.scenes.reduce(
      (sum, scene) =>
        sum +
        scene.nodes.filter(
          (n) =>
            (n.type === 'dialogue' && n.speaker === characterId) ||
            ((n.type === 'showSprite' || n.type === 'hideSprite') && n.characterId === characterId),
        ).length,
      0,
    ),
  );
}

/** 单个差分行 */
function ExpressionRow({ characterId, expressionId }: { characterId: string; expressionId: string }) {
  const expression = useProjectStore((s) =>
    s.data.story.characters.find((c) => c.id === characterId)?.sprites.expressions.find((e) => e.id === expressionId),
  );
  const updateExpression = useProjectStore((s) => s.updateExpression);
  const removeExpression = useProjectStore((s) => s.removeExpression);
  const upload = useUploadAssets();

  if (!expression) return null;

  return (
    <div className="flex items-center gap-2 rounded-md border border-line bg-white p-1.5">
      <AssetThumb assetId={expression.assetId} size={36} fallbackIcon="users" />
      <input
        className="input flex-1"
        value={expression.name}
        placeholder="差分名，如 微笑"
        onChange={(e) => updateExpression(characterId, expressionId, { name: e.target.value })}
      />
      <UploadButton
        accept="image/*"
        onFiles={async (files) => {
          const { created } = await upload('sprites', files);
          if (created[0]) updateExpression(characterId, expressionId, { assetId: created[0].id });
        }}
      >
        {expression.assetId ? '换图' : '上传'}
      </UploadButton>
      <button
        className="btn btn-sm"
        title="删除差分"
        onClick={() => removeExpression(characterId, expressionId)}
      >
        <Icon name="trash" className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/** 单个角色卡片 */
function CharacterCard({ characterId }: { characterId: string }) {
  const character = useProjectStore((s) => s.data.story.characters.find((c) => c.id === characterId));
  const updateCharacter = useProjectStore((s) => s.updateCharacter);
  const removeCharacter = useProjectStore((s) => s.removeCharacter);
  const setBaseSprite = useProjectStore((s) => s.setBaseSprite);
  const addExpression = useProjectStore((s) => s.addExpression);
  const upload = useUploadAssets();
  const usage = useCharacterUsage(characterId);
  const [open, setOpen] = useState(true);
  const [confirming, setConfirming] = useState(false);

  if (!character) return null;

  return (
    <div className="rounded-lg border border-line bg-white">
      {/* 卡片头：头像 + 名字 + 颜色 */}
      <div className="flex items-center gap-2 border-b border-line p-2">
        <button
          className="text-ink-faint transition hover:text-ink"
          onClick={() => setOpen((v) => !v)}
          title={open ? '收起' : '展开'}
        >
          <Icon name="chevron" className={`h-4 w-4 transition ${open ? 'rotate-90' : ''}`} />
        </button>
        <AssetThumb assetId={character.sprites.base} size={32} fallbackIcon="user" />
        <input
          className="input flex-1"
          value={character.name}
          placeholder="角色名（会显示在对话框上）"
          onChange={(e) => updateCharacter(characterId, { name: e.target.value })}
        />
        <input
          type="color"
          className="h-7 w-8 shrink-0 cursor-pointer rounded border border-line bg-white p-0.5"
          value={character.color ?? '#e11d48'}
          title="名字颜色"
          onChange={(e) => updateCharacter(characterId, { color: e.target.value })}
        />
        <button className="btn btn-sm" title="删除角色" onClick={() => setConfirming(true)}>
          <Icon name="trash" className="h-3.5 w-3.5" />
        </button>
      </div>

      {open ? (
        <div className="space-y-2 p-2">
          {/* 基础立绘 */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-ink-soft">基础立绘</span>
            <UploadButton
              accept="image/*"
              onFiles={async (files) => {
                const { created } = await upload('sprites', files);
                if (created[0]) setBaseSprite(characterId, created[0].id);
              }}
            >
              {character.sprites.base ? '更换' : '上传'}
            </UploadButton>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-slate-50 p-2">
            <AssetThumb assetId={character.sprites.base} size={56} />
            <div className="min-w-0 text-xs text-ink-faint">
              {character.sprites.base ? '已设置：立绘节点不选差分时使用它' : '尚未上传，立绘节点需要它才能显示'}
            </div>
          </div>

          {/* 差分 */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-soft">
              表情差分 <span className="text-ink-faint">（{character.sprites.expressions.length}）</span>
            </span>
            <button
              className="btn btn-sm"
              onClick={() => {
                addExpression(characterId, { name: '新差分' });
                toast('已添加一个新差分，记得上传图片', 'info');
              }}
            >
              <Icon name="plus" className="h-3.5 w-3.5" />
              新增差分
            </button>
          </div>
          <div className="space-y-1.5">
            {character.sprites.expressions.map((e) => (
              <ExpressionRow key={e.id} characterId={characterId} expressionId={e.id} />
            ))}
            {!character.sprites.expressions.length ? (
              <div className="rounded-md border border-dashed border-line p-2 text-center text-[11px] text-ink-faint">
                差分是叠加在基础立绘上的表情图，可选
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirming}
        title={`删除角色「${character.name}」？`}
        message={
          usage > 0
            ? `有 ${usage} 个节点正在使用这个角色，删除后这些节点会变成未指定状态（需要重新设置）。`
            : '这个角色还没有被任何节点使用，可以安全删除。'
        }
        confirmText="删除"
        danger
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          removeCharacter(characterId);
          setConfirming(false);
          toast('角色已删除', 'success');
        }}
      />
    </div>
  );
}

export default function CharactersTab() {
  const characterIds = useProjectStore((s) => s.data.story.characters.map((c) => c.id));
  const addCharacter = useProjectStore((s) => s.addCharacter);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-faint">共 {characterIds.length} 个角色</span>
        <button className="btn btn-sm btn-primary" onClick={() => addCharacter()}>
          <Icon name="plus" className="h-3.5 w-3.5" />
          新增角色
        </button>
      </div>

      {characterIds.length ? (
        characterIds.map((id) => <CharacterCard key={id} characterId={id} />)
      ) : (
        <EmptyState
          icon="users"
          title="还没有角色"
          hint="先建一个角色，再上传立绘，就能在对话里给她写台词了"
          action={
            <button className="btn btn-sm btn-primary" onClick={() => addCharacter()}>
              <Icon name="plus" className="h-3.5 w-3.5" />
              新增角色
            </button>
          }
        />
      )}
    </div>
  );
}
