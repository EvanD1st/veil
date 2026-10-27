import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,symlink,rm} from 'node:fs/promises';
import {tmpdir,homedir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

test('managed worker invoked through a release symlink actually runs its guarded main',async t=>{
 // Removable FAT volumes cannot host Windows symlinks. This tiny test uses the
 // user's native home filesystem; large artifacts and other scratch stay on E:.
 const directory=await mkdtemp(join(process.platform==='win32'?homedir():tmpdir(),'veil-managed-entry-'));
 try{
  const entry=join(directory,'worker.mjs');
  try{await symlink(resolve('judging/managed-service.mjs'),entry,'file');}
  catch(error){if(process.platform==='win32'&&['EPERM','EACCES'].includes(error.code)){t.skip('Windows does not permit creating this test symlink. Linux CI executes it.');return;}throw error;}
  const result=spawnSync(process.execPath,[entry,join(directory,'missing-private-config.json')],{encoding:'utf8',timeout:15000});
  assert.equal(result.error,undefined);
  assert.notEqual(result.status,0,'A worker must not silently succeed without opening its configuration.');
  assert.match(result.stderr,/ENOENT/);
 }finally{await rm(directory,{recursive:true,force:true});}
});
