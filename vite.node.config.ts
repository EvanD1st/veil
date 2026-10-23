import { defineConfig } from 'vite';
import vinext from 'vinext';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
const root=fileURLToPath(new URL('.',import.meta.url));
export default defineConfig(({command})=>{
 if(command!=='build'||process.env.VEIL_LOCAL_TEST==='1')throw Error('Standalone target is for production builds only; test identities are forbidden.');
 return {plugins:[{name:'veil-node-auth',enforce:'pre',resolveId(source,importer){if(source==='@/app/chatgpt-auth'||(importer&&source.startsWith('.')&&resolve(dirname(importer),source)===resolve(root,'app/chatgpt-auth')))return resolve(root,'runtime/node-auth.ts');},load(id){if(id.split('?')[0]===resolve(root,'app/chatgpt-auth.ts'))return 'export * from '+JSON.stringify(resolve(root,'runtime/node-auth.ts'))+';';}},vinext({nextConfig:{output:'standalone'}})],resolve:{alias:{'cloudflare:workers':resolve(root,'runtime/database.mjs')}}};
});
