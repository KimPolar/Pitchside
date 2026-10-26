import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { createSheetDrag } from './createSheetDrag';
import './bottom-sheet.css';

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** 이만큼 끌어내리면 닫힘 (기본 120px) */
  dismissThresholdPx?: number;
  /** 스냅 위치들(px, 0=전체 열림). 지정하면 마지막 스냅(가장 낮게 열림)에서 시작하고,
   *  드래그로 스냅 사이를 오가며, 마지막 스냅 아래로 끌면 닫힌다. 0을 포함하라 */
  snapOffsetsPx?: number[];
  className?: string;
};

/**
 * createSheetDrag 코어의 React 래퍼 — 백드롭·Esc·드래그 세 경로로 닫힌다.
 * 시트는 언마운트하지 않고 data-open으로 여닫아 닫힘 애니메이션을 CSS에 맡긴다.
 */
export const BottomSheet = ({
  open,
  onClose,
  children,
  dismissThresholdPx,
  snapOffsetsPx,
  className,
}: BottomSheetProps) => {
  const sheetRef = useRef<HTMLElement | null>(null);
  // 최신 콜백을 ref로 들고 있어 인라인 함수를 넘겨도 리스너가 재등록되지 않는다
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const sheet = sheetRef.current;
    const root = document.getElementById('root');
    if (!open || !sheet) return;
    const previous = document.activeElement as HTMLElement | null;
    if (root) root.inert = true;
    sheet.querySelector<HTMLElement>('button,input,select')?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusable = [
        ...sheet.querySelectorAll<HTMLElement>('button:not(:disabled),input,select,a[href]'),
      ];
      const first = focusable[0],
        last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    sheet.addEventListener('keydown', trap);
    return () => {
      if (root) root.inert = false;
      sheet.removeEventListener('keydown', trap);
      previous?.focus();
    };
  }, [open]);

  useEffect(
    function lockBodyScroll() {
      if (!open) return;
      const previous = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = previous;
      };
    },
    [open],
  );

  useEffect(
    function closeOnEscape() {
      if (!open) return;
      const handleKeydown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') onCloseRef.current();
      };
      window.addEventListener('keydown', handleKeydown);
      return () => window.removeEventListener('keydown', handleKeydown);
    },
    [open],
  );

  useEffect(
    function attachDragToDismiss() {
      const sheet = sheetRef.current;
      if (!sheet) return;
      return createSheetDrag({
        sheet,
        handle: sheet.querySelector<HTMLElement>('.sheet-handle-area') ?? sheet,
        onDismiss: () => onCloseRef.current(),
        dismissThresholdPx,
        snapOffsetsPx,
      });
    },
    [dismissThresholdPx, snapOffsetsPx],
  );

  useEffect(
    function openAtInitialSnap() {
      const sheet = sheetRef.current;
      if (!sheet || !snapOffsetsPx?.length) return;
      if (!open) {
        sheet.style.transform = ''; // 인라인을 걷어야 CSS의 translateY(100%)로 닫힌다
        return;
      }
      // 마지막(가장 낮게 열리는) 스냅에서 시작. rAF 없이 즉시 설정해도
      // data-open 전환과 같은 커밋이라 닫힘 위치(100%)에서 스냅 위치로 transition된다
      sheet.style.transform = `translateY(${Math.max(...snapOffsetsPx)}px)`;
    },
    [open, snapOffsetsPx],
  );

  return createPortal(
    <>
      <button
        type="button"
        tabIndex={-1}
        aria-label="필터 닫기"
        aria-hidden={!open}
        inert={!open}
        className="sheet-backdrop"
        data-open={open ? 'true' : 'false'}
        onClick={() => onCloseRef.current()}
      />
      <section
        ref={sheetRef}
        className={className ? `bottom-sheet ${className}` : 'bottom-sheet'}
        data-open={open ? 'true' : 'false'}
        role="dialog"
        aria-modal="true"
        aria-label="필터"
        aria-hidden={!open}
        inert={!open}
      >
        <div className="sheet-handle-area" aria-hidden="true">
          <div className="sheet-handle" />
        </div>
        {children}
      </section>
    </>,
    document.body,
  );
};
