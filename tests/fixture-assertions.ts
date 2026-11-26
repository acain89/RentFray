import assert from "node:assert/strict";
// Projected/legacy fixture rows may omit fields. Positive assertions must prove
// a value exists with the expected type rather than inventing defaults.
export function requiredDate(value: unknown): Date {
  assert.ok(value instanceof Date, "Expected a stored Date value"); return value;
}
export function requiredText(value: unknown): string {
  assert.ok(typeof value === "string", "Expected stored text"); return value;
}
export function requiredNumber(value: unknown): number {
  assert.ok(typeof value === "number", "Expected a stored number"); return value;
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function dateFromArguments(args: readonly unknown[], constructor: DateConstructor = Date): Date {
  const value: unknown = Reflect.construct(constructor, [...args]);
  assert.ok(value instanceof Date, "Expected native Date constructor output"); return value;
}

export function requiredMapValue<Key, Value>(map: ReadonlyMap<Key, Value>, key: Key): Value {
  const value = map.get(key); assert.ok(value !== undefined, "Expected an existing fixture map entry"); return value;
}

export type FieldChange<Object> = { [Key in keyof Object]-?: readonly [Key, Object[Key]] }[keyof Object];
export function applyFieldChange<Object extends object>(target: Object, change: FieldChange<NoInfer<Object>>): void {
  Reflect.set(target, change[0], change[1]);
}

export function isElement(value: unknown): value is { type: unknown; props: Record<string, unknown> } {
  return isRecord(value) && "type" in value && isRecord(value.props);
}

export function requiredValue<Value>(value: Value | null | undefined): Value {
  assert.ok(value !== undefined && value !== null, "Expected an existing fixture value"); return value;
}

export function requiredRecord(value: unknown): Record<string, unknown> {
  assert.ok(isRecord(value), "Expected a structured fixture value"); return value;
}
export function requiredArray(value: unknown): unknown[] {
  assert.ok(Array.isArray(value), "Expected an array fixture value"); return value;
}
export function invokeEvent(element: unknown, name: string, ...args: unknown[]): unknown {
  assert.ok(isElement(element), "Expected a rendered element"); const handler = element.props[name];
  assert.ok(typeof handler === "function", "Expected event handler " + name); return Reflect.apply(handler, element.props, args);
}
export function requestData(options: { body: string }): Record<string, unknown> {
  const value: unknown = JSON.parse(options.body); return requiredRecord(value);
}

export function recordRows(value: unknown): Record<string, unknown>[] {
  return requiredArray(value).map(requiredRecord);
}
export type MockReply = { status: number; body: Record<string, unknown> };
export function checkedHttpNamespace(namespace: unknown): Record<string, unknown> {
  const exports = requiredRecord(namespace); const checked = { ...exports };
  for (const name of ["GET", "POST", "PATCH", "PUT", "DELETE"]) {
    const handler = exports[name]; if (typeof handler !== "function") continue;
    checked[name] = async (...args: unknown[]): Promise<MockReply> => {
      const raw: unknown = await Reflect.apply(handler, exports, args); assert.ok(isRecord(raw));
      assert.ok(typeof raw.status === "number"); assert.ok(isRecord(raw.body));
      return Object.assign(raw, { status: raw.status, body: raw.body });
    };
  }
  return checked;
}

export function cancelResponse(response: { body: unknown }): void {
  const body = requiredRecord(response.body); const cancel = body.cancel;
  assert.ok(typeof cancel === "function", "Expected a stream cancellation callback"); Reflect.apply(cancel, body, []);
}

export function callVm(namespace: unknown, name: string, ...args: unknown[]): unknown {
  const exports = requiredRecord(namespace); const member = exports[name];
  assert.ok(typeof member === "function", "Missing source export " + name); return Reflect.apply(member, exports, args);
}
export function httpFacade(namespace: unknown) {
  const invoke = async (...args: unknown[]): Promise<MockReply> => {
    const method = requiredText(args.shift()); const value: unknown = await callVm(namespace, method, ...args);
    const raw = requiredRecord(value); assert.ok(typeof raw.status === "number"); const body = requiredRecord(raw.body);
    return Object.assign(raw, { status: raw.status, body });
  };
  return { GET: (...args: unknown[]) => invoke("GET", ...args), POST: (...args: unknown[]) => invoke("POST", ...args), PATCH: (...args: unknown[]) => invoke("PATCH", ...args), PUT: (...args: unknown[]) => invoke("PUT", ...args), DELETE: (...args: unknown[]) => invoke("DELETE", ...args) };
}

export function callArguments(calls: readonly (readonly [string, unknown])[], operation: string): Record<string, unknown> {
  const found = calls.find(call => call[0] === operation); assert.ok(found, "Missing fixture call " + operation); return requiredRecord(found[1]);
}

export function eventArguments(events: readonly (readonly [string, ...unknown[]])[], name: string): Record<string, unknown> {
  const event = events.find(value => value[0] === name); assert.ok(event, "Missing fixture event " + name); return requiredRecord(event[1]);
}

export function applyDefined<Row extends object>(target: Row, data: Partial<Row>): void {
  for (const key in data) {
    if (Object.hasOwn(data, key) && data[key] !== undefined) target[key] = data[key];
  }
}
