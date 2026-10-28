"""Operator-only installation of exact CI artifacts; no existing service changes.

Place reviewed sources and the two exact artifact ZIPs in /home/ubuntu first.
Run as root once. Starts no service, creates no wallet and enables nothing at boot.
"""
import hashlib,json,os,pathlib,pwd,shutil,subprocess,zipfile

SOURCE='1022a22d01455d44133d90f6d26fe84814e0aae1'
ARTIFACTS={
 'lightwalletd.zip':('dabea2a77b97e0f2ccde58a8043b3abc3891380571d35af22fa10d8b6f0192fe',
    {'lightwalletd','lightwalletd.sha256','lightwalletd-source.txt','lightwalletd-toolchain.txt'}),
 'zingolib.zip':('4e7237bf87617f693dccd3d95e0bde9cc576c03975eaff791c48e2f72a1658fa',
    {'veil-trial','veil-trial.sha256','zingolib-source.txt','zingolib-toolchain.txt','zingolib-lock.sha256','offline-evidence.json'}),
}
def digest(p):
 with open(p,'rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def main():
 assert os.geteuid()==0
 os.umask(0o077)
 base=pathlib.Path('/opt/veil-zingolib-trial')
 release=base/'releases'/SOURCE
 assert not release.exists() and not (base/'current').exists()
 for name,(expected,names) in ARTIFACTS.items():
  path=pathlib.Path('/home/ubuntu')/name
  assert digest(path)==expected
  with zipfile.ZipFile(path) as z:
   assert set(z.namelist())==names and len(z.infolist())==len(names)
   assert sum(e.file_size for e in z.infolist())<100*1024*1024
   assert all((e.external_attr>>16)&0o170000!=0o120000 for e in z.infolist())
 try:
  account=pwd.getpwnam('veil-zingolib')
  assert account.pw_shell=='/usr/sbin/nologin' and account.pw_dir=='/var/lib/veil-zingolib-trial'
 except KeyError:
  subprocess.run(['useradd','--system','--user-group','--no-create-home','--home-dir','/var/lib/veil-zingolib-trial','--shell','/usr/sbin/nologin','veil-zingolib'],check=True)
 account=pwd.getpwnam('veil-zingolib')
 release.mkdir(parents=True,mode=0o755)
 for p in [base,base/'releases',release]:p.chmod(0o755)
 for name in ARTIFACTS:
  with zipfile.ZipFile('/home/ubuntu/'+name) as z:
   for e in z.infolist():
    p=release/e.filename
    with p.open('xb') as out:out.write(z.read(e))
    p.chmod(0o755 if e.filename in ('lightwalletd','veil-trial') else 0o644)
 for binary in ['lightwalletd','veil-trial']:
  assert digest(release/binary)==(release/(binary+'.sha256')).read_text().split()[0]
 assert (release/'lightwalletd-source.txt').read_text().strip()=='e7436d2adb9ab5828eb8a27de534e16218841fc2'
 assert (release/'zingolib-source.txt').read_text().strip()=='bfb0a2156819ea7f75a9b09b1724abfd06c8925e'
 offline=json.loads((release/'offline-evidence.json').read_text())
 assert offline['distinctWallets'] and all(x['independentRecovery'] and x['encryptedReopen'] and not x['liveSync'] for x in offline['wallets'])
 shutil.copyfile('/home/ubuntu/read_only_bridge.py',release/'read_only_bridge.py')
 (release/'read_only_bridge.py').chmod(0o644)
 state=pathlib.Path('/var/lib/veil-zingolib-trial')
 state.mkdir(mode=0o700)
 os.chown(state,account.pw_uid,account.pw_gid)
 (base/'current').symlink_to(release)
 unit=pathlib.Path('/etc/systemd/system/veil-lightwallet-trial.service')
 assert not unit.exists()
 shutil.copyfile('/home/ubuntu/veil-lightwallet-trial.service',unit);unit.chmod(0o644)
 subprocess.run(['systemd-analyze','verify',str(unit)],check=True)
 subprocess.run(['systemctl','daemon-reload'],check=True)
 record={'source':SOURCE,'lightwalletdSha256':digest(release/'lightwalletd'),'walletTrialSha256':digest(release/'veil-trial'),
  'bridgeScriptSha256':digest(release/'read_only_bridge.py'),'serviceSha256':digest(unit),
  'servicesStarted':False,'enabledAtBoot':False,'walletsCreated':False,'existingServicesChanged':False}
 (base/'installation.json').write_text(json.dumps(record,indent=2))
 print(json.dumps(record))
if __name__=='__main__':main()
