// app/api/manager/dashboard/route.ts

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

function getCutoffDate() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon

  const cutoff = new Date(now);

  // set to 5:00 PM
  cutoff.setHours(17, 0, 0, 0);

  if (day === 1) {
    // Monday → go back to Friday 5 PM
    cutoff.setDate(cutoff.getDate() - 3);
  } else {
    // Other weekdays → yesterday 5 PM
    cutoff.setDate(cutoff.getDate() - 1);
  }

  return cutoff;
}

export async function GET() {
  try {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get("rf_session");

    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = JSON.parse(sessionCookie.value);

    if (session.role !== "MANAGER" || !session.propertyId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const propertyId = session.propertyId;
    const cutoff = getCutoffDate();

    // Units + assignments
    const units = await prisma.unit.findMany({
      where: { propertyId },
      include: {
        assignments: {
          where: { moveOut: null },
          include: { tenant: true },
        },
      },
    });

    // Ledger entries since cutoff
    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: {
        propertyId,
        createdAt: { gte: cutoff },
      },
    });

    // Maintenance since cutoff
    const maintenance = await prisma.maintenanceRequest.findMany({
      where: {
        propertyId,
        createdAt: { gte: cutoff },
      },
    });

    let paidSinceClose = 0;
    let newPayments = 0;

    for (const entry of ledgerEntries) {
      if (Number(entry.amount) < 0) {
        paidSinceClose += Math.abs(Number(entry.amount));
        newPayments++;
      }
    }

    // Status counts (basic version)
    let paid = 0;
    let delinquent = 0;
    let partial = 0;
    let grace = 0;
    let vacant = 0;

    for (const unit of units) {
      const hasTenant = unit.assignments.length > 0;

      if (!hasTenant) {
        vacant++;
        continue;
      }

      // TEMP: basic status logic (refine later)
      const entries = await prisma.ledgerEntry.findMany({
        where: { unitId: unit.id },
      });

      const balance = entries.reduce(
        (sum, e) => sum + Number(e.amount),
        0
      );

      if (balance <= 0) {
        paid++;
      } else {
        delinquent++; // simplified for now
      }
    }

    return NextResponse.json({
      ok: true,
      cutoff,
      summary: {
        paidSinceClose,
        newPayments,
        delinquentUnits: delinquent,
        openMaintenance: maintenance.length,
        vacantUnits: vacant,
      },
      counts: {
        paid,
        grace,
        partial,
        delinquent,
        vacant,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to load dashboard" },
      { status: 500 }
    );
  }
}