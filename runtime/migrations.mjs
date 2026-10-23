// Explicit offline operator operations. Startup never changes an existing schema.
import {backup} from 'node:sqlite';
import {openSync,closeSync,readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {isAbsolute,resolve} from 'node:path';
import {openDatabase} from './database.mjs';
export function reviewMigrations(db,directory){
 const files=readdirSync(directory).filter(n=>/^\d+.*\.sql$/.test(n)).sort();
 const known=new Map(files.map(name=>[name,{name,sql:readFileSync(resolve(directory,name),'utf8'),sha256:createHash('sha256').update(readFileSync(resolve(directory,name))).digest('hex')}]));
 const recorded=db.prepare('SELECT name,sha256 FROM veil_migrations ORDER BY name').all();
 for(const row of recorded)if(known.get(row.name)?.sha256!==row.sha256)throw Error('Recorded migration hash does not match this release.');
 const applied=new Set(recorded.map(r=>r.name));let pending=false;
 for(const name of files){if(!applied.has(name))pending=true;else if(pending)throw Error('Migration history has a gap.');}
 return files.filter(n=>!applied.has(n)).map(n=>known.get(n));
}
export async function privateBackup(db,destination){
 if(!isAbsolute(destination))throw Error('Use an absolute private backup path.');
 closeSync(openSync(destination,'wx',0o600));
 await backup(db,destination);
}
export async function migrateOffline(path,directory,destination){
 const db=openDatabase(path);
 try{
  const pending=reviewMigrations(db,directory);
  if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('Database integrity check failed.');
  if(!pending.length)throw Error('No unapplied migration.');
  await privateBackup(db,destination);
  db.exec('BEGIN IMMEDIATE');
  try{for(const migration of pending){db.exec(migration.sql);db.prepare('INSERT INTO veil_migrations VALUES(?,?)').run(migration.name,migration.sha256);}db.exec('COMMIT');}
  catch(error){db.exec('ROLLBACK');throw error;}
  if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('Post-migration integrity check failed. Keep the service stopped and inspect the backup.');
  return pending.map(m=>m.name);
 }finally{db.close();}
}
