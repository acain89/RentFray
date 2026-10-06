import { NextRequest, NextResponse } from "next/server";
import { subscribe, type RealtimePayload } from "@/lib/realtime";
import { getSession, SESSION_COOKIE_NAME, validateSessionToken } from "@/lib/session";
import { isManagementRole } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSession();
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!session || !token) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (!isManagementRole(session.role) || !session.propertyId)
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  const propertyId = session.propertyId;
  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;
  let interval: ReturnType<typeof setInterval> | null = null;
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  let stopped = false;
  let draining = false;
  // Bound transport work while asynchronous session authority is checked.
  const pending: (RealtimePayload | null)[] = [];
  const stop = (close = true) => {
    if (stopped) return;
    stopped = true;
    pending.length = 0;
    if (interval !== null) clearInterval(interval);
    interval = null;
    cleanup?.();
    cleanup = null;
    req.signal.removeEventListener("abort", abort);
    if (close) { try { controller?.close(); } catch { /* already closed */ } }
  };
  const abort = () => stop();
  async function drain() {
    if (draining || stopped) return;
    draining = true;
    try {
      while (pending.length && !stopped) {
        const event = pending.shift()!;
        const current = await validateSessionToken(token!);
        if (stopped) return;
        if (!current || !isManagementRole(current.role) || current.propertyId !== propertyId) { stop(); return; }
        if (!controller || (controller.desiredSize ?? 0) <= 0) { stop(); return; }
        controller.enqueue(encoder.encode(event ? `data: ${JSON.stringify(event)}\n\n` : ": ping\n\n"));
      }
    } catch { stop(); }
    finally { draining = false; }
  }
  const deliver = (event: RealtimePayload | null) => {
    if (stopped) return;
    if (pending.length >= 32) { stop(); return; }
    pending.push(event);
    void drain();
  };
  const stream = new ReadableStream<Uint8Array>({
    start(target) {
      controller = target;
      req.signal.addEventListener("abort", abort, { once: true });
      if (req.signal.aborted) { stop(); return; }
      cleanup = subscribe((event) => {
        const data = event.data;
        if (!data || typeof data !== "object" || Array.isArray(data)) return;
        const scope = (data as { propertyId?: unknown }).propertyId;
        if (typeof scope !== "string" || !scope.trim() || scope !== propertyId) return;
        deliver(event);
      });
      interval = setInterval(() => deliver(null), 15000);
    },
    cancel() { stop(false); },
  });
  return new Response(stream, { headers: {
    "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive", "X-Accel-Buffering": "no",
  } });
}
