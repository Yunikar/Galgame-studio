/**
 * 开场图：标题画面出现之前先显示的一张图，停留若干秒后自动进入标题画面。
 * 按需求不提供跳过按钮，只通过设置里的「显示时长」控制节奏。
 */
import { useEffect, useRef, useState } from 'react';

type Props = {
  src: string;
  /** 图片完全显示后停留的时长（毫秒） */
  durationMs: number;
  /** 淡入 / 淡出各自占用的时长（毫秒） */
  fadeMs: number;
  /** 整段播完后的回调，由外层切到标题画面 */
  onDone: () => void;
};

export default function OpeningScreen({ src, durationMs, fadeMs, onDone }: Props) {
  const [visible, setVisible] = useState(false);
  const [broken, setBroken] = useState(false);

  // onDone 每次渲染都可能是新函数，用 ref 存住，避免把计时器重置掉
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });

  // 淡入：等下一帧再改透明度，否则 transition 不会触发
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // 计时：停留结束开始淡出，淡出结束通知外层进标题
  useEffect(() => {
    const hideAt = fadeMs + durationMs;
    const doneAt = hideAt + fadeMs;
    const hideTimer = window.setTimeout(() => setVisible(false), hideAt);
    const doneTimer = window.setTimeout(() => onDoneRef.current(), doneAt);
    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(doneTimer);
    };
  }, [durationMs, fadeMs]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {broken ? null : (
        <img
          src={src}
          alt=""
          draggable={false}
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
          style={{
            opacity: visible ? 1 : 0,
            transition: `opacity ${fadeMs}ms ease-in-out`,
          }}
        />
      )}
    </div>
  );
}
