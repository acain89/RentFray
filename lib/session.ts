// lib/session.ts

export type SessionData = {
  role: "MANAGER" | "TENANT" | "MAINTENANCE";
  propertyId: string;
  unitId?: string | null;
  userId?: string | null;
};

export async function getSession(): Promise<SessionData | null> {
  try {
    const res = await fetch("/api/auth/session", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });

    const data = await res.json();

    if (!data?.ok) return null;

    return {
      role: data.role,
      propertyId: data.propertyId,
      unitId: data.unitId,
      userId: data.userId,
    };
  } catch {
    return null;
  }
}

export async function createSession(payload: SessionData) {
  const res = await fetch("/api/auth/session", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error("Failed to create session");
  }

  return res.json();
}

export async function clearSession() {
  await fetch("/api/auth/session", {
    method: "DELETE",
    credentials: "include",
  });
}