# Native username/password accounts

This applies to the Ubuntu website, not the separate Sites gateway. Anonymous browser pages redirect to `/login`; `/signup` publicly creates an ordinary account and signs it in. `/logout` requires a same-origin POST, revokes the session and returns to `/login`. Legacy sign-in/out paths remain compatible aliases. Authenticated login/signup pages return to `/`. Valid same-origin relative destinations survive login/signup; external, control-character and authentication-loop destinations fall back to `/`.

Usernames are lowercased and must contain 3–40 ASCII letters/numbers/dots/underscores/hyphens, beginning with a letter or number. SQLite's existing unique constraint arbitrates concurrent signups. Passwords remain case-sensitive and must contain 14–128 JavaScript string characters under the existing policy; they are never truncated. Confirmation is checked on the server. Existing scrypt parameters, salts, account IDs, password hashes, twelve-hour hashed sessions and secure cookie settings are retained. Signup inserts the account and fresh session in one transaction after hashing. Existing sessions remain compatible.

There is no email provider, social login, self-service password reset or reset link. Keep credentials safe. Operator account creation remains supported; it does not overwrite an existing account or recover an unknown password.

## Administrator account list

The server operator can always list metadata using the private operator command:

```sh
sudo -u veil /srv/veil/runtime/bin/node /srv/veil/current/runtime/admin.mjs accounts /srv/veil/shared/veil.sqlite
# Continue a page using its nextAfter username:
sudo -u veil /srv/veil/runtime/bin/node /srv/veil/current/runtime/admin.mjs accounts /srv/veil/shared/veil.sqlite LAST_USERNAME
```

Each page contains at most 50 account IDs, usernames, creation timestamps and disabled status. Password hashes, salts, session tokens and payment records are excluded. Treat the output as private operator data.

For the web list, set `VEIL_ADMIN_ACCOUNT_IDS` to a comma-separated allowlist of existing account IDs in the private native runtime environment, then use `/admin/accounts` in that administrator's ordinary session. IDs must be explicitly selected by the operator; do not select the first signup, infer ownership from a username, or accept a public role flag. The allowlist is limited to 100 IDs. No configured IDs means no web administrator access; the private CLI remains available. The page is paginated and never grants auction ownership, payment access or bidding exceptions. Disabled accounts cannot administer. Changes to the live allowlist require reviewed deployment/configuration approval.

## Abuse and request boundaries

Signup permits at most 30 attempts per ten-minute window per server process, including invalid/duplicate submissions, and shares a two-scrypt-operation concurrency limit with login. This conservative global bound works behind the existing reverse proxy without trusting spoofable client-IP headers. It can temporarily limit legitimate registration during abuse; it is not a distributed abuse-prevention service. Restart resets process-local windows. Login retains its five-attempt username window, ten-minute expiry and bounded 200-entry tracking map. Form bodies are capped at 8 KiB; repeated/unexpected fields and privilege flags are rejected.

Browser redirects do not apply to API routes. Auction API JSON authentication/authorization and scanner bearer-token validation remain independent. Only public images, compiled assets and public proof artifacts are exempt from browser entry gating. Production local-test identity hooks remain excluded. Forms use nonce-scoped script CSP, same-origin POST/origin checks and no-store responses; password manager/paste support, visibility controls and pending-submit guards are progressive enhancements.

## Release and rollback

No schema migration is required: existing native account/session tables and auction ownership associations are reused. Build/test the exact commit in CI, verify its release archive/provenance and stage a new isolated directory. Before approved activation, save a fresh consistent SQLite backup with integrity check, current release link and private environment backup. Review optional admin IDs separately; never install credentials in source or artifacts.

Only after final approval: briefly stop VEIL, take its final consistent backup, apply the reviewed private admin allowlist if selected, switch the release link, start VEIL and verify anonymous `/login`, public signup, existing-account login, logout revocation, APIs, administrator listing and proof assets. Keep Mintly, Smart Attendance, node/wallet services and scanner configuration unchanged.

Rollback is a code/config switch to the prior release with VEIL briefly stopped. The schema is unchanged, so retain the current database and all accounts/auctions created since deployment; the older native runtime can authenticate newly registered accounts. Do not restore an older database over new writes as routine rollback. Preserve the backup for diagnosed corruption/operator-reviewed recovery only. This task does not deploy or merge.
