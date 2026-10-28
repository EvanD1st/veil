//! Read-only companion. Does not replace the validated managed signing binary.
//! Emits only a Sapling viewing key through private IPC, never a seed/spending key.
use std::{fs,io::{Read,IsTerminal},os::unix::fs::PermissionsExt,path::{Path,PathBuf},process::{Command,Stdio}};
use zingolib::{config::{ChainType,ClientConfig,WalletConfig},lightclient::LightClient,wallet::keys::unified::UnifiedKeyStore};
use zcash_protocol::consensus::NetworkConstants;
type Result<T> = std::result::Result<T,Box<dyn std::error::Error>>;
fn require(ok:bool)->Result<()>{if ok{Ok(())}else{Err("private seller export rejected".into())}}
fn decrypt(root:&Path,name:&str)->Result<Vec<u8>>{
 let p=root.join(name);let s=fs::symlink_metadata(&p)?;
 require(s.is_file()&&!s.file_type().is_symlink()&&s.permissions().mode()&0o077==0&&s.len()<64*1024*1024)?;
 let mut child=Command::new("/usr/bin/age").arg("-d").arg("-i").arg(root.join("identity.txt")).arg(p).stdout(Stdio::piped()).stderr(Stdio::null()).spawn()?;
 let mut data=Vec::new();child.stdout.take().ok_or("private pipe required")?.take(64*1024*1024+1).read_to_end(&mut data)?;
 require(child.wait()?.success()&&data.len()<=64*1024*1024)?;Ok(data)
}
async fn run()->Result<()>{
 require(!std::io::stdout().is_terminal())?;
 let args:Vec<String>=std::env::args().collect();require(args.len()==2)?;
 let root=PathBuf::from(&args[1]);require(root.is_absolute()&&root.canonicalize()?==root)?;
 let mut p=root.as_path();loop{let s=fs::symlink_metadata(p)?;require(s.is_dir()&&!s.file_type().is_symlink())?;if let Some(parent)=p.parent(){p=parent;}else{break;}}
 require(fs::metadata(&root)?.permissions().mode()&0o077==0)?;
 let identity=fs::symlink_metadata(root.join("identity.txt"))?;
 require(identity.is_file()&&!identity.file_type().is_symlink()&&identity.permissions().mode()&0o077==0)?;
 let mut input=String::new();std::io::stdin().take(513).read_to_string(&mut input)?;require(input.len()<=512)?;
 let input=json::parse(&input)?;require(input.len()==1)?;
 let expected=input["address"].as_str().ok_or("bound receiver required")?;
 require(expected.starts_with("ztestsapling1")&&expected.len()<200)?;
 let config=ClientConfig::builder().set_chain_type(ChainType::Testnet).set_wallet_dir(root.clone()).set_wallet_name("NEVER_PLAINTEXT".into()).set_wallet_config(WalletConfig::Read).build()?;
 // No indexer URI, sync, persistence, proposal, signature or broadcast operation.
 let client=LightClient::from_bytes(decrypt(&root,"wallet.age")?,config).await?;
 let backup=json::parse(&String::from_utf8(decrypt(&root,"recovery.age")?)?)?;
 require(backup["network"]=="testnet"&&backup["accounts"].as_u32()==Some(1))?;
 let birthday=backup["birthday"].as_u32().ok_or("original birthday required")?;
 require(birthday>=4_465_126)?;
 let w=client.wallet().read().await;require(w.unified_key_store.len()==1)?;
 let bound=w.unified_addresses().values().filter_map(|ua|ua.sapling()).any(|a|zcash_keys::encoding::encode_payment_address(ChainType::Testnet.hrp_sapling_payment_address(),a)==expected);
 require(bound)?;
 let key=w.unified_key_store.get(&zip32::AccountId::ZERO).ok_or("isolated account required")?;
 let UnifiedKeyStore::Spend(usk)=key else{return Err("individual spending account required".into());};
 #[allow(deprecated)]
 let fvk=usk.sapling().to_extended_full_viewing_key();
 let (_,default)=fvk.default_address();
 let encoded=zcash_keys::encoding::encode_extended_full_viewing_key(ChainType::Testnet.hrp_sapling_extended_full_viewing_key(),&fvk);
 let default_address=zcash_keys::encoding::encode_payment_address(ChainType::Testnet.hrp_sapling_payment_address(),&default);
 println!("{}",json::object!{network:"testnet",address:expected,defaultAddress:default_address,birthday:birthday,viewingKey:encoded});Ok(())
}
#[tokio::main(flavor="multi_thread",worker_threads=2)]
async fn main(){std::panic::set_hook(Box::new(|_|eprintln!("private seller export rejected")));if run().await.is_err(){eprintln!("private seller export rejected; wallet unchanged");std::process::exit(1);}}
