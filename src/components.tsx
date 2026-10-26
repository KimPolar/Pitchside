import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Bookmark,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Play,
  Search,
  Shield,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type { League, Match, Page, Standing, Suggestion, Video } from '../shared/types';
import { api, dateText, kindText, statusText, timeText, useApi, useSaved } from './lib';
import { useSearchSuggest } from './ui/search-suggest/useSearchSuggest';
import { useTabIndicator } from './ui/tab-indicator/useTabIndicator';
import { BottomSheet } from './ui/bottom-sheet/BottomSheet';
import './ui/skeleton/skeleton.css';

export function Empty({
  title = '아직 공개된 자료가 없어요',
  description = '다른 리그나 기간을 선택해 보세요.',
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <Shield size={32} strokeWidth={1.5} />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Loading() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 200);
    return () => clearTimeout(t);
  }, []);
  return (
    <div
      className="loading-grid"
      role="status"
      aria-label="자료를 불러오는 중이에요"
      aria-busy="true"
    >
      {visible &&
        [0, 1, 2].map((i) => (
          <div key={i}>
            <div className="skeleton loading-photo" />
            <div className="skeleton skeleton-text" />
            <div className="skeleton skeleton-text" />
          </div>
        ))}
    </div>
  );
}
export function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="error-state" role="alert">
      <p>{message}</p>
      <button onClick={retry} className="text-button">
        다시 시도
      </button>
    </div>
  );
}
export function SectionTitle({
  title,
  to,
  children,
}: {
  title: string;
  to?: string;
  children?: ReactNode;
}) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {children}
      {to && (
        <Link to={to} className="subtle-link">
          전체 보기 <ArrowRight size={16} />
        </Link>
      )}
    </div>
  );
}
export function SaveButton({
  id,
  type = 'videos',
  name,
}: {
  id: string;
  type?: 'teams' | 'videos';
  name: string;
}) {
  const { saved, toggle } = useSaved();
  const active = saved[type].includes(id);
  return (
    <button
      className={`icon-button save-button ${active ? 'is-saved' : ''}`}
      aria-label={`${name} ${active ? '저장 해제' : '저장'}`}
      aria-pressed={active}
      onClick={() => toggle(type, id)}
    >
      {active ? <Check size={18} /> : <Bookmark size={18} />}
    </button>
  );
}
export function VideoCard({ video }: { video: Video }) {
  return (
    <article className="video-card">
      <Link to={`/watch/${video.id}`} className="video-image">
        <img src={video.thumbnail} alt="" loading="lazy" />
        <span className="image-play">
          <Play size={20} fill="currentColor" />
        </span>
        <span className="image-kind">{kindText[video.kind]}</span>
      </Link>
      <div className="video-card-caption">
        <div>
          <span className="eyebrow accent-text">{video.league_name || '국내 축구'}</span>
          <Link to={`/watch/${video.id}`} className="video-title">
            {video.title}
          </Link>
          <p className="meta">
            {video.channel} <span>·</span> {dateText(video.published_at)}
          </p>
        </div>
        <SaveButton id={video.id} name={video.title} />
      </div>
    </article>
  );
}
export function VideoGrid({ videos }: { videos: Video[] }) {
  return videos.length ? (
    <div className="video-grid">
      {videos.map((v) => (
        <VideoCard key={v.id} video={v} />
      ))}
    </div>
  ) : (
    <Empty
      title="아직 등록된 영상이 없어요"
      description="다른 리그를 둘러보거나, 수집 후 다시 확인해 보세요."
    />
  );
}
export function Emblem({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return src && !failed ? (
    <img className="emblem" src={src} alt="" onError={() => setFailed(true)} />
  ) : (
    <span className="emblem emblem-fallback" aria-hidden="true">
      <Shield size={20} />
    </span>
  );
}
export function MatchRow({ match, compact = false }: { match: Match; compact?: boolean }) {
  return (
    <Link to={`/matches/${match.id}`} className={`match-row ${compact ? 'compact' : ''}`}>
      <div className="match-context">
        <span className="eyebrow">
          {match.league_name} {match.round && `· ${match.round}`}
        </span>
        <span>
          {dateText(match.date)} <span className="match-clock">{timeText(match.kickoff)}</span>
        </span>
      </div>
      <div className="match-teams">
        <span className="team-name">
          <Emblem src={match.home_emblem} name={match.home_name} />
          {match.home_name}
        </span>
        <span className="match-score">
          {match.home_score !== null && match.away_score !== null ? (
            <>
              {match.home_score}
              <span>:</span>
              {match.away_score}
            </>
          ) : (
            <span className="versus">VS</span>
          )}
        </span>
        <span className="team-name">
          <Emblem src={match.away_emblem} name={match.away_name} />
          {match.away_name}
        </span>
      </div>
      <div className="match-foot">
        <span>{statusText[match.status] || match.status}</span>
        {match.video_count > 0 ? (
          <span className="accent-text">
            <Play size={12} /> 영상 {match.video_count}
          </span>
        ) : (
          <span>{match.venue}</span>
        )}
      </div>
      <ChevronRight className="match-chevron" size={18} />
    </Link>
  );
}
export function StandingsTable({ rows, compact = false }: { rows: Standing[]; compact?: boolean }) {
  return rows.length ? (
    <div className="table-scroll">
      <table className={`data-table ${compact ? 'compact-table' : ''}`}>
        <thead>
          <tr>
            <th>순위</th>
            <th className="left">팀</th>
            <th>경기</th>
            {!compact && (
              <>
                <th>승</th>
                <th>무</th>
                <th>패</th>
                <th>득실</th>
              </>
            )}
            <th>승점</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{r.position}</td>
              <td className="left">
                <Link className="team-cell" to={`/matches?team=${r.team_id}`}>
                  <Emblem src={r.emblem} name={r.team_name} />
                  {r.team_name}
                </Link>
              </td>
              <td>{r.played ?? '—'}</td>
              {!compact && (
                <>
                  <td>{r.wins ?? '—'}</td>
                  <td>{r.draws ?? '—'}</td>
                  <td>{r.losses ?? '—'}</td>
                  <td>{r.goal_difference ?? '—'}</td>
                </>
              )}
              <td className="points">{r.points ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty title="공개된 순위가 없어요" description="경기 일정과 공개 영상을 먼저 확인해 보세요." />
  );
}
export function Pager({ data, onPage }: { data: Page<unknown>; onPage: (p: number) => void }) {
  if (data.total <= data.page_size) return null;
  const pages = Math.ceil(data.total / data.page_size);
  return (
    <nav className="pager" aria-label="목록 페이지">
      <button
        className="icon-button"
        disabled={data.page <= 1}
        onClick={() => onPage(data.page - 1)}
        aria-label="이전 페이지"
      >
        <ChevronLeft size={18} />
      </button>
      <span>
        {data.page} / {pages} <span className="meta">· {data.total.toLocaleString()}개</span>
      </span>
      <button
        className="icon-button"
        disabled={data.page >= pages}
        onClick={() => onPage(data.page + 1)}
        aria-label="다음 페이지"
      >
        <ChevronRight size={18} />
      </button>
    </nav>
  );
}
export function Tabs({
  items,
  value,
  onChange,
}: {
  items: { id: string; label: string }[];
  value: string;
  onChange: (s: string) => void;
}) {
  const active = items.findIndex((t) => t.id === value);
  const { registerTab, indicatorRef } = useTabIndicator({ activeIndex: active });
  return (
    <div className="tabs tab-bar" aria-label="보기 선택">
      {items.map((t, i) => (
        <button
          type="button"
          key={t.id}
          ref={registerTab(i)}
          aria-pressed={t.id === value}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
      <span className="tab-indicator" ref={indicatorRef} aria-hidden="true" />
    </div>
  );
}
export function SearchBox() {
  const navigate = useNavigate();
  const search = useSearchSuggest<Suggestion>({
    fetchSuggestions: ({ query, signal }) =>
      api(`/api/suggest?q=${encodeURIComponent(query)}`, signal),
    toText: (i) => i.name,
    onSelect: (i) => navigate(i.url),
  });
  return (
    <form
      className="global-search suggest-root"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        search.close();
        navigate(`/videos?q=${encodeURIComponent(search.query)}`);
      }}
    >
      <Search size={18} />
      <input
        {...search.inputProps}
        placeholder="리그, 팀, 영상 검색"
        aria-label="리그, 팀, 영상 검색"
      />
      {search.query && (
        <button
          type="button"
          className="icon-button"
          onClick={() => search.setQuery('')}
          aria-label="검색어 지우기"
        >
          <X size={16} />
        </button>
      )}
      {search.isOpen && search.items.length > 0 && (
        <ul {...search.listProps} className="suggest-panel">
          {search.items.map((item, i) => (
            <li
              key={`${item.type}-${item.id}`}
              {...search.getOptionProps(i)}
              className="suggest-option"
            >
              <span>{item.name}</span>
              <small>
                {item.type === 'team' ? '팀' : item.type === 'league' ? '리그' : '영상'}
              </small>
            </li>
          ))}
        </ul>
      )}
      <span className="sr-only" role="status">
        {search.status === 'error'
          ? '검색 제안을 불러오지 못했어요'
          : search.status === 'loading'
            ? '검색 중이에요'
            : ''}
      </span>
    </form>
  );
}
export function Filters({ children, reset }: { children: ReactNode; reset: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="desktop-filters">
        {children}
        <button className="text-button" onClick={reset}>
          초기화
        </button>
      </div>
      <button className="mobile-filter-button secondary-button" onClick={() => setOpen(true)}>
        <SlidersHorizontal size={18} /> 필터
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)}>
        <div className="sheet-heading">
          <h2>필터</h2>
          <button className="icon-button" onClick={() => setOpen(false)} aria-label="필터 닫기">
            <X />
          </button>
        </div>
        <div className="sheet-filters">{open && children}</div>
        <div className="sheet-actions">
          <button className="text-button" onClick={reset}>
            초기화
          </button>
          <button className="primary-button" onClick={() => setOpen(false)}>
            결과 보기
          </button>
        </div>
      </BottomSheet>
    </>
  );
}
export function LeagueSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (s: string) => void;
}) {
  const { data } = useApi<League[]>('/api/leagues');
  return (
    <label className="filter-field">
      리그
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">전체 리그</option>
        {data?.map((l) => (
          <option value={l.id} key={l.id}>
            {l.name}
          </option>
        ))}
      </select>
    </label>
  );
}
export function SourceNote({
  source,
  url,
  updated,
}: {
  source: string;
  url: string;
  updated: string;
}) {
  return (
    <div className="source-note">
      <span>
        출처 {source.toUpperCase()} ·{' '}
        {dateText(updated, { year: 'numeric', month: '2-digit', day: '2-digit' })} 수집
      </span>
      <a href={url} target="_blank" rel="noreferrer">
        원본 보기 <ExternalLink size={14} />
      </a>
    </div>
  );
}
