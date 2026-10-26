import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { createSuggestSearch, type SuggestStatus } from './createSuggestSearch';
import './search-suggest.css';

type UseSearchSuggestOptions<T> = {
  fetchSuggestions: (args: { query: string; signal: AbortSignal }) => Promise<T[]>;
  /** 제안 하나를 골랐을 때 */
  onSelect: (item: T) => void;
  /** 입력창에 채울 문자열 — 목록을 고르면 이 값이 들어간다 */
  toText: (item: T) => string;
  debounceMs?: number;
  minLength?: number;
};

/**
 * createSuggestSearch 코어의 React 래퍼 + 콤보박스 조작.
 *
 * 코어가 "언제 부를지"를 담당하고, 이 훅은 "어떻게 고를지"(키보드·포커스·ARIA)를 담당한다.
 * 화면에 붙이는 속성은 직접 쓰지 말고 inputProps·listProps·getOptionProps를 펼친다 —
 * 콤보박스는 속성 하나만 빠져도 스크린 리더에서 그냥 입력창으로 읽힌다.
 */
export const useSearchSuggest = <T>({
  fetchSuggestions,
  onSelect,
  toText,
  debounceMs,
  minLength,
}: UseSearchSuggestOptions<T>) => {
  const listId = useId();
  const [query, setQueryState] = useState('');
  const [items, setItems] = useState<T[]>([]);
  const [status, setStatus] = useState<SuggestStatus>('idle');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const controllerRef = useRef<ReturnType<typeof createSuggestSearch<T>> | null>(null);
  const fetchRef = useRef(fetchSuggestions);
  fetchRef.current = fetchSuggestions;

  useEffect(
    function createController() {
      const controller = createSuggestSearch<T>({
        fetchSuggestions: (args) => fetchRef.current(args),
        debounceMs,
        minLength,
        onStateChange: (next) => {
          setItems(next.items);
          setStatus(next.status);
        },
      });
      controllerRef.current = controller;
      return () => {
        controller.destroy();
        controllerRef.current = null;
      };
    },
    [debounceMs, minLength],
  );

  const close = () => {
    setOpen(false);
    setActiveIndex(-1);
    controllerRef.current?.cancel();
  };

  const setQuery = (next: string) => {
    setQueryState(next);
    setActiveIndex(-1); // 글자가 바뀌면 이전 선택은 의미가 없다
    setOpen(true);
    controllerRef.current?.setQuery(next);
  };

  const choose = (index: number) => {
    const item = items[index];
    if (!item) return;
    setQueryState(toText(item));
    close();
    onSelect(item);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); // 커서가 글자 끝으로 튀지 않게
      if (items.length === 0) return;
      setOpen(true);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((prev) => {
        // 아직 아무것도 안 골랐으면 아래는 첫 항목, 위는 마지막 항목으로 들어간다
        if (prev === -1) return step === 1 ? 0 : items.length - 1;
        // 끝에서는 반대편으로 감는다 — 목록이 짧을수록 되돌아가는 조작이 잦다
        return (prev + step + items.length) % items.length;
      });
      return;
    }

    if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      choose(activeIndex);
      return;
    }

    if (event.key === 'Escape') {
      close();
    }
  };

  const isOpen = open && (items.length > 0 || status === 'loading' || status === 'error');

  return {
    setQuery,
    query,
    items,
    status,
    activeIndex,
    isOpen,
    close,
    /** 입력창에 펼친다 */
    inputProps: {
      role: 'combobox' as const,
      type: 'search' as const,
      value: query,
      'aria-expanded': isOpen,
      'aria-controls': listId,
      'aria-autocomplete': 'list' as const,
      'aria-activedescendant': activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined,
      autoComplete: 'off',
      onChange: (event: { target: { value: string } }) => setQuery(event.target.value),
      onKeyDown,
      onFocus: () => {
        if (items.length > 0) setOpen(true);
      },
      onBlur: close,
    },
    /** 제안 목록(ul)에 펼친다 */
    listProps: {
      id: listId,
      role: 'listbox' as const,
    },
    /** 제안 항목(li)마다 펼친다 */
    getOptionProps: (index: number) => ({
      id: `${listId}-${index}`,
      role: 'option' as const,
      'aria-selected': index === activeIndex,
      'data-active': index === activeIndex ? 'true' : 'false',
      // blur가 먼저 일어나 목록이 닫히면 click이 오지 않는다 — 눌리는 순간 고른다
      onMouseDown: (event: { preventDefault: () => void }) => {
        event.preventDefault();
        choose(index);
      },
      onMouseEnter: () => setActiveIndex(index),
    }),
  };
};
