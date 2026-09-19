import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  BODY,
  DO_BINDING_NAME,
  DO_CLASS_NAME,
  STATUS,
  WEBSOCKET_TOKEN,
  WORKER_ENTRY,
} from "../../cloudflare/src/constants.ts";
import type { WorkerEnv } from "../../cloudflare/src/env.ts";
import { handleRequest, healthResponse, isWebSocketUpgrade } from "../../cloudflare/src/route.ts";
import { HEALTH_BODY, HEALTH_PATH, WS_PATH } from "../../shared/src/index.ts";

const ORIGIN = "https://sudoku-jev.example";
const POST_METHOD = "POST";
const UNKNOWN_PATH = "/nope";
const UPGRADED_BODY = "upgraded";

function env(overrides: Partial<WorkerEnv> = {}): WorkerEnv {
  return {
    GAME_SESSION: {
      getByName: () => ({
        fetch: async () => new Response(UPGRADED_BODY, { status: STATUS.ok }),
      }),
    },
    OPENROUTER_API_KEY: "k",
    OPENROUTER_URL: "https://example.test/decisions",
    JEV_MODEL: "m",
    ...overrides,
  };
}

test("healthResponse answers ok", async () => {
  const response = healthResponse();
  assert.equal(response.status, STATUS.ok);
  assert.equal(await response.text(), HEALTH_BODY);
});

test("isWebSocketUpgrade reads the Upgrade header", () => {
  const upgrade = new Request(`${ORIGIN}${WS_PATH}`, { headers: { Upgrade: WEBSOCKET_TOKEN } });
  const plain = new Request(`${ORIGIN}${WS_PATH}`);
  assert.equal(isWebSocketUpgrade(upgrade), true);
  assert.equal(isWebSocketUpgrade(plain), false);
});

test("handleRequest serves healthz and 404s unknown paths", async () => {
  const health = await handleRequest(new Request(`${ORIGIN}${HEALTH_PATH}`), env());
  assert.equal(health.status, STATUS.ok);
  assert.equal(await health.text(), HEALTH_BODY);

  const missing = await handleRequest(new Request(`${ORIGIN}${UNKNOWN_PATH}`), env());
  assert.equal(missing.status, STATUS.notFound);
  assert.equal(await missing.text(), BODY.notFound);
});

test("handleRequest rejects a misconfigured or non-upgrade /ws", async () => {
  const noKey = await handleRequest(new Request(`${ORIGIN}${WS_PATH}`), env({ OPENROUTER_API_KEY: "" }));
  assert.equal(noKey.status, STATUS.serverError);
  assert.equal(await noKey.text(), BODY.missingApiKey);

  const noUpgrade = await handleRequest(new Request(`${ORIGIN}${WS_PATH}`), env());
  assert.equal(noUpgrade.status, STATUS.upgradeRequired);

  const post = await handleRequest(
    new Request(`${ORIGIN}${WS_PATH}`, { method: POST_METHOD, headers: { Upgrade: WEBSOCKET_TOKEN } }),
    env(),
  );
  assert.equal(post.status, STATUS.badRequest);
});

test("handleRequest forwards a websocket upgrade to a new Durable Object", async () => {
  const seen: string[] = [];
  const response = await handleRequest(
    new Request(`${ORIGIN}${WS_PATH}`, { headers: { Upgrade: WEBSOCKET_TOKEN } }),
    env({
      GAME_SESSION: {
        getByName: (name) => {
          seen.push(name);
          return {
            fetch: async () => new Response(UPGRADED_BODY, { status: STATUS.ok }),
          };
        },
      },
    }),
  );
  assert.equal(response.status, STATUS.ok);
  assert.equal(await response.text(), UPGRADED_BODY);
  assert.equal(seen.length, 1);
  assert.ok(seen[0] !== undefined && seen[0].length > 0);
});

test("wrangler.jsonc binds GameSession on /ws", () => {
  const text = readFileSync(new URL("../../wrangler.jsonc", import.meta.url), "utf8");
  assert.ok(text.includes(`"main": "${WORKER_ENTRY}"`));
  assert.ok(text.includes(`"${WS_PATH}"`));
  assert.ok(text.includes(`"${HEALTH_PATH}"`));
  assert.ok(text.includes(`"name": "${DO_BINDING_NAME}"`));
  assert.ok(text.includes(`"class_name": "${DO_CLASS_NAME}"`));
  assert.ok(text.includes(`"${DO_CLASS_NAME}":`));
});
