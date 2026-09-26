/**
 * Server-rendered HTML for the landing, share, and expired pages.
 *
 * Pages are plain HTML strings styled with `sharedCss()` and run the inline
 * browser scripts from `ui.ts`. All user-controlled values are escaped.
 */

import type { ShareRecord } from "./kv.ts";
import { hasDownloadsRemaining, isExpired } from "./kv.ts";
import { Messages } from "./messages.ts";
import {
  downloadIconSvg,
  landingScript,
  moonIconSvg,
  sharedCss,
  shareScript,
  sunIconSvg,
} from "./ui.ts";

/** Escape a string for safe interpolation into HTML text content. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escape a value for safe use inside a double-quoted HTML attribute. */
function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** Format a byte count into a human-readable size string. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** Format a share's remaining expiry into a friendly label. */
export function formatExpiryLabel(record: ShareRecord): string {
  if (record.expiresAt === null) return Messages.SHARE_EXPIRES_NEVER;
  const remainingMs = Date.parse(record.expiresAt) - Date.now();
  if (remainingMs <= 0) return "expired";
  const minutes = Math.round(remainingMs / 60_000);
  const hours = Math.round(remainingMs / 3_600_000);
  const days = Math.round(remainingMs / 86_400_000);
  if (minutes < 60) return Messages.SHARE_EXPIRES_IN(`${minutes}m`);
  if (hours < 24) return Messages.SHARE_EXPIRES_IN(`${hours}h`);
  return Messages.SHARE_EXPIRES_IN(`${days}d`);
}

/** Inline script that applies the stored theme before first paint (no FOUC). */
function themeBootstrap(): string {
  return `
(function () {
  try {
    var t = localStorage.getItem('safeshare-theme');
    if (t !== 'light' && t !== 'dark') t = 'dark';
    document.documentElement.setAttribute('data-theme', t);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`.trim();
}

/** The landing/upload page. */
export function renderLandingPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(Messages.APP_NAME)} — ${escapeHtml(Messages.APP_TAGLINE)}</title>
<style>${sharedCss()}</style>
<script>${themeBootstrap()}</script>
</head>
<body>
<button id="themeToggle" class="theme-toggle" type="button" aria-label="Toggle theme"><span class="icon-moon">${moonIconSvg()}</span><span class="icon-sun">${sunIconSvg()}</span></button>
<main>
  <h1>${escapeHtml(Messages.LANDING_HEADING)}</h1>
  <form id="uploadForm" autocomplete="off">
    <label for="fileInput">${escapeHtml(Messages.UPLOAD_LABEL_FILE)}</label>
    <input id="fileInput" name="file" type="file" required>
    <label for="passwordInput">${escapeHtml(Messages.UPLOAD_LABEL_PASSWORD)}</label>
    <input id="passwordInput" name="password" type="text" autocomplete="off">
    <label for="uploadTokenInput">${escapeHtml(Messages.UPLOAD_LABEL_TOKEN)}</label>
    <input id="uploadTokenInput" name="uploadToken" type="password" autocomplete="off" required>
    <div class="row">
      <div>
        <label for="maxDownloadsInput">${escapeHtml(Messages.UPLOAD_LABEL_MAX_DOWNLOADS)}</label>
        <input id="maxDownloadsInput" name="maxDownloads" type="number" min="1" max="100" value="1">
      </div>
      <div>
        <label for="expiresInInput">${escapeHtml(Messages.UPLOAD_LABEL_EXPIRES_IN)}</label>
        <select id="expiresInInput" name="expiresIn">
          <option value="3600">${escapeHtml(Messages.EXPIRY_1_HOUR)}</option>
          <option value="86400" selected>${escapeHtml(Messages.EXPIRY_1_DAY)}</option>
          <option value="604800">${escapeHtml(Messages.EXPIRY_7_DAYS)}</option>
          <option value="0">${escapeHtml(Messages.EXPIRY_NEVER)}</option>
        </select>
      </div>
    </div>
    <label class="checkbox-row">
      <input id="shortUrlInput" name="shortUrl" type="checkbox">
      <span>${escapeHtml(Messages.UPLOAD_LABEL_SHORT_URL)}</span>
    </label>
    <p id="shortUrlNotice" class="notice" style="display:none">${escapeHtml(Messages.UPLOAD_SHORT_URL_NOTICE)}</p>
    <button type="submit">${escapeHtml(Messages.UPLOAD_BUTTON)}</button>
    <p id="status"></p>
  </form>
  <div id="result" style="display:none">
    <p class="muted">${escapeHtml(Messages.UPLOAD_SUCCESS)}</p>
    <div class="linkbox">
      <input id="shareLink" type="text" readonly>
      <button id="copyBtn" type="button">${escapeHtml(Messages.UPLOAD_COPY)}</button>
    </div>
    <button id="anotherBtn" class="ghost" type="button">${escapeHtml(Messages.UPLOAD_ANOTHER)}</button>
  </div>
