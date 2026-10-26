import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  ExternalLink,
  MapPin,
  Play,
  Search,
  Shield,
} from 'lucide-react';
import type {
  Competition,
  HomeData,
  League,
  Match,
  MatchDetail,
  Page,
  PlayerStat,
  SourceRun,
  Standing,
  Team,
  Video,
} from '../shared/types';
import { dateText, kindText, statusText, timeText, useApi, useSaved } from './lib';
import {
  Empty,
  Emblem,
  ErrorState,
  Filters,
  LeagueSelect,
  Loading,
  MatchRow,
  Pager,
  SaveButton,
  SectionTitle,
  SourceNote,
  StandingsTable,
  Tabs,
  VideoCard,
  VideoGrid,
} from './components';

function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow accent-text">{eyebrow}</span>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}
export function HomePage() {
  const { data, loading, error, retry } = useApi<HomeData>('/api/home');
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} retry={retry} />;
  if (!data) return null;
  const featured = data.featured;
  return (
    <>
      <div className="home-heading">
        <div>
          <div className="eyebrow accent-text">
            <span className="tiny-line" /> THE HOME OF KOREAN FOOTBALL
          </div>
          <h1>
            한국 축구의 모든 순간<span>.</span>
          </h1>
          <p>우리 동네의 킥오프부터, 내일의 주인공까지.</p>
        </div>
        <div className="today-date">
          <span>
            {dateText(new Date().toISOString(), { month: 'long', day: 'numeric', weekday: 'long' })}
          </span>
          <span className="meta">2026 시즌 아카이브</span>
        </div>
      </div>
      <div className="league-shortcuts">
        <Link to="/leagues" className="league-shortcut all">
          전체 리그
        </Link>
        {data.leagues
          .filter((l) => ['wk', 'k3', 'k4', 'u1', 'school-u18', 'school-u15', 'k5'].includes(l.id))
          .sort(
            (a, b) =>
              ['k3', 'k4', 'wk', 'u1', 'k5', 'school-u18', 'school-u15'].indexOf(a.id) -
              ['k3', 'k4', 'wk', 'u1', 'k5', 'school-u18', 'school-u15'].indexOf(b.id),
          )
          .map((l) => (
            <Link className="league-shortcut" key={l.id} to={`/leagues/${l.id}`}>
              {l.name}
              <ArrowUpRight size={14} />
            </Link>
          ))}
      </div>
      <div className="home-top-grid">
        <section className="featured-section">
          <SectionTitle title="지금, 피치사이드" />
          {featured ? (
            <Link to={`/watch/${featured.id}`} className="featured-video">
              <img src={featured.thumbnail} alt="" fetchPriority="high" />
              <div className="featured-scrim" />
              <div className="featured-top">
                <span>FEATURED MATCH</span>
                <span>{kindText[featured.kind]}</span>
              </div>
              <div className="featured-content">
                <span className="eyebrow">{featured.league_name || '한국 축구'}</span>
                <h2>
                  {featured.team_names ? featured.team_names.replace(', ', ' vs ') : featured.title}
                </h2>
                <span className="featured-action">
                  <span className="play-disc">
                    <Play size={20} fill="currentColor" />
                  </span>{' '}
                  경기 보러 가기 <ArrowRight size={18} />
                </span>
              </div>
              <span className="featured-channel">{featured.channel}</span>
            </Link>
          ) : (
            <Empty
              title="첫 경기를 기다리고 있어요"
              description="공개 영상을 수집하면 이곳에서 만나볼 수 있어요."
            />
          )}
        </section>
        <section className="upcoming-panel">
          <SectionTitle title="다가오는 경기" to="/matches?status=scheduled&order=asc" />
          <div className="upcoming-list">
            {data.upcoming.length ? (
              data.upcoming.slice(0, 3).map((m) => <MatchRow key={m.id} match={m} compact />)
            ) : (
              <Empty title="예정된 경기가 없어요" description="최근 경기 결과를 확인해 보세요." />
            )}
          </div>
          <Link to="/matches" className="schedule-link">
            <CalendarDays size={16} /> 전체 경기 일정 <ArrowRight size={16} />
          </Link>
        </section>
      </div>
      <div className="home-bottom-grid">
        <section>
          <SectionTitle title="놓치지 말아야 할 경기" to="/videos" />
          <div className="home-video-grid">
            {data.videos
              .filter((v) => v.id !== featured?.id)
              .slice(0, 3)
              .map((v) => (
                <VideoCard key={v.id} video={v} />
              ))}
          </div>
          <div className="recent-section">
            <SectionTitle title="피치 위의 최신 결과" to="/matches?status=finished" />
            <div className="recent-grid">
              {data.recent.slice(0, 4).map((m) => (
                <MatchRow key={m.id} match={m} compact />
              ))}
            </div>
          </div>
        </section>
        <aside className="standings-panel">
          <SectionTitle title="리그 테이블">
            <Link to="/leagues/wk?tab=standings" className="subtle-link">
              <ArrowUpRight size={18} />
              <span className="sr-only">WK리그 순위 전체 보기</span>
            </Link>
          </SectionTitle>
          <div className="table-label">
            <strong>WK리그</strong>
            <span className="meta">2026 정규리그</span>
          </div>
          <StandingsTable rows={data.standings} compact />
          <div className="archive-note">
            <Shield size={24} />
            <div>
              <strong>작은 무대, 큰 이야기</strong>
              <p>
                {data.counts.matches.toLocaleString()}경기와 {data.counts.videos}개의 영상.
                <br />
                한국 축구의 기록을 이어가요.
              </p>
              <Link to="/leagues">
                우리 리그 찾기 <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
export function LeaguesPage() {
  const [params, setParams] = useSearchParams();
  const region = params.get('region') || '';
  const { data, loading, error, retry } = useApi<League[]>(
    `/api/leagues?region=${encodeURIComponent(region)}`,
  );
  const { data: regions } = useApi<string[]>('/api/regions');
  const gender = params.get('gender') || '',
    age = params.get('age') || '',
    q = params.get('q') || '';
  function update(k: string, v: string) {
    setParams((p) => {
      if (v) p.set(k, v);
      else p.delete(k);
      return p;
    });
  }
  const filtered =
    data?.filter(
      (l) =>
        (!gender || l.gender === gender || l.gender === '혼성') &&
        (!age || l.age === age) &&
        (!q || l.name.includes(q) || l.description.includes(q)),
    ) || [];
  return (
    <>
      <PageHeading
        eyebrow="LEAGUES & COMPETITIONS"
        title="우리의 리그, 우리의 축구"
        description="세미프로부터 생활 축구까지, 응원할 무대를 찾아보세요."
      />
      <div className="filter-bar">
        <label className="filter-field search-field">
          <Search size={18} />
          <input
            value={q}
            onChange={(e) => update('q', e.target.value)}
            placeholder="리그 이름 검색"
            aria-label="리그 이름 검색"
          />
        </label>
        <Filters reset={() => setParams({})}>
          <label className="filter-field">
            성별
            <select value={gender} onChange={(e) => update('gender', e.target.value)}>
              <option value="">전체</option>
              <option>남자</option>
              <option>여자</option>
            </select>
          </label>
          <label className="filter-field">
            연령
            <select value={age} onChange={(e) => update('age', e.target.value)}>
              <option value="">전체 연령</option>
              {['성인', '대학', 'U-23', 'U-18', 'U-17', 'U-15', 'U-14', 'U-12', 'U-10', 'U-8'].map(
                (a) => (
                  <option key={a}>{a}</option>
                ),
              )}
            </select>
          </label>
          <label className="filter-field">
            수집된 권역
            <select value={region} onChange={(e) => update('region', e.target.value)}>
              <option value="">전체 권역</option>
              {regions?.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
        </Filters>
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} retry={retry} />
      ) : filtered.length ? (
        <div className="league-groups">
          {['세미프로', '여자축구', '대학', '리저브', '유소년', '아마추어', '생활축구'].map(
            (group) => {
              const rows = filtered.filter((l) => l.category === group);
              return rows.length ? (
                <section key={group}>
                  <SectionTitle title={group} />
                  <div className="league-grid">
                    {rows.map((l) => (
                      <Link to={`/leagues/${l.id}`} key={l.id} className="league-tile">
                        <span className="league-monogram">{l.short_name}</span>
                        <div>
                          <span className="eyebrow">
                            {l.gender} · {l.age}
                          </span>
                          <h3>{l.name}</h3>
                          <p>{l.description}</p>
                          <span className="league-coverage">
                            {l.match_count ? `${l.match_count}경기` : '경기 미수집'} <span>·</span>{' '}
                            {l.video_count ? `영상 ${l.video_count}개` : '영상 미수집'}
                          </span>
                        </div>
                        <ArrowUpRight size={18} />
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null;
            },
          )}
        </div>
      ) : (
        <Empty title="조건에 맞는 리그가 없어요" description="성별이나 연령 필터를 바꿔 보세요." />
      )}
    </>
  );
}
export function LeaguePage() {
  const { id } = useParams();
  const { data: league, error, loading, retry } = useApi<League>(`/api/leagues/${id}`);
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'videos',
    season = params.get('season') || '2026',
    competition = params.get('competition') || '';
  const { data: competitions } = useApi<Page<Competition>>(
    `/api/competitions?league=${id}&season=${season}&page_size=100`,
  );
  const selected = competitions?.items.find((c) => c.id === competition);
  const format = selected?.format || competitions?.items[0]?.format;
  function update(k: string, v: string) {
    setParams((p) => {
      if (v) p.set(k, v);
      else p.delete(k);
      p.delete('page');
      return p;
    });
  }
  const suffix = `league=${id}&season=${season}${competition ? `&competition=${competition}` : ''}`;
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} retry={retry} />;
  if (!league) return null;
  return (
    <>
      <Link to="/leagues" className="back-link">
        <ArrowLeft size={16} /> 리그·대회
      </Link>
      <div className="league-hero">
        <span className="league-monogram large">{league.short_name}</span>
        <PageHeading
          eyebrow={`${league.gender} · ${league.age} · ${league.category}`}
          title={league.name}
          description={league.description}
        />
        <div className="league-numbers">
          <span>
            <strong>{league.match_count}</strong>경기 기록
          </span>
          <span>
            <strong>{league.video_count}</strong>공개 영상
          </span>
        </div>
      </div>
      <div className="filter-bar">
        <label className="filter-field">
          시즌
          <select value={season} onChange={(e) => update('season', e.target.value)}>
            {[2026, 2025, 2024].map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </label>
        <label className="filter-field">
          대회·권역
          <select value={competition} onChange={(e) => update('competition', e.target.value)}>
            <option value="">전체 대회·권역</option>
            {competitions?.items.map((c) => (
              <option value={c.id} key={c.id}>
                {c.name}
                {c.region ? ` · ${c.region}` : ''}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Tabs
        value={tab}
        onChange={(v) => update('tab', v)}
        items={[
          { id: 'videos', label: '경기 영상' },
          { id: 'matches', label: '일정·결과' },
          { id: 'standings', label: format === 'tournament' ? '대회 단계' : '팀 순위' },
          { id: 'players', label: '선수 기록' },
          { id: 'teams', label: '참가 팀' },
        ]}
      />
      <div className="tab-content">
        {tab === 'videos' ? (
          <VideoResults query={`league=${id}&from=${season}-01-01&to=${season}-12-31`} />
        ) : tab === 'matches' ? (
          <MatchResults query={suffix} />
        ) : tab === 'standings' ? (
          format === 'tournament' ? (
            <MatchResults query={suffix} stages />
          ) : (
            <StandingsResults query={suffix} />
          )
        ) : tab === 'players' ? (
          <PlayerResults query={suffix} />
        ) : (
          <TeamResults league={id!} />
        )}
      </div>
      <p className="coverage-note">
        공개 출처에서 확보한 자료만 제공해요. 리그와 경기마다 영상·기록의 제공 범위가 달라요.
      </p>
    </>
  );
}
function VideoResults({ query }: { query: string }) {
  const [p, setP] = useState(1);
  useEffect(() => setP(1), [query]);
  const { data, loading, error, retry } = useApi<Page<Video>>(`/api/videos?${query}&page=${p}`);
  return loading ? (
    <Loading />
  ) : error ? (
    <ErrorState message={error} retry={retry} />
  ) : data ? (
    <>
      <VideoGrid videos={data.items} />
      <Pager data={data} onPage={setP} />
    </>
  ) : null;
}
function MatchResults({ query, stages = false }: { query: string; stages?: boolean }) {
  const [p, setP] = useState(1);
  useEffect(() => setP(1), [query]);
  const { data, loading, error, retry } = useApi<Page<Match>>(`/api/matches?${query}&page=${p}`);
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} retry={retry} />;
  if (!data) return null;
  const groups = Map.groupBy(data.items, (m) =>
    stages ? m.stage || m.round || '대회 경기' : m.date,
  );
  return (
    <>
      {data.items.length ? (
        <div className="match-groups">
          {[...groups].map(([key, rows]) => (
            <section key={key}>
              <h3 className="group-label">
                {stages ? key : dateText(key, { month: 'long', day: 'numeric', weekday: 'long' })}
              </h3>
              <div className="match-list">
                {rows.map((m) => (
                  <MatchRow key={m.id} match={m} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <Empty
          title="해당 조건의 경기가 없어요"
          description="다른 기간이나 대회를 선택해 보세요."
        />
      )}
      <Pager data={data} onPage={setP} />
    </>
  );
}
function StandingsResults({ query }: { query: string }) {
  const { data, loading, error, retry } = useApi<Page<Standing>>(
    `/api/standings?${query}&page_size=100`,
  );
  return loading ? (
    <Loading />
  ) : error ? (
    <ErrorState message={error} retry={retry} />
  ) : data ? (
    <StandingsTable rows={data.items} />
  ) : null;
}
function PlayerResults({ query }: { query: string }) {
  const [sort, setSort] = useState('goals');
  const [p, setP] = useState(1);
  const { data, loading, error, retry } = useApi<Page<PlayerStat>>(
    `/api/player-stats?${query}&sort=${sort}&page=${p}`,
  );
  return (
    <>
      <label className="inline-filter">
        기록 정렬
        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setP(1);
          }}
        >
          <option value="goals">득점</option>
          <option value="assists">도움</option>
          <option value="minutes">출전 시간</option>
        </select>
      </label>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} retry={retry} />
      ) : data?.items.length ? (
        <>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="left">선수</th>
                  <th className="left">팀</th>
                  <th>출전</th>
                  <th>시간</th>
                  <th>득점</th>
                  <th>도움</th>
                  <th>슈팅</th>
                  <th>경고</th>
                  <th>퇴장</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((r) => (
                  <tr key={r.id}>
                    <td className="left">
                      <span className="player-cell">
                        {r.photo && <img src={r.photo} alt="" loading="lazy" />}
                        <span>
                          <strong>{r.player_name}</strong>
                          <small>{r.position}</small>
                        </span>
                      </span>
                    </td>
                    <td className="left">{r.team_name}</td>
                    {[
                      r.played,
                      r.minutes,
                      r.goals,
                      r.assists,
                      r.shots,
                      r.yellow_cards,
                      r.red_cards,
                    ].map((n, i) => (
                      <td key={i}>{n ?? '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager data={data} onPage={setP} />
        </>
      ) : (
        <Empty
          title="공개된 선수 기록이 없어요"
          description="대회와 출처별로 개인 기록 공개 범위가 달라요."
        />
      )}
    </>
  );
}
function TeamResults({ league }: { league: string }) {
  const { data, loading, error, retry } = useApi<Page<Team>>(
    `/api/teams?league=${league}&page_size=100`,
  );
  return loading ? (
    <Loading />
  ) : error ? (
    <ErrorState message={error} retry={retry} />
  ) : data?.items.length ? (
    <div className="team-grid">
      {data.items.map((t) => (
        <div className="team-tile" key={t.id}>
          <Emblem src={t.emblem} name={t.name} />
          <Link to={`/matches?team=${t.id}`}>{t.name}</Link>
          <SaveButton id={t.id} type="teams" name={t.name} />
        </div>
      ))}
    </div>
  ) : (
    <Empty
      title="아직 등록된 팀이 없어요"
      description="공개 경기 자료를 수집하면 참가 팀을 확인할 수 있어요."
    />
  );
}
export function VideosPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '',
    league = params.get('league') || '',
    kind = params.get('kind') || '';
  function update(k: string, v: string) {
    setParams((p) => {
      if (v) p.set(k, v);
      else p.delete(k);
      p.delete('page');
      return p;
    });
  }
  return (
    <>
      <PageHeading
        eyebrow="WATCH THE GAME"
        title="다시 만나고 싶은 순간"
        description="중계부터 하이라이트까지, 우리 축구를 가까이에서."
      />
      <div className="filter-bar">
        <label className="filter-field search-field">
          <Search size={18} />
          <input
            aria-label="영상과 팀 검색"
            placeholder="영상 제목, 팀 이름 검색"
            value={q}
            onChange={(e) => update('q', e.target.value)}
          />
        </label>
        <Filters reset={() => setParams({})}>
          <LeagueSelect value={league} onChange={(v) => update('league', v)} />
          <label className="filter-field">
            영상 종류
            <select value={kind} onChange={(e) => update('kind', e.target.value)}>
              <option value="">전체 영상</option>
              {Object.entries(kindText).map(([id, name]) => (
                <option value={id} key={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            시작일
            <input
              type="date"
              value={params.get('from') || ''}
              onChange={(e) => update('from', e.target.value)}
            />
          </label>
          <label className="filter-field">
            종료일
            <input
              type="date"
              value={params.get('to') || ''}
              onChange={(e) => update('to', e.target.value)}
            />
          </label>
        </Filters>
      </div>
      <VideoResults query={params.toString()} />
    </>
  );
}
export function MatchesPage() {
  const [params, setParams] = useSearchParams();
  function update(k: string, v: string) {
    setParams((p) => {
      if (v) p.set(k, v);
      else p.delete(k);
      return p;
    });
  }
  return (
    <>
      <PageHeading
        eyebrow="MATCHDAY"
        title="다음 킥오프는 언제인가요?"
        description="경기 일정을 살피고, 지나간 승부의 기록을 만나보세요."
      />
      <div className="filter-bar">
        <label className="filter-field search-field">
          <Search size={18} />
          <input
            value={params.get('q') || ''}
            onChange={(e) => update('q', e.target.value)}
            placeholder="팀, 대회 이름 검색"
            aria-label="경기 검색"
          />
        </label>
        <Filters reset={() => setParams({})}>
          <LeagueSelect value={params.get('league') || ''} onChange={(v) => update('league', v)} />
          <label className="filter-field">
            경기 상태
            <select
              value={params.get('status') || ''}
              onChange={(e) => update('status', e.target.value)}
            >
              <option value="">전체 경기</option>
              {Object.entries(statusText).map(([id, name]) => (
                <option value={id} key={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            날짜
            <input
              type="date"
              value={params.get('date') || ''}
              onChange={(e) => update('date', e.target.value)}
            />
          </label>
        </Filters>
      </div>
      {params.get('team') && (
        <p className="coverage-note">
          선택한 팀의 경기를 보고 있어요.{' '}
          <button className="text-button" onClick={() => update('team', '')}>
            팀 선택 해제
          </button>
        </p>
      )}
      <MatchResults query={params.toString()} />
    </>
  );
}
export function MatchPage() {
  const { id } = useParams();
  const { data: m, loading, error, retry } = useApi<MatchDetail>(`/api/matches/${id}`);
  const [tab, setTab] = useState('videos');
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} retry={retry} />;
  if (!m) return null;
  return (
    <>
      <Link to={`/leagues/${m.league_id}?tab=matches`} className="back-link">
        <ArrowLeft size={16} /> {m.league_name}
      </Link>
      <div className="match-detail-head">
        <span className="eyebrow accent-text">
          {m.competition_name} {m.round && `· ${m.round}`}
        </span>
        <p>
          {dateText(m.date, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })} ·{' '}
          {timeText(m.kickoff)}
        </p>
        <div className="scoreboard">
          <div>
            <Emblem src={m.home_emblem} name={m.home_name} />
            <h1>{m.home_name}</h1>
            <SaveButton id={m.home_id} type="teams" name={m.home_name} />
          </div>
          <div className="scoreboard-center">
            <strong>
              {m.home_score ?? '—'}
              <span>:</span>
              {m.away_score ?? '—'}
            </strong>
            <span>{statusText[m.status]}</span>
          </div>
          <div>
            <Emblem src={m.away_emblem} name={m.away_name} />
            <h2>{m.away_name}</h2>
            <SaveButton id={m.away_id} type="teams" name={m.away_name} />
          </div>
        </div>
        {m.venue && (
          <p className="venue">
            <MapPin size={16} />
            {m.venue}
          </p>
        )}
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'videos', label: `경기 영상 ${m.videos.length}` },
          { id: 'lineups', label: '출전 명단' },
          { id: 'events', label: '경기 기록' },
        ]}
      />
      <div className="tab-content">
        {tab === 'videos' ? (
          <VideoGrid videos={m.videos} />
        ) : tab === 'lineups' ? (
          m.lineups.length ? (
            <>
              <p className="coverage-note">{m.detail_message}</p>
              <div className="lineup-grid">
                {[m.home_id, m.away_id].map((team, i) => (
                  <section key={team}>
                    <SectionTitle title={i === 0 ? m.home_name : m.away_name} />
                    <div className="table-scroll">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>번호</th>
                            <th className="left">선수</th>
                            <th>출전</th>
                            <th>득점</th>
                            <th>경고</th>
                            <th>퇴장</th>
                          </tr>
                        </thead>
                        <tbody>
                          {m.lineups
                            .filter((l) => l.team_id === team)
                            .map((l, j) => (
                              <tr key={j}>
                                <td>{l.number || '—'}</td>
                                <td className="left">
                                  {l.player_name}
                                  <small className="lineup-position">
                                    {l.position}{' '}
                                    {l.starter === true
                                      ? '· 선발'
                                      : l.starter === false
                                        ? '· 후보'
                                        : ''}
                                  </small>
                                </td>
                                <td>{l.minutes === null ? '—' : `${l.minutes}′`}</td>
                                <td>{l.goals ?? '—'}</td>
                                <td>{l.yellow_cards ?? '—'}</td>
                                <td>{l.red_cards ?? '—'}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ))}
              </div>
            </>
          ) : (
            <RecordEmpty match={m} />
          )
        ) : m.events.length ? (
          <div className="event-list">
            {[...m.events]
              .sort((a, b) => {
                const [am, aa = 0] = a.minute.split('+').map(Number);
                const [bm, ba = 0] = b.minute.split('+').map(Number);
                return am - bm || aa - ba;
              })
              .map((e, i) => (
                <div className="event-row" key={i}>
                  <strong>{e.minute || '—'}′</strong>
                  <span>
                    <span className="eyebrow">
                      {e.team_id === m.home_id ? m.home_name : m.away_name}
                    </span>
                    <b>{e.player_name}</b>
                  </span>
                  <span>{e.detail || e.type}</span>
                </div>
              ))}
            <p className="coverage-note">
              공개된 이벤트만 표시해요. 목록에 없는 교체·경고 기록은 원본에서 확인해 주세요.
            </p>
          </div>
        ) : (
          <RecordEmpty match={m} />
        )}
      </div>
      <SourceNote source={m.source} url={m.source_url} updated={m.updated_at} />
    </>
  );
}
function RecordEmpty({ match }: { match: MatchDetail }) {
  return (
    <Empty
      title={
        match.detail_status === 'requires_login'
          ? '상세 기록은 원본 로그인이 필요해요'
          : match.detail_status === 'failed'
            ? '상세 기록을 수집하지 못했어요'
            : '아직 공개된 상세 기록이 없어요'
      }
      description={
        match.detail_status === 'failed'
          ? '기본 경기 정보는 확인할 수 있어요. 원본 기록을 확인해 보세요.'
          : match.detail_message || '출처에서 제공하는 기록을 확인해 보세요.'
      }
      action={
        <a className="text-button" href={match.source_url} target="_blank" rel="noreferrer">
          원본 보기 <ExternalLink size={16} />
        </a>
      }
    />
  );
}
function Player({ video }: { video: Video }) {
  const [started, setStarted] = useState(false);
  useEffect(() => setStarted(false), [video.id]);
  return (
    <div className="player">
      {started ? (
        <iframe
          title={video.title}
          src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0&origin=${encodeURIComponent(window.location.origin)}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <button
          className="player-poster"
          onClick={() => setStarted(true)}
          aria-label={`${video.title} 재생`}
        >
          <img src={video.thumbnail} alt="" />
          <span className="big-play">
            <Play size={32} fill="currentColor" />
          </span>
          <span className="poster-label">경기 재생</span>
        </button>
      )}
    </div>
  );
}
export function WatchPage() {
  const { id } = useParams();
  const { data: v, loading, error, retry } = useApi<Video>(`/api/videos/${id}`);
  const { data: related } = useApi<Page<Video>>(
    `/api/videos?league=${v?.league_id || ''}&page_size=7`,
  );
  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} retry={retry} />;
  if (!v) return null;
  return (
    <>
      <Link to="/videos" className="back-link">
        <ArrowLeft size={16} /> 영상 보관함
      </Link>
      <Player video={v} />
      <div className="watch-heading">
        <div>
          <span className="eyebrow accent-text">
            {v.league_name || '국내 축구'} · {kindText[v.kind]}
          </span>
          <h1>{v.title}</h1>
          <p className="meta">
            {v.channel} ·{' '}
            {dateText(v.published_at, { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <SaveButton id={v.id} name={v.title} />
      </div>
      <div className="watch-actions">
        {v.match_id && (
          <Link className="primary-button" to={`/matches/${v.match_id}`}>
            경기 기록 <ArrowRight size={16} />
          </Link>
        )}
        <a className="text-button" href={v.source_url} target="_blank" rel="noreferrer">
          YouTube에서 보기 <ExternalLink size={16} />
        </a>
        <span className="meta">재생이 제한되면 원본에서 확인해 주세요.</span>
      </div>
      {v.description && (
        <details className="video-description">
          <summary>영상 설명</summary>
          <p>{v.description}</p>
        </details>
      )}
      <SourceNote source={v.source} url={v.source_url} updated={v.updated_at} />
      <section className="related-section">
        <SectionTitle title="이어서 볼 경기" />
        <VideoGrid videos={related?.items.filter((item) => item.id !== v.id).slice(0, 6) || []} />
      </section>
    </>
  );
}
export function SavedPage() {
  const { saved } = useSaved();
  const [tab, setTab] = useState('videos');
  return (
    <>
      <PageHeading
        eyebrow="YOUR SIDELINE"
        title="나의 관심 목록"
        description="다시 보고 싶은 경기와 응원하는 팀을 모아두세요."
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'videos', label: `저장한 영상 ${saved.videos.length}` },
          { id: 'teams', label: `관심 팀 ${saved.teams.length}` },
        ]}
      />
      <div className="tab-content">
        {tab === 'videos' ? (
          saved.videos.length ? (
            <div className="video-grid">
              {saved.videos.map((id) => (
                <SavedVideo key={id} id={id} />
              ))}
            </div>
          ) : (
            <Empty
              title="아직 저장한 영상이 없어요"
              description="영상 옆의 저장 버튼을 누르면 여기에 모아둘 수 있어요."
              action={
                <Link className="text-button" to="/videos">
                  영상 둘러보기 <ArrowRight size={16} />
                </Link>
              }
            />
          )
        ) : saved.teams.length ? (
          <div className="saved-teams">
            {saved.teams.map((id) => (
              <SavedTeam key={id} id={id} />
            ))}
          </div>
        ) : (
          <Empty
            title="아직 관심 팀이 없어요"
            description="리그의 참가 팀에서 응원하는 팀을 저장해 보세요."
            action={
              <Link className="text-button" to="/leagues">
                리그 둘러보기 <ArrowRight size={16} />
              </Link>
            }
          />
        )}
      </div>
      <p className="coverage-note">관심 목록은 지금 사용하는 브라우저에 저장돼요.</p>
    </>
  );
}
function SavedVideo({ id }: { id: string }) {
  const { data, error, loading } = useApi<Video>(`/api/videos/${id}`);
  return data ? (
    <VideoCard video={data} />
  ) : loading ? (
    <Loading />
  ) : error ? (
    <div className="unavailable-saved">
      <p>이 영상은 현재 목록에 없어요.</p>
      <SaveButton id={id} name="영상" />
    </div>
  ) : null;
}
function SavedTeam({ id }: { id: string }) {
  const { data, loading, error } = useApi<Page<Match>>(`/api/matches?team=${id}&page_size=4`);
  const team = data?.items[0];
  const home = team?.home_id === id;
  return (
    <section>
      <div className="section-title">
        <h2>{team ? (home ? team.home_name : team.away_name) : '저장한 팀'}</h2>
        <SaveButton
          id={id}
          type="teams"
          name={team ? (home ? team.home_name : team.away_name) : '팀'}
        />
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <p>팀 경기를 불러오지 못했어요.</p>
      ) : data?.items.length ? (
        data.items.map((m) => <MatchRow match={m} key={m.id} />)
      ) : (
        <p className="coverage-note">아직 수집된 경기가 없어요.</p>
      )}
    </section>
  );
}
export function SourcesPage() {
  const { data, loading, error, retry } = useApi<SourceRun[]>('/api/sources');
  return (
    <>
      <PageHeading
        eyebrow="OPEN FOOTBALL ARCHIVE"
        title="기록은 어디에서 오나요?"
        description="공개 자료의 출처와 마지막 수집 상태를 확인해요."
      />
      <div className="source-list">
        {[
          ['KFA', '대한축구협회', 'https://www.kfa.or.kr', 'K3·K4 경기와 팀 순위'],
          ['KWFF', '한국여자축구연맹', 'https://www.kwff.or.kr', 'WK리그 일정·순위·공개 선수 기록'],
          [
            'JoinKFA',
            '대한축구협회 경기 시스템',
            'https://www.joinkfa.com',
            '공개 대회·경기·참가 정보',
          ],
          [
            'YouTube',
            'KFATV Live · 한국여자축구연맹',
            'https://www.youtube.com/@KFATVLIVE',
            '공개 채널 피드의 최신 영상',
          ],
        ].map(([name, title, url, description]) => (
          <a className="source-row" key={name} href={url} target="_blank" rel="noreferrer">
            <span className="source-code">{name}</span>
            <span>
              <strong>{title}</strong>
              <p>{description}</p>
            </span>
            <ArrowUpRight size={18} />
          </a>
        ))}
      </div>
      <p className="coverage-note">
        공개 범위와 갱신 시점은 출처마다 달라요. 영상은 원본 플레이어로 재생하며, 실제 경기 중계
        상태를 실시간으로 갱신하지 않아요.
      </p>
      <section className="related-section">
        <SectionTitle title="최근 수집 현황" />
        {loading ? (
          <Loading />
        ) : error ? (
          <ErrorState message={error} retry={retry} />
        ) : data?.length ? (
          <div className="run-list">
            {data.map((r) => (
              <div key={r.id} className="run-row">
                <strong>{r.source.toUpperCase()}</strong>
                <span>
                  {dateText(r.started_at, {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span className={r.status === 'failed' ? 'error-text' : ''}>
                  {
                    (
                      {
                        success: '수집 완료',
                        partial: '일부 자료 확인 필요',
                        failed: '수집 실패',
                        running: '수집 중',
                      } as Record<string, string>
                    )[r.status]
                  }{' '}
                  · {r.count}건
                </span>
                <p>{r.message}</p>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title="아직 수집 이력이 없어요"
            description="첫 수집을 마치면 결과를 확인할 수 있어요."
          />
        )}
      </section>
    </>
  );
}
export function NotFound() {
  return (
    <Empty
      title="페이지를 찾을 수 없어요"
      description="주소를 확인하거나 홈으로 돌아가 주세요."
      action={
        <Link className="primary-button" to="/">
          홈으로
        </Link>
      }
    />
  );
}
