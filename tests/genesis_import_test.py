import importlib.util, io, pathlib, unittest, zipfile
spec = importlib.util.spec_from_file_location('genesis_import', pathlib.Path(__file__).resolve().parent.parent / 'scripts/import-genesis.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class GenesisArchiveTest(unittest.TestCase):
    def archive(self, name, content=b'bounded fixture', mode=None):
        data = io.BytesIO()
        with zipfile.ZipFile(data, 'w') as z:
            e = zipfile.ZipInfo(name)
            if mode is not None:
                e.external_attr = mode << 16
            z.writestr(e, content)
        data.seek(0)
        archive = zipfile.ZipFile(data)
        archive.infolist()[0].filename = name  # Preserve hostile raw metadata on Windows too.
        return archive

    def test_traversal_windows_paths_symlinks_and_limits(self):
        for name in ['../outside.png', '/absolute.png', 'a/../../outside', 'C:/secrets', 'a\\escape.png']:
            with self.archive(name) as z:
                with self.assertRaises(ValueError): module.inspect(z)
        with self.archive('linked.png', mode=0o120777) as z:
            with self.assertRaises(ValueError): module.inspect(z)
        with self.archive('valid.png') as z:
            self.assertEqual(len(module.inspect(z)), 1)
            z.infolist()[0].file_size = 33 * 1024**2
            with self.assertRaises(ValueError): module.inspect(z)

    def test_exact_selection_excludes_reference_sheets_and_unused_variants(self):
        self.assertEqual(len(module.SELECTION), 10)
        self.assertEqual(module.SELECTION[0][2], '01_The_First_Seal/01b_The_First_Seal_Veil.png')
        self.assertEqual(module.SELECTION[1][2], '02_Cipher_Guardian_v2_Swords/02a_The_Sentinel.png')
        self.assertEqual(module.SELECTION[4][2], '05_ZEC_Citadel_v1/05a_The_Pinnacle.png')
        self.assertTrue(all('Sheet' not in item[2] for item in module.SELECTION))

if __name__ == '__main__': unittest.main()
