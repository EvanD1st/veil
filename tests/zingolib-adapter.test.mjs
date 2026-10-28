import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,chmod,symlink,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {privateJson} from '../backend/judging/zingolib-adapter.mjs';

test('private JSON accepts owner-only files and rejects links',async t=>{
 if(process.platform==='win32'){t.skip('POSIX private file modes are required.');return;}
 const root=await mkdtemp(join(tmpdir(),'veil-private-json-'));
 const original=process.env.CREDENTIALS_DIRECTORY;
 try{
  const file=join(root,'private.json');await writeFile(file,'{"ok":true}');await chmod(file,0o600);
  assert.deepEqual(privateJson(file),{ok:true});
  if(process.platform!=='win32'){
   const link=join(root,'link.json');await symlink(file,link);assert.throws(()=>privateJson(link),/Private configuration required/);
  }
 }finally{
  if(original===undefined)delete process.env.CREDENTIALS_DIRECTORY;else process.env.CREDENTIALS_DIRECTORY=original;
  await rm(root,{recursive:true,force:true});
 }
});

test('private JSON allows only the read-only managed systemd capability credential',async t=>{
 if(process.platform==='win32'){t.skip('POSIX credential file modes are required.');return;}
 const root=await mkdtemp(join(tmpdir(),'veil-systemd-credential-'));
 const original=process.env.CREDENTIALS_DIRECTORY;
 try{
  const file=join(root,'managed-validation');await writeFile(file,'{"network":"testnet"}');await chmod(file,0o440);
  process.env.CREDENTIALS_DIRECTORY=root;
  assert.deepEqual(privateJson(file),{network:'testnet'});
  const other=join(root,'other.json');await writeFile(other,'{"network":"testnet"}');await chmod(other,0o440);
  assert.throws(()=>privateJson(other),/Private configuration required/);
  await chmod(file,0o640);assert.throws(()=>privateJson(file),/Private configuration required/);
 }finally{
  if(original===undefined)delete process.env.CREDENTIALS_DIRECTORY;else process.env.CREDENTIALS_DIRECTORY=original;
  await rm(root,{recursive:true,force:true});
 }
});
