/**
 * Typed errors and sentinel codes for SafeShare.
 *
 * Errors carry a stable `code` so handlers can branch without matching on
 * message text. `is*` predicates narrow the type at call sites.
 */

/** Stable error codes used across the app. */
export const ErrorCodes = {
  SHARE_NOT_FOUND: "SHARE_NOT_FOUND",
  SHARE_EXPIRED: "SHARE_EXPIRED",
  DOWNLOAD_LIMIT_REACHED: "DOWNLOAD_LIMIT_REACHED",
  PASSWORD_REQUIRED: "PASSWORD_REQUIRED",
  PASSWORD_INVALID: "PASSWORD_INVALID",
  TOKEN_INVALID: "TOKEN_INVALID",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  UPLOAD_TOO_LARGE: "UPLOAD_TOO_LARGE",
  BAD_REQUEST: "BAD_REQUEST",
  UNAUTHORIZED: "UNAUTHORIZED",
  INTERNAL: "INTERNAL",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/** Base application error carrying a stable code and HTTP status. */
export class SafeShareError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, message: string, status: number) {
    super(message);
    this.name = "SafeShareError";
    this.code = code;
    this.status = status;
  }
}

export function isSafeShareError(error: unknown): error is SafeShareError {
  return error instanceof SafeShareError;
}

export function notFound(): SafeShareError {
  return new SafeShareError(ErrorCodes.SHARE_NOT_FOUND, "This share does not exist.", 404);
}

export function expired(): SafeShareError {
  return new SafeShareError(ErrorCodes.SHARE_EXPIRED, "This share has expired.", 410);
}

export function downloadLimitReached(): SafeShareError {
  return new SafeShareError(
    ErrorCodes.DOWNLOAD_LIMIT_REACHED,
    "The download limit for this share has been reached.",
    410,
  );
}

export function passwordRequired(): SafeShareError {
  return new SafeShareError(
    ErrorCodes.PASSWORD_REQUIRED,
    "A password is required to download this share.",
    401,
  );
}

export function passwordInvalid(): SafeShareError {
  return new SafeShareError(
    ErrorCodes.PASSWORD_INVALID,
    "The provided password is incorrect.",
    401,
  );
}

export function tokenInvalid(): SafeShareError {
  return new SafeShareError(ErrorCodes.TOKEN_INVALID, "The download token is invalid.", 401);
}

export function tokenExpired(): SafeShareError {
  return new SafeShareError(
    ErrorCodes.TOKEN_EXPIRED,
    "The download token has expired. Please verify the password again.",
    401,
  );
}

export function uploadTooLarge(maxBytes: number): SafeShareError {
  return new SafeShareError(
    ErrorCodes.UPLOAD_TOO_LARGE,
    `Encrypted payload exceeds the ${maxBytes} byte limit.`,
    413,
  );
}

export function badRequest(detail: string): SafeShareError {
  return new SafeShareError(ErrorCodes.BAD_REQUEST, detail, 400);
}

export function unauthorized(): SafeShareError {
  return new SafeShareError(ErrorCodes.UNAUTHORIZED, "Unauthorized.", 401);
}

export function internal(detail = "Something went wrong."): SafeShareError {
  return new SafeShareError(ErrorCodes.INTERNAL, detail, 500);
}
