import { XMLParser } from 'fast-xml-parser';
import type { DatabaseSync } from 'node:sqlite';
import { stamp, transaction, upsert } from '../db.ts';
import { normalize, request } from './common.ts';

export const channels = [
  { id: 'UCxKEldsuGD4SmJvDO_UT8kQ', name: 'KFATV Live', handle: 'KFATVLIVE' },
  { id: 'UCTKwSI8N9ObC6t0opgGnW4Q', name: '한국여자축구연맹', handle: 'the_kwff' },
];
export function videoId(url: string) {
  const u = new URL(url);
  if (
    ![
      'youtube.com',
      'www.youtube.com',
      'm.youtube.com',
      'youtu.be',
      'www.youtube-nocookie.com',
    ].includes(u.hostname)
  )
    throw new Error('YouTube 영상 주소를 입력해 주세요');
  const id =
    u.hostname === 'youtu.be'
      ? u.pathname.slice(1)
      : u.searchParams.get('v') || u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]+)/)?.[1];
  if (!id || !/^[\w-]{11}$/.test(id)) throw new Error('YouTube 영상 ID를 확인해 주세요');
  return id;
}
export function classifyVideo(text: string): { league: string | null; kind: string } {
  let league: string | null = null;
  const rules: [RegExp, string][] = [
    [/WK\s*(?:리그|LEAGUE)|WK리그/i, 'wk'],
    [/K3\s*(?:리그|LEAGUE)/i, 'k3'],
    [/K4\s*(?:리그|LEAGUE)/i, 'k4'],
    [/K5\s*(?:리그|LEAGUE)/i, 'k5'],
    [/K6\s*(?:리그|LEAGUE)/i, 'k6'],
    [/K7\s*(?:리그|LEAGUE)/i, 'k7'],
    [/여대생.*클럽/, 'women-club'],
    [/여자.*U리그|여자.*대학.*리그/, 'women-u'],
    [/춘계.*여자|여자.*춘계/, 'women-spring'],
    [/추계.*여자|여자.*추계/, 'women-autumn'],
    [/주니어.*U.?18/i, 'junior-u18'],
    [/주니어.*U.?17/i, 'junior-u17'],
    [/주니어.*U.?15/i, 'junior-u15'],
    [/주니어.*U.?14/i, 'junior-u14'],
    [/U리그\s*2|U.LEAGUE\s*2/i, 'u2'],
    [/U리그|U.LEAGUE/i, 'u1'],
    [/전국.*고등.*리그/, 'school-u18'],
    [/전국.*중등.*리그/, 'school-u15'],
    [/전국.*초등.*리그|KWFF.*초등.*리그/, 'school-u12'],
  ];
  for (const [pattern, id] of rules)
    if (pattern.test(text)) {
      league = id;
      break;
    }
  const kind = /하이라이트|highlight/i.test(text)
    ? 'highlight'
    : /FULL\s*MATCH|풀매치|다시보기/i.test(text)
      ? 'replay'
      : /중계|생중계|LIVE|\d{1,2}:\d{2}/i.test(text)
        ? 'broadcast'
        : 'other';
  return { league, kind };
}
export function matchVideo(
  db: DatabaseSync,
  league: string | null,
  text: string,
): { matchId: string | null; teams: string } {
  if (!league) return { matchId: null, teams: '' };
  const normalized = normalize(text);
  const rows = db
    .prepare(
      `SELECT m.id,m.date,h.name home,a.name away FROM matches m JOIN competitions c ON c.id=m.competition_id JOIN teams h ON h.id=m.home_id JOIN teams a ON a.id=m.away_id WHERE c.league_id=?`,
    )
    .all(league);
  const candidates = rows.filter((r) => {
    if (
      !normalized.includes(normalize(String(r.home))) ||
      !normalized.includes(normalize(String(r.away)))
    )
      return false;
    const date = String(r.date);
    const [y, m, d] = date.split('-');
    return [
      date,
      `${y}.${m}.${d}`,
      `${y}년${Number(m)}월${Number(d)}일`,
      `${y}${m}${d}`,
      `${Number(m)}월${Number(d)}일`,
    ].some((v) => normalized.includes(normalize(v)));
  });
  return candidates.length === 1
    ? { matchId: String(candidates[0].id), teams: `${candidates[0].home}, ${candidates[0].away}` }
    : { matchId: null, teams: '' };
}
export async function collectVideos(db: DatabaseSync, season: number) {
  let count = 0;
  for (const channel of channels) {
    const xml = await (
      await request(`https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`)
    ).text();
    const feed = new XMLParser({ ignoreAttributes: false }).parse(xml).feed;
    if (!feed) throw new Error('채널 피드 형식이 변경되었어요');
    const entries = Array.isArray(feed.entry) ? feed.entry : feed.entry ? [feed.entry] : [];
    transaction(db, () => {
      for (const entry of entries) {
        if (!String(entry.published).startsWith(String(season))) continue;
        const id = String(entry['yt:videoId']);
        const title = String(entry.title);
        const description = String(entry['media:group']?.['media:description'] ?? '');
        const { league, kind } = classifyVideo(title + ' ' + description);
        const link = matchVideo(db, league, title + ' ' + description);
        upsert(db, 'videos', {
          id,
          title,
          channel: channel.name,
          channel_id: channel.id,
          thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
          published_at: String(entry.published),
          kind,
          league_id: league,
          match_id: link.matchId,
          team_names: link.teams,
          description,
          availability: 'available',
          ...stamp('youtube', `https://www.youtube.com/watch?v=${id}`),
        });
        count++;
      }
    });
  }
  return count;
}
export async function addVideo(
  db: DatabaseSync,
  url: string,
  options: { title?: string; league?: string; match?: string; date?: string } = {},
) {
  const id = videoId(url);
  const canonical = `https://www.youtube.com/watch?v=${id}`;
  let meta: { title?: string; author_name?: string; thumbnail_url?: string } = {};
  try {
    meta = (await (
      await request(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(canonical)}&format=json`,
      )
    ).json()) as typeof meta;
  } catch (error) {
    if (!options.title) throw error;
  }
  const title = options.title || meta.title!;
  const guessed = classifyVideo(title);
  const league = options.league || guessed.league;
  const linked = matchVideo(db, league, title);
  if (options.match && !db.prepare('SELECT id FROM matches WHERE id=?').get(options.match))
    throw new Error('연결할 경기 ID를 확인해 주세요');
  const existing = db.prepare('SELECT published_at FROM videos WHERE id=?').get(id);
  upsert(db, 'videos', {
    id,
    title,
    channel: meta.author_name || 'YouTube',
    thumbnail: meta.thumbnail_url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    published_at: options.date || String(existing?.published_at || ''),
    kind: guessed.kind,
    league_id: league,
    match_id: options.match || linked.matchId,
    team_names: linked.teams,
    description: '',
    availability: 'available',
    ...stamp('youtube', canonical),
  });
  return id;
}
