/// <reference types="@cloudflare/vitest-plugin/types" />

declare namespace Cloudflare {
  interface Env {
    TOKEN_SECRET: string;
    UPLOAD_TOKEN?: string;
  }
}
