/**
 * GET / — the landing/upload page.
 */

import { htmlResponse } from "../http.ts";
import { renderLandingPage } from "../render.ts";

export function landingPage(): Response {
  return htmlResponse(renderLandingPage());
}
