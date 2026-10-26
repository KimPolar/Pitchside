/**
 * 프레임워크 무관 탭 인디케이터 이동 코어 (의존성 0).
 *
 * 활성 탭의 offsetLeft·offsetWidth를 인디케이터의 translateX·scaleX로 옮긴다.
 * left/width를 직접 애니메이션하면 매 프레임 레이아웃이 돌아 성능을 깎는다 —
 * 인디케이터를 폭 1px로 두고 scaleX로 늘리면 transform(GPU 합성)만으로 끝난다.
 *
 * 바닐라 사용: 탭 클릭 핸들러에서 moveTabIndicator({ indicator, target: 클릭된 탭 })
 * React 사용: useTabIndicator.ts가 이 코어를 감싼다.
 */

type MoveTabIndicatorOptions = {
  /** 폭 1px·transform-origin left인 인디케이터 요소 (tab-indicator.css의 .tab-indicator) */
  indicator: HTMLElement;
  /** 활성 탭 요소 — 인디케이터와 같은 offsetParent 안에 있어야 좌표가 맞는다 */
  target: HTMLElement;
  /** true면 슬라이드 없이 즉시 배치 — 첫 렌더가 0에서 미끄러져 오는 것을 막는다 */
  immediate?: boolean;
};

export const moveTabIndicator = ({
  indicator,
  target,
  immediate = false,
}: MoveTabIndicatorOptions) => {
  const transform = `translateX(${target.offsetLeft}px) scaleX(${target.offsetWidth})`;
  if (!immediate) {
    indicator.style.transform = transform;
    return;
  }
  indicator.style.transition = 'none';
  indicator.style.transform = transform;
  // 브라우저가 무전환 배치를 그린 다음 프레임에 transition을 복원한다
  requestAnimationFrame(() => {
    indicator.style.transition = '';
  });
};
