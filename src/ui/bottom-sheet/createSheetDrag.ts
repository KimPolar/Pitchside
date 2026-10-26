/**
 * 프레임워크 무관 바텀시트 드래그 코어 (의존성 0).
 *
 * 포인터로 시트를 아래로 끌면 손가락을 따라오고, 놓는 순간
 * 거리(dismissThresholdPx) 또는 속도(dismissVelocity)로 닫기/스냅백을 판정한다.
 * 드래그 중에만 transition을 꺼서 손가락에 붙고, 놓으면 CSS transition이
 * 스냅백·닫힘 이동을 처리한다 — 애니메이션 정의는 CSS 몫(bottom-sheet.css).
 */

type CreateSheetDragOptions = {
  sheet: HTMLElement;
  /** 드래그를 받을 요소 — 기본은 시트 전체. 내부 스크롤이 있으면 핸들만 지정한다 */
  handle?: HTMLElement;
  onDismiss: () => void;
  /** 이만큼 끌어내리면 닫힘 (기본 120px) */
  dismissThresholdPx?: number;
  /** 놓는 순간 속도가 이 이상이면 거리와 무관하게 닫힘 (px/ms, 기본 0.5) */
  dismissVelocity?: number;
  /** 스냅 위치들(px, 0=전체 열림·클수록 낮게 열림). 지정하면 놓을 때 가까운 스냅으로 정착하고,
   *  마지막 스냅 아래로 던지거나 임계를 넘기면 닫힌다. 0을 반드시 포함하라 */
  snapOffsetsPx?: number[];
  /** 스냅 정착 시 — 현재 오프셋(px)을 알려준다 */
  onSnap?: (offsetPx: number) => void;
};

export const createSheetDrag = ({
  sheet,
  handle = sheet,
  onDismiss,
  dismissThresholdPx = 120,
  dismissVelocity = 0.5,
  snapOffsetsPx,
  onSnap,
}: CreateSheetDragOptions) => {
  let dragging = false;
  let startY = 0;
  let deltaY = 0;
  let lastY = 0;
  let lastTime = 0;
  let velocity = 0;
  let baseOffset = 0; // 드래그 시작 시점의 스냅 오프셋 — 현재 inline transform에서 읽는다

  const snaps = snapOffsetsPx ? [...snapOffsetsPx].sort((a, b) => a - b) : null;

  // 드래그 중 시트 안 텍스트가 끌려 선택되는 부작용을 막는다
  const preventSelection = (event: Event) => event.preventDefault();

  // 누른 뒤 이만큼 움직여야 끌기로 본다. 누르는 순간 포인터를 잡으면 브라우저가 뒤따르는 click을
  // 시트로 넘겨서 시트 안 버튼(담기·바로 구매)이 눌리지 않는다
  const DRAG_SLOP_PX = 8;
  let pressed = false;
  let pointerId: number | null = null;

  const onPointerDown = (event: PointerEvent | MouseEvent) => {
    if ('button' in event && event.button !== 0) return;
    pressed = true;
    startY = event.clientY;
    lastY = event.clientY;
    lastTime = Date.now();
    velocity = 0;
    pointerId = 'pointerId' in event ? event.pointerId : null;
    // 누른 채 움직이는 동안 시트 안 글자가 선택되지 않게 — click에는 영향이 없다
    document.addEventListener('selectstart', preventSelection);
  };

  /** 실제로 끌기 시작한 순간 — 여기서 transition을 끄고 포인터를 잡는다 */
  const beginDrag = () => {
    dragging = true;
    deltaY = 0;
    baseOffset = Number(/translateY\((-?\d+(?:\.\d+)?)px\)/.exec(sheet.style.transform)?.[1] ?? 0);
    sheet.style.transition = 'none';
    // 포인터가 요소 밖으로 나가도 move/up을 계속 받는다 (jsdom 등 미지원 환경 가드)
    if (pointerId != null && typeof handle.setPointerCapture === 'function') {
      handle.setPointerCapture(pointerId);
    }
  };

  const onPointerMove = (event: PointerEvent | MouseEvent) => {
    if (!pressed) return;
    if (!dragging) {
      if (Math.abs(event.clientY - startY) < DRAG_SLOP_PX) return;
      beginDrag();
    }
    const now = Date.now();
    if (now > lastTime) velocity = (event.clientY - lastY) / (now - lastTime);
    lastY = event.clientY;
    lastTime = now;
    // 스냅 모드에서는 현재 오프셋 기준 상대 이동(위로 끌어 더 열 수 있다), 아니면 아래로만
    deltaY = snaps
      ? Math.max(0, baseOffset + (event.clientY - startY))
      : Math.max(0, event.clientY - startY);
    sheet.style.transform = `translateY(${deltaY}px)`;
  };

  const onPointerUp = () => {
    if (pressed) document.removeEventListener('selectstart', preventSelection);
    pressed = false;
    if (!dragging) return;
    dragging = false;
    sheet.style.transition = '';

    if (snaps) {
      settleToSnap();
      return;
    }

    const shouldDismiss = deltaY >= dismissThresholdPx || velocity >= dismissVelocity;
    if (shouldDismiss) {
      onDismiss();
      // data-open이 false로 바뀐 다음 프레임에 인라인 transform을 걷어야
      // 현재 위치에서 화면 밖까지 CSS transition으로 이어진다
      requestAnimationFrame(() => {
        sheet.style.transform = '';
      });
      return;
    }
    sheet.style.transform = ''; // 스냅백 — CSS transition이 제자리로 되돌린다
  };

  /** 놓은 위치·속도로 정착할 스냅을 고른다. 마지막 스냅 밖은 닫힘이다 */
  const settleToSnap = () => {
    const list = snaps!;
    const lowest = list[list.length - 1];
    const flingDown = velocity >= dismissVelocity;
    const nudgeDown = velocity >= 0.3;
    const nudgeUp = velocity <= -0.3;

    const dismissByDistance = deltaY >= lowest + dismissThresholdPx;
    const dismissByFling = flingDown && baseOffset >= lowest;
    if (dismissByDistance || dismissByFling) {
      onDismiss();
      requestAnimationFrame(() => {
        sheet.style.transform = '';
      });
      return;
    }

    let target: number;
    if (nudgeDown) {
      // 아래로 던짐 — 현재 위치보다 낮은(값이 큰) 첫 스냅, 없으면 닫힘
      const below = list.find((snap) => snap > deltaY);
      if (below === undefined) {
        onDismiss();
        requestAnimationFrame(() => {
          sheet.style.transform = '';
        });
        return;
      }
      target = below;
    } else if (nudgeUp) {
      // 위로 던짐 — 현재 위치보다 높은(값이 작은) 마지막 스냅
      const above = [...list].reverse().find((snap) => snap < deltaY);
      target = above ?? list[0];
    } else {
      target = list.reduce((nearest, snap) =>
        Math.abs(snap - deltaY) < Math.abs(nearest - deltaY) ? snap : nearest,
      );
    }

    sheet.style.transform = `translateY(${target}px)`;
    onSnap?.(target);
  };

  handle.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  return () => {
    handle.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('selectstart', preventSelection);
  };
};
