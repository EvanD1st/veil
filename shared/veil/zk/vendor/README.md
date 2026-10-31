# PLONK verifier provenance

`plonk_verify.js` and `Keccak256Transcript.js` come from iden3/snarkjs tag v0.7.6, copyright 0KIMS association, GPL-3.0-or-later. Their headers and complete license are retained. Sources:

- https://github.com/iden3/snarkjs/blob/v0.7.6/src/plonk_verify.js
- https://github.com/iden3/snarkjs/blob/v0.7.6/src/Keccak256Transcript.js

VEIL changes: imports use `curve.js` and @noble/hashes Keccak; absent logger checks are guarded. The verification algebra is retained. `curve.js` supplies canonical BN254 scalar/point parsing, field arithmetic, serialization, root-of-unity tables and pairing equality using @noble/curves, without dynamic WASM. The adapter is VEIL code; the combined verifier is distributed under GPL-3.0-or-later. It is unaudited. A freshly generated auction proof was checked with both this adapter and the unmodified reference verifier; mutation and malformed-point tests fail closed.

The browser runtime in public/zk is the pinned snarkjs npm 0.7.6 minified build. Corresponding upstream source is available at the same tag; package versions and the build script are committed. Do not remove license notices when redistributing.
