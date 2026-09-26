/**
 * Client-facing UI assets: shared CSS, inline SVG icons, and the browser-side
 * scripts that perform the end-to-end encryption (upload) and decryption (share).
 *
 * All scripts are plain vanilla JS using WebCrypto; they are inlined into the
 * SSR HTML and run with `script-src 'unsafe-inline'`.
 */

import { MAX_ENCRYPTED_BYTES } from "./env.ts";
import { Messages } from "./messages.ts";

/** Shared CSS, themed via CSS custom properties and `data-theme` on `<html>`. */
export function sharedCss(): string {
  return `
:root {
  --bg: #0b0d10;
  --surface: #14181d;
  --surface-2: #1b2128;
  --ink: #e8edf2;
  --muted: #8b97a3;
  --line: #232a33;
  --accent: #3b82f6;
  --accent-ink: #ffffff;
  --danger: #ef4444;
  --ok: #10b981;
  --radius: 12px;
  --mono: "SF Mono", ui-monospace, "Cascadia Code", "JetBrains Mono", monospace;
  --sans: -apple-system, "SF Pro Text", "Avenir Next", "Segoe UI", system-ui, sans-serif;
  --select-arrow: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238b97a3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
}

html[data-theme="light"] {
  --bg: #f6f7f9;
  --surface: #ffffff;
  --surface-2: #eef0f3;
  --ink: #1a1f26;
  --muted: #5b6573;
  --line: #dfe3e8;
  --accent: #2563eb;
  --accent-ink: #ffffff;
  --danger: #dc2626;
  --ok: #059669;
  --select-arrow: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%235b6573' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
}

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--bg);
  color: var(--ink);
  font-family: var(--sans);
  font-size: 16px;
  line-height: 1.5;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
main {
  width: 100%;
  max-width: 460px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 28px 24px;
}
h1 { font-size: 1.25rem; margin: 0 0 4px; }
.muted { color: var(--muted); font-size: 0.875rem; margin: 0 0 20px; }
label { display: block; font-size: 0.8rem; color: var(--muted); margin: 14px 0 6px; }
input[type="text"], input[type="password"], input[type="number"], select {
  width: 100%;
  padding: 10px 12px;
  background: var(--surface-2);
  color: var(--ink);
  border: 1px solid var(--line);
  border-radius: 8px;
  font-size: 0.95rem;
  font-family: var(--sans);
  line-height: 1.5;
}
select {
  -webkit-appearance: none;
  appearance: none;
  background-image: var(--select-arrow);
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 32px;
}
input[type="file"] { width: 100%; padding: 10px; background: var(--surface-2); border: 1px dashed var(--line); border-radius: 8px; color: var(--muted); }
button, .btn {
  width: 100%;
  padding: 12px;
  margin-top: 18px;
  background: var(--accent);
  color: var(--accent-ink);
  border: none;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
}
button:disabled { opacity: 0.6; cursor: default; }
button.ghost { background: transparent; color: var(--muted); border: 1px solid var(--line); }
.row { display: flex; gap: 12px; }
.row > div { flex: 1; }
#status { color: var(--muted); font-size: 0.85rem; margin-top: 14px; }
.checkbox-row { display: flex; align-items: center; gap: 8px; margin: 14px 0 4px; font-size: 0.85rem; cursor: pointer; }
.checkbox-row input { width: auto; margin: 0; }
.notice { color: var(--muted); font-size: 0.78rem; margin: 6px 0 0; line-height: 1.4; }
.meta { display: flex; flex-direction: column; gap: 6px; margin: 16px 0; }
.meta .name { font-weight: 600; word-break: break-all; }
.meta .pill { display: inline-block; font-size: 0.75rem; color: var(--muted); background: var(--surface-2); border: 1px solid var(--line); padding: 3px 9px; border-radius: 999px; margin-right: 6px; }
.linkbox { display: flex; gap: 8px; margin-top: 14px; }
.linkbox input { flex: 1; font-family: var(--mono); font-size: 0.8rem; }
.linkbox button { width: auto; margin: 0; padding: 10px 14px; }
.err { color: var(--danger); }
.ok { color: var(--ok); }
.theme-toggle { position: fixed; top: 16px; right: 16px; background: var(--surface-2); border: 1px solid var(--line); color: var(--muted); width: auto; margin: 0; padding: 8px; border-radius: 999px; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 0; }
.theme-toggle .icon-sun { display: none; }
.theme-toggle .icon-moon { display: inline; }
html[data-theme="light"] .theme-toggle .icon-sun { display: inline; }
html[data-theme="light"] .theme-toggle .icon-moon { display: none; }
a { color: var(--accent); }
@media (max-width: 520px) { body { padding: 12px; } main { padding: 22px 16px; } }
`.trim();
}

