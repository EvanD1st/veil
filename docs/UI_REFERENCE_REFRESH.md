# UI reference refresh — 26 October 2026

Branch `ui-reference-refresh` starts from merged main `abc29866499d0d93baefe0578f89abc1e020611e` (PR #17). Its exact main CI run 40359542256 passed. This follow-up adapts the operator-provided `veil_private_auctions_login (1).html` and `veil_sealed_bid_auctions.html` as visual references. It does not deploy or merge a release.

## Adaptation

- Reuse the supplied procedural ivory citadel, gold ribbons/orbs, silk painting, crystal front/back geometry and V/Z seals. Static canvases are bounded and painted once; envelope animation preserves visibility pauses and reduced motion, with fewer envelopes/no flips on phones. Auction hero animation also pauses outside the viewport. Canvas artwork contains no auction/account state.
- Frosted warm glass authentication cards, self-hosted Playfair Display/Inter, inset eye controls, golden submit buttons, clear loading/errors and compact short-screen layouts. Empty initial passwords, paste/password-manager support, confirmation fields and honest recovery copy remain. Signup keeps a compact form-first layout on phones.
- Marketplace typography, sticky ivory navigation with testnet badge, the supplied mystery/fair-result hero, gold actions, bordered cards and procedural Midnight Edition/Golden Spiral/Hidden Identity sample artwork. Samples are guided demos, not real listings, NFT assets or fabricated countdowns. Real cards continue using real seller previews, reserves, deadlines, bid counts and results. Category filters are functional and expose their selected state.
- Keep My bids, My purchases, Seller studio, account username, logout, creation/upload, reveal/proof, canonical payment and protected download controls. No prototype login overlay, simulated authentication, fake bid acknowledgement, invented account or zero-knowledge session toast was imported.
- Remove the prototypes' Tailwind CDN and Google-font runtime requests. Static font binaries include upstream SIL OFL 1.1 licenses and source/hash provenance in `public/fonts/sources.json`. Their filenames accurately distinguish regular/semibold weights. No font install step runs on a deployment host.

## Security and compatibility

Native scrypt credentials, session cookies, CSRF/origin checks, safe return paths, throttling, administrator account lists and independent scanner bearer authentication remain. Only the public `/fonts/` static-asset prefix and `font-src 'self'` are added for authentication font loading; script nonces and other CSP restrictions remain. No schema, dependency, proof-asset, scanner, node/wallet or private-file-storage change is introduced.

This UI inherits the merged digital-delivery implementation. If the live website still predates it, migration 0006 and private-store/eligible-seller setup from DIGITAL_RELEASE.md remain required; merging does not apply them. A new reviewed CI artifact and explicit deployment approval are needed. Do not activate escrow or reuse a legacy payment for digital access. Rollback after new purchases must retain compatible delivery routes, current DB and exact originals.

## Validation

Local typecheck and native authentication/migration regressions are run without a workstation production build. Actual installed desktop Chrome checks the native auth HTML under its CSP: font loading, 14 V/Z envelopes, cursor motion, reduced motion, four mobile envelopes, empty password, password visibility and desktop form fit at 1366x768, 1280x720 and 1024x600. Phone viewport checks are emulation, not a new physical-device result.

Linux CI runs both production builds, unit/scanner/crypto tests, portable browser tests, isolated packaged-native upload/auth/asset checks and the full separate-account digital purchase browser regression (synthetic payment clearly labelled). The updated native browser also checks the supplied hero/artwork, self-hosted fonts and reduced motion. Exact final run links and screenshots belong in the PR after completion. No new hosted payment or physical-phone upload/download validation is implied.
