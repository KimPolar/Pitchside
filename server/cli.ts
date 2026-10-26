import { parseArgs } from 'node:util';
import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { openDb, backupDb, dbPath } from './db.ts';
import { collectKfa } from './collectors/kfa.ts';
import { collectKwff } from './collectors/kwff.ts';
import { collectJoin } from './collectors/joinkfa.ts';
import { addVideo, collectVideos, matchVideo } from './collectors/video.ts';

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    source: { type: 'string' },
    season: { type: 'string' },
    url: { type: 'string' },
    title: { type: 'string' },
    league: { type: 'string' },
    match: { type: 'string' },
    date: { type: 'string' },
    file: { type: 'string' },
    competition: { type: 'string' },
    month: { type: 'string' },
    'skip-details': { type: 'boolean', default: false },
  },
});
const command = positionals[0];
const db = openDb();
try {
  if (command === 'db:init') console.log(`DB 초기화 완료: ${dbPath}`);
  else if (command === 'db:backup') console.log(`백업 완료: ${await backupDb(db)}`);
  else if (command === 'db:restore') {
    if (!values.file) throw new Error('--file 백업파일 경로를 지정해 주세요');
    const path = resolve(values.file);
    if (path === dbPath || !existsSync(path)) throw new Error('다른 백업 파일을 지정해 주세요');
    const check = new DatabaseSync(path, { readOnly: true });
    try {
      if (
        check.prepare('PRAGMA integrity_check').get()?.integrity_check !== 'ok' ||
        !check.prepare("SELECT name FROM sqlite_master WHERE name='matches'").get()
      )
        throw new Error('유효한 피치사이드 백업이 아니에요');
    } finally {
      check.close();
    }
    console.log(`복원 전 백업: ${await backupDb(db)}`);
    db.close();
    copyFileSync(path, dbPath);
    console.log(`복원 완료: ${dbPath}`);
    process.exit(0);
  } else if (command === 'video:add') {
    if (!values.url) throw new Error('--url YouTube영상주소를 지정해 주세요');
    console.log(`백업: ${await backupDb(db)}`);
    console.log(
      `영상 등록: ${await addVideo(db, values.url, { title: values.title, league: values.league, match: values.match, date: values.date })}`,
    );
  } else if (command === 'collect') {
    const season = Number(values.season || 2026);
    if (!Number.isInteger(season) || season < 2000 || season > 2100)
      throw new Error('시즌을 네 자리 연도로 입력해 주세요');
    const source = values.source || 'all';
    if (!['all', 'kfa', 'kwff', 'joinkfa', 'youtube'].includes(source))
      throw new Error('출처는 all, kfa, kwff, joinkfa, youtube 중 선택해 주세요');
    console.log(`수집 전 백업: ${await backupDb(db)}`);
    const sources = source === 'all' ? ['kfa', 'kwff', 'joinkfa', 'youtube'] : [source];
    for (const s of sources) {
      const run = db
        .prepare("INSERT INTO source_runs(source,status,started_at) VALUES (?,'running',?)")
        .run(s, new Date().toISOString()).lastInsertRowid;
      console.log(`${s}: ${season} 시즌 수집 중`);
      try {
        const count =
          s === 'kfa'
            ? await collectKfa(db, season)
            : s === 'kwff'
              ? await collectKwff(db, season, !values['skip-details'])
              : s === 'joinkfa'
                ? await collectJoin(db, season, {
                    league: values.league,
                    competition: values.competition,
                    month: values.month,
                    details: !values['skip-details'],
                  })
                : await collectVideos(db, season);
        const message =
          s === 'youtube'
            ? '공개 피드에 포함된 최신 영상만 수집했어요.'
            : count === 0
              ? '공개 조회가 빈 목록을 반환했어요. 기존 자료는 보존했어요.'
              : '공개 출처 수집을 마쳤어요.';
        db.prepare(
          'UPDATE source_runs SET status=?,finished_at=?,count=?,message=? WHERE id=?',
        ).run(count ? 'success' : 'partial', new Date().toISOString(), count, message, run);
        console.log(`${s}: ${count}건 · ${message}`);
      } catch (error) {
        db.prepare("UPDATE source_runs SET status='failed',finished_at=?,message=? WHERE id=?").run(
          new Date().toISOString(),
          String(error),
          run,
        );
        console.error(`${s}: ${error}`);
        process.exitCode = 1;
      }
    }
    // 기록을 나중에 가져와도 명확히 일치하는 영상은 다시 연결합니다.
    for (const row of db
      .prepare('SELECT * FROM videos WHERE match_id IS NULL AND manual_locked=0')
      .all()) {
      const linked = matchVideo(
        db,
        row.league_id ? String(row.league_id) : null,
        String(row.title) + ' ' + String(row.description),
      );
      if (linked.matchId)
        db.prepare('UPDATE videos SET match_id=?,team_names=? WHERE id=?').run(
          linked.matchId,
          linked.teams,
          String(row.id),
        );
    }
  } else throw new Error('사용 명령: db:init, db:backup, db:restore, collect, video:add');
} catch (error) {
  console.error(String(error));
  process.exitCode = 1;
} finally {
  db.close();
}
