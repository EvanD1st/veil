"""Select a hash-verified private source/binary release without changing wallets.

Root only: source tar, tar SHA-256, public binary, binary SHA-256, binary source
commit. Neither the API nor its SDK subprocess may be active during selection.
"""
import hashlib,json,os,pathlib,shutil,subprocess,sys,tarfile
def sha(p):
 with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def main():
 assert os.geteuid()==0 and len(sys.argv)==6
 archive=pathlib.Path(sys.argv[1]);binary=pathlib.Path(sys.argv[3]);binary_source=sys.argv[5]
 assert sha(archive)==sys.argv[2] and sha(binary)==sys.argv[4]
 assert len(binary_source)==40 and all(x in '0123456789abcdef' for x in binary_source)
 st=binary.stat();assert st.st_uid==0 and not st.st_mode&0o022
 for name in ['veil-managed.service','veil-managed-restore.service']:
  assert subprocess.check_output(['systemctl','show',name,'-p','ActiveState','--value'],text=True).strip() not in ['active','activating','deactivating']
 base=pathlib.Path('/opt/veil-managed')
 with tarfile.open(archive) as t:
  source=t.pax_headers['comment'].strip();assert len(source)==40 and all(x in '0123456789abcdef' for x in source)
  dest=base/'releases'/source;assert not dest.exists();dest.mkdir(mode=0o755)
  for member in t.getmembers():
   p=pathlib.PurePosixPath(member.name);assert not p.is_absolute() and '..' not in p.parts and p.parts[0] in ['judging','scanner'] and (member.isdir() or member.isfile()) and member.size<2*1024*1024
  t.extractall(dest,filter='data')
 shutil.copyfile(binary,dest/'veil-managed');assert sha(dest/'veil-managed')==sys.argv[4]
 for p in dest.rglob('*'):p.chmod(0o755 if p.is_dir() or p.name=='veil-managed' else 0o644)
 config=pathlib.Path('/etc/veil-managed/service.json');data=json.loads(config.read_text());assert data['enabled'] is False
 data['binarySha256']=sys.argv[4];config.write_text(json.dumps(data,indent=2));config.chmod(0o600)
 nextlink=base/'next';assert not nextlink.exists();nextlink.symlink_to(dest);nextlink.replace(base/'current')
 shutil.copyfile(dest/'scanner/zingolib/veil-managed.service','/etc/systemd/system/veil-managed.service')
 subprocess.run(['systemd-analyze','verify','/etc/systemd/system/veil-managed.service'],check=True)
 subprocess.run(['systemctl','daemon-reload'],check=True)
 (base/('release-'+source+'.json')).write_text(json.dumps({'source':source,'sourceSha256':sys.argv[2],'binarySha256':sys.argv[4],'binarySource':binary_source,'spendingEnabled':False,'existingWalletChanged':False},indent=2))
 print('Private source selected with verified binary; spending remains disabled.')
if __name__=='__main__':main()
