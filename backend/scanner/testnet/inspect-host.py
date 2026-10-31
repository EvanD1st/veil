"""Read-only initial inventory. Run only after AWS host fingerprint verification."""
import json, os, pathlib, platform, shutil, subprocess, urllib.request
result={'os':platform.platform(),'architecture':platform.machine(),'cpus':os.cpu_count(),'release':pathlib.Path('/etc/os-release').read_text(),'memory':pathlib.Path('/proc/meminfo').read_text().splitlines()[:5]}
for name,command in [('disk',['df','-hT','/']),('swap',['swapon','--show','--bytes']),('storage',['lsblk','-o','NAME,SIZE,FSTYPE,MOUNTPOINTS']),('listeners',['ss','-ltn']),('processes',['ps','-eo','user,pid,comm','--sort=-rss'])]:
 result[name]=subprocess.check_output(command,text=True)
result['tools']={name:shutil.which(name) for name in ['git','node','cargo','rustup','cmake','clang','protoc','zallet','zebrad']}
try:
 token=urllib.request.urlopen(urllib.request.Request('http://169.254.169.254/latest/api/token',method='PUT',headers={'X-aws-ec2-metadata-token-ttl-seconds':'60'}),timeout=3).read().decode()
 document=json.loads(urllib.request.urlopen(urllib.request.Request('http://169.254.169.254/latest/dynamic/instance-identity/document',headers={'X-aws-ec2-metadata-token':token}),timeout=3).read())
 result['instance']={k:document.get(k) for k in ['instanceId','instanceType','architecture','region','availabilityZone','pendingTime']}
except Exception:result['instance']='IMDS identity unavailable; confirm in AWS console'
print(json.dumps(result,indent=2))
