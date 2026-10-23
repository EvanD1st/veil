// Read-only HTTPS checks plus an ordinary session login/logout. No wallet access.
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {checkDeployedAssets} from './check-deployed-assets.mjs';
const config=JSON.parse(await readFile(process.env.VEIL_HOSTED_TEST_CONFIG,'utf8'));
const origin=new URL(config.origin);assert.equal(origin.protocol,'https:');
const account=config.accounts.observer;
const login=await fetch(new URL('/signin-with-chatgpt',origin),{method:'POST',redirect:'manual',headers:{Origin:origin.origin,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:account.username,password:account.password})});
assert.equal(login.status,303);const cookie=login.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie);
const headers={Cookie:cookie};
try{
 assert.equal((await fetch(new URL('/api/auctions',origin),{headers})).status,200);
 assert.equal((await fetch(new URL('/api/auctions',origin),{headers:{'oai-authenticated-user-id':'forged'}})).status,401);
 assert.equal((await fetch(new URL('/api/scanner/jobs',origin),{method:'POST',headers:{'Content-Type':'application/json'},body:'{"action":"claim"}'})).status,401);
 const manifest=JSON.parse(await readFile(new URL('../lib/veil/zk/assets.json',import.meta.url),'utf8'));
 await checkDeployedAssets(origin.href,manifest,(url,options)=>fetch(url,{...options,headers}),()=>{});
 console.log('PASS authenticated HTTPS proof assets: all six parts; API authentication and scanner rejection.');
}finally{
 const logout=await fetch(new URL('/signout-with-chatgpt',origin),{method:'POST',redirect:'manual',headers:{...headers,Origin:origin.origin,'Content-Type':'application/x-www-form-urlencoded'},body:'return_to=%2F'});assert.equal(logout.status,303);
 assert.equal((await fetch(new URL('/api/auctions',origin),{headers})).status,401);
 console.log('PASS logout revokes the session.');
}
