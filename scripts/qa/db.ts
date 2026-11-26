import { disposableClient } from "../operational-safety";

export const prisma = disposableClient(["qa-audit", "qa-integration"]);
