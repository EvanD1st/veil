import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { QUICKNET } = require('../.sites-runtime/test-build/lib/veil/core.js');
const fixture = JSON.parse(await readFile('tests/fixtures/quicknet-1000.json', 'utf8'));
const directory = 'dist/client/_next/static/chunks';
const filename = (await readdir(directory)).find(name => /^tlock-js-.*\.js$/.test(name));
assert.ok(filename, 'Build the production bundle before testing it.');
// Exercise the bundled browser branch without starting a browser or preview server.
// The externalized Node crypto module must never be used by this branch.
globalThis.window = { crypto: globalThis.crypto };
globalThis.fetch = async () => Response.json(fixture);
const imported = await import(pathToFileURL(resolve(directory, filename)).href);
const tlock = imported.default ?? imported;
const client = new tlock.HttpChainClient({ baseUrl: 'https://fixture.invalid', info: async () => QUICKNET }, { disableBeaconVerification: false, noCache: false, chainVerificationParams: { chainHash: QUICKNET.hash, publicKey: QUICKNET.public_key } });
const ciphertext = await tlock.timelockEncrypt(1000, tlock.Buffer.from('VEIL production bundle check'), client);
const plaintext = await tlock.timelockDecrypt(ciphertext, client);
assert.equal(plaintext.toString('utf8'), 'VEIL production bundle check');
console.log('Production crypto bundle: browser WebCrypto path, encryption, signature verification and decryption passed.');
