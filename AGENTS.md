# AGENTS.md

Guidance for AI agents (and humans) working on SafeShare.

## What this is

SafeShare is a tiny end-to-end encrypted file-sharing app on Cloudflare Workers.
Files are encrypted in the browser with AES-GCM-256; the symmetric key lives only
in the URL fragment (`#k=...`), which browsers never send to the server. The server
stores only ciphertext (R2) and opaque metadata (KV), plus an optional server-side
password gate (PBKDF2) and a one-time download counter.

## Stack

- Cloudflare Workers (TypeScript), Hono for routing + multipart
- R2 for ciphertext blobs, Workers KV for share metadata (KV TTL auto-expires metadata)
- Biome v2 (lint + format), esbuild -> dist/worker.js, Wrangler v4, npm
- Zero runtime deps beyond Hono. No zod; validation is hand-rolled (matches `reader`).

## Commands

Always run these before considering work done:

```sh
npm install              # first time only
npm run lint             # biome check src + test — must pass
npm run build            # esbuild bundle         — must pass
npm run typecheck        # tsc --noEmit            — must pass
npm test                 # vitest (Workers pool)  — must pass
npm run dev              # local dev on http://localhost:8787
```

Tests use `@cloudflare/vitest-plugin` running in the Workers runtime via
Miniflare. Test files live in `test/` and access bindings via
`import { env } from "cloudflare:workers"`. Reset state between tests with
`import { reset } from "cloudflare:test"`.

## Provisioning bindings (one-time)

```sh
wrangler kv namespace create SHARES        # paste id into wrangler.toml
wrangler r2 bucket create safeshare
wrangler secret put TOKEN_SECRET            # random 32+ byte string
```

Optionally add an R2 bucket lifecycle rule to sweep orphaned ciphertext blobs
(KV metadata auto-expires via TTL; R2 objects for never-accessed shares are the gap):

```sh
wrangler r2 bucket lifecycle add safeshare --prefix "" --expire-days 8
```

## Conventions

- Follow the style already in place. Prefer slightly more verbose, semantic code over terse code.
- Guard clauses and early returns; `is*`/`has*`/`should*` predicate helpers.
- SCREAMING_SNAKE_CASE for module constants, camelCase for functions and variables.
- Typed errors in `src/errors.ts`; user-facing strings in `src/messages.ts` (do not inline them).
- Security headers (`hardenedHeaders`) on every response; strict CSP.
- No comments unless something is genuinely non-self-evident. JSDoc on public functions.
- Never commit secrets. Use `.dev.vars` (gitignored) locally and `wrangler secret` in prod.

## Known limitations (by design, for "tiny")

- KV has no transactions. One-time download is enforced by incrementing `downloadCount`
  in KV before streaming and (for `maxDownloads === 1`) deleting the R2 object after the
  stream. There is a narrow millisecond-level race on concurrent requests; for true
  atomicity, upgrade to D1 (transactional UPDATE ... RETURNING) or a Durable Object.
- Browser SubtleCrypto encrypts the whole plaintext in memory, so E2E uploads are capped
  at MAX_ENCRYPTED_BYTES (100 MB). Larger files would need chunked GCM or plaintext mode.
