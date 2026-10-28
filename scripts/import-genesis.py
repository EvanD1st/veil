"""Operator-only, bounded ZIP import. Originals never enter the checkout.

Requires Pillow for full still-image decoding and metadata-free previews.
Usage: python scripts/import-genesis.py ZIP NEW_PRIVATE_DIRECTORY
"""
import hashlib, io, json, os, pathlib, sys, zipfile

SELECTION = [
    ('first-seal', 'The First Seal', '01_The_First_Seal/01b_The_First_Seal_Veil.png'),
    ('cipher-guardian', 'Cipher Guardian', '02_Cipher_Guardian_v2_Swords/02a_The_Sentinel.png'),
    ('golden-flight', 'Golden Flight', '03_Golden_Flight/03a_The_Migration.png'),
    ('silent-orbit', 'Silent Orbit', '04_Silent_Orbit/04a_The_Eclipse.png'),
    ('zec-citadel', 'ZEC Citadel', '05_ZEC_Citadel_v1/05a_The_Pinnacle.png'),
    ('veiled-crown', 'Veiled Crown', '06_Veiled_Crown/06a_The_Sovereign_Throne.png'),
    ('proof-of-light', 'Proof of Light', '07_Proof_of_Light/07a_The_Prismatic_Temple.png'),
    ('hidden-garden', 'The Hidden Garden', '08_The_Hidden_Garden/08a_The_Grand_Courtyard.png'),
    ('shielded-voyager', 'Shielded Voyager', '09_Shielded_Voyager/09a_The_Desert_Trek.png'),
    ('genesis-vault', 'Genesis Vault', '10_Genesis_Vault/10a_The_Astral_Gateway.png'),
]
LICENSE = 'Personal testnet demonstration use only. No exclusivity, copyright transfer or NFT rights.'

def inspect(archive):
    entries = archive.infolist()
    if len(entries) > 200 or len({e.filename for e in entries}) != len(entries):
        raise ValueError('Too many or duplicate archive entries')
    total = 0
    for e in entries:
        p = pathlib.PurePosixPath(e.filename)
        if p.is_absolute() or '..' in p.parts or '\\' in e.filename or ':' in e.filename or '\x00' in e.filename:
            raise ValueError('Unsafe archive path')
        if e.flag_bits & 1 or ((e.external_attr >> 16) & 0o170000) == 0o120000:
            raise ValueError('Encrypted or linked archive entry')
        if e.file_size > 32 * 1024**2 or e.file_size > max(e.compress_size, 1) * 200:
            raise ValueError('Oversized archive entry')
        total += e.file_size
    if total > 128 * 1024**2:
        raise ValueError('Oversized archive')
    return entries

def main():
    from PIL import Image
    source, private = pathlib.Path(sys.argv[1]).resolve(), pathlib.Path(sys.argv[2]).resolve()
    repo = pathlib.Path(__file__).resolve().parent.parent
    if private.is_relative_to(repo):
        raise ValueError('Originals require a NEW private directory outside the repository')
    public = repo / 'public' / 'images' / 'genesis'
    with zipfile.ZipFile(source) as archive:
        entries = inspect(archive)
        private.mkdir(mode=0o700)
        public.mkdir(parents=True, exist_ok=True)
        items, objects = [], []
        for i, (slug, title, relative) in enumerate(SELECTION, 1):
            data = archive.read('02_Cropped_Individual_Artworks/' + relative)
            with Image.open(io.BytesIO(data)) as image:
                if image.format != 'PNG' or getattr(image, 'n_frames', 1) != 1 or image.width * image.height > 4194304:
                    raise ValueError('Expected bounded still PNG')
                image.load()
                width, height = image.size
                preview = image.convert('RGB')
                preview.thumbnail((480, 480), Image.Resampling.LANCZOS)
                # A new pixel-only image discards input metadata/profiles/comments.
                clean = Image.new('RGB', preview.size)
                clean.paste(preview)
                clean.save(public / (slug + '.webp'), 'WEBP', quality=82, method=6)
            fd = os.open(private / (slug + '.png'), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, 'wb') as output:
                output.write(data)
            items.append(dict(slug=slug, title=title, order=i, width=width, height=height,
                              format='png', bytes=len(data), category='Digital Art',
                              previewUrl='/images/genesis/' + slug + '.webp', license=LICENSE,
                              provenance='Artwork supplied by the VEIL operator; no official Zcash endorsement.'))
            objects.append(dict(slug=slug, file=slug + '.png', sha256=hashlib.sha256(data).hexdigest()))
        (repo / 'judging').mkdir(exist_ok=True)
        (repo / 'judging' / 'collection.json').write_text(json.dumps(items, indent=2) + '\n', encoding='utf-8')
        (private / 'import.json').write_text(json.dumps(dict(objects=objects), indent=2), encoding='utf-8')
        os.chmod(private / 'import.json', 0o600)
        print(json.dumps(dict(entries=len(entries), individualImages=sum(e.filename.startswith('02_') for e in entries),
                              selected=len(items), protectedBytes=sum(i['bytes'] for i in items),
                              previewBytes=sum(p.stat().st_size for p in public.glob('*.webp')))))

if __name__ == '__main__':
    main()
