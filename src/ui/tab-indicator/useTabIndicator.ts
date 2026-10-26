import { useEffect, useRef } from 'react';
import { moveTabIndicator } from './moveTabIndicator';
import './tab-indicator.css';

/**
 * moveTabIndicator 코어의 React 래퍼.
 * registerTab(index)를 각 탭의 ref로, indicatorRef를 인디케이터 요소에 달면
 * activeIndex가 바뀔 때마다 인디케이터가 활성 탭 위치로 미끄러진다.
 */
export const useTabIndicator = ({ activeIndex }: { activeIndex: number }) => {
  const tabsRef = useRef<Array<HTMLElement | null>>([]);
  const indicatorRef = useRef<HTMLElement | null>(null);
  const initializedRef = useRef(false);

  const registerTab = (index: number) => (el: HTMLElement | null) => {
    tabsRef.current[index] = el;
  };

  useEffect(
    function slideToActiveTab() {
      const indicator = indicatorRef.current;
      const target = tabsRef.current[activeIndex];
      if (!indicator || !target) return;
      // 첫 배치는 슬라이드 없이 — 0에서 미끄러져 오는 가짜 이동을 막는다
      moveTabIndicator({ indicator, target, immediate: !initializedRef.current });
      initializedRef.current = true;

      if (typeof ResizeObserver === 'undefined') return;
      // 폰트 로드·컨테이너 리사이즈로 탭 폭이 변하면 제자리로 재측정한다
      const observer = new ResizeObserver(() =>
        moveTabIndicator({ indicator, target, immediate: true }),
      );
      observer.observe(target);
      return () => observer.disconnect();
    },
    [activeIndex],
  );

  return { registerTab, indicatorRef };
};
