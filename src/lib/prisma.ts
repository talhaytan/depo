import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function resolveDatabaseUrl(): string {
  // If an explicit external database URL (e.g. Postgres/Turso) is provided, use it
  if (
    process.env.DATABASE_URL &&
    !process.env.DATABASE_URL.startsWith("file:")
  ) {
    return process.env.DATABASE_URL;
  }

  // On Vercel serverless environment, /var/task is read-only; copy bundled SQLite db to writable /tmp/dev.db
  if (process.env.VERCEL) {
    const tmpDbPath = "/tmp/dev.db";
    if (!fs.existsSync(tmpDbPath)) {
      const candidatePaths = [
        path.join(process.cwd(), "prisma", "dev.db"),
        path.join(process.cwd(), "dev.db"),
      ];
      for (const srcPath of candidatePaths) {
        if (fs.existsSync(srcPath)) {
          try {
            fs.copyFileSync(srcPath, tmpDbPath);
            break;
          } catch {
            // ignore copy error and fallback
          }
        }
      }
    }
    if (fs.existsSync(tmpDbPath)) {
      return `file:${tmpDbPath}`;
    }
  }

  return process.env.DATABASE_URL || "file:./dev.db";
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: resolveDatabaseUrl(),
      },
    },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
