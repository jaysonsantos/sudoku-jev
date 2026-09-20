import { HEALTH_BODY, HEALTH_PATH, WS_PATH } from "../../shared/src/index.ts";
import { BODY, CONTENT_TYPE, GET_METHOD, HEADER, STATUS, WEBSOCKET_TOKEN } from "./constants.ts";
import type { WorkerEnv } from "./env.ts";

export function isWebSocketUpgrade(request: Request): boolean {
  const value = request.headers.get(HEADER.upgrade);
  return value !== null && value.toLowerCase() === WEBSOCKET_TOKEN;
}

function textResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { [HEADER.contentType]: CONTENT_TYPE.text },
  });
}

export function healthResponse(): Response {
  return textResponse(HEALTH_BODY, STATUS.ok);
}

/** Routes `/healthz` and `/ws`. Assets handle every other path in production. */
export async function handleRequest(request: Request, env: WorkerEnv): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (path === HEALTH_PATH) {
    return healthResponse();
  }
  if (path !== WS_PATH) {
    return textResponse(BODY.notFound, STATUS.notFound);
  }
  if (!isWebSocketUpgrade(request)) {
    return textResponse(BODY.expectedUpgrade, STATUS.upgradeRequired);
  }
  if (request.method !== GET_METHOD) {
    return textResponse(BODY.expectedGet, STATUS.badRequest);
  }
  const binding = env.GAME_SESSION;
  if (binding === undefined) {
    return textResponse(BODY.missingBinding, STATUS.serverError);
  }
  return binding.getByName(crypto.randomUUID()).fetch(request);
}
