import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync, readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { catalog } from './catalog.ts';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const dbPath = resolve(process.env.PITCHSIDE_DB || resolve(root, 'data/kfootball.sqlite'));
export function openDb(path = dbPath) {
  mkdirSync(dirname(path), {recursive:true});
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  db.exec('CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  for(const name of readdirSync(resolve(root,'server/migrations')).filter(n=>n.endsWith('.sql')).sort()) {
    if(db.prepare('SELECT name FROM migrations WHERE name=?').get(name)) continue;
    transaction(db,()=>{db.exec(readFileSync(resolve(root,'server/migrations',name),'utf8')); db.prepare('INSERT INTO migrations VALUES (?,?)').run(name,new Date().toISOString());});
  }
  const insert=db.prepare('INSERT OR IGNORE INTO leagues VALUES (?,?,?,?,?,?,?)');
  transaction(db,()=>catalog.forEach(row=>insert.run(...row)));
  return db;
}
export function transaction<T>(db: DatabaseSync, work:()=>T):T {
  db.exec('BEGIN IMMEDIATE');
  try {const result=work(); db.exec('COMMIT'); return result;} catch(error) {db.exec('ROLLBACK'); throw error;}
}
const tables = new Set(['competitions','teams','players','matches','standings','player_stats','videos','aliases']);
export function upsert(db: DatabaseSync, table:string, row:Record<string, string | number | null>) {
  if(!tables.has(table) || Object.keys(row).some(k=>!/^[a-z_]+$/.test(k))) throw new Error('저장 형식을 확인해 주세요');
  const existing=db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(row.id);
  if(existing?.manual_locked)return {changes:0,lastInsertRowid:0};
  if(existing)row={...existing,...row} as Record<string,string|number|null>;
  const keys=Object.keys(row);
  const edits=keys.filter(k=>k!=='id').map(k=>`${k}=excluded.${k}`).join(',');
  return db.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')}) ON CONFLICT(id) DO UPDATE SET ${edits} WHERE ${table}.manual_locked=0`).run(...keys.map(k=>row[k]));
}
export async function backupDb(db:DatabaseSync, directory=resolve(root,'data/backups')) {
  mkdirSync(directory,{recursive:true});
  const destination=resolve(directory,`pitchside-${new Date().toISOString().replaceAll(/[:.]/g,'-')}.sqlite`);
  await backup(db,destination);
  return destination;
}
export const stamp = (source:string,source_url:string)=>({source,source_url,updated_at:new Date().toISOString()});
export function ensureDatabaseExists() {return existsSync(dbPath);}
