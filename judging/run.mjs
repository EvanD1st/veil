// Kernel flock releases on crash/OOM/reboot; no stale PID-file deletion or duplicate-key race.
import {spawn} from 'node:child_process';import {open,lstat} from 'node:fs/promises';import {join} from 'node:path';import {fileURLToPath} from 'node:url';
import {privateDirectory,privateJson} from './private-state.mjs';
process.umask(0o077);
try{
 if(process.platform!=='linux')throw Error('Supervised demo workers require Linux.');
 const config=await privateJson(process.argv[3]);await privateDirectory(config.journalRoot);const lock=join(config.journalRoot,'worker.lock');
 try{const s=await lstat(lock);if(!s.isFile()||s.isSymbolicLink()||(s.mode&0o077))throw Error('Unsafe process lock.');}catch(e){if(e.code!=='ENOENT')throw e;const h=await open(lock,'wx',0o600);await h.close();}
 const child=spawn('/usr/bin/flock',['-n','--no-fork',lock,process.execPath,fileURLToPath(new URL('./cli.mjs',import.meta.url)),...process.argv.slice(2)],{stdio:'inherit'});
 process.on('SIGTERM',()=>child.kill('SIGTERM'));process.on('SIGINT',()=>child.kill('SIGINT'));
 child.on('error',()=>{console.error('Private worker lock could not start.');process.exitCode=1;});child.on('exit',(code)=>{process.exitCode=code??1;});
}catch{console.error('Use a private Linux configuration and a single locked worker.');process.exitCode=1;}
