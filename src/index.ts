/**
 * SafeShare Worker entrypoint. Wires Hono routes and applies a global error
 * boundary that converts SafeShareError into JSON responses.
 */

import { Hono } from "hono";
import type { Env } from "./env.ts";
import { isSafeShareError } from "./errors.ts";
import { errorResponse, textResponse } from "./http.ts";
import { downloadFile } from "./routes/download.ts";
import { landingPage } from "./routes/page.ts";
import { sharePage, verifySharePassword } from "./routes/share.ts";
import { uploadFile } from "./routes/upload.ts";

const app = new Hono<{ Bindings: Env }>();

app.get("/", landingPage);
app.post("/api/upload", (c) => uploadFile(c));
app.get("/:id", (c) => sharePage(c));
app.post("/:id/verify", (c) => verifySharePassword(c));
app.get("/:id/download", (c) => downloadFile(c));

app.notFound((c) => {
  void c;
  return textResponse("Not found.", 404);
});

app.onError((error, c) => {
  void c;
  if (isSafeShareError(error)) return errorResponse(error);
  console.error(error);
  return errorResponse(error);
});

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return app.fetch(request, env, ctx);
  },
};
