import { mkdir, lstat, readdir, writeFile } from 'node:fs/promises';
import { resolve, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
export function templates(root) {
 if(!isAbsolute(root)||root==='/'||/[\r\n]/.test(root))throw Error('Choose an absolute private Linux lab directory.');
 const q=JSON.stringify,sh=s=>"'"+s.replaceAll("'","'\\''")+"'";
 const result={};
 result['zebrad.toml']=`# Dedicated VEIL TESTNET lab. Never point at an existing state cache.\n[network]\nnetwork = "Testnet"\nlisten_addr = "127.0.0.1:18233"\n\n[state]\ncache_dir = ${q(root+'/state')}\n\n[rpc]\nlisten_addr = "127.0.0.1:18232"\nindexer_listen_addr = "127.0.0.1:18230"\nenable_cookie_auth = true\ncookie_dir = ${q(root+'/node-auth')}\n`;
 for(const [role,port] of [['receiver',28232],['sender',28233]]){
  result[role+'/zallet.toml']=`backend = "zebra"\n[builder.limits]\n[consensus]\nnetwork = "test"\n[database]\n[external]\n[features]\nas_of_version = "0.0.0"\n[features.deprecated]\n[features.experimental]\n[indexer]\nvalidator_address = "127.0.0.1:18232"\nvalidator_cookie_path = ${q(root+'/node-auth/.cookie')}\n[indexer.read_state_service]\ngrpc_address = "127.0.0.1:18230"\nzebra_state_path = ${q(root+'/state')}\n[keystore]\nrequire_backup = true\n[note_management]\n[rpc]\nbind = ["127.0.0.1:${port}"]\nallow_insecure_remote_bind = false\n`;
 }
 result['scanner.env']=`# Source locally; contains paths only. Generate the signing key separately.\nexport ZALLET_RPC_URL='http://127.0.0.1:28232'\nexport ZALLET_COOKIE_FILE=${sh(root+'/receiver/.cookie')}\nexport ZEBRA_RPC_URL='http://127.0.0.1:18232'\nexport ZEBRA_COOKIE_FILE=${sh(root+'/node-auth/.cookie')}\nexport VEIL_SCANNER_KEY_FILE=${sh(root+'/scanner.pem')}\nunset ZALLET_RPC_AUTH ZEBRA_RPC_AUTH\n`;
 return result;
}
export async function initialize(root) {
 const files=templates(root);
 // Refuse any pre-existing wallet/state material, including symlinked directories.
 for(const path of ['', 'receiver','sender','state','node-auth','private']){
  try{const entry=await lstat(resolve(root,path));if(!entry.isDirectory()||entry.isSymbolicLink()||(path&&(await readdir(resolve(root,path))).length))throw Error('Existing lab material found.');}
  catch(e){if(e.code!=='ENOENT')throw e;}
 }
 for(const path of Object.keys(files)){try{await lstat(resolve(root,path));throw Error('Existing lab configuration found; refusing to overwrite it.');}catch(e){if(e.code!=='ENOENT')throw e;}}
 for(const path of ['','state','node-auth','receiver','sender','private'])await mkdir(resolve(root,path),{recursive:true,mode:0o700});
 for(const [path,data] of Object.entries(files))await writeFile(resolve(root,path),data,{flag:'wx',mode:0o600});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{if(process.platform!=='linux'||process.argv.length!==3)throw Error();await initialize(process.argv[2]);console.log('Created separate testnet configs. No wallet initialized or service started.');}
 catch{console.error('Config preparation failed. Use a private absolute Linux lab root with no existing configuration files.');process.exitCode=1;}
}
