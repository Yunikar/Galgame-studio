/**
 * 选项菜单：居中弹出，点击后进入对应分支
 */
import type { StoryNode } from '@gal/shared';

type Option = Extract<StoryNode, { type: 'choice' }>['options'][number];

type Props = {
  prompt?: string;
  options: Option[];
  onSelect: (optionId: string) => void;
};

export default function ChoiceMenu({ prompt, options, onSelect }: Props) {
  return (
    // 层级 110：在对话框（100）之上，玩家永远点得到选项
    <div className="absolute inset-0 flex items-center justify-center bg-black/35 backdrop-blur-[2px]" style={{ zIndex: 110 }}>
      <div className="w-[62%] max-w-[620px] space-y-2.5">
        {prompt?.trim() ? (
          <div className="mb-4 text-center text-[16px] tracking-wide text-white/90 drop-shadow">
            {prompt}
          </div>
        ) : null}

        {options.map((option, index) => (
          <button
            key={option.id}
            className="choice-btn anim-fade"
            style={{ animationDelay: `${index * 60}ms` }}
            onClick={(e) => {
              // 避免事件冒泡到舞台的"点击推进"
              e.stopPropagation();
              onSelect(option.id);
            }}
          >
            <span className="mr-2 text-white/50">{index + 1}.</span>
            <span>{option.text || '（空选项）'}</span>
          </button>
        ))}

        {!options.length ? (
          <div className="text-center text-sm text-white/60">这个选项节点没有配置任何选项</div>
        ) : null}
      </div>
    </div>
  );
}
