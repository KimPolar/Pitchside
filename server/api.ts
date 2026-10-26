import express from 'express';
import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import type { HomeData, Match, MatchDetail, Video } from '../shared/types.ts';

export const matchSelect = `SELECT m.*, c.league_id, l.name league_name, c.name competition_name, c.season,c.region,
 h.name home_name,a.name away_name,h.emblem home_emblem,a.emblem away_emblem,
 (SELECT count(*) FROM videos v WHERE v.match_id=m.id) video_count
 FROM matches m JOIN competitions c ON c.id=m.competition_id JOIN leagues l ON l.id=c.league_id
 JOIN teams h ON h.id=m.home_id JOIN teams a ON a.id=m.away_id`;
export const videoSelect = `SELECT v.*,l.name league_name FROM videos v LEFT JOIN leagues l ON l.id=v.league_id`;
const standingSelect = `SELECT s.*, t.name team_name,t.emblem FROM standings s JOIN teams t ON t.id=s.team_id JOIN competitions c ON c.id=s.competition_id`;
export const leagueSelect = `SELECT l.*, (SELECT count(*) FROM matches m JOIN competitions c ON c.id=m.competition_id WHERE c.league_id=l.id) match_count,
 (SELECT count(*) FROM videos v WHERE v.league_id=l.id) video_count FROM leagues l`;
