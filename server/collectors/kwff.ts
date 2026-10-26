import * as cheerio from 'cheerio';
import type { DatabaseSync } from 'node:sqlite';
import { stamp, transaction, upsert } from '../db.ts';
import { absolute, clean, identity, number, request, saveTeam } from './common.ts';
import type { Lineup, MatchEvent } from '../../shared/types.ts';

const base = 'https://www.kwff.or.kr';
export function parseKwffMatches(html: string) {
  const $ = cheerio.load(html);
  return $('.match-list-card')
    .map((_i, el) => {
      const card = $(el);
      const blocks = card.children('div');
      const sides = blocks.eq(1).children('div');
      const scores = sides
        .eq(1)
        .find('span')
        .map((_j, e) => clean($(e).text()))
        .get();
      const scoreText = scores.join(' ');
      const score = scoreText.match(/^(\d+)\s*:\s*(\d+)/);
      const dt = card.attr('data-match-datetime') || '';
      return {
        sourceId: card.find('a.match-center-btn').attr('href')?.split('/').pop() || '',
        date: dt.slice(0, 10),
        kickoff: dt.includes('T') ? `${dt}:00+09:00` : null,
        home: clean(sides.eq(0).find('span').text()),
        away: clean(sides.eq(2).find('span').text()),
        homeEmblem: absolute(sides.eq(0).find('img').attr('src'), base),
        awayEmblem: absolute(sides.eq(2).find('img').attr('src'), base),
        homeScore: score ? Number(score[1]) : null,
        awayScore: score ? Number(score[2]) : null,
        status: /연기/.test(card.text())
          ? 'postponed'
          : /취소/.test(card.text())
            ? 'cancelled'
            : /종료/.test(scoreText)
              ? 'finished'
              : /경기중/.test(scoreText)
                ? 'live'
                : 'scheduled',
        round: clean(blocks.eq(0).children('span').first().text()),
        venue: clean(blocks.eq(0).find('div span').last().text()),
      };
    })
    .get()
    .filter((m) => m.sourceId && m.home && m.away && m.date);
}
export function parseKwffDetail(html: string, homeId: string, awayId: string) {
  const $ = cheerio.load(html);
  const lineups: Lineup[] = [],
    events: MatchEvent[] = [];
  $('table')
    .slice(0, 2)
    .each((i, table) => {
      $(table)
        .find('tbody tr')
        .each((_j, row) => {
          const cells = $(row).children('td');
          if (cells.length < 9) return;
          const first = clean(cells.eq(0).find('p').first().find('span').first().text());
          const parsed = first.match(/^(\d+)\.\s*(.+)$/);
          if (!parsed) return;
          lineups.push({
            team_id: i === 0 ? homeId : awayId,
            number: parsed[1],
            player_name: parsed[2],
            position: clean(cells.eq(0).find('p').eq(1).text()),
            starter: null,
            minutes: number(cells.eq(8).text()),
            goals: number(cells.eq(1).text()),
            yellow_cards: number(cells.eq(6).text()),
            red_cards: number(cells.eq(7).text()),
          });
        });
    });
  $('ul')
    .filter((_i, el) => $(el).find('img[src*="ic-ball"]').length > 0)
    .slice(0, 2)
    .each((i, ul) => {
      $(ul)
        .find('li')
        .each((_j, li) => {
          const text = clean($(li).text());
          const m = text.match(/^(.+?)\s+(\d+(?:\+\d+)?)'/);
          if (m)
            events.push({
              minute: m[2],
              player_name: m[1],
              team_id: $(ul).hasClass('items-end') ? homeId : awayId,
              type: 'goal',
              detail: '득점',
            });
        });
    });
  return { lineups, events };
}
export async function collectKwff(db: DatabaseSync, season: number, details = true) {
  const competition = `kwff-wk-${season}`;
  const url = `${base}/wk-league/matches?year=${season}`;
  upsert(db, 'competitions', {
    id: competition,
    league_id: 'wk',
    name: `${season} WK리그`,
    season,
    region: '전국',
    format: 'league',
    availability: 'partial',
    ...stamp('kwff', url),
  });
  const ids = new Set<string>();
  let count = 0;
  for (let month = 1; month <= 12; month++) {
    const html = await (await request(`${url}&month=${month}`)).text();
    const rows = parseKwffMatches(html);
    transaction(db, () => {
      for (const row of rows) {
        const sourceUrl = `${base}/matches/${row.sourceId}`;
        const id = `kwff-${row.sourceId}`;
        ids.add(id);
        const home = saveTeam(db, 'kwff', 'wk', row.home, row.home, row.homeEmblem, sourceUrl);
        const away = saveTeam(db, 'kwff', 'wk', row.away, row.away, row.awayEmblem, sourceUrl);
        upsert(db, 'matches', {
          id,
          competition_id: competition,
          home_id: home,
          away_id: away,
          kickoff: row.kickoff,
          date: row.date,
          round: row.round,
          venue: row.venue,
          home_score: row.homeScore,
          away_score: row.awayScore,
          status: row.status,
          ...stamp('kwff', sourceUrl),
        });
        count++;
      }
    });
  }
  const rankingUrl = `${base}/wk-league/ranking?year=${season}`;
  const $ = cheerio.load(await (await request(rankingUrl)).text());
  transaction(db, () =>
    $('tbody tr').each((_i, row) => {
      const cells = $(row).children('td');
      if (cells.length < 10) return;
      const name = clean(cells.eq(1).text());
      const team = saveTeam(
        db,
        'kwff',
        'wk',
        name,
        name,
        absolute(cells.eq(1).find('img').attr('src'), base),
        rankingUrl,
      );
      upsert(db, 'standings', {
        id: `${competition}-${team}`,
        competition_id: competition,
        team_id: team,
        position: number(cells.eq(0).text())!,
        played: number(cells.eq(2).text()),
        wins: number(cells.eq(3).text()),
        draws: number(cells.eq(4).text()),
        losses: number(cells.eq(5).text()),
        goals_for: number(cells.eq(6).text()),
        goals_against: number(cells.eq(7).text()),
        goal_difference: number(cells.eq(8).text()),
        points: number(cells.eq(9).text()),
        ...stamp('kwff', rankingUrl),
      });
    }),
  );
  const playersUrl = `${base}/wk-league/ranking/players?year=${season}`;
  const p = cheerio.load(await (await request(playersUrl)).text());
  transaction(db, () =>
    p('tbody tr').each((_i, row) => {
      const c = p(row).children('td');
      if (c.length < 13) return;
      const info = c.eq(1).find('div.min-w-0');
      const spans = info.children('div').first().children('span');
      const name = clean(spans.eq(1).text());
      const teamName = clean(info.children('div').eq(1).text());
      if (!name || !teamName) return;
      const team = saveTeam(db, 'kwff', 'wk', teamName, teamName, null, playersUrl);
      const player = `kwff-player-${identity(team, name, clean(spans.eq(2).text()))}`;
      upsert(db, 'players', {
        id: player,
        name,
        team_id: team,
        photo: absolute(c.eq(1).find('img').attr('src'), base),
        ...stamp('kwff', playersUrl),
      });
      upsert(db, 'player_stats', {
        id: `${competition}-${player}`,
        competition_id: competition,
        player_id: player,
        team_id: team,
        position: clean(spans.eq(0).text()),
        played: number(c.eq(2).text()),
        minutes: number(c.eq(3).text()),
        goals: number(c.eq(4).text()),
        assists: number(c.eq(5).text()),
        shots: number(c.eq(7).text()),
        yellow_cards: number(c.eq(11).text()),
        red_cards: number(c.eq(12).text()),
        ...stamp('kwff', playersUrl),
      });
    }),
  );
  if (details)
    for (const id of ids) {
      const row = db.prepare('SELECT * FROM matches WHERE id=?').get(id)!;
      if (
        row.status !== 'finished' ||
        row.manual_locked ||
        row.detail_status === 'partial' ||
        row.detail_status === 'available'
      )
        continue;
      try {
        const data = parseKwffDetail(
          await (await request(String(row.source_url))).text(),
          String(row.home_id),
          String(row.away_id),
        );
        upsert(db, 'matches', {
          id,
          competition_id: competition,
          home_id: String(row.home_id),
          away_id: String(row.away_id),
          date: String(row.date),
          detail_status: data.lineups.length ? 'partial' : 'unavailable',
          detail_message:
            '공개 출전 명단과 득점 기록이에요. 선발 구분·교체 시각은 원문에 표시된 경우에만 제공해요.',
          lineups_json: JSON.stringify(data.lineups),
          events_json: JSON.stringify(data.events),
          ...stamp('kwff', String(row.source_url)),
        });
      } catch (error) {
        db.prepare(
          "UPDATE matches SET detail_status='failed',detail_message=? WHERE id=? AND manual_locked=0",
        ).run(String(error), id);
      }
    }
  return ids.size;
}
