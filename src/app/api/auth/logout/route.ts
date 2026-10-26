import { NextResponse } from "next/server";
import { clearSessionCookie, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (user) {
      await prisma.auditLog.create({
        data: {
          action: "USER_LOGOUT",
          entityType: "User",
          entityId: user.id,
          userId: user.id,
          summary: `${user.name} oturumu kapattı.`,
        },
      });
    }
    await clearSessionCookie();
    return NextResponse.json({ success: true });
  } catch {
    await clearSessionCookie();
    return NextResponse.json({ success: true });
  }
}
