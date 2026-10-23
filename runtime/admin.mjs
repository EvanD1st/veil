// Private operator command. Passwords arrive only on hidden stdin, never argv or logs.
import { initializeDatabase, openDatabase } from './database.mjs';
import { createAccount } from './accounts.mjs';
const [command,path,...args]=process.argv.slice(2);
try{
 if(command==='init'&&args.length===0){initializeDatabase(path,new URL('../drizzle/',import.meta.url).pathname);console.log('Initialized a new standalone database.');}
 else if(command==='account'&&args.length>=1&&args.length<=2){
  if(process.stdin.isTTY)process.stdin.setRawMode(true);process.stdout.write('Ready for password on hidden stdin.\n');
  let input='';for await(const data of process.stdin){input+=data.toString();if(input.includes('\u0003'))throw Error();if(/[\r\n]/.test(input))break;if(input.length>256)throw Error();}
  if(process.stdin.isTTY)process.stdin.setRawMode(false);
  const db=openDatabase(path);try{await createAccount(db,args[0],input.split(/[\r\n]/)[0],args[1]);}finally{db.close();}console.log('Created VEIL account.');
 }else throw Error();
}catch{if(process.stdin.isTTY)process.stdin.setRawMode(false);console.error('Operator command failed. Use init ABSOLUTE_DB_PATH or account ABSOLUTE_DB_PATH USERNAME [EXISTING_ACTOR_ID]. Existing databases/accounts are never overwritten.');process.exitCode=1;}
