import type { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { stamp, upsert } from '../db.ts';

export const clean = (value: unknown) =>
  String(value ?? '')
    .replaceAll(/\s+/g, ' ')
    .trim();
export const number = (value: unknown): number | null => {
  const s = clean(value);
  if (!s || s === '-' || s === '–') return null;
  const numeric = s.replaceAll(/[^\d.-]/g, '');
  if (!numeric) return null;
  const parsed = Number(numeric);
  return Number.isFinite(parsed) ? parsed : null;
};
export const normalize = (s: string) => s.toLowerCase().replaceAll(/[\s\-_·.()]/g, '');
export const identity = (...parts: string[]) =>
  createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 20);
export const absolute = (path: string | undefined, base: string) =>
  path ? new URL(path, base).href : null;
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let previousRequest = 0;
export async function request(url: string, init: RequestInit = {}, attempt = 0): Promise<Response> {
  const delay = Math.max(0, previousRequest + 350 - Date.now());
  if (delay) await sleep(delay);
  previousRequest = Date.now();
  try {
    const res = await fetch(url, {
      ...init,
      headers: { 'User-Agent': 'Mozilla/5.0', ...init.headers },
      signal: AbortSignal.timeout(20000),
    });
    if ((res.status === 429 || res.status >= 500) && attempt < 2) {
      await sleep((attempt + 1) * 1500);
      return request(url, init, attempt + 1);
    }
    if (!res.ok) throw new Error(`공개 출처 응답 ${res.status}: ${new URL(url).host}`);
    return res;
  } catch (error) {
    if (attempt < 2 && !(error instanceof Error && error.message.includes('응답 4'))) {
      await sleep((attempt + 1) * 1000);
      return request(url, init, attempt + 1);
    }
    throw error;
  }
}
export function saveTeam(
  db: DatabaseSync,
  source: string,
  league: string,
  name: string,
  sourceId: string,
  emblem: string | null,
  url: string,
) {
  const key = identity(source, sourceId, league);
  const mapped = db
    .prepare("SELECT entity_id FROM aliases WHERE source=? AND source_id=? AND entity_type='team'")
    .get(source, `${league}:${sourceId}`);
  const id = mapped ? String(mapped.entity_id) : `${source}-${key}`;
  const existing = db.prepare('SELECT emblem FROM teams WHERE id=?').get(id);
  upsert(db, 'teams', {
    id,
    name,
    league_id: league,
    emblem: emblem || String(existing?.emblem || '') || null,
    ...stamp(source, url),
  });
  upsert(db, 'aliases', {
    id: `team-${key}`,
    source,
    source_id: `${league}:${sourceId}`,
    entity_type: 'team',
    entity_id: id,
    alias: name,
  });
  return id;
}