export function createApp(db: DatabaseSync) {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
  const list = (sql: string, params: SQLInputValue[] = []) => db.prepare(sql).all(...params);
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', name: '피치사이드' }));
  app.get('/api/home', (_req, res) => {
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date());
    const videos = list(
      `${videoSelect} ORDER BY v.published_at DESC LIMIT 8`,
    ) as unknown as Video[];
    const featured = list(
      `${videoSelect} ORDER BY (v.match_id IS NOT NULL) DESC, v.published_at DESC LIMIT 1`,
    )[0] as unknown as Video | undefined;
    res.json({
      featured: featured ?? null,
      videos,
      upcoming: list(
        `${matchSelect} WHERE m.date>=? AND m.status NOT IN ('finished','cancelled') ORDER BY m.date,m.kickoff LIMIT 6`,
        [today],
      ),
      recent: list(
        `${matchSelect} WHERE m.status='finished' ORDER BY m.date DESC,m.kickoff DESC LIMIT 6`,
      ),
      standings: list(
        `${standingSelect} WHERE c.league_id='wk' AND c.season=2026 ORDER BY s.position LIMIT 5`,
      ),
      leagues: list(`${leagueSelect} ORDER BY match_count+video_count DESC`),
      counts: db
        .prepare(
          'SELECT (SELECT count(*) FROM matches) matches,(SELECT count(*) FROM videos) videos,(SELECT count(*) FROM teams) teams',
        )
        .get(),
      runs: list('SELECT * FROM source_runs ORDER BY id DESC LIMIT 8'),
    });
  });
  app.get('/api/leagues', (req, res) => {
    const region = typeof req.query.region === 'string' ? req.query.region : '';
    res.json(
      region
        ? list(
            `${leagueSelect} WHERE EXISTS (SELECT 1 FROM competitions c WHERE c.league_id=l.id AND c.region=?)`,
            [region],
          )
        : list(leagueSelect),
    );
  });
  app.get('/api/regions', (_req, res) =>
    res.json(
      list("SELECT DISTINCT region FROM competitions WHERE region<>'' ORDER BY region").map(
        (r) => r.region,
      ),
    ),
  );
  app.get('/api/leagues/:id', (req, res) => {
    const item = db.prepare(`${leagueSelect} WHERE l.id=?`).get(req.params.id);
    if (!item) {
      res.status(404).json({ message: '리그를 찾을 수 없어요' });
      return;
    }
    res.json(item);
  });
  const paginate = (
    req: express.Request,
    res: express.Response,
    select: string,
    clauses: string[],
    params: SQLInputValue[],
    order: string,
  ) => {
    const page = Math.floor(Math.max(1, Math.min(100000, Number(req.query.page) || 1)));
    const size = Math.floor(Math.max(1, Math.min(100, Number(req.query.page_size) || 24)));
    const where = clauses.length ? ' WHERE ' + clauses.join(' AND ') : '';
    const total = Number(
      db.prepare(`SELECT count(*) total FROM (${select}${where})`).get(...params)?.total ?? 0,
    );
    res.json({
      items: list(`${select}${where} ORDER BY ${order} LIMIT ? OFFSET ?`, [
        ...params,
        size,
        (page - 1) * size,
      ]),
      total,
      page,
      page_size: size,
    });
  };
  const filters = (req: express.Request, mapping: Record<string, string>) => {
    const clauses: string[] = [],
      params: SQLInputValue[] = [];
    for (const [key, column] of Object.entries(mapping)) {
      const value = req.query[key];
      if (typeof value === 'string' && value) {
        clauses.push(`${column}=?`);
        params.push(value);
      }
    }
    return { clauses, params };
  };
  app.get('/api/competitions', (req, res) => {
    const { clauses, params } = filters(req, {
      league: 'c.league_id',
      season: 'c.season',
      region: 'c.region',
    });
    paginate(req, res, 'SELECT c.* FROM competitions c', clauses, params, 'c.season DESC,c.name');
  });
  app.get('/api/matches', (req, res) => {
    const { clauses, params } = filters(req, {
      league: 'c.league_id',
      competition: 'm.competition_id',
      season: 'c.season',
      region: 'c.region',
      status: 'm.status',
    });
    if (typeof req.query.team === 'string') {
      clauses.push('(m.home_id=? OR m.away_id=?)');
      params.push(req.query.team, req.query.team);
    }
    if (typeof req.query.q === 'string' && req.query.q) {
      clauses.push('(h.name LIKE ? OR a.name LIKE ? OR c.name LIKE ?)');
      params.push(...Array(3).fill(`%${req.query.q}%`));
    }
    if (typeof req.query.date === 'string' && req.query.date) {
      clauses.push('m.date=?');
      params.push(req.query.date);
    }
    paginate(
      req,
      res,
      matchSelect,
      clauses,
      params,
      req.query.order === 'asc' ? 'm.date ASC,m.kickoff ASC' : 'm.date DESC,m.kickoff DESC',
    );
  });
  app.get('/api/matches/:id', (req, res) => {
    const item = db
      .prepare(`${matchSelect} WHERE m.id=?`)
      .get(req.params.id) as unknown as Match & {
      lineups_json: string;
      events_json: string;
      detail_message: string;
    };
    if (!item) {
      res.status(404).json({ message: '경기를 찾을 수 없어요' });
      return;
    }
    const { lineups_json, events_json, ...rest } = item;
    res.json({
      ...rest,
      lineups: JSON.parse(lineups_json),
      events: JSON.parse(events_json),
      videos: list(`${videoSelect} WHERE v.match_id=? ORDER BY v.published_at DESC`, [item.id]),
    });
  });
  app.get('/api/videos', (req, res) => {
    const { clauses, params } = filters(req, {
      league: 'v.league_id',
      kind: 'v.kind',
      match: 'v.match_id',
    });
    if (typeof req.query.q === 'string' && req.query.q) {
      clauses.push('(v.title LIKE ? OR v.team_names LIKE ?)');
      params.push(`%${req.query.q}%`, `%${req.query.q}%`);
    }
    if (typeof req.query.team === 'string' && req.query.team) {
      clauses.push(`v.match_id IN (SELECT id FROM matches WHERE home_id=? OR away_id=?)`);
      params.push(req.query.team, req.query.team);
    }
    if (typeof req.query.from === 'string' && req.query.from) {
      clauses.push('v.published_at>=?');
      params.push(req.query.from);
    }
    if (typeof req.query.to === 'string' && req.query.to) {
      clauses.push('v.published_at<?');
      params.push(req.query.to + 'T23:59:59.999Z');
    }
    paginate(req, res, videoSelect, clauses, params, 'v.published_at DESC');
  });
  app.get('/api/videos/:id', (req, res) => {
    const item = db.prepare(`${videoSelect} WHERE v.id=?`).get(req.params.id);
    if (!item) {
      res.status(404).json({ message: '영상을 찾을 수 없어요' });
      return;
    }
    res.json(item);
  });
  app.get('/api/standings', (req, res) => {
    const { clauses, params } = filters(req, {
      league: 'c.league_id',
      competition: 's.competition_id',
      season: 'c.season',
    });
    paginate(req, res, standingSelect, clauses, params, 's.competition_id,s.position');
  });
  app.get('/api/player-stats', (req, res) => {
    const { clauses, params } = filters(req, {
      league: 'c.league_id',
      competition: 's.competition_id',
      season: 'c.season',
    });
    const order = ['goals', 'assists', 'minutes', 'played'].includes(String(req.query.sort))
      ? String(req.query.sort)
      : 'goals';
    paginate(
      req,
      res,
      `SELECT s.*,p.name player_name,p.photo,t.name team_name FROM player_stats s JOIN players p ON p.id=s.player_id JOIN teams t ON t.id=s.team_id JOIN competitions c ON c.id=s.competition_id`,
      clauses,
      params,
      `s.${order} DESC,p.name`,
    );
  });
  app.get('/api/teams', (req, res) => {
    const { clauses, params } = filters(req, { league: 't.league_id' });
    paginate(req, res, 'SELECT t.* FROM teams t', clauses, params, 't.name');
  });
  app.get('/api/suggest', (req, res) => {
    const q = String(req.query.q || '').trim();
    if (!q) {
      res.json([]);
      return;
    }
    const pattern = `%${q}%`;
    res.json([
      ...list(
        "SELECT id,name,'league' type,'/leagues/'||id url FROM leagues WHERE name LIKE ? LIMIT 3",
        [pattern],
      ),
      ...list(
        "SELECT id,name,'team' type,'/matches?team='||id url FROM teams WHERE name LIKE ? LIMIT 4",
        [pattern],
      ),
      ...list(
        "SELECT id,title name,'video' type,'/watch/'||id url FROM videos WHERE title LIKE ? LIMIT 3",
        [pattern],
      ),
    ]);
  });
  app.get('/api/sources', (_req, res) =>
    res.json(list('SELECT * FROM source_runs ORDER BY id DESC LIMIT 100')),
  );
  app.use('/api', (_req, res) => res.status(404).json({ message: '요청한 주소를 찾을 수 없어요' }));
  app.use(
    (error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      console.error(error);
      res.status(500).json({ message: '자료를 불러오지 못했어요. 잠시 후 다시 시도해 주세요' });
    },
  );
  return app;
}
