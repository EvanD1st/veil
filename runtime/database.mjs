import { DatabaseSync } from 'node:sqlite';
import { openSync, closeSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, isAbsolute } from 'node:path';
export function initializeDatabase(path,migrations) {
 if(!isAbsolute(path))throw Error('Use an absolute database path.');
 closeSync(openSync(path,'wx',0o600));
 const db=new DatabaseSync(path);
 try{
  db.exec('PRAGMA foreign_keys=ON; BEGIN IMMEDIATE; CREATE TABLE veil_migrations(name TEXT PRIMARY KEY,sha256 TEXT NOT NULL);');
  for(const file of readdirSync(migrations).filter(x=>/^\d+.*\.sql$/.test(x)).sort()){
   const sql=readFileSync(resolve(migrations,file),'utf8');db.exec(sql);
   db.prepare('INSERT INTO veil_migrations VALUES (?,?)').run(file,createHash('sha256').update(sql).digest('hex'));
  }
  db.exec(`CREATE TABLE veil_accounts(id TEXT PRIMARY KEY,username TEXT UNIQUE NOT NULL,salt TEXT NOT NULL,password_hash TEXT NOT NULL,disabled INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL);
  CREATE TABLE veil_sessions(token_hash TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES veil_accounts(id),expires_at INTEGER NOT NULL);
  CREATE INDEX veil_session_expiry ON veil_sessions(expires_at); COMMIT;`);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
 }catch(e){try{db.exec('ROLLBACK');}catch{}throw e;}finally{db.close();}
}
export function openDatabase(path) {
 if(!path||!isAbsolute(path))throw Error('VEIL_SQLITE_PATH must name an initialized absolute database path.');
 const db=new DatabaseSync(path,{open:false});db.open();db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA synchronous=FULL;');
 if(!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='veil_accounts'").get()){db.close();throw Error('Initialize the standalone database explicitly before startup.');}
 return db;
}
export function nodeDatabase() {
 const key=Symbol.for('veil.node.database');
 return globalThis[key]??=(openDatabase(process.env.VEIL_SQLITE_PATH));
}
// Preserve the D1 methods used by the unchanged auction/payment service and its SQL.
export function d1Adapter(db) {
 return {prepare(sql){const statement=db.prepare(sql);let values=[];const bound={bind(...args){values=args;return bound;},async first(column){const row=statement.get(...values);return column?(row?.[column]??null):(row??null);},async all(){return {results:statement.all(...values),success:true};},async run(){const r=statement.run(...values);return {meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)},success:true};}};return bound;}};
}
export const env={get DB(){return d1Adapter(nodeDatabase());},get VEIL_SCANNER_PUBLIC_KEY(){return process.env.VEIL_SCANNER_PUBLIC_KEY;}};
