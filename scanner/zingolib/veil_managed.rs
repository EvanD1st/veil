//! Private TESTNET wallet process. Input/output is private IPC; never broadcasts.
//! Added as a binary to the exact upstream workspace; upstream code/lock unchanged.
use std::{fs::{self, File, OpenOptions}, io::{Read, Write}, num::NonZeroU32,
    os::unix::fs::{OpenOptionsExt, PermissionsExt}, path::{Path, PathBuf},
    process::{Command, Stdio}, time::Duration};
use zingolib::{config::{ChainType, ClientConfig, WalletConfig}, lightclient::LightClient,
    wallet::WalletSettings};

type Result<T> = std::result::Result<T, Box<dyn std::error::Error>>;
const ENDPOINT: &str = "http://127.0.0.1:19067";
fn require(ok: bool, message: &'static str) -> Result<()> {
    if ok { Ok(()) } else { Err(message.into()) }
}
fn settings() -> WalletSettings {
    let mut s = WalletSettings::default();
    s.sync_config.performance_level = pepper_sync::config::PerformanceLevel::Low;
    s.sync_config.shutdown_on_completion = true;
    s
}
fn config(root: &Path, wallet: WalletConfig, online: bool) -> Result<ClientConfig> {
    let mut c = ClientConfig::builder().set_chain_type(ChainType::Testnet)
        .set_wallet_dir(root.to_path_buf()).set_wallet_name("NEVER_PLAINTEXT".into())
        .set_wallet_config(wallet);
    if online { c = c.set_indexer_uri(ENDPOINT.parse()?); }
    Ok(c.build()?)
}
fn private_file(path: &Path) -> Result<File> {
    Ok(OpenOptions::new().write(true).create_new(true).mode(0o600).open(path)?)
}
fn identity(root: &Path, create: bool) -> Result<String> {
    let path = root.join("identity.txt");
    if create {
        let out = private_file(&path)?;
        require(Command::new("/usr/bin/age-keygen").stdout(out).stderr(Stdio::null())
            .status()?.success(), "identity generation failed")?;
        File::open(&path)?.sync_all()?;
    }
    let s = fs::symlink_metadata(&path)?;
    require(s.is_file() && !s.file_type().is_symlink() && s.permissions().mode() & 0o077 == 0,
        "private identity permissions required")?;
    let out = Command::new("/usr/bin/age-keygen").arg("-y").arg(path)
        .stderr(Stdio::null()).output()?;
    require(out.status.success(), "identity read failed")?;
    Ok(String::from_utf8(out.stdout)?.trim().to_owned())
}
fn encrypt(path: &Path, plaintext: &[u8], recipient: &str) -> Result<()> {
    let temp = path.with_extension("age.next");
    let output = private_file(&temp)?;
    let mut child = Command::new("/usr/bin/age").args(["-r", recipient])
        .stdin(Stdio::piped()).stdout(output).stderr(Stdio::null()).spawn()?;
    let written = child.stdin.take().ok_or("missing encryption pipe")?.write_all(plaintext);
    let status = child.wait()?;
    written?;
    require(status.success(), "encryption failed; retained partial file")?;
    File::open(&temp)?.sync_all()?;
    fs::rename(temp, path)?;
    File::open(path.parent().ok_or("missing parent")?)?.sync_all()?;
    Ok(())
}
fn decrypt(path: &Path, root: &Path) -> Result<Vec<u8>> {
    let s = fs::symlink_metadata(path)?;
    require(s.is_file() && !s.file_type().is_symlink() && s.len() < 64*1024*1024,
        "invalid encrypted file")?;
    let mut child = Command::new("/usr/bin/age").arg("-d").arg("-i")
        .arg(root.join("identity.txt")).arg(path).stdout(Stdio::piped())
        .stderr(Stdio::null()).spawn()?;
    let mut bytes = Vec::new();
    child.stdout.take().ok_or("missing decryption pipe")?.take(64*1024*1024+1).read_to_end(&mut bytes)?;
    if bytes.len()>64*1024*1024 { child.kill()?;let _=child.wait();return Err("decrypted file too large".into()); }
    require(child.wait()?.success(), "decryption failed")?;
    Ok(bytes)
}
async fn persist(client: &LightClient, path: &Path, recipient: &str) -> Result<()> {
    let mut bytes = Vec::new();
    client.wallet().write().await.write(&mut bytes, &ChainType::Testnet)?;
    encrypt(path, &bytes, recipient)
}
async fn check_sync(client: &mut LightClient) -> Result<(u32,u32)> {
    let info = client.info().await?;
    require(info.chain_name=="test" && info.consensus_branch_id.eq_ignore_ascii_case("77190ad9"),
        "unexpected network or consensus; stop for pin review")?;
    let result = tokio::time::timeout(Duration::from_secs(180), client.sync_to_tip_and_await()).await??;
    let end = u32::from(result.sync_end_height);
    let latest = client.info().await?.latest_block_height;
    require(!result.nullifier_retrieval_pending && latest.saturating_sub(u64::from(end))<=2,
        "wallet has not reached strict trial readiness")?;
    Ok((end,result.blocks_scanned))
}

