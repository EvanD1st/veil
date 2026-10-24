import { randomBytes, randomUUID, createHash, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const derive=promisify(scrypt);
const options={N:32768,r:8,p:1,maxmem:64*1024*1024};
export const COOKIE='__Host-veil_session';
export function validateAccount(username,password){
 if(typeof username!=='string'||!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username))throw Error('Use 3–40 characters: lowercase letters, numbers, dots, underscores or hyphens; start with a letter or number.');
 if(typeof password!=='string'||password.length<14||password.length>128)throw Error('Use a password of 14–128 characters. Passwords are never shortened.');
}
const digest=token=>createHash('sha256').update(token).digest('hex');
async function accountValues(username,password,id){
 validateAccount(username,password);if(typeof id!=='string'||!id||id.length>200)throw Error('Invalid account ID.');
 const salt=randomBytes(32).toString('hex'),hash=(await derive(password,salt,64,options)).toString('hex');
 return [id,username,salt,hash,Date.now()];
}
export async function createAccount(db,username,password,id=randomUUID()) {
 const values=await accountValues(username,password,id);
 db.prepare('INSERT INTO veil_accounts(id,username,salt,password_hash,created_at) VALUES (?,?,?,?,?)').run(...values);
 return id;
}
export async function registerAccount(db,username,password){
 const id=randomUUID(),values=await accountValues(username,password,id);
 db.exec('BEGIN IMMEDIATE');
 try{db.prepare('INSERT INTO veil_accounts(id,username,salt,password_hash,created_at) VALUES (?,?,?,?,?)').run(...values);const token=createSession(db,id);db.exec('COMMIT');return token;}
 catch(error){db.exec('ROLLBACK');throw error;}
}
export async function authenticate(db,username,password,now=Date.now()) {
 if(typeof username!=='string'||typeof password!=='string'||username.length>40||password.length>128)return null;
 const row=db.prepare('SELECT * FROM veil_accounts WHERE username=?').get(username);
 const actual=await derive(password,row?.salt??'0'.repeat(64),64,options);
 const expected=Buffer.from(row?.password_hash??'0'.repeat(128),'hex');
 if(!timingSafeEqual(actual,expected)||!row||row.disabled)return null;
 return createSession(db,row.id,now);
}
export function createSession(db,id,now=Date.now()){
 const token=randomBytes(32).toString('hex');
 db.prepare('DELETE FROM veil_sessions WHERE expires_at<=?').run(now);
 db.prepare('INSERT INTO veil_sessions VALUES (?,?,?)').run(digest(token),id,now+43200000);
 return token;
}
export function sessionToken(cookie='') {
 const entries=cookie.split(';').map(x=>x.trim()).filter(x=>x.startsWith(COOKIE+'='));
 if(entries.length!==1)return null;
 const token=entries[0].slice(COOKIE.length+1);return /^[a-f0-9]{64}$/.test(token)?token:null;
}
export function sessionUser(db,cookie,now=Date.now()) {
 const token=sessionToken(cookie);if(!token)return null;
 const row=db.prepare('SELECT a.id,a.username FROM veil_sessions s JOIN veil_accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.expires_at>? AND a.disabled=0').get(digest(token),now);
 return row?{userId:row.id,email:row.username+'@veil.local',displayName:row.username,fullName:row.username}:null;
}
export function revokeSession(db,cookie) {const token=sessionToken(cookie);if(token)db.prepare('DELETE FROM veil_sessions WHERE token_hash=?').run(digest(token));}
export function sessionCookie(token) {return `${COOKIE}=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${token?43200:0}`;}
export function safeReturn(value='/') {
 try{if(typeof value!=='string'||value.length>2048||!value.startsWith('/')||value.startsWith('//')||/[\u0000-\u0020\u007f\\]/.test(value))return '/';const u=new URL(value,'https://veil.invalid');const decoded=decodeURIComponent(u.pathname);if(u.origin!=='https://veil.invalid'||decoded.startsWith('//')||/[\u0000-\u0020\u007f\\]/.test(decoded)||/^\/(login|signup|logout|signin-with-chatgpt|signout-with-chatgpt)(\/|$)/i.test(decoded))return '/';return u.pathname+u.search+u.hash;}catch{return '/';}
}
export function listAccounts(db,after=''){
 if(typeof after!=='string'||(after&&!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(after)))throw Error('Invalid account cursor.');
 return db.prepare('SELECT id,username,disabled,created_at FROM veil_accounts WHERE username>? ORDER BY username LIMIT 51').all(after);
}
