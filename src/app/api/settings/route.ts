import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { settingsSchema } from "@/lib/validations";
import { handleApiError } from "@/lib/api-error";

export async function GET() {
  try {
    const user = await requireUser();
    let settings = await prisma.appSetting.findUnique({
      where: { id: "default" },
    });

    if (!settings) {
      settings = await prisma.appSetting.create({
        data: { id: "default" },
      });
    }

    let auditLogs: unknown[] = [];
    if (user.role === "ADMIN") {
      auditLogs = await prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 40,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });
    }

    return NextResponse.json({ settings, auditLogs });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: Request) {
  try {
    const admin = await requireUser("ADMIN_ONLY");
    const body = await req.json();
    const parsed = settingsSchema.parse(body);

    const updated = await prisma.appSetting.upsert({
      where: { id: "default" },
      update: parsed,
      create: {
        id: "default",
        ...parsed,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "SETTINGS_UPDATE",
        entityType: "Settings",
        entityId: "default",
        userId: admin.id,
        summary: `Uygulama ayarları güncellendi (${updated.companyName} - Para Birimi: ${updated.currency} ${updated.currencySymbol}).`,
        metadata: JSON.stringify(parsed),
      },
    });

    return NextResponse.json({ settings: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
