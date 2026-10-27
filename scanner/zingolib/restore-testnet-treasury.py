"""One isolated read-only restore of the already backed-up TESTNET sender.

No service is enabled at boot, no transfer is prepared/broadcast, and the source
wallet stays stopped. Recovery words exist only in private process memory/pipes.
"""
import hashlib,json,os,pathlib,socket,sqlite3,subprocess,time,tomllib,uuid
def unit(name):
 out=subprocess.check_output(['systemctl','show',name,'-p','ActiveState,NRestarts,Result,MemoryPeak'],text=True)
 return dict(x.split('=',1) for x in out.splitlines() if '=' in x)
def available():
 return int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
def digest(path):
 with path.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def main():
 assert os.geteuid()==0;os.umask(0o077)
 root=pathlib.Path('/var/lib/veil-managed');config=json.loads(pathlib.Path('/etc/veil-managed/service.json').read_text())
 original=pathlib.Path('/var/lib/veil-testnet/sender')
 assert tomllib.loads((original/'zallet.toml').read_text())['consensus']['network']=='test'
 assert unit('veil-zallet@sender.service')['ActiveState']=='inactive'
 assert available()>=2684354560
 units=['veil-zebra.service','veil-zallet@receiver-v2.service','veil-scanner.service']
 before={n:unit(n) for n in units};assert all(x['ActiveState']=='active' for x in before.values())
 c=sqlite3.connect('file:'+str(original/'wallet.db')+'?mode=ro',uri=True)
 assert c.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
 rows=c.execute('SELECT uuid,birthday_height,hd_account_index,has_spend_key FROM accounts').fetchall()
 assert len(rows)==1 and rows[0][2:]==(0,1)
 account,birthday,_,_=rows[0]
 backup=root/'original-sender-before-restore.sqlite'
 if backup.exists():
  old=sqlite3.connect('file:'+str(backup)+'?mode=ro',uri=True)
  assert old.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
  assert old.execute('SELECT uuid,birthday_height,hd_account_index,has_spend_key FROM accounts').fetchall()==rows
  old.close()
 else:
  dest=sqlite3.connect(backup);c.backup(dest);dest.close();backup.chmod(0o600)
 c.close()
 source_hash=digest(original/'wallet.db')
 exported=subprocess.run(['/opt/veil-testnet/current/bin/zallet','-d',str(original),'export-mnemonic','--armor',str(uuid.UUID(bytes=account))],capture_output=True,timeout=30,check=True)
 decoded=subprocess.run(['/usr/bin/age','-d','-i',str(original/'encryption-identity.txt')],input=exported.stdout,capture_output=True,timeout=15,check=True)
 seed=decoded.stdout.decode().strip();assert len(seed.split()) in [12,15,18,21,24]
 target=pathlib.Path(config['walletRoot'])/config['policy']['treasuryAccount'];assert not target.exists()
 subprocess.run(['systemctl','start','veil-managed-health.service','veil-managed-indexer.service'],check=True)
 for _ in range(30):
  with socket.socket() as sock:
   sock.settimeout(1)
   if sock.connect_ex(('127.0.0.1',19067))==0:break
  time.sleep(1)
 else:raise RuntimeError('Private indexer did not become available')
 h=json.loads(pathlib.Path('/run/veil-managed-health/current.json').read_text());assert h['ready'] and 0<=time.time()*1000-h['observedAt']<600000
 props=['RuntimeMaxSec=420','TimeoutStopSec=20','MemoryHigh=1152M','MemoryMax=1408M','MemorySwapMax=128M','CPUQuota=50%','TasksMax=128','UMask=0077','LimitCORE=0','NoNewPrivileges=yes','PrivateTmp=yes','ProtectSystem=strict','ProtectHome=yes','IPAddressDeny=any','IPAddressAllow=localhost','InaccessiblePaths=/var/lib/veil-testnet /srv','ReadWritePaths='+str(root)]
 command=['systemd-run','--quiet','--pipe','--wait','--unit=veil-managed-restore','--service-type=exec','--uid=veil-managed','--gid=veil-managed']
 for p in props:command+=['--property='+p]
 command+=['/opt/veil-managed/current/veil-managed','restore',str(target),str(h['height'])]
 started=time.monotonic();child=subprocess.Popen(command,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 payload=json.dumps({'network':'testnet','seed':seed,'birthday':birthday}).encode();del seed,decoded,exported
 child.stdin.write(payload);child.stdin.close();del payload
 minimum=available();peak=0;aborted=False
 while child.poll() is None:
  minimum=min(minimum,available());state=unit('veil-managed-restore.service');peak=max(peak,int(state.get('MemoryPeak','0')) if state.get('MemoryPeak','').isdigit() else 0)
  if minimum<1024**3 or any(unit(n)['ActiveState']!='active' or unit(n)['NRestarts']!=before[n]['NRestarts'] for n in units):
   aborted=True;subprocess.run(['systemctl','stop','veil-managed-restore.service'],check=True)
  time.sleep(5)
 raw=child.stdout.read();child.stderr.read();result=json.loads(raw) if child.returncode==0 else None
 after={n:unit(n) for n in units}
 evidence={'seconds':round(time.monotonic()-started,2),'exitCode':child.returncode,'aborted':aborted,'peakBytes':peak,'minimumMemAvailableBytes':minimum,'sourceWalletPreserved':source_hash==digest(original/'wallet.db'),'sourceBirthday':birthday,'existingBefore':before,'existingAfter':after,'fundsMoved':False,'result':result}
 (root/'funded-restore-evidence.json').write_text(json.dumps(evidence,indent=2))
 print(json.dumps({k:v for k,v in evidence.items() if k not in ['existingBefore','existingAfter','result']}))
 if result:print(json.dumps({k:result.get(k) for k in ['network','height','confirmed','synchronized','independentRecovery']}))
 if child.returncode or aborted:raise SystemExit(1)
if __name__=='__main__':
 try:main()
 except Exception:print('Private treasury restore failed; retained state requires inspection. No transfer attempted.');raise SystemExit(1)
