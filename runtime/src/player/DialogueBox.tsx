/**
 * 对话框：说话人名（带角色颜色） + 打字机文本 + 推进提示
 * 特效（黑白 / 模糊 / 震动）可以单独作用在对话框上，由 GamePlayer 传进来。
 */
type Props = {
  /** 说话人显示名，空表示旁白 */
  speakerName?: string;
  /** 名字颜色 */
  speakerColor?: string;
  text: string;
  /** 是否已显示完整 */
  done: boolean;
  /** 旁白用不同样式（居中、斜体） */
  narration?: boolean;
  /** 作用在对话框上的滤镜（grayscale / blur） */
  effectFilter?: string;
  /** 是否正在持续震动（状态型特效） */
  shaking?: boolean;
};

export default function DialogueBox({
  speakerName,
  speakerColor,
  text,
  done,
  narration,
  effectFilter,
  shaking,
}: Props) {
  return (
    <div
      className="dialogue-box anim-fade"
      style={{
        pointerEvents: 'none',
        filter: effectFilter,
        // 震动时 inline animation 会覆盖 .anim-fade 的入场淡入，所以把两个动画拼在一起
        animation: shaking ? 'gal-fade-in 0.35s ease both, gal-shake 0.5s ease-in-out infinite' : undefined,
      }}
    >
      {/* 说话人名 */}
      {!narration && speakerName ? (
        <div className="mb-1.5 inline-block rounded-md bg-black/50 px-3 py-0.5">
          <span className="text-[15px] font-semibold" style={{ color: speakerColor ?? '#ffffff' }}>
            {speakerName}
          </span>
        </div>
      ) : null}

      {/* 台词正文 */}
      <div
        className={`min-h-[3.6em] text-[17px] leading-[1.75] tracking-wide ${
          narration ? 'text-white/80 italic' : 'text-white'
        }`}
      >
        {text}
        {/* 打完字后右下角的闪烁三角，提示"点一下继续" */}
        {done ? (
          <span className="ml-2 inline-block animate-bounce align-middle text-[12px] text-white/70">▼</span>
        ) : null}
      </div>
    </div>
  );
}
