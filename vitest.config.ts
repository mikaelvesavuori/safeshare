import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.toml" },
      miniflare: {
        bindings: {
          TOKEN_SECRET: "test-secret-for-vitest-only-32-bytes-long",
        },
      },
    }),
  ],
  test: {
    include: ["test/**/*.test.ts"],
  },
});