/** Inline SVG icons (no icon library, no external assets). */
export function moonIconSvg(): string {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
}

export function sunIconSvg(): string {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
}

export function lockIconSvg(): string {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
}

export function downloadIconSvg(): string {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
}

/**
 * Browser script for the landing/upload page: generates an AES-GCM-256 key,
 * encrypts the file and its metadata, and POSTs only ciphertext to the server.
 */
export function landingScript(): string {
  return `
(function () {
  var MAX_BYTES = ${MAX_ENCRYPTED_BYTES};
  var form = document.getElementById('uploadForm');
  var fileInput = document.getElementById('fileInput');
  var passwordInput = document.getElementById('passwordInput');
  var uploadTokenInput = document.getElementById('uploadTokenInput');
  var maxDownloadsInput = document.getElementById('maxDownloadsInput');
  var expiresInInput = document.getElementById('expiresInInput');
  var shortUrlInput = document.getElementById('shortUrlInput');
  var shortUrlNotice = document.getElementById('shortUrlNotice');
  var statusEl = document.getElementById('status');
  var resultEl = document.getElementById('result');
  var linkInput = document.getElementById('shareLink');
  var copyBtn = document.getElementById('copyBtn');
  var anotherBtn = document.getElementById('anotherBtn');

  function setStatus(msg, cls) {
    statusEl.textContent = msg || '';
    statusEl.className = cls || '';
  }
  function bytesToB64(bytes) {
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function bytesToB64Url(bytes) {
    return bytesToB64(bytes).replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');
  }

  shortUrlInput.addEventListener('change', function () {
    shortUrlNotice.style.display = shortUrlInput.checked ? '' : 'none';
  });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var file = fileInput.files[0];
    if (!file) return setStatus('Please choose a file.', 'err');
    if (file.size > MAX_BYTES) return setStatus('File is too large (max 100 MB).', 'err');

    try {
      setStatus('Encrypting…');
      var key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
      var iv = crypto.getRandomValues(new Uint8Array(12));
      var fileBuf = await file.arrayBuffer();
      var cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, fileBuf);
      var metaIv = crypto.getRandomValues(new Uint8Array(12));
      var meta = JSON.stringify({ name: file.name, type: file.type });
      var metaBuf = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: metaIv }, key, new TextEncoder().encode(meta)
      );
      var rawKey = await crypto.subtle.exportKey('raw', key);
      var keyStr = bytesToB64Url(new Uint8Array(rawKey));

      setStatus('Uploading…');
      var fd = new FormData();
      fd.append('file', new Blob([cipherBuf]));
      fd.append('iv', bytesToB64(iv));
      fd.append('meta', new Blob([metaBuf]));
      fd.append('metaIv', bytesToB64(metaIv));
      fd.append('size', String(file.size));
      if (passwordInput.value) fd.append('password', passwordInput.value);
      fd.append('maxDownloads', maxDownloadsInput.value || '1');
      fd.append('expiresIn', expiresInInput.value);
      if (shortUrlInput.checked) fd.append('key', keyStr);

      var res = await fetch('/api/upload', {
        method: 'POST',
        body: fd,
        headers: { 'x-upload-token': uploadTokenInput.value },
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok || !data.url) return setStatus(data.message || 'Upload failed.', 'err');
      var fullUrl = data.shortUrl ? data.url : data.url + '#k=' + keyStr;

      form.style.display = 'none';
      resultEl.style.display = '';
      linkInput.value = fullUrl;
      var msg = data.shortUrl
        ? 'Your short link is ready. Anyone with the 8-character URL can open it.'
        : 'Your share link is ready. The key is in the link after #.';
      setStatus(msg, 'ok');
    } catch (err) {
      setStatus('Error: ' + (err && err.message ? err.message : 'unknown'), 'err');
    }
  });

  copyBtn.addEventListener('click', function () {
    linkInput.select();
    linkInput.setSelectionRange(0, 99999);
    function done() {
      copyBtn.textContent = 'Copied!';
      setTimeout(function () { copyBtn.textContent = 'Copy link'; }, 1500);
    }
    function fallback() {
      try { document.execCommand('copy'); done(); } catch (e) {}
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(linkInput.value).then(done, fallback);
    } else {
      fallback();
    }
  });

  anotherBtn.addEventListener('click', function () { location.reload(); });

  var toggle = document.getElementById('themeToggle');
  toggle.addEventListener('click', function () {
    var cur = document.documentElement.getAttribute('data-theme');
    document.documentElement.setAttribute('data-theme', cur === 'dark' ? 'light' : 'dark');
    try { localStorage.setItem('safeshare-theme', document.documentElement.getAttribute('data-theme')); } catch (e) {}
  });
})();
`.trim();
}

