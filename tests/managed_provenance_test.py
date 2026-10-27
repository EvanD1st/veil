"""Synthetic binary files only; never reads wallet state or starts services."""
import hashlib
import importlib.util
from pathlib import Path
import tempfile
import unittest

spec=importlib.util.spec_from_file_location('managed_stage',Path(__file__).parents[1]/'scanner/zingolib/stage-managed-release.py')
stage=importlib.util.module_from_spec(spec);spec.loader.exec_module(stage)

class BinarySelection(unittest.TestCase):
    def test_replaces_legacy_executable_and_hash_together(self):
        with tempfile.TemporaryDirectory() as directory:
            binary=Path(directory)/'veil-managed'
            binary.write_bytes(b'synthetic reviewed binary')
            expected=hashlib.sha256(binary.read_bytes()).hexdigest()
            old={'enabled':False,'binary':'/opt/veil-managed/sdk/old/veil-managed','binarySha256':'0'*64,'walletRoot':'unchanged'}
            selected=stage.bind_binary(old,binary,expected)
            self.assertEqual(selected['binary'],str(binary))
            self.assertEqual(stage.sha(Path(selected['binary'])),selected['binarySha256'])
            self.assertEqual(selected['walletRoot'],old['walletRoot'])
            self.assertIs(selected['enabled'],False)
            self.assertEqual(old['binary'],'/opt/veil-managed/sdk/old/veil-managed')

    def test_refuses_tampered_binary_or_active_configuration(self):
        with tempfile.TemporaryDirectory() as directory:
            binary=Path(directory)/'veil-managed';binary.write_bytes(b'synthetic changed binary')
            with self.assertRaises(AssertionError):
                stage.bind_binary({'enabled':False},binary,'0'*64)
            with self.assertRaises(AssertionError):
                stage.bind_binary({'enabled':True},binary,stage.sha(binary))

if __name__=='__main__':unittest.main()
