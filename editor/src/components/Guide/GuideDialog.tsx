/**
 * 新手引导：第一次打开自动弹出，之后可从工具栏的「?」随时再看
 * 只讲最短路径：起名字 → 加台词 → 加选项和结局 → 预览 → 导出
 */
import { useEffect, useState } from 'react';
import { useUiStore } from '../../store/uiStore';
import { Icon } from '../ui/Icon';

/** 引导步骤内容 */
const STEPS: { title: string; icon: string; body: React.ReactNode }[] = [
  {
    title: '欢迎来到 Galgame 编辑器',
    icon: 'film',
    body: (
      <>
        <p>这里可以做出你自己的视觉小说：不需要写代码，像搭积木一样把台词、图片、音乐串起来就行。</p>
        <p>做好的作品可以导出成一个网页压缩包，或者一个双击就能玩的 Windows 程序。</p>
        <p className="text-ink-faint">整个过程大概 10 分钟，跟着下面几步走就行。</p>
      </>
    ),
  },
  {
    title: '第一步：给作品起个名字',
    icon: 'edit',
    body: (
      <>
        <p>看屏幕最上方的输入框，把「未命名作品」改成你想好的名字。</p>
        <p>这个名字会显示在游戏标题画面上，也是导出文件的名字。</p>
      </>
    ),
  },
  {
    title: '第二步：往左边放素材（可以先跳过）',
    icon: 'image',
    body: (
      <>
        <p>左侧面板分几类：角色、背景图、背景音乐、音效、语音。点对应分类再拖文件进来即可。</p>
        <p>没有图和音乐也完全能做游戏——先做完剧情，再回头补素材，是很常见的工作方式。</p>
      </>
    ),
  },
  {
    title: '第三步：中间摆剧情',
    icon: 'flow',
    body: (
      <>
        <p>中间的画布就是你的剧情。点上方工具条里的「新增节点」加台词、背景、立绘……</p>
        <p>从右侧面板改每句话的内容，节点之间会自动连成一条线，游戏就按这条线走。</p>
        <p>想加分支？放一个「选项」节点，它有几个选项就能接几条后续。</p>
      </>
    ),
  },
  {
    title: '第四步：结局很重要',
    icon: 'flag',
    body: (
      <>
        <p>每条故事线最后要接一个「结局」节点，不然玩家会走到一半卡住。</p>
        <p>左上角的「校验」按钮会帮你检查哪里没连上，点它的提示就能直接跳到出问题的节点。</p>
      </>
    ),
  },
  {
    title: '第五步：预览、导出，完工',
    icon: 'download',
    body: (
      <>
        <p>右下角是实时预览，随时点开试玩；勾选「从选中节点开始」可以直接试某一段。</p>
        <p>没问题了就点右上角的「导出作品」：网页版（zip）发给朋友解压即玩，Windows 程序（exe）双击即玩。</p>
        <p className="text-ink-faint">就这么多，开始创作吧！</p>
      </>
    ),
  },
];

const SEEN_KEY = 'galgame-editor.guide.seen.v1';

export default function GuideDialog() {
  const open = useUiStore((s) => s.guideOpen);
  const setOpen = useUiStore((s) => s.setGuideOpen);
  const [step, setStep] = useState(0);

  // 第一次使用时自动弹一次
  useEffect(() => {
    if (localStorage.getItem(SEEN_KEY)) return;
    setOpen(true);
    localStorage.setItem(SEEN_KEY, '1');
  }, [setOpen]);

  // 每次打开都从第一页开始
  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  if (!open) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-[520px] max-w-full overflow-hidden rounded-xl border border-line bg-panel shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 步骤点 */}
        <div className="flex items-center gap-1.5 px-4 pt-3">
          {STEPS.map((_, index) => (
            <span
              key={index}
              className={`h-1.5 flex-1 rounded-full transition ${
                index <= step ? 'bg-brand-500' : 'bg-slate-100'
              }`}
            />
          ))}
        </div>

        <div className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Icon name={current.icon} className="h-4 w-4" />
            </span>
            <span className="text-[15px] font-semibold text-ink">{current.title}</span>
          </div>
          <div className="mt-2.5 space-y-1.5 text-[13px] leading-relaxed text-ink-soft">{current.body}</div>
        </div>

        <div className="flex items-center gap-2 border-t border-line px-4 py-3">
          <span className="text-[11.5px] text-ink-faint">
            {step + 1} / {STEPS.length}
          </span>
          <div className="ml-auto flex gap-2">
            {step > 0 ? (
              <button className="btn" onClick={() => setStep((s) => s - 1)}>
                上一步
              </button>
            ) : (
              <button className="btn" onClick={() => setOpen(false)}>
                跳过
              </button>
            )}
            {isLast ? (
              <button className="btn btn-primary" onClick={() => setOpen(false)}>
                开始创作
              </button>
            ) : (
              <button className="btn btn-primary" onClick={() => setStep((s) => s + 1)}>
                下一步
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
