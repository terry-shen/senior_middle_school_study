import { useEffect, useRef } from 'react';
import { reportLearningEvent } from '../services/learning-api';
import { getCurrentSectionId } from '../services/study-context';

/**
 * 学习心跳：仅在页面可见时累计秒数，每满 30 秒上报一次；切走/离开时立即补报。
 * 用于计算"有效学习时长"，不采集任何内容数据。
 */
export function useStudyHeartbeat(token: string | null, enabled: boolean) {
  const acc = useRef(0);

  useEffect(() => {
    if (!token || !enabled) return;
    let last = Date.now();

    const flush = () => {
      const sec = Math.round(acc.current);
      acc.current = 0;
      if (sec > 0) reportLearningEvent(token, { type: 'heartbeat', sectionId: getCurrentSectionId(), durationSec: Math.min(sec, 60) });
    };

    const tick = () => {
      const now = Date.now();
      const delta = Math.round((now - last) / 1000);
      last = now;
      if (delta <= 0) return;
      if (document.visibilityState === 'visible' && delta < 120) {
        acc.current += Math.min(delta, 35);
      }
      if (acc.current >= 30) flush();
    };

    const onVisibility = () => {
      tick();
      if (document.visibilityState === 'hidden') flush();
      last = Date.now();
    };

    const intervalId = window.setInterval(tick, 10000);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);

    return () => {
      flush();
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
    };
  }, [token, enabled]);
}
