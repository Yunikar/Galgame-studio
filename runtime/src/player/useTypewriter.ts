/**
 * 打字机效果
 */
import { useCallback, useEffect, useRef, useState } from 'react';

type Result = {
  /** 当前应该显示的文字 */
  shown: string;
  /** 是否已经全部显示完 */
  done: boolean;
  /** 立刻显示全部（点击时"跳过打字"） */
  finish: () => void;
};

/**
 * @param text 完整文本
 * @param speedMs 每字间隔毫秒，0 表示瞬间显示
 * @param enabled false 时不做动画（例如还没开始游戏）
 */
export function useTypewriter(text: string, speedMs: number, enabled = true): Result {
  const [shown, setShown] = useState(text);
  const [done, setDone] = useState(true);
  const timerRef = useRef<number | null>(null);

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    clear();

    if (!enabled || speedMs <= 0 || !text) {
      setShown(text);
      setDone(true);
      return clear;
    }

    setShown('');
    setDone(false);
    let index = 0;

    timerRef.current = window.setInterval(() => {
      index += 1;
      setShown(text.slice(0, index));
      if (index >= text.length) {
        clear();
        setDone(true);
      }
    }, speedMs);

    return clear;
  }, [text, speedMs, enabled, clear]);

  const finish = useCallback(() => {
    clear();
    setShown(text);
    setDone(true);
  }, [clear, text]);

  return { shown, done, finish };
}
