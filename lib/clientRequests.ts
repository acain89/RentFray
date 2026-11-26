/** Coalesce concurrent read refreshes into one active and at most one queued request.
 * A request arriving after a mutation must run after the older read, not reuse it. */
export class RefreshCoordinator {
  private active: Promise<void> | null = null;
  private queued: { work: () => Promise<void>; promise: Promise<void>; resolve(): void; reject(error: unknown): void } | null = null;
  request(work: () => Promise<void>): Promise<void> {
    if (!this.active) {
      this.active = this.run(work);
      return this.active;
    }
    if (this.queued) { this.queued.work = work; return this.queued.promise; }
    let resolve!: () => void, reject!: (error: unknown) => void;
    const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
    this.queued = { work, promise, resolve, reject };
    return promise;
  }
  private async run(work: () => Promise<void>): Promise<void> {
    try { await Promise.resolve().then(work); }
    finally {
      const next = this.queued;
      this.queued = null;
      if (next) {
        const running = this.run(next.work); this.active = running;
        void running.then(next.resolve, next.reject);
      } else this.active = null;
    }
  }
}
export type RequestTicket = { readonly key: string; readonly sequence: number };
export class ContextFence {
  private key: string | null = null;
  private sequence = 0;
  activate(key: string): void { this.key = key || null; this.sequence++; }
  deactivate(key: string): void { if (this.key === key) { this.key = null; this.sequence++; } }
  begin(key: string): RequestTicket | null {
    return this.key === key ? { key, sequence: ++this.sequence } : null;
  }
  current(ticket: RequestTicket): boolean { return this.key === ticket.key && this.sequence === ticket.sequence; }
}
