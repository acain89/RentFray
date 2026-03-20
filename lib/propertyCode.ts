import { prisma } from "@/lib/prisma";

function randomFourDigitCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export async function generateUniquePropertyCode(maxAttempts = 200): Promise<string> {
  for (let i = 0; i < maxAttempts; i++) {
    const code = randomFourDigitCode();

    const existing = await prisma.property.findUnique({
      where: { code },
      select: { id: true },
    });

    if (!existing) {
      return code;
    }
  }

  throw new Error("Unable to generate unique property code");
}