</main>
<script>${landingScript()}</script>
</body>
</html>`;
}

/** The share page for a given record. Metadata is decrypted client-side. */
export function renderSharePage(record: ShareRecord): string {
  const downloadsPill =
    record.downloadCount >= record.maxDownloads
      ? Messages.SHARE_DOWNLOADS_REMAINING(0)
      : record.maxDownloads === 1
        ? Messages.SHARE_ONE_TIME
        : Messages.SHARE_DOWNLOADS_REMAINING(record.maxDownloads - record.downloadCount);

  return `<!doctype html>
<html lang="en" data-theme="dark"
  data-share-id="${escapeAttr(record.id)}"
  data-meta-cipher="${escapeAttr(record.metaCipher)}"
  data-meta-iv="${escapeAttr(record.metaIv)}"
  data-file-iv="${escapeAttr(record.fileIv)}"
  data-has-password="${record.passwordHash !== null ? "1" : "0"}"
  ${record.key !== null ? `data-key="${escapeAttr(record.key)}"` : ""}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(Messages.APP_NAME)} — ${escapeHtml(Messages.SHARE_HEADING)}</title>
<style>${sharedCss()}</style>
<script>${themeBootstrap()}</script>
</head>
<body>
<button id="themeToggle" class="theme-toggle" type="button" aria-label="Toggle theme"><span class="icon-moon">${moonIconSvg()}</span><span class="icon-sun">${sunIconSvg()}</span></button>
<main>
  <h1>${escapeHtml(Messages.SHARE_HEADING)}</h1>
  <div class="meta">
    <span class="name" id="fileName">${escapeHtml(Messages.SHARE_DECRYPTING_NAME)}</span>
    <span><span class="pill">${escapeHtml(formatBytes(record.sizeBytes))}</span><span class="pill">${escapeHtml(formatExpiryLabel(record))}</span><span class="pill">${escapeHtml(downloadsPill)}</span></span>
  </div>
  <form id="passwordForm" style="display:none" autocomplete="off">
    <label for="pwInput">${escapeHtml(Messages.SHARE_PASSWORD_LABEL)}</label>
    <input id="pwInput" name="password" type="password" autocomplete="current-password">
    <button type="submit">${escapeHtml(Messages.SHARE_PASSWORD_BUTTON)}</button>
  </form>
  <button id="downloadBtn" type="button" style="display:none">${downloadIconSvg()} ${escapeHtml(Messages.SHARE_DOWNLOAD)}</button>
  <p id="status"></p>
</main>
<script>${shareScript()}</script>
</body>
</html>`;
}

/** The expired / not-found page. */
export function renderExpiredPage(): string {
  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(Messages.APP_NAME)} — ${escapeHtml(Messages.EXPIRED_HEADING)}</title>
<style>${sharedCss()}</style>
<script>${themeBootstrap()}</script>
</head>
<body>
<main>
  <h1>${escapeHtml(Messages.EXPIRED_HEADING)}</h1>
  <p class="muted">${escapeHtml(Messages.EXPIRED_TEXT)}</p>
  <a class="btn" href="/" style="display:block;text-align:center;text-decoration:none">${escapeHtml(Messages.EXPIRED_ANOTHER)}</a>
</main>
</body>
</html>`;
}

/** Whether a record should render as the share page (still alive). */
export function isShareAlive(record: ShareRecord): boolean {
  return !isExpired(record) && hasDownloadsRemaining(record);
}
