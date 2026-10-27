"""Stage a new isolated managed-wallet release; never starts/enables services.

Operator supplies an exact CI artifact ZIP and its trusted SHA-256, source archive
and trusted hash. No existing wallet, node or website is changed. Run as root.
"""
import hashlib,json,os,pathlib,pwd,secrets,shutil,subprocess,sys,tarfile,uuid,zipfile
def sha(path):
 with open(path,'rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def main():
 assert os.geteuid()==0 and len(sys.argv)==7
 os.umask(0o077)
 source,archive,archive_hash,binaries,binaries_hash,expected_binary=sys.argv[1:]
 assert len(source)==40 and all(c in '0123456789abcdef' for c in source)
 assert sha(archive)==archive_hash and sha(binaries)==binaries_hash
 base=pathlib.Path('/opt/veil-managed');assert not base.exists()
 state=pathlib.Path('/var/lib/veil-managed');assert not state.exists()
 etc=pathlib.Path('/etc/veil-managed');assert not etc.exists()
 for name,home in [('veil-managed',str(state)),('veil-lightwallet','/nonexistent')]:
  try:pwd.getpwnam(name);raise RuntimeError('Account name already allocated; inspect before reuse')
  except KeyError:subprocess.run(['useradd','--system','--user-group','--no-create-home','--home-dir',home,'--shell','/usr/sbin/nologin',name],check=True)
 release=base/'releases'/source;release.mkdir(parents=True,mode=0o755)
 for p in [base,base/'releases',release]:p.chmod(0o755)
 with tarfile.open(archive) as t:
  for member in t.getmembers():
   path=pathlib.PurePosixPath(member.name)
   assert not path.is_absolute() and '..' not in path.parts and (member.isdir() or member.isfile()) and member.size<2*1024*1024
   assert path.parts[0] in ['judging','scanner']
  t.extractall(release,filter='data')
 with zipfile.ZipFile(binaries) as z:
  entry=z.getinfo('veil-managed');assert entry.file_size<200*1024*1024
  assert (entry.external_attr>>16)&0o170000!=0o120000
  (release/'veil-managed').write_bytes(z.read(entry))
 assert sha(release/'veil-managed')==expected_binary
 for path in release.rglob('*'):path.chmod(0o755 if path.is_dir() or path.name=='veil-managed' else 0o644)
 (base/'current').symlink_to(release)
 account=pwd.getpwnam('veil-managed')
 state.mkdir(mode=0o700);os.chown(state,account.pw_uid,account.pw_gid)
 wallets=state/'wallets';wallets.mkdir(mode=0o700);os.chown(wallets,account.pw_uid,account.pw_gid)
 etc.mkdir(mode=0o700);os.chown(etc,account.pw_uid,account.pw_gid)
 config={'enabled':False,'websiteOrigin':'https://ve-il.duckdns.org','token':secrets.token_hex(32),
  'binary':str(base/'current/veil-managed'),'binarySha256':expected_binary,'database':str(state/'journal.sqlite'),
  'walletRoot':str(wallets),'healthFile':'/run/veil-managed-health/current.json','killFile':str(etc/'PAUSED'),
  'policy':{'grant':'200000','maxFee':'20000','daily':'2200000','total':'2200000','maxUsers':10,'treasuryAccount':str(uuid.uuid4())}}
 config_path=etc/'service.json';config_path.write_text(json.dumps(config,indent=2));config_path.chmod(0o600);os.chown(config_path,account.pw_uid,account.pw_gid)
 units=pathlib.Path('/etc/systemd/system')
 service=release/'scanner/zingolib/veil-managed.service'
 shutil.copyfile(service,units/'veil-managed.service')
 bridge=(release/'scanner/zingolib/veil-lightwallet-trial.service').read_text()
 bridge=bridge.replace('veil-zingolib','veil-lightwallet').replace('veil-lightwallet-trial','veil-managed-indexer')
 bridge='\n'.join('ExecStart=/usr/bin/python3 '+str(base/'current/scanner/zingolib/read_only_bridge.py') if line.startswith('ExecStart=') else line for line in bridge.splitlines())+'\n'
 bridge=bridge.replace('[Unit]','[Unit]\nStartLimitIntervalSec=300\nStartLimitBurst=3')
 bridge=bridge.replace('Restart=no','Restart=on-failure\nRestartSec=15').replace('RuntimeMaxSec=1800\n','')
 bridge=bridge.replace('[Service]','[Service]\nEnvironment=VEIL_BRIDGE_RUNTIME=/run/veil-managed-indexer')
 bridge+='\n[Install]\nWantedBy=multi-user.target\n'
 (units/'veil-managed-indexer.service').write_text(bridge)
 (units/'veil-managed-health.service').write_text('[Unit]\nDescription=Export filtered VEIL readiness\n[Service]\nType=oneshot\nExecStart=/usr/bin/python3 '+str(base/'current/scanner/zingolib/managed-health.py')+'\n')
 (units/'veil-managed-health.timer').write_text('[Unit]\nDescription=Refresh filtered VEIL readiness\n[Timer]\nOnBootSec=30\nOnUnitActiveSec=30\n[Install]\nWantedBy=timers.target\n')
 for path in units.glob('veil-managed*'):path.chmod(0o644)
 subprocess.run(['systemd-analyze','verify',str(units/'veil-managed.service'),str(units/'veil-managed-indexer.service'),str(units/'veil-managed-health.service')],check=True)
 subprocess.run(['systemctl','daemon-reload'],check=True)
 (base/'installation.json').write_text(json.dumps({'source':source,'sourceArchiveSha256':archive_hash,'artifactSha256':binaries_hash,'binarySha256':expected_binary,'servicesStarted':False,'enabledAtBoot':False,'websiteChanged':False},indent=2))
 print('Isolated managed release staged. Services and spending remain disabled.')
if __name__=='__main__':main()
