import assert from "node:assert/strict";
import { test } from "node:test";
import { formatMatchCost, formatPuzzleCost, formatUsd } from "../../frontend/src/cost.ts";

test("formatUsd and labeled costs print small OpenRouter amounts", () => {
  assert.equal(formatUsd(0), "$0");
  assert.equal(formatMatchCost(0), "match cost: $0");
  assert.equal(formatMatchCost(0.0123), "match cost: $0.0123");
  assert.equal(formatMatchCost(0.000012), "match cost: $0.000012");
  assert.equal(formatPuzzleCost(0), "puzzle cost: $0");
  assert.equal(formatPuzzleCost(0.0123), "puzzle cost: $0.0123");
  assert.equal(formatPuzzleCost(0.000012), "puzzle cost: $0.000012");
});
