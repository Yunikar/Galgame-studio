/**
 * 结局画面
 */
type Props = {
  endingName: string;
  description?: string;
  /** 结局收集进度 */
  reached: number;
  total: number;
  onBackToTitle: () => void;
};

export default function EndingScreen({ endingName, description, reached, total, onBackToTitle }: Props) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black">
      <div className="anim-fade text-center">
        <div className="text-[11px] tracking-[0.4em] text-white/35">ENDING</div>
        <h1 className="mt-3 text-[34px] font-bold tracking-[0.15em] text-white">{endingName}</h1>
        {description?.trim() ? (
          <p className="mx-auto mt-4 max-w-[440px] text-[13px] leading-relaxed text-white/60">{description}</p>
        ) : null}
        {total > 0 ? (
          <div className="mt-6 text-[11px] tracking-widest text-white/35">
            结局收集 {reached} / {total}
          </div>
        ) : null}
      </div>

      <button className="menu-btn mt-12" onClick={onBackToTitle}>
        返回标题
      </button>
    </div>
  );
}
