"""Bound disk use for the dedicated build; never stop unrelated units."""
import datetime,json,pathlib,shutil,subprocess
root=pathlib.Path('/var/lib/veil-build')
if not root.is_dir() or root.is_symlink():raise SystemExit('Dedicated build directory missing.')
free=shutil.disk_usage(root).free
show=subprocess.check_output(['systemctl','show','veil-build.service','--property=ActiveState,MemoryCurrent,MemoryPeak,MemorySwapCurrent,CPUUsageNSec'],text=True)
record={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'freeBytes':free,'service':dict(line.split('=',1) for line in show.splitlines() if '=' in line)}
path=root/'resource-observations.jsonl'
with path.open('a') as stream:stream.write(json.dumps(record)+'\n')
path.chmod(0o600)
if free<15*1024**3 and record['service'].get('ActiveState') in ['active','activating']:
 subprocess.run(['systemctl','stop','veil-build.service'],check=True)
 print('VEIL build stopped at the disk reserve; inspect the isolated build before retrying.')
else:print('VEIL build resource observation saved.')
