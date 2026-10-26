import {lstatSync,readFileSync} from 'node:fs';
import {isAbsolute} from 'node:path';
export function digitalSellers(){
 const path=process.env.VEIL_DIGITAL_SELLERS_FILE;
 if(!path||!isAbsolute(path))return '{}';
 try{
  const stat=lstatSync(path);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>32768||(process.platform!=='win32'&&(stat.mode&0o022)))return '{}';
  const value=JSON.parse(readFileSync(path,'utf8'));
  if(!value||Array.isArray(value)||typeof value!=='object'||Object.keys(value).length>100)return '{}';
  return JSON.stringify(value);
 }catch{return '{}';}
}
