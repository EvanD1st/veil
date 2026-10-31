//! Isolated TESTNET recovery/sync trial. No proposal, funding or broadcast command.
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
async fn run() -> Result<()> {
    let args:Vec<String>=std::env::args().collect();
    require(args.len()==4,"usage: veil-trial offline|create|resume PRIVATE_NEW_DIRECTORY HEIGHT")?;
    let mode=&args[1];require(["offline","create","resume"].contains(&mode.as_str()),"unsupported command")?;
    let online=mode!="offline";let create=mode!="resume";
    let root=PathBuf::from(&args[2]);let height:u32=args[3].parse()?;
    require(root.is_absolute() && (4_465_126..10_000_000).contains(&height),"testnet trial path/height required")?;
    if create { fs::create_dir(&root)?;fs::set_permissions(&root,fs::Permissions::from_mode(0o700))?; }
    require(root.canonicalize()?==root && fs::metadata(&root)?.permissions().mode()&0o077==0,
        "private canonical root required")?;
    let recipient=identity(&root,create)?;
    let mut addresses=Vec::new();let mut summaries=Vec::new();
    for label in ["a","b"] {
        let wallet_path=root.join(format!("{label}.age"));
        let recovery_path=root.join(format!("{label}-recovery.age"));
        let mut client=if create {
            let client=LightClient::new(config(&root,WalletConfig::NewSeed {
                no_of_accounts:NonZeroU32::new(1).unwrap(),chain_height:height,wallet_settings:settings()
            },online)?,false).await?;
            let recovery=client.recovery_info().await.ok_or("no independent recovery")?;
            // No secret-bearing value is sent to stdout, argv, environment or a plaintext file.
            let backup=json::object! { seed: recovery.seed_phrase, birthday: recovery.birthday,
                accounts: recovery.no_of_accounts, network: "testnet" }.dump();
            encrypt(&recovery_path,backup.as_bytes(),&recipient)?;
            persist(&client,&wallet_path,&recipient).await?;
            client
        } else {
            LightClient::from_bytes(decrypt(&wallet_path,&root)?,config(&root,WalletConfig::Read,online)?).await?
        };
        client.update_wallet_settings(settings()).await;
        let original_addresses=client.unified_addresses_json().await.dump();
        require(!original_addresses.is_empty() && original_addresses!="[]","missing addresses")?;
        addresses.push(original_addresses.clone());
        let backup=json::parse(&String::from_utf8(decrypt(&recovery_path,&root)?)?)?;
        require(backup["network"]=="testnet" && backup["accounts"].as_u32()==Some(1),"invalid backup binding")?;
        let restored=LightClient::new(config(&root,WalletConfig::MnemonicPhrase {
            mnemonic_phrase:backup["seed"].as_str().ok_or("invalid seed record")?.to_owned(),
            no_of_accounts:NonZeroU32::new(1).unwrap(),birthday:backup["birthday"].as_u32().ok_or("invalid birthday")?,
            wallet_settings:settings()
        },false)?,false).await?;
        require(restored.unified_addresses_json().await.dump()==original_addresses,"independent restore mismatch")?;
        require(restored.birthday()==client.birthday(),"birthday mismatch")?;
        drop(restored);
        let (end,scanned)=if online { check_sync(&mut client).await? } else {(0,0)};
        persist(&client,&wallet_path,&recipient).await?;
        let reopened=LightClient::from_bytes(decrypt(&wallet_path,&root)?,config(&root,WalletConfig::Read,false)?).await?;
        require(reopened.unified_addresses_json().await.dump()==original_addresses,"persistence mismatch")?;
        summaries.push(json::object!{ label:label, independentRecovery:true, encryptedReopen:true,
            liveSync:online, height:end, blocksScanned:scanned });
    }
    require(addresses[0]!=addresses[1],"wallets are not independent")?;
    require(!root.join("NEVER_PLAINTEXT").exists(),"unexpected plaintext persistence")?;
    println!("{}",json::object! { network:"testnet", distinctWallets:true, mode:mode.as_str(),
        wallets:summaries, fundingEnabled:false, broadcastEnabled:false }.dump());
    Ok(())
}
#[tokio::main(flavor="multi_thread", worker_threads=2)]
async fn main() {
    // No logger/panic message may serialize a wallet, mnemonic or network response.
    std::panic::set_hook(Box::new(|_| eprintln!("trial aborted; no secret diagnostics emitted")));
    if run().await.is_err() { eprintln!("trial failed; retained encrypted state; no transfer attempted");std::process::exit(1); }
}
