import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export async function api<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || '자료를 불러오지 못했어요');
  }
  return response.json();
}
export function useApi<T>(path: string) {
  const [state, setState] = useState<{ data: T | null; error: string; loading: boolean }>({
    data: null,
    error: '',
    loading: true,
  });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ data: null, error: '', loading: true });
    api<T>(path, controller.signal)
      .then((data) => setState({ data, error: '', loading: false }))
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ data: null, error: String(error.message), loading: false });
      });
    return () => controller.abort();
  }, [path, retry]);
  return { ...state, retry: () => setRetry((v) => v + 1) };
}
export const dateText = (
  date: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' },
) =>
  date
    ? new Intl.DateTimeFormat('ko-KR', { ...options, timeZone: 'Asia/Seoul' }).format(
        new Date(date.length === 10 ? date + 'T12:00:00+09:00' : date),
      )
    : '날짜 미공개';
export const timeText = (date: string | null) =>
  date
    ? new Intl.DateTimeFormat('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Seoul',
      }).format(new Date(date))
    : '시간 미정';
export const kindText: Record<string, string> = {
  highlight: '하이라이트',
  replay: '다시보기',
  broadcast: '경기 중계',
  other: '축구 영상',
};
export const statusText: Record<string, string> = {
  finished: '경기 종료',
  scheduled: '경기 예정',
  postponed: '경기 연기',
  cancelled: '경기 취소',
  live: '경기 중',
};
type Saved = { videos: string[]; teams: string[] };
const SavedContext = createContext<{
  saved: Saved;
  toggle: (type: keyof Saved, id: string) => void;
  announcement: string;
}>({ saved: { videos: [], teams: [] }, toggle: () => {}, announcement: '' });
export function SavedProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<Saved>(() => {
    try {
      const s = JSON.parse(localStorage.getItem('pitchside-saved') || '{}');
      return {
        videos: Array.isArray(s.videos) ? s.videos : [],
        teams: Array.isArray(s.teams) ? s.teams : [],
      };
    } catch {
      return { videos: [], teams: [] };
    }
  });
  const [announcement, setAnnouncement] = useState('');
  function toggle(type: keyof Saved, id: string) {
    const exists = saved[type].includes(id);
    const next = {
      ...saved,
      [type]: exists ? saved[type].filter((i) => i !== id) : [...saved[type], id],
    };
    setSaved(next);
    try {
      localStorage.setItem('pitchside-saved', JSON.stringify(next));
    } catch {}
    setAnnouncement(exists ? '관심 목록에서 해제했어요' : '관심 목록에 저장했어요');
  }
  return (
    <SavedContext.Provider value={{ saved, toggle, announcement }}>
      {children}
    </SavedContext.Provider>
  );
}
export const useSaved = () => useContext(SavedContext);
