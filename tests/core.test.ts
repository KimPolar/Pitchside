import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb, upsert, stamp, transaction, backupDb } from '../server/db.ts';
import { saveTeam, number } from '../server/collectors/common.ts';
import { classifyVideo, matchVideo, videoId } from '../server/collectors/video.ts';
import { parseKwffMatches, parseKwffDetail } from '../server/collectors/kwff.ts';
import { parseKfaMatches } from '../server/collectors/kfa.ts';
import { parseJoinDetail, detailXml } from '../server/collectors/joinkfa.ts';
import { createApp } from '../server/api.ts';

function setup() {
  const db = openDb(':memory:');
  upsert(db, 'competitions', {
    id: 'test-competition',
    league_id: 'wk',
    name: '검증용 대회',
    season: 2026,
    region: '서울',
    ...stamp('test', 'https://example.com'),
  });
  const home = saveTeam(db, 'test', 'wk', '홈팀', 'home', null, 'https://example.com');
  const away = saveTeam(db, 'test', 'wk', '원정팀', 'away', null, 'https://example.com');
  upsert(db, 'matches', {
    id: 'test-match',
    competition_id: 'test-competition',
    home_id: home,
    away_id: away,
    date: '2026-10-15',
    home_score: 0,
    away_score: null,
    ...stamp('test', 'https://example.com'),
  });
  return { db, home, away };
}
test('누락된 수치와 실제 0을 구분한다', () => {
  for (const v of ['', null, undefined, '—', '-', '–', '미공개']) assert.equal(number(v), null);
  assert.equal(number('0'), 0);
  assert.equal(number('1190분'), 1190);
});
test('리그 전체 분류는 초기화하되 허구의 경기 데이터는 넣지 않는다', () => {
  const db = openDb(':memory:');
  assert.ok(Number(db.prepare('SELECT count(*) n FROM leagues').get()?.n) >= 27);
  assert.equal(db.prepare('SELECT count(*) n FROM matches').get()?.n, 0);
  db.close();
});
test('반복 수집은 중복을 만들지 않고 수동 잠금은 유지된다', () => {
  const { db } = setup();
  upsert(db, 'matches', { id: 'test-match', home_score: 3 });
  assert.equal(db.prepare('SELECT count(*) n FROM matches').get()?.n, 1);
  db.prepare('UPDATE matches SET manual_locked=1 WHERE id=?').run('test-match');
  upsert(db, 'matches', { id: 'test-match', home_score: 5 });
  assert.equal(db.prepare('SELECT home_score FROM matches').get()?.home_score, 3);
  db.close();
});
test('트랜잭션 실패 시 기존 자료를 보존한다', () => {
  const { db } = setup();
  assert.throws(() =>
    transaction(db, () => {
      db.prepare('UPDATE matches SET home_score=7').run();
      throw new Error('검증');
    }),
  );
  assert.equal(db.prepare('SELECT home_score FROM matches').get()?.home_score, 0);
  db.close();
});
test('동일 이름의 팀은 리그와 원본 ID로 구분하고 엠블럼은 빈 값으로 지우지 않는다', () => {
  const db = openDb(':memory:');
  const one = saveTeam(
    db,
    'test',
    'k3',
    '동일 이름',
    'a',
    'https://example.com/a.svg',
    'https://example.com',
  );
  const two = saveTeam(db, 'test', 'k4', '동일 이름', 'a', null, 'https://example.com');
  assert.notEqual(one, two);
  assert.equal(saveTeam(db, 'test', 'k3', '동일 이름', 'a', null, 'https://example.com'), one);
  assert.equal(
    db.prepare('SELECT emblem FROM teams WHERE id=?').get(one)?.emblem,
    'https://example.com/a.svg',
  );
  db.close();
});
test('영상은 리그·양 팀·경기일이 모두 일치할 때만 연결한다', () => {
  const { db } = setup();
  assert.equal(matchVideo(db, 'wk', 'WK리그 홈팀 VS 원정팀 2026.10.15').matchId, 'test-match');
  assert.equal(matchVideo(db, 'wk', '홈팀 VS 원정팀').matchId, null);
  assert.equal(matchVideo(db, 'k3', '홈팀 VS 원정팀 2026.10.15').matchId, null);
  upsert(db, 'matches', {
    id: 'ambiguous',
    competition_id: 'test-competition',
    home_id: String(db.prepare('SELECT home_id FROM matches LIMIT 1').get()?.home_id),
    away_id: String(db.prepare('SELECT away_id FROM matches LIMIT 1').get()?.away_id),
    date: '2026-10-15',
    ...stamp('test', 'https://example.com'),
  });
  assert.equal(matchVideo(db, 'wk', '홈팀 VS 원정팀 2026.10.15').matchId, null);
  db.close();
});
test('유튜브 주소 검증과 영상 종류 분류', () => {
  assert.equal(videoId('https://youtu.be/9eJQGNV9egY'), '9eJQGNV9egY');
  assert.equal(videoId('https://www.youtube.com/live/9eJQGNV9egY'), '9eJQGNV9egY');
  assert.throws(() => videoId('https://example.com/watch?v=9eJQGNV9egY'));
  assert.throws(() => videoId('https://youtube.com/watch?v=bad'));
  assert.deepEqual(classifyVideo('2026 WK League 하이라이트'), { league: 'wk', kind: 'highlight' });
});
test('KWFF 예정·종료·연기 경기와 누락 시간 파싱', () => {
  const make = (scores: string, state: string, dt: string) =>
    `<div class="match-list-card" data-match-datetime="${dt}"><div><span>1R</span><div><span>날짜</span><span>경기장</span></div></div><div><div><span>홈팀</span></div><div>${scores}<span>${state}</span></div><div><span>원정팀</span></div></div><div><a class="match-center-btn" href="/matches/1">매치센터</a></div></div>`;
  let r = parseKwffMatches(
    make('<span>0</span><span>:</span><span>1</span>', '종료', '2026-10-15T19:00'),
  )[0];
  assert.equal(r.homeScore, 0);
  assert.equal(r.status, 'finished');
  r = parseKwffMatches(make('', '경기예정', '2026-10-15'))[0];
  assert.equal(r.homeScore, null);
  assert.equal(r.kickoff, null);
  assert.equal(parseKwffMatches(make('', '연기', '2026-10-15'))[0].status, 'postponed');
});
test('K3와 K4의 서로 다른 이벤트 이름을 모두 파싱한다', () => {
  for (const league of ['k3', 'k4']) {
    const html = `<table><tr><td onclick="${league}_result('57431','509821','${league}');"><div><span>경기장</span><h3>홈팀</h3><h3>원정팀</h3></div><div><span>10-15(목요일) 19:00</span><h3>0</h3><h3>0</h3></div></td></tr></table>`;
    assert.equal(parseKfaMatches(html, 2026)[0].homeScore, 0);
  }
});
test('공개 출전 표에서 선발 여부를 추정하지 않는다', () => {
  const html =
    '<table><tbody><tr><td><p><span>1. 선수</span></p><p>GK</p></td>' +
    ['0', '0', '0', '0', '0', '0', '0', "90'"].map((x) => `<td>${x}</td>`).join('') +
    '</tr></tbody></table>';
  const result = parseKwffDetail(html, 'home', 'away');
  assert.equal(result.lineups[0].starter, null);
  assert.equal(result.lineups[0].minutes, 90);
});
test('JoinKFA 로그인 제한과 공개 기록 없음을 구분한다', () => {
  const restricted =
    '<Root><Parameters><Parameter id="ErrorMsg" type="string">로그인정보가 없습니다.</Parameter></Parameters></Root>';
  assert.equal(parseJoinDetail(restricted, 'h', 'a').status, 'requires_login');
  assert.equal(parseJoinDetail('<Root><Parameters/></Root>', 'h', 'a').status, 'unavailable');
  assert.throws(() => detailXml('<script>', '1'));
  assert.match(detailXml('57431', '509821'), /v_SINGLE_IDX/);
});
test('SQLite 백업을 복원하면 수집 전 값이 유지된다', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pitchside-test-'));
  const original = join(dir, 'original.sqlite');
  const db = openDb(original);
  db.prepare("UPDATE leagues SET description='백업 시점' WHERE id='wk'").run();
  const file = await backupDb(db, join(dir, 'backups'));
  db.prepare("UPDATE leagues SET description='변경 후' WHERE id='wk'").run();
  db.close();
  copyFileSync(file, original);
  const restored = openDb(original);
  assert.equal(
    restored.prepare("SELECT description FROM leagues WHERE id='wk'").get()?.description,
    '백업 시점',
  );
  restored.close();
  rmSync(dir, { recursive: true, force: true });
});
test('조회 API의 필터·페이지·404·누락 값과 출처가 유지된다', async () => {
  const { db } = setup();
  const server = createApp(db).listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const detail = await (await fetch(base + '/api/matches/test-match')).json();
    assert.equal(detail.home_score, 0);
    assert.equal(detail.away_score, null);
    assert.equal(detail.source, 'test');
    assert.deepEqual(detail.lineups, []);
    let page = await (await fetch(base + '/api/matches?league=k3')).json();
    assert.equal(page.total, 0);
    page = await (await fetch(base + '/api/matches?league=wk&page_size=1')).json();
    assert.equal(page.total, 1);
    assert.equal(page.items.length, 1);
    assert.equal((await fetch(base + '/api/matches/missing')).status, 404);
    assert.equal((await fetch(base + '/api/unknown')).status, 404);
  } finally {
    await new Promise<void>((r, e) => server.close((err) => (err ? e(err) : r())));
    db.close();
  }
});
