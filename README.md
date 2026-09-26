# SafeShare

Tiny end-to-end encrypted file sharing on Cloudflare Workers. Files are encrypted in
the browser with AES-GCM-256; the key lives only in the URL fragment, which the server
never sees. One-time downloads, optional passwords, short URLs, automatic expiry.

Inspired by Wormhole.app and 1time.io, built small and self-hostable.

## How it works

1. **Upload** — your browser generates an AES-GCM-256 key, encrypts the file and its
   metadata, and sends only ciphertext to the server. The server stores the ciphertext
   in R2 and opaque metadata in Workers KV, then returns a short URL.
2. **Share** — the decryption key is appended to the URL as a fragment (`#k=...`).
   Browsers never send fragments to the server, so the server cannot decrypt your file.
3. **Download** — the recipient opens the link, the page decrypts the metadata locally
   to reveal the filename, and on request fetches the ciphertext and decrypts it in the
   browser. An optional password is a server-side PBKDF2 gate for when the URL leaks.

## Features

- End-to-end encryption (AES-GCM-256) — server stores only ciphertext
- One-time downloads (best-effort atomicity; see Limitations)
- Optional password gate (PBKDF2 via WebCrypto)
- Short, unguessable URLs (`crypto.getRandomValues`, ~50 bits)
- Automatic expiry via KV TTL (1 hour / 1 day / 7 days / never)
- Hardened security headers and strict CSP on every response
- Runs entirely on the Cloudflare free tier

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

## License

MIT
