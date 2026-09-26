/**
 * User-facing strings for SafeShare. Keep messages here so they are not inlined
 * across handlers and can be revised in one place.
 */

export const Messages = {
  APP_NAME: "SafeShare",
  APP_TAGLINE: "End-to-end encrypted file sharing.",
  LANDING_HEADING: "Share a file, privately.",
  LANDING_SUBTEXT:
    "Your file is encrypted in your browser. The key lives in the link, which the server never sees.",
  UPLOAD_LABEL_FILE: "Choose a file",
  UPLOAD_LABEL_PASSWORD: "Password (optional)",
  UPLOAD_LABEL_TOKEN: "Upload token",
  UPLOAD_LABEL_MAX_DOWNLOADS: "Max downloads",
  UPLOAD_LABEL_EXPIRES_IN: "Expires in",
  UPLOAD_LABEL_SHORT_URL: "Short URL (typeable, not end-to-end encrypted)",
  UPLOAD_SHORT_URL_NOTICE:
    "With a short URL the decryption key is stored on the server. Anyone with the 8-character link can open the file. Use this only when convenience matters more than E2E encryption.",
  UPLOAD_BUTTON: "Share",
  UPLOAD_ENCRYPTING: "Encrypting…",
  UPLOAD_UPLOADING: "Uploading…",
  UPLOAD_SUCCESS: "Your share link is ready.",
  UPLOAD_COPY: "Copy link",
  UPLOAD_COPIED: "Copied!",
  UPLOAD_ANOTHER: "Share another file",
  EXPIRY_1_HOUR: "1 hour",
  EXPIRY_1_DAY: "1 day",
  EXPIRY_7_DAYS: "7 days",
  EXPIRY_NEVER: "Never",
  SHARE_HEADING: "Encrypted file",
  SHARE_DOWNLOAD: "Download",
  SHARE_DOWNLOADING: "Downloading and decrypting…",
  SHARE_PASSWORD_LABEL: "Enter the password to continue",
  SHARE_PASSWORD_BUTTON: "Unlock",
  SHARE_PASSWORD_WRONG: "Incorrect password.",
  SHARE_DECRYPTING_NAME: "Decrypting file name…",
  SHARE_ENCRYPTED_NAME: "Encrypted file name",
  SHARE_ONE_TIME: "one-time download",
  SHARE_DOWNLOADS_REMAINING: (n: number) => `${n} download${n === 1 ? "" : "s"} remaining`,
  SHARE_EXPIRES_IN: (label: string) => `expires in ${label}`,
  SHARE_EXPIRES_NEVER: "never expires",
  EXPIRED_HEADING: "Link expired or not found",
  EXPIRED_TEXT: "This share link has expired, reached its download limit, or never existed.",
  EXPIRED_ANOTHER: "Share a new file",
  ERROR_GENERIC: "Something went wrong. Please try again.",
  ERROR_NO_KEY: "No decryption key found in the link. The link may be incomplete.",
} as const;
