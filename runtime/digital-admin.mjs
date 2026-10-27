// Offline, local operator only. Never exposes files through an HTTP administrator route.
import {openDatabase} from './database.mjs';
import {privateRoot} from './digital-files.mjs';
import {backup} from 'node:sqlite';
import * as fs from 'node:fs/promises';
import {constants} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {reviewableReport} from './digital-review.mjs';
const [operation,arg]=process.argv.slice(2),db=openDatabase(process.env.VEIL_SQLITE_PATH),root=await privateRoot(process.env.VEIL_DIGITAL_ROOT);
const digest=async path=>{const h=await fs.open(path,constants.O_RDONLY|constants.O_NOFOLLOW);try{const hash=createHash('sha256');for await(const c of h.createReadStream({autoClose:false}))hash.update(c);return hash.digest('hex');}finally{await h.close();}};
try{
 if(operation==='audit'){
  let bad=0;for(const a of db.prepare("SELECT * FROM digital_assets WHERE state='complete'").all()){try{if(await digest(join(root,'objects',a.id))!==a.sha256)bad++;}catch{bad++;}}
  console.log(JSON.stringify({assets:db.prepare('SELECT COUNT(*) n FROM digital_assets').get().n,unavailable:bad,entitlements:db.prepare('SELECT state,COUNT(*) n FROM digital_entitlements GROUP BY state').all()}));if(bad)process.exitCode=1;
 }else if(operation==='cleanup'){
  const cutoff=Date.now()-86400000,removed=[];db.exec('BEGIN IMMEDIATE');
  try{
   db.prepare('DELETE FROM digital_drafts WHERE created_at<? AND NOT EXISTS(SELECT 1 FROM digital_listings WHERE version_id=digital_drafts.id)').run(cutoff);
   const rows=db.prepare('SELECT id FROM digital_assets WHERE created_at<? AND NOT EXISTS(SELECT 1 FROM digital_drafts WHERE file_id=digital_assets.id OR preview_id=digital_assets.id) AND NOT EXISTS(SELECT 1 FROM digital_listings WHERE file_id=digital_assets.id OR preview_id=digital_assets.id) AND NOT EXISTS(SELECT 1 FROM judging_families WHERE file_id=digital_assets.id OR preview_id=digital_assets.id)').all(cutoff);
   for(const a of rows){if(!/^[a-f0-9]{32}$/.test(a.id))throw Error();db.prepare('DELETE FROM digital_assets WHERE id=?').run(a.id);removed.push(a.id);}db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
  let deleted=0;for(const dir of ['objects','tmp'])for(const name of await fs.readdir(join(root,dir))){
   if(!(dir==='objects'?/^[a-f0-9]{32}$/:/^[a-f0-9]{32}\.(part|preview)$/).test(name))continue;
   const id=name.slice(0,32),path=join(root,dir,name),stat=await fs.lstat(path);if(!stat.isFile()||stat.isSymbolicLink()||stat.mtimeMs>=cutoff||db.prepare('SELECT id FROM digital_assets WHERE id=?').get(id))continue;
   await fs.unlink(path);deleted++;
  }
  console.log(JSON.stringify({expiredAssets:removed.length,oldOrphanFilesRemoved:deleted,note:'Frozen listing and entitlement files are retained.'}));
 }else if(operation==='backup'){
  if(!arg||resolve(arg)!==arg)throw Error('Use a new absolute private backup directory.');await fs.mkdir(arg,{mode:0o700});await fs.mkdir(join(arg,'objects'),{mode:0o700});
  const path=join(arg,'veil.sqlite');await backup(db,path);await fs.chmod(path,0o600);const snapshot=openDatabase(path);
  try{if(snapshot.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('Database integrity failed.');let count=0;
   for(const a of snapshot.prepare("SELECT * FROM digital_assets WHERE state='complete'").all()){if(!/^[a-f0-9]{32}$/.test(a.id))throw Error();const target=join(arg,'objects',a.id);await fs.copyFile(join(root,'objects',a.id),target,constants.COPYFILE_EXCL);await fs.chmod(target,0o600);if(await digest(target)!==a.sha256)throw Error('File integrity failed.');count++;}
   await fs.writeFile(join(arg,'complete.json'),JSON.stringify({databaseSha256:await digest(path),files:count,createdAt:Date.now()}),{flag:'wx',mode:0o600});console.log('Consistent database/private-file backup verified. Keep the complete set private.');
  }finally{snapshot.close();}
 }else if(operation==='suspend'||operation==='review-resume'){
  if(!/^[a-f0-9-]{36}$/.test(arg??''))throw Error('Use an exact auction identifier.');
  const row=db.prepare('SELECT * FROM digital_entitlements WHERE auction_id=?').get(arg);if(!row)throw Error('Entitlement not found.');
  if(operation==='review-resume'&&process.env.VEIL_DIGITAL_REVIEW_CONFIRM!=='I reviewed current chain evidence and the exact frozen purchase')throw Error('Independent chain/payment review and explicit operator confirmation are required.');
  db.exec('BEGIN IMMEDIATE');try{if(operation==='review-resume'){const a=db.prepare('SELECT * FROM auctions WHERE id=?').get(arg),r=db.prepare('SELECT signed_report FROM payment_reports WHERE auction_id=?').get(arg);if(!r||!reviewableReport(JSON.parse(r.signed_report),row,a,process.env.VEIL_SCANNER_PUBLIC_KEY))throw Error('Current trusted confirmed evidence required.');}db.prepare('UPDATE digital_entitlements SET state=?,suspended_at=? WHERE auction_id=?').run(operation==='suspend'?'suspended':'active',operation==='suspend'?Date.now():null,arg);db.prepare("INSERT INTO digital_events(auction_id,event,recorded_at) VALUES(?,'operator-reviewed',?)").run(arg,Date.now());db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}console.log('Entitlement review recorded. Already downloaded files cannot be recalled.');
 }else throw Error('Choose audit, cleanup, backup, suspend or review-resume. Run cleanup/review while VEIL is stopped.');
}catch{console.error('Digital operation failed. Inspect the private database/files; no complete backup or successful delivery is implied.');process.exitCode=1;}finally{db.close();}
