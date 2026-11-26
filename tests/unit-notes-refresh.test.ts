import { test } from "node:test";
import assert from "node:assert/strict";
import { stage2Load } from "./representative-stage2-fixture";
type Effect = () => void | (() => void);
type Pending = { url: string; signal?: AbortSignal; cache?: string; finish(value: unknown): void };
function notesHarness() {
  let cursor = 0;
  const states: unknown[] = [], effects: Effect[] = [], pending: Pending[] = [];
  const streams: Stream[] = [];
  class Stream {
    onmessage: ((event: { data: string }) => void) | null = null;
    closed = false;
    constructor(readonly url: string) { streams.push(this); }
    close() { this.closed = true; }
  }
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const component = stage2Load<{ default(props: { unitId: string }): unknown }>("app/components/UnitNotes.tsx", {
    react: { useState: (initial: unknown) => {
      const index = cursor++; if (!(index in states)) states[index] = initial;
      return [states[index], (next: unknown) => { const value: unknown = typeof next === "function" ? Reflect.apply(next, undefined, [states[index]]) : next; states[index] = value; }];
    }, useEffect: (effect: Effect) => { effects.push(effect); } },
    "react/jsx-runtime": { jsx, jsxs: jsx },
  }, {}, { AbortController, EventSource: Stream, fetch: (url: string, options: { signal?: AbortSignal; cache?: string }) => new Promise(resolve => {
    pending.push({ url, ...options, finish: (value: unknown) => resolve({ json: async () => value }) });
  }) });
  return { states, effects, pending, streams, render(unitId: string) { cursor = 0; effects.length = 0; return JSON.stringify(component.default({ unitId })); } };
}
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
const response = (content: string) => ({ ok: true, data: [{ id: "n", content, noteType: "GENERAL", isPinned: false, createdAt: "2026-01-01" }] });
test("unit notes discard aborted and out-of-order responses and never show another unit's notes", async () => {
  const f = notesHarness(); f.render("a"); const closeA = f.effects[0]();
  assert.equal(f.pending[0].url, "/api/notes?unitId=a"); assert.equal(f.pending[0].cache, "no-store");
  assert.equal(typeof closeA, "function"); if (typeof closeA === "function") closeA();
  assert.equal(f.pending[0].signal?.aborted, true);
  f.render("b"); f.effects[0](); f.pending[1].finish(response("B private note")); await tick();
  assert.match(f.render("b"), /B private note/);
  f.pending[0].finish(response("A private note")); await tick();
  assert.doesNotMatch(f.render("b"), /A private note/); assert.match(f.render("b"), /B private note/);
  assert.doesNotMatch(f.render("a"), /B private note/);
});
test("unit notes validate responses and close realtime subscriptions at the unit boundary", async () => {
  const f = notesHarness(); f.render("a/b"); f.effects[0](); const cleanup = f.effects[1]();
  assert.equal(f.pending[0].url, "/api/notes?unitId=a%2Fb");
  f.pending[0].finish({ ok: true, data: [{ content: "malformed" }] }); await tick();
  assert.doesNotMatch(f.render("a/b"), /malformed/);
  const stream = f.streams[0]; assert.equal(stream.url, "/api/stream"); assert.ok(stream.onmessage);
  stream.onmessage({ data: "not JSON" }); stream.onmessage({ data: JSON.stringify({ type: "admin:notes:update", payload: { unitId: "other" } }) });
  assert.equal(f.states[1], 0);
  stream.onmessage({ data: JSON.stringify({ type: "admin:notes:update", payload: { unitId: "a/b" } }) });
  assert.equal(f.states[1], 1);
  if (typeof cleanup === "function") cleanup(); else assert.fail("Realtime cleanup required");
  assert.equal(stream.closed, true);
});
