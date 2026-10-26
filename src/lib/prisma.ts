import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { EMBEDDED_DB_BASE64 } from "./embedded-db";

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

  // On Vercel serverless environment, /var/task is read-only; materialize SQLite db into writable /tmp/dev.db
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const tmpDbPath = "/tmp/dev.db";
    const needsInit =
      !fs.existsSync(tmpDbPath) || fs.statSync(tmpDbPath).size < 16384;

    if (needsInit) {
      try {
        fs.writeFileSync(tmpDbPath, Buffer.from(EMBEDDED_DB_BASE64, "base64"));
      } catch {
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
              // ignore
            }
          }
        }
      }
    }
    return `file:${tmpDbPath}`;
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
