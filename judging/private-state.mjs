import * as fs from 'node:fs/promises';
import {dirname,resolve,join} from 'node:path';
import {randomBytes} from 'node:crypto';
export async function privateDirectory(root){
 if(resolve(root)!==root)throw Error('Use an absolute private directory.');
 await fs.mkdir(root,{mode:0o700,recursive:true});let p=root;
 while(true){const s=await fs.lstat(p);if(s.isSymbolicLink()||!s.isDirectory())throw Error('Unsafe private directory.');if(p===root&&process.platform!=='win32'&&(s.mode&0o077))throw Error('Owner-only worker directory required.');if(dirname(p)===p)break;p=dirname(p);}
 return root;
}
export async function privateJson(path){const s=await fs.lstat(path);if(!s.isFile()||s.isSymbolicLink()||s.size>65536||(process.platform!=='win32'&&(s.mode&0o077)))throw Error('Owner-only bounded regular JSON file required.');return JSON.parse(await fs.readFile(path,'utf8'));}
export class PrivateState{
 constructor(root){this.root=root;}
 path(name){if(!/^[a-z0-9-]{1,100}\.json$/.test(name))throw Error('Invalid journal name.');return join(this.root,name);}
 async read(name){try{return await privateJson(this.path(name));}catch(e){if(e.code==='ENOENT')return null;throw e;}}
 async write(name,data){await privateDirectory(this.root);const target=this.path(name);try{const s=await fs.lstat(target);if(!s.isFile()||s.isSymbolicLink())throw Error('Unsafe journal.');}catch(e){if(e.code!=='ENOENT')throw e;}
  const bytes=JSON.stringify(data);if(Buffer.byteLength(bytes)>65536)throw Error('Journal limit exceeded.');const temp=target+'.'+randomBytes(8).toString('hex');const h=await fs.open(temp,'wx',0o600);try{await h.writeFile(bytes);await h.sync();}finally{await h.close();}await fs.rename(temp,target);
  if(process.platform!=='win32'){const dir=await fs.open(this.root,'r');try{await dir.sync();}finally{await dir.close();}}
 }
}
