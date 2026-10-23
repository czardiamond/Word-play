import assert from "node:assert/strict";
import test from "node:test";
import { resolveBotSource } from "../src/utils/aiBotGenerator";

test("only an explicit Gemini response is attributed to Gemini", () => {
  assert.equal(resolveBotSource("gemini"), "gemini");
  assert.equal(resolveBotSource(undefined), "local-fallback");
  assert.equal(resolveBotSource("unknown"), "local-fallback");
});
