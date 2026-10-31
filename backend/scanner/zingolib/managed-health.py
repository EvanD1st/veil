"""Root-owned timer exports only filtered readiness into a separate runtime dir."""
import json,os,pathlib,pwd,shutil
account=pwd.getpwnam('veil-managed')
root=pathlib.Path('/run/veil-managed-health');root.mkdir(mode=0o750,exist_ok=True)
os.chown(root,0,account.pw_gid)
h=json.loads(pathlib.Path('/var/lib/veil-testnet/health.json').read_text())
memory=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
filtered={k:h.get(k) for k in ['ready','observedAt','height','stale']}
filtered.update(memAvailableBytes=memory,diskFreeBytes=shutil.disk_usage('/var/lib').free)
temporary=root/'current.next';temporary.write_text(json.dumps(filtered))
temporary.chmod(0o640);os.chown(temporary,0,account.pw_gid)
temporary.replace(root/'current.json')
