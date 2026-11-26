import { stage2Load } from "./representative-stage2-fixture";
import type * as PropertyCodeHook from "../lib/usePropertyCode";
import { test } from "node:test";
import assert from "node:assert/strict";
import { RefreshCoordinator, ContextFence } from "../lib/clientRequests";
function deferred() {
  let finish!: () => void;
  const promise = new Promise<void>(resolve => { finish = resolve; });
  return { promise, finish };
}
test("refresh queues one latest read after an in-flight pre-mutation read", async () => {
  const coordinator = new RefreshCoordinator(), gate = deferred(), events: string[] = [];
  let active = 0, peak = 0;
  const first = coordinator.request(async () => { active++; peak = Math.max(peak, active); events.push("old"); await gate.promise; active--; });
  await Promise.resolve();
  const second = coordinator.request(async () => { events.push("superseded"); });
  const third = coordinator.request(async () => { active++; peak = Math.max(peak, active); events.push("fresh"); active--; });
  assert.equal(second, third);
  assert.deepEqual(events, ["old"]);
  gate.finish(); await Promise.all([first, second, third]);
  assert.equal(peak, 1); assert.deepEqual(events, ["old", "fresh"]);
  await coordinator.request(async () => { events.push("later"); });
  assert.deepEqual(events, ["old", "fresh", "later"]);
});
test("failed reads release the coordinator and still execute queued recovery", async () => {
  const coordinator = new RefreshCoordinator(), gate = deferred(), events: string[] = [];
  const first = coordinator.request(async () => { await gate.promise; throw new Error("read failed"); });
  const rejected = assert.rejects(first, /read failed/);
  const next = coordinator.request(async () => { events.push("recovered"); });
  gate.finish(); await rejected; await next;
  await assert.rejects(coordinator.request(() => { throw new Error("synchronous"); }), /synchronous/);
  await coordinator.request(async () => { events.push("ready"); });
  assert.deepEqual(events, ["recovered", "ready"]);
});
test("context fences reject out-of-order, cross-property and unmounted responses", () => {
  const fence = new ContextFence();
  assert.equal(fence.begin("a"), null); fence.activate("a");
  const old = fence.begin("a"), latest = fence.begin("a"); assert.ok(old); assert.ok(latest);
  assert.equal(fence.current(old), false); assert.equal(fence.current(latest), true);
  fence.activate("b"); assert.equal(fence.current(latest), false); assert.equal(fence.begin("a"), null);
  const current = fence.begin("b"); assert.ok(current);
  fence.deactivate("a"); assert.equal(fence.current(current), true);
  fence.deactivate("b"); assert.equal(fence.current(current), false); assert.equal(fence.begin("b"), null);
  fence.activate("b"); assert.equal(fence.current(current), false);
});

function propertyCodeHarness() {
  const effects: (() => void | (() => void))[] = [], values = new Map<string, string>();
  const target = new EventTarget(); let unavailable = false;
  let subscribe: ((listener: () => void) => () => void) | undefined;
  let server: (() => string) | undefined;
  const window = { addEventListener: target.addEventListener.bind(target), removeEventListener: target.removeEventListener.bind(target), dispatchEvent: target.dispatchEvent.bind(target),
    localStorage: { getItem: (key: string) => { if (unavailable) throw Error("unavailable"); return values.get(key) ?? null; }, setItem: (key: string, value: string) => { if (unavailable) throw Error("unavailable"); values.set(key, value); } } };
  const hook = stage2Load<typeof PropertyCodeHook>("lib/usePropertyCode.ts", { react: {
    useCallback<T>(callback: T): T { return callback; },
    useEffect: (effect: () => void | (() => void)) => { effects.push(effect); },
    useSyncExternalStore: (listen: (listener: () => void) => () => void, snapshot: () => string, initial: () => string) => { subscribe = listen; server = initial; return snapshot(); },
  } }, {}, { window, Event });
  return { hook, values, target, effects, disableStorage: () => { unavailable = true; },
    listen(listener: () => void) { assert.ok(subscribe); return subscribe(listener); },
    server() { assert.ok(server); return server(); } };
}
test("property-code hook gives explicit routes priority without mirrored credential state", () => {
  const f = propertyCodeHarness(); f.values.set("rf_property_code", "old");
  assert.equal(f.hook.usePropertyCode("route"), "route"); assert.equal(f.server(), "route");
  assert.equal(f.values.get("rf_property_code"), "old");
  let notifications = 0; const stop = f.listen(() => { notifications++; });
  f.effects[0](); assert.equal(f.values.get("rf_property_code"), "route"); assert.equal(notifications, 1);
  f.effects[0](); assert.equal(notifications, 1);
  stop(); f.target.dispatchEvent(new Event("storage")); assert.equal(notifications, 1);
});
test("property-code fallback normalizes storage and subscribes across tabs without overwriting it", () => {
  const f = propertyCodeHarness(); f.values.set("rf_property_code", " CODE ");
  assert.equal(f.hook.usePropertyCode("", value => value.trim()), "CODE"); assert.equal(f.server(), "");
  f.effects[0](); assert.equal(f.values.get("rf_property_code"), " CODE ");
  let notifications = 0; const stop = f.listen(() => { notifications++; });
  f.target.dispatchEvent(new Event("storage")); assert.equal(notifications, 1); stop();
});
test("disabled local storage cannot break explicit login context or invent a fallback", () => {
  const f = propertyCodeHarness(); f.disableStorage();
  assert.equal(f.hook.usePropertyCode("route"), "route"); assert.doesNotThrow(() => f.effects[0]());
  assert.equal(f.hook.usePropertyCode(""), ""); assert.doesNotThrow(() => f.effects[1]());
});
