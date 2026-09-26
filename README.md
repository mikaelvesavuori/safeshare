# SafeShare

[![CI](https://github.com/mikaelvesavuori/safeshare/actions/workflows/ci.yml/badge.svg)](https://github.com/mikaelvesavuori/safeshare/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Tiny end-to-end encrypted file sharing on Cloudflare Workers. Files are encrypted in
the browser with AES-GCM-256; by default the key lives only in the URL fragment, which
the server never sees. One-time downloads, optional passwords, short URLs, automatic
expiry.

Inspired by [Wormhole.app](https://wormhole.app) and [1time.io](https://1time.io), built small and self-hostable.

## How it works

1. **Upload** — your browser generates an AES-GCM-256 key, encrypts the file and its
   metadata, and sends only ciphertext to the server. The server stores the ciphertext
   in R2 and opaque metadata in Workers KV, then returns a URL.
2. **Share** — by default the decryption key is appended to the URL as a fragment
   (`#k=...`). Browsers never send fragments to the server, so the server cannot decrypt
   your file. The full URL is long because it carries the key.
3. **Download** — the recipient opens the link, the page decrypts the metadata locally
   to reveal the filename, and on request fetches the ciphertext and decrypts it in the
   browser. An optional password is a server-side PBKDF2 gate for when the URL leaks.

There is a **short-URL mode** for when the full link is impractical: the key is stored
on the server (in KV) and the link is an 8-character slug. This is **not end-to-end
encrypted** — a server compromise can decrypt the file. Pair it with a password and
one-time download to limit exposure. Use it only when convenience matters more than E2E.

## Features

- End-to-end encryption (AES-GCM-256) — server stores only ciphertext (full-URL mode)
- Optional short URLs (8-char slug) — convenience over E2E; key stored server-side, pair with a password
- One-time downloads (best-effort atomicity; see Limits)
- Optional password gate (PBKDF2 via WebCrypto)
- Automatic expiry via KV TTL (1 hour / 1 day / 7 days / never)
- Hardened security headers and strict CSP on every response
- Runs entirely on the Cloudflare free tier

## Threat model

SafeShare protects against:

- **Server compromise of stored data** (full-URL mode) — only ciphertext and opaque
  metadata are stored; the key lives in the URL fragment, never on the server.
- **URL interception in transit** — TLS terminates the request, and the fragment never
  leaves the browser, so the key is not logged by proxies or the origin.
- **Casual URL leak** — optional one-time downloads delete the blob after first fetch,
  and optional password gates add a server-side PBKDF2 challenge.

SafeShare does **not** protect against:

- **Server compromise in short-URL mode** — the key is stored in KV, so a compromised
  server (or a server-side breach) can decrypt the file. A password limits this to
  attackers who also have the password.
- **A malicious or compromised recipient** — once decrypted, the plaintext is in their
  browser; they can copy, screenshot, or exfiltrate it.
- **Phishing of the recipient** — an attacker who tricks the recipient into entering the
  password on a lookalike page can capture it.
- **Active server-side tampering during delivery** — the HTML/JS is served by the worker;
  a compromised worker could ship malicious JS. Subresource integrity or a browser
  extension pinning the bundle would mitigate this (not included).

## Quick start

```sh
npm install

# One-time provisioning
cp wrangler.example.toml wrangler.toml      # then paste your KV id into it
wrangler kv namespace create SHARES        # paste the id into wrangler.toml
wrangler r2 bucket create safeshare
wrangler secret put TOKEN_SECRET            # any random 32+ byte string

# Local dev (copy .dev.vars.example to .dev.vars first)
npm run dev

# Deploy
npm run deploy
```

## Development

```sh
npm run lint          # biome check src + test
npm run typecheck     # tsc --noEmit
npm run build         # esbuild bundle to dist/worker.js
npm test              # vitest (Workers runtime via Miniflare)
npm run dev           # local dev on http://localhost:8787
```

## Limits

- E2E uploads are capped at 100 MB (browser SubtleCrypto buffers the whole plaintext).
- One-time download is a KV counter increment performed before streaming. There is a
  narrow millisecond race under truly concurrent requests. For mathematical atomicity,
  upgrade to D1 or a Durable Object.
- KV metadata auto-expires via TTL. Orphaned R2 blobs from never-accessed shares are the
  gap; add an R2 lifecycle rule to sweep them:
  `wrangler r2 bucket lifecycle add safeshare --prefix "" --expire-days 8`

## Configuration

| Binding | Purpose |
| --- | --- |
| `SHARES` (KV) | Share metadata; entries carry a TTL matching their expiry |
| `BUCKET` (R2) | Ciphertext blobs |
| `TOKEN_SECRET` (secret) | HMAC key for short-lived download capability tokens |
| `UPLOAD_TOKEN` (optional secret) | If set, `POST /api/upload` requires it in `x-upload-token` |

## Contributing

PRs welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) and the
[Code of Conduct](CODE_OF_CONDUCT.md). Report security issues via
[SECURITY.md](SECURITY.md), not public issues.

## License

[MIT](LICENSE)
