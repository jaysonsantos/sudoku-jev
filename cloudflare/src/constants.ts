// region: bindings
/** Wrangler Durable Object binding name. Must match wrangler.jsonc. */
export const DO_BINDING_NAME = "GAME_SESSION";
/** Exported Durable Object class. Must match wrangler.jsonc exports. */
export const DO_CLASS_NAME = "GameSession";
/** Worker entry. Must match wrangler.jsonc main. */
export const WORKER_ENTRY = "cloudflare/src/worker.ts";
// endregion: bindings

// region: http
export const HEADER = {
  upgrade: "Upgrade",
  contentType: "Content-Type",
} as const;

export const WEBSOCKET_TOKEN = "websocket";
export const GET_METHOD = "GET";

export const CONTENT_TYPE = {
  text: "text/plain; charset=utf-8",
} as const;

export const STATUS = {
  ok: 200,
  switchingProtocols: 101,
  badRequest: 400,
  notFound: 404,
  upgradeRequired: 426,
  serverError: 500,
} as const;

export const BODY = {
  expectedUpgrade: "expected Upgrade: websocket",
  expectedGet: "expected GET",
  missingApiKey: "OPENROUTER_API_KEY is not set",
  notFound: "not found",
} as const;
// endregion: http

// region: logs
export const LOG_EVENT = {
  decision: "decision",
  error: "error",
} as const;
// endregion: logs