/**
 * Browser script for the share page: reads the key from the URL fragment or
 * a server-stored data attribute (short-URL mode), decrypts the inline metadata
 * to reveal the filename, handles the optional password gate, and fetches +
 * decrypts the ciphertext on download.
 */
export function shareScript(): string {
  return `
(function () {
  var keyStr = location.hash.startsWith('#k=') ? location.hash.slice(3) : null;
  var html = document.documentElement;
  var shareId = html.getAttribute('data-share-id');
  var metaCipher = html.getAttribute('data-meta-cipher');
  var metaIv = html.getAttribute('data-meta-iv');
  var fileIv = html.getAttribute('data-file-iv');
  var hasPassword = html.getAttribute('data-has-password') === '1';
  var storedKey = html.getAttribute('data-key');
  if (storedKey && !keyStr) keyStr = storedKey;

  var nameEl = document.getElementById('fileName');
  var passwordForm = document.getElementById('passwordForm');
  var downloadBtn = document.getElementById('downloadBtn');
  var statusEl = document.getElementById('status');

  function setStatus(msg, cls) {
    statusEl.textContent = msg || '';
    statusEl.className = cls || '';
  }
  function b64ToBytes(b64) {
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  function b64UrlToBytes(s) {
    var b = s.replace(/-/g, '+').replace(/_/g, '/');
    b += '='.repeat((4 - (b.length % 4)) % 4);
    return b64ToBytes(b);
  }

  var keyPromise = null;
  function getKey() {
    if (keyPromise) return keyPromise;
    if (!keyStr) { keyPromise = Promise.reject(new Error('no-key')); return keyPromise; }
    keyPromise = crypto.subtle.importKey('raw', b64UrlToBytes(keyStr), { name: 'AES-GCM' }, false, ['decrypt']);
    return keyPromise;
  }

  (async function decryptMeta() {
    if (!keyStr) { nameEl.textContent = '${Messages.SHARE_ENCRYPTED_NAME}'; setStatus('${Messages.ERROR_NO_KEY}', 'err'); return; }
    try {
      var key = await getKey();
      var plain = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: b64ToBytes(metaIv) }, key, b64ToBytes(metaCipher)
      );
      var meta = JSON.parse(new TextDecoder().decode(plain));
      nameEl.textContent = meta.name || 'file';
    } catch (e) {
      nameEl.textContent = '${Messages.SHARE_ENCRYPTED_NAME}';
      setStatus('Could not decrypt the file name. The link may be incomplete.', 'err');
    }
  })();

  var authToken = null;

  if (hasPassword) {
    passwordForm.style.display = '';
    downloadBtn.style.display = 'none';
    passwordForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var pw = document.getElementById('pwInput').value;
      if (!pw) return;
      setStatus('Verifying…');
      try {
        var res = await fetch('/' + shareId + '/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: pw })
        });
        var data = await res.json().catch(function () { return {}; });
        if (!res.ok || !data.token) return setStatus('${Messages.SHARE_PASSWORD_WRONG}', 'err');
        authToken = data.token;
        passwordForm.style.display = 'none';
        downloadBtn.style.display = '';
        setStatus('');
      } catch (err) {
        setStatus('Error verifying password.', 'err');
      }
    });
  } else {
    if (passwordForm) passwordForm.style.display = 'none';
    downloadBtn.style.display = '';
  }

  downloadBtn.addEventListener('click', async function () {
    downloadBtn.disabled = true;
    if (!keyStr) { setStatus('${Messages.ERROR_NO_KEY}', 'err'); downloadBtn.disabled = false; return; }
    setStatus('${Messages.SHARE_DOWNLOADING}');
    try {
      var url = '/' + shareId + '/download';
      if (authToken) url += '?token=' + encodeURIComponent(authToken);
      var res = await fetch(url);
      if (!res.ok) {
        var data = await res.json().catch(function () { return {}; });
        setStatus(data.message || ('Download failed (' + res.status + ').'), 'err');
        downloadBtn.disabled = false;
        return;
      }
      var cipherBuf = await res.arrayBuffer();
      var key = await getKey();
      var plainBuf = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: b64ToBytes(fileIv) }, key, cipherBuf
      );
      var blob = new Blob([plainBuf]);
      var meta = nameEl.textContent || 'file';
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = meta;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      setStatus('Done.', 'ok');
    } catch (err) {
      setStatus('Could not decrypt the file. The link may be invalid.', 'err');
      downloadBtn.disabled = false;
    }
  });

  var toggle = document.getElementById('themeToggle');
  toggle.addEventListener('click', function () {
    var cur = document.documentElement.getAttribute('data-theme');
    document.documentElement.setAttribute('data-theme', cur === 'dark' ? 'light' : 'dark');
    try { localStorage.setItem('safeshare-theme', document.documentElement.getAttribute('data-theme')); } catch (e) {}
  });
})();
`.trim();
}
