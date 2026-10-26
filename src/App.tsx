import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import {
  ArrowUpRight,
  Bookmark,
  CalendarDays,
  Clapperboard,
  Compass,
  Home,
  Moon,
  Sun,
} from 'lucide-react';
import { SearchBox } from './components';
import { useSaved } from './lib';
import {
  HomePage,
  LeaguePage,
  LeaguesPage,
  MatchesPage,
  MatchPage,
  VideosPage,
  WatchPage,
  SavedPage,
  SourcesPage,
  NotFound,
} from './pages';

const navigation = [
  { to: '/', label: '오늘의 피치', icon: Home },
  { to: '/videos', label: '영상 보관함', icon: Clapperboard },
  { to: '/leagues', label: '리그·대회', icon: Compass },
  { to: '/matches', label: '경기 일정', icon: CalendarDays },
  { to: '/saved', label: '관심 목록', icon: Bookmark },
];
export default function App() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light');
  const { announcement } = useSaved();
  const location = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);
  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('pitchside-theme', next);
    } catch {}
  }
  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const listener = () => {
      if (!localStorage.getItem('pitchside-theme')) {
        setTheme(media.matches ? 'dark' : 'light');
        document.documentElement.dataset.theme = media.matches ? 'dark' : 'light';
      }
    };
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);
  return (
    <>
      <a href="#main" className="skip-link">
        본문으로 이동
      </a>
      <aside className="sidebar">
        <Link to="/" className="brand" aria-label="피치사이드 홈">
          <img src="/favicon.svg" alt="" />
          <span>
            PITCHSIDE<span className="brand-korean">축구, 더 가까이</span>
          </span>
        </Link>
        <nav aria-label="주 메뉴">
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={20} />
              <span>{label}</span>
              {to === '/' && <span className="nav-dot" />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-leagues">
          <span className="eyebrow">피치 둘러보기</span>
          {[
            ['wk', 'WK리그'],
            ['k3', 'K3리그'],
            ['k4', 'K4리그'],
            ['u1', 'U리그'],
            ['school-u18', '유소년 축구'],
          ].map(([id, label]) => (
            <Link key={id} to={`/leagues/${id}`}>
              <span className="league-bullet" />
              {label}
              <ArrowUpRight size={14} />
            </Link>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="pitch-symbol" aria-hidden="true">
            <span />
          </div>
          <p>
            모든 경기에는
            <br />
            이야기가 있으니까.
          </p>
          <Link to="/sources">
            자료 출처·수집 현황 <ArrowUpRight size={14} />
          </Link>
          <span className="sidebar-copyright">© 2026 PITCHSIDE</span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <Link to="/" className="mobile-brand">
            <img src="/favicon.svg" alt="" />
            <strong>PITCHSIDE</strong>
          </Link>
          <SearchBox />
          <div className="topbar-right">
            <span className="local-edition">한국 축구 아카이브</span>
            <button
              className="icon-button theme-button"
              onClick={toggleTheme}
              aria-label={theme === 'light' ? '다크 모드로 전환' : '라이트 모드로 전환'}
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/leagues" element={<LeaguesPage />} />
            <Route path="/leagues/:id" element={<LeaguePage />} />
            <Route path="/matches" element={<MatchesPage />} />
            <Route path="/matches/:id" element={<MatchPage />} />
            <Route path="/videos" element={<VideosPage />} />
            <Route path="/watch/:id" element={<WatchPage />} />
            <Route path="/saved" element={<SavedPage />} />
            <Route path="/sources" element={<SourcesPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <footer className="footer">
          <span>
            <strong>PITCHSIDE</strong> 한국 축구, 경기장 곁에서.
          </span>
          <Link to="/sources">
            공개 자료로 이어지는 축구 <ArrowUpRight size={14} />
          </Link>
        </footer>
      </div>
      <nav className="mobile-nav" aria-label="모바일 주 메뉴">
        {navigation
          .filter((n) => n.to !== '/saved')
          .map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'}>
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
        <NavLink to="/saved" aria-label="관심 목록">
          <Bookmark size={20} />
          <span>관심 목록</span>
        </NavLink>
      </nav>
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </>
  );
}
