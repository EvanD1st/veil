// Native private uploads are outside the framework graph. Ship their locked runtime
// dependencies explicitly; never depend on a checkout or an on-host npm install.
import {createRequire} from 'node:module';
import {readFile,realpath,cp,mkdir,lstat} from 'node:fs/promises';
import {join,relative} from 'node:path';
const require=createRequire(import.meta.url);
export async function packageNativeImages(root){
 if(process.platform!=='linux'||process.arch!=='x64')throw Error('Package the Ubuntu x64 artifact on Linux x64.');
 const sharpBase=await packageDirectory('sharp',require),fromSharp=createRequire(join(sharpBase,'package.json'));
 const pinned={'sharp':'0.35.4','@img/colour':'1.1.0','detect-libc':'2.1.2','semver':'7.8.5','@img/sharp-linux-x64':'0.35.4','@img/sharp-libvips-linux-x64':'1.3.3'};
 for(const [name,version]of Object.entries(pinned)){
  const source=name==='sharp'?sharpBase:await packageDirectory(name,fromSharp),pkg=JSON.parse(await readFile(join(source,'package.json'),'utf8'));
  if(pkg.name!==name||pkg.version!==version||Object.keys(pkg.dependencies??{}).some(n=>!pinned[n]))throw Error('Review native image dependency pins before packaging.');
  const target=join(root,'node_modules',name);await mkdir(join(target,'..'),{recursive:true});
  const stat=await lstat(target).catch(e=>{if(e.code!=='ENOENT')throw e;});if(stat?.isSymbolicLink())throw Error('Do not overwrite a linked dependency.');
  await cp(source,target,{recursive:true,dereference:true,filter:path=>!relative(source,path).split(/[\\/]/).includes('node_modules')});
 }
}
async function packageDirectory(name,from){
 for(const base of from.resolve.paths(name)??[]){const path=join(base,name);try{if(JSON.parse(await readFile(join(path,'package.json'),'utf8')).name===name)return await realpath(path);}catch(e){if(e.code!=='ENOENT'&&e.code!=='ENOTDIR')throw e;}}
 throw Error('Missing locked native image dependency: '+name);
}
