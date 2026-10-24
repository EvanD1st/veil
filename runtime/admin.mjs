// Private operator command. Passwords arrive only on hidden stdin, never argv or logs.
import { initializeDatabase, openDatabase } from './database.mjs';
import { createAccount,listAccounts } from './accounts.mjs';
import {privateBackup,migrateOffline,reviewMigrations} from './migrations.mjs';
const [command,path,...args]=process.argv.slice(2);
try{
 if(command==='init'&&args.length===0){initializeDatabase(path,new URL('../drizzle/',import.meta.url).pathname);console.log('Initialized a new standalone database.');}
 else if(command==='accounts'&&args.length<=1){const db=openDatabase(path);try{const rows=listAccounts(db,args[0]??'');console.log(JSON.stringify({accounts:rows.slice(0,50),nextAfter:rows.length>50?rows[49].username:null}));}finally{db.close();}}
 else if(command==='backup'&&args.length===1){const db=openDatabase(path);try{await privateBackup(db,args[0]);}finally{db.close();}console.log('Saved a consistent private SQLite backup.');}
 else if(command==='review'&&args.length===0){const db=openDatabase(path);try{console.log(JSON.stringify(reviewMigrations(db,new URL('../drizzle/',import.meta.url).pathname).map(m=>({name:m.name,sha256:m.sha256}))));}finally{db.close();}}
 else if(command==='migrate'&&args.length===2&&args[1]==='--offline-service-stopped'){await migrateOffline(path,new URL('../drizzle/',import.meta.url).pathname,args[0]);console.log('Applied reviewed migrations after a consistent backup.');}
 else if(command==='account'&&args.length>=1&&args.length<=2){
  if(process.stdin.isTTY)process.stdin.setRawMode(true);process.stdout.write('Ready for password on hidden stdin.\n');
  let input='';for await(const data of process.stdin){input+=data.toString();if(input.includes('\u0003'))throw Error();if(/[\r\n]/.test(input))break;if(input.length>256)throw Error();}
  if(process.stdin.isTTY)process.stdin.setRawMode(false);
  const db=openDatabase(path);try{await createAccount(db,args[0],input.split(/[\r\n]/)[0],args[1]);}finally{db.close();}console.log('Created VEIL account.');
 }else throw Error();
}catch{if(process.stdin.isTTY)process.stdin.setRawMode(false);console.error('Operator command failed. Use init ABSOLUTE_DB_PATH, accounts ABSOLUTE_DB_PATH [AFTER_USERNAME], or account ABSOLUTE_DB_PATH USERNAME [EXISTING_ACTOR_ID]. Existing databases/accounts are never overwritten.');process.exitCode=1;}