use pepper_sync::wallet::{OutputInterface, OutgoingNoteInterface, KeyIdInterface};
use zingolib::data::receivers::{Receiver,transaction_request_from_receivers};
use zcash_protocol::{memo::{Memo,MemoBytes},value::Zatoshis,consensus::{BlockHeight,BranchId}};
use zcash_primitives::transaction::{Transaction,TxId};

async fn address(client:&LightClient)->Result<String>{
    let mut w=client.wallet().write().await;
    // This SDK deliberately defaults to an Orchard-only UA. Request its supported
    // Sapling derivation explicitly; never relabel an Orchard receiver as Sapling.
    if !w.unified_addresses().values().any(|ua|ua.sapling().is_some()){
        w.generate_unified_address(zingolib::wallet::keys::unified::ReceiverSelection::sapling_only(),zip32::AccountId::ZERO)?;
    }
    let sapling=w.unified_addresses().values().find_map(|ua|ua.sapling()).ok_or("missing Sapling")?;
    Ok(zcash_keys::address::Address::Sapling(Box::new(*sapling)).encode(&ChainType::Testnet))
}
fn integer(v:&json::JsonValue)->Result<u64>{
    let s=v.as_str().ok_or("integer string required")?;
    require(!s.is_empty() && s.len()<=14 && s.bytes().all(|c|c.is_ascii_digit()),"invalid amount")?;
    Ok(s.parse()?)
}
// Inspect the retained SDK transaction and parse the exact serialized bytes again.
// All recipients must be the requested Sapling receiver or this wallet's change.
async fn inspected(client:&LightClient,id:TxId,input:&json::JsonValue,tip:u32)->Result<json::JsonValue>{
    let w=client.wallet().read().await;
    require(w.unified_key_store.len()==1,"isolated account required")?;
    let t=w.wallet_transactions.get(&id).ok_or("missing calculated transaction")?;
    let tx=t.transaction();
    require(tx.transparent_bundle().is_none_or(|b|b.vin.is_empty()&&b.vout.is_empty()),"public pool forbidden")?;
    let expiry=u32::from(tx.expiry_height());
    require(expiry>tip && expiry<=tip+100,"expired or excessive expiry")?;
    let fee=w.calculate_transaction_fee(t)?.into_u64();
    require(fee>0 && fee<=integer(&input["max_fee"])? ,"fee cap exceeded")?;
    let mut selected=None;
    for n in t.outgoing_sapling_notes(){
        let own=t.sapling_notes().iter().any(|v|v.output_id()==n.output_id());
        if !own {
            require(selected.is_none() && n.encoded_recipient(&ChainType::Testnet)?==input["destination"].as_str().ok_or("destination")?
                && n.value()==integer(&input["amount"])? && matches!(n.memo(),Memo::Text(s) if &**s==input["memo"].as_str().unwrap_or("")),"output binding failed")?;
            selected=Some(n.output_id().output_index());
        }
    }
    require(selected.is_some(),"missing exact external output")?;
    require(t.outgoing_orchard_notes().iter().all(|n|t.orchard_notes().iter().any(|v|v.output_id()==n.output_id()))
        && t.outgoing_ironwood_notes().iter().all(|n|t.ironwood_notes().iter().any(|v|v.output_id()==n.output_id())),"unrecognized external output")?;
    require(t.sapling_notes().iter().all(|n|n.key_id().account_id()==zip32::AccountId::ZERO)
        && t.orchard_notes().iter().all(|n|n.key_id().account_id()==zip32::AccountId::ZERO)
        && t.ironwood_notes().iter().all(|n|n.key_id().account_id()==zip32::AccountId::ZERO),"foreign change")?;
    let mut raw=Vec::new();tx.write(&mut raw)?;
    let parsed=Transaction::read(&raw[..],BranchId::for_height(&ChainType::Testnet,BlockHeight::from_u32(tip)))?;
    require(parsed.txid()==id,"raw transaction identity mismatch")?;
    Ok(json::object!{source:input["source"].clone(),destination:input["destination"].clone(),amount:input["amount"].clone(),memo:input["memo"].clone(),fee:fee.to_string(),rawHex:hex::encode(raw),txid:id.to_string(),output:selected.unwrap(),expiryHeight:expiry,independentlyDecoded:true})
}
async fn run()->Result<()>{
    let args:Vec<String>=std::env::args().collect();
    require(args.len()==4,"command root height required")?;
    let mode=args[1].as_str();
    require(["offline","provision","restore","status","backup","check-backup","prepare","inspect"].contains(&mode),"unsupported command")?;
    let root=PathBuf::from(&args[2]);let height:u32=args[3].parse()?;
    require(root.is_absolute() && (4_465_126..10_000_000).contains(&height),"testnet root/height required")?;
    let mut input=String::new();std::io::stdin().take(16385).read_to_string(&mut input)?;
    require(input.len()<=16384,"oversized input")?;
    let input=json::parse(&input)?;
    let create=mode=="offline"||mode=="provision"||mode=="restore";
    if create {fs::create_dir(&root)?;fs::set_permissions(&root,fs::Permissions::from_mode(0o700))?;}
    require(root.canonicalize()?==root && fs::metadata(&root)?.permissions().mode()&0o077==0,"private canonical root required")?;
    let recipient=identity(&root,create)?;
    let path=root.join("wallet.age");let recovery=root.join("recovery.age");
    let mut client=if create{
        let wallet=if mode=="restore"{
            require(input["network"]=="testnet","testnet-only recovery required")?;
            let birthday=input["birthday"].as_u32().ok_or("original birthday required")?;
            require(birthday>=4_465_126&&birthday<=height,"original testnet birthday required")?;
            WalletConfig::MnemonicPhrase{mnemonic_phrase:input["seed"].as_str().ok_or("individual testnet seed required")?.into(),no_of_accounts:NonZeroU32::new(1).unwrap(),birthday,wallet_settings:settings()}
        }else{WalletConfig::NewSeed{no_of_accounts:NonZeroU32::new(1).unwrap(),chain_height:height,wallet_settings:settings()}};
        let c=LightClient::new(config(&root,wallet,mode!="offline")?,false).await?;
        let r=c.recovery_info().await.ok_or("recovery required")?;
        let b=json::object!{seed:r.seed_phrase,birthday:r.birthday,accounts:r.no_of_accounts,network:"testnet"}.dump();
        encrypt(&recovery,b.as_bytes(),&recipient)?;persist(&c,&path,&recipient).await?;c
    }else{LightClient::from_bytes(decrypt(&path,&root)?,config(&root,WalletConfig::Read,true)?).await?};
    client.update_wallet_settings(settings()).await;
    let addr=address(&client).await?;
    let backup=json::parse(&String::from_utf8(decrypt(&recovery,&root)?)?)?;
    require(backup["network"]=="testnet" && backup["accounts"].as_u32()==Some(1),"individual backup required")?;
    let restored=LightClient::new(config(&root,WalletConfig::MnemonicPhrase{mnemonic_phrase:backup["seed"].as_str().ok_or("seed")?.into(),no_of_accounts:NonZeroU32::new(1).unwrap(),birthday:backup["birthday"].as_u32().ok_or("birthday")?,wallet_settings:settings()},false)?,false).await?;
    require(address(&restored).await?==addr,"independent recovery mismatch")?;drop(restored);
    if mode=="offline"{
        persist(&client,&path,&recipient).await?;
        let reopened=LightClient::from_bytes(decrypt(&path,&root)?,config(&root,WalletConfig::Read,false)?).await?;
        require(address(&reopened).await?==addr,"encrypted persistence mismatch")?;
        println!("{}",json::object!{network:"testnet",saplingReceiver:true,independentRecovery:true,encryptedReopen:true,broadcastEnabled:false});return Ok(());
    }
    if mode=="backup"{println!("{}",json::object!{network:"testnet",seed:backup["seed"].clone(),birthday:backup["birthday"].clone(),address:addr});return Ok(());}
    if mode=="check-backup"{
        let words:Vec<&str>=backup["seed"].as_str().ok_or("seed")?.split_whitespace().collect();
        require(input["answers"].len()==3,"three answers required")?;
        for a in input["answers"].members(){let n=a["index"].as_usize().ok_or("index")?;require(n>0&&n<=words.len()&&a["word"].as_str()==Some(words[n-1]),"backup mismatch")?;}
        println!("{}",json::object!{confirmed:true});return Ok(());
    }
    let synced=check_sync(&mut client).await;
    // Retain partial scan ranges on a bounded sync timeout; resume never shortens
    // the original birthday or discards historical recovery work.
    persist(&client,&path,&recipient).await?;
    let(tip,_)=synced?;
    let output=if mode=="prepare"||mode=="inspect"{
        require(input["destination"].as_str().is_some_and(|s|s.starts_with("ztestsapling1")),"Sapling testnet required")?;
        let id=if mode=="inspect"{let w=client.wallet().read().await;*w.wallet_transactions.keys().find(|id|Some(id.to_string().as_str())==input["txid"].as_str()).ok_or("unknown retained txid")?}else{
            let receivers=vec![Receiver{recipient_address:zcash_address::ZcashAddress::try_from_encoded(input["destination"].as_str().ok_or("destination")?)?,amount:Zatoshis::from_u64(integer(&input["amount"])?)?,memo:Some(MemoBytes::from_bytes(input["memo"].as_str().ok_or("memo")?.as_bytes())?)}];
            let p=client.propose_send(transaction_request_from_receivers(receivers)?,zip32::AccountId::ZERO).await?;
            require(p.steps().len()==1,"one shielded transaction required")?;
            let fee=p.steps().first().balance().fee_required().into_u64();require(fee>0&&fee<=integer(&input["max_fee"])? ,"fee cap exceeded")?;
            let ids=tokio::time::timeout(Duration::from_secs(300),client.calculate_stored_proposal()).await??;
            require(ids.len()==1,"one transaction required")?;
            persist(&client,&path,&recipient).await?;*ids.first()
        };
        inspected(&client,id,&input,tip).await?
    }else{
        let b=client.account_balance(zip32::AccountId::ZERO).await?;
        let confirmed=b.confirmed_sapling_balance.map_or(0,Zatoshis::into_u64)+b.confirmed_orchard_balance.map_or(0,Zatoshis::into_u64)+b.confirmed_ironwood_balance.map_or(0,Zatoshis::into_u64);
        json::object!{network:"testnet",address:addr,confirmed:confirmed.to_string(),synchronized:true,height:tip,independentRecovery:true}
    };
    persist(&client,&path,&recipient).await?;
    require(!root.join("NEVER_PLAINTEXT").exists(),"plaintext persistence forbidden")?;
    println!("{}",output);Ok(())
}
fn private_error_chain(error: &(dyn std::error::Error + 'static), mode: &str) -> String {
    let mut detail = format!("mode={mode}\n");
    let mut current = Some(error);
    for depth in 0..8 {
        let Some(item) = current else { break };
        detail.push_str(&format!("{depth}: {item}\n"));
        current = item.source();
    }
    detail
}

#[tokio::main(flavor="multi_thread",worker_threads=2)]
async fn main(){
    std::panic::set_hook(Box::new(|_|eprintln!("managed wallet aborted; private state retained")));
    if let Err(error)=run().await{
        // Detailed SDK diagnostics can embed payment metadata. Keep a maximum of
        // five encrypted private captures; never serialize them into a journal.
        let args:Vec<String>=std::env::args().collect();
        if let Some(value)=args.get(2){
            let root=PathBuf::from(value);
            if root.is_absolute() && root.canonicalize().ok().as_ref()==Some(&root)
                && fs::metadata(&root).is_ok_and(|m|m.permissions().mode()&0o077==0){
                if let Ok(recipient)=identity(&root,false){
                    for n in 0..5 {
                        let path=root.join(format!("failure-{n}.age"));
                        if !path.exists(){let mut detail=private_error_chain(error.as_ref(),args.get(1).map(String::as_str).unwrap_or("unknown"));detail.truncate(detail.floor_char_boundary(8192));let _=encrypt(&path,detail.as_bytes(),&recipient);break;}
                    }
                }
            }
        }
        eprintln!("managed wallet operation failed; retained private state; no broadcast performed");std::process::exit(1);
    }
}
