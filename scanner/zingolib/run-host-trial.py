"""Bounded operator-only fresh-wallet/restart trial, stopping only trial services.

Usage: sudo python3 run-host-trial.py create|resume
No wallet data or credential is printed. No retries and no broadcasts exist.
"""
import json,os,pathlib,subprocess,sys,time,shutil
ROOT=pathlib.Path('/var/lib/veil-zingolib-trial')
UNITS=['veil-zebra.service','veil-zallet@receiver-v2.service','veil-scanner.service']
def unit(name):
 out=subprocess.check_output(['systemctl','show',name,'-p','ActiveState,SubState,Result,NRestarts,MemoryCurrent,MemoryPeak,ExecMainStatus'],text=True)
 return dict(line.split('=',1) for line in out.splitlines() if '=' in line)
def mem():
 return int(next(line.split()[1] for line in pathlib.Path('/proc/meminfo').read_text().splitlines() if line.startswith('MemAvailable:')))*1024
def health():
 h=json.loads(pathlib.Path('/var/lib/veil-testnet/health.json').read_text())
 assert h.get('ready') and 0<=time.time()*1000-h['observedAt']<600000
 return h
def main():
 assert os.geteuid()==0 and len(sys.argv)==2 and sys.argv[1] in ['create','resume']
 os.umask(0o077);mode=sys.argv[1]
 live=ROOT/'live-trial-20261027'
 assert live.exists()==(mode=='resume')
 assert mem()>=3*1024**3 and shutil.disk_usage(ROOT).free>=15*1024**3
 before={n:unit(n) for n in UNITS};assert all(x['ActiveState']=='active' for x in before.values())
 h=health();assert unit('veil-lightwallet-trial.service')['ActiveState']=='active'
 existing=unit('veil-zingolib-trial.service');assert existing['ActiveState'] in ['inactive','failed']
 # Reset only an ended transient trial unit so a separate explicit restart can be tested.
 subprocess.run(['systemctl','reset-failed','veil-zingolib-trial.service'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 props=['RemainAfterExit=yes','Restart=no','RuntimeMaxSec=600','TimeoutStopSec=20','MemoryHigh=768M','MemoryMax=1024M','MemorySwapMax=64M','CPUQuota=50%','TasksMax=128','UMask=0077','LimitCORE=0','NoNewPrivileges=yes','PrivateTmp=yes','ProtectSystem=strict','ProtectHome=yes','ProtectKernelTunables=yes','ProtectControlGroups=yes','RestrictAddressFamilies=AF_INET AF_UNIX','IPAddressDeny=any','IPAddressAllow=localhost','InaccessiblePaths=/var/lib/veil-testnet /srv','ReadWritePaths='+str(ROOT)]
 command=['systemd-run','--quiet','--unit=veil-zingolib-trial','--service-type=exec','--uid=veil-zingolib','--gid=veil-zingolib']
 for prop in props:command+=['--property='+prop]
 command+=['/opt/veil-zingolib-trial/current/veil-trial',mode,str(live),str(h['height'])]
 subprocess.run(command,check=True)
 started=time.monotonic();minimum=mem();peak=0;aborted=False
 try:
  while time.monotonic()-started<610:
   observed=unit('veil-zingolib-trial.service');available=mem();minimum=min(minimum,available)
   if observed.get('MemoryPeak','').isdigit():peak=max(peak,int(observed['MemoryPeak']))
   now={n:unit(n) for n in UNITS}
   if available<1024**3 or any(now[n]['ActiveState']!='active' or now[n]['NRestarts']!=before[n]['NRestarts'] for n in UNITS):
    raise RuntimeError('existing service or resource guard failed')
   health()
   if observed['ActiveState'] in ['inactive','failed'] or observed['SubState']=='exited':break
   time.sleep(5)
  else:raise RuntimeError('trial exceeded observation deadline')
 except Exception:
  aborted=True
  subprocess.run(['systemctl','stop','veil-zingolib-trial','veil-lightwallet-trial'],check=True)
 observed=unit('veil-zingolib-trial.service')
 evidence={'mode':mode,'seconds':round(time.monotonic()-started,2),'unit':observed,'walletPeakBytes':peak,'minimumMemAvailableBytes':minimum,'aborted':aborted,'existingUnitsBefore':before,'existingUnitsAfter':{n:unit(n) for n in UNITS},'transfersAttempted':False}
 dest=ROOT/(mode+'-evidence-'+str(int(time.time()))+'.json');dest.write_text(json.dumps(evidence,indent=2))
 print(json.dumps(evidence),flush=True)
 subprocess.run(['systemctl','stop','veil-zingolib-trial'],check=True)
 if aborted or observed['Result']!='success' or observed.get('ExecMainStatus')!='0':raise SystemExit(1)
if __name__=='__main__':main()
