export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateSessionConfiguration } = await import("@/lib/session");
    validateSessionConfiguration();
  }
}
