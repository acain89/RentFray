import * as crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import * as calendar from "../lib/representativeCalendar";
import { stage2Load } from "./representative-stage2-fixture";
import type * as Session from "../lib/session";
import type * as RepSession from "../lib/representativeSession";
import type * as Auth from "../lib/representativeAuth";
import type * as Reports from "../lib/representativeReports";
import type * as Admin from "../lib/representativeAdmin";

export function stage3Fixture(db: unknown, runtime = Prisma, options: {
  session?: unknown; crypto?: unknown; send?: (input: Auth.RepresentativePasswordLink) => Promise<void>;
} = {}) {
  const cookies = new Map<string, string>();
  const headerMock = { cookies: async () => ({ get: (name: string) => cookies.has(name) ? { value: cookies.get(name) } : undefined,
    set: (name: string, value: string) => { cookies.set(name, value); } }) };
  const base = { "@/lib/prisma": { prisma: db }, "@prisma/client": { Prisma: runtime }, "next/headers": headerMock };
  const originalSession = stage2Load<typeof Session>("lib/session.ts", { ...base, crypto });
  const repSession = stage2Load<typeof RepSession>("lib/representativeSession.ts", base);
  const auth = stage2Load<typeof Auth>("lib/representativeAuth.ts", { ...base, "@/lib/representativeSession": repSession });
  const reports = stage2Load<typeof Reports>("lib/representativeReports.ts", { ...base, "@/lib/representativeReferrals": { REPRESENTATIVE_ORIGIN: "https://www.rentfray.com" } });
  const delivered: Auth.RepresentativePasswordLink[] = [];
  const mocks = { ...base, "next/server": { NextResponse: { json: (body: unknown, options?: ResponseInit) => Response.json(body, options) } },
    "@/lib/session": options.session ?? originalSession, "@/lib/representativeSession": repSession, "@/lib/representativeAuth": auth,
    "@/lib/representativeCalendar": calendar, "@/lib/representativeReports": reports,
    "@/lib/representativeEmail": { sendRepresentativeRecoveryEmail: async (input: Auth.RepresentativePasswordLink) => { delivered.push(input); if (options.send) await options.send(input); } },
    ...(options.crypto ? { "node:crypto": options.crypto } : {}),
  };
  const admin = stage2Load<typeof Admin>("lib/representativeAdmin.ts", mocks);
  return { admin, auth, repSession, reports, originalSession, cookies, delivered, mocks };
}
