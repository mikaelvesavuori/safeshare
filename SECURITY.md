# Security Policy

## Supported Versions

These versions of the project are currently being supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 0.x.x   | :white_check_mark: |

## Reporting a Vulnerability

It's unclear to me if any user can add a security advisory report. If you can, do it! Else reach out with a regular issue. Try to limit the amount of detail since the communication is public. I will then reach out so we can have a private conversation. Please prepare proof of the security vulnerability, and ideally a mitigation strategy.

## Security model

SafeShare is end-to-end encrypted: the file's symmetric key lives only in the URL
fragment (`#k=...`), which browsers never transmit to the server. The server stores
only ciphertext and opaque metadata. If you lose the link (including the fragment),
the file is not recoverable by the server operator.

The optional password is a server-side PBKDF2 gate that protects the download endpoint
when the URL itself has leaked. It is independent of the end-to-end encryption.

Known limitation: one-time download enforcement relies on a KV counter increment
performed before streaming. There is a narrow race window under truly concurrent
requests; for true atomicity, a D1 transaction or Durable Object would be required.
