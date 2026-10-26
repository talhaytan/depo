import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";

export async function GET() {
  try {
    await requireUser();

    const notifications = await prisma.notification.findMany({
      orderBy: [{ isRead: "asc" }, { createdAt: "desc" }],
      take: 30,
      include: {
        product: { select: { id: true, name: true, sku: true } },
      },
    });

    const unreadCount = await prisma.notification.count({
      where: { isRead: false },
    });

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: Request) {
  try {
    await requireUser();
    const body = await req.json();

    if (body.markAllRead) {
      await prisma.notification.updateMany({
        where: { isRead: false },
        data: { isRead: true },
      });
      return NextResponse.json({ success: true });
    }

    if (body.id) {
      await prisma.notification.update({
        where: { id: String(body.id) },
        data: { isRead: true },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false }, { status: 400 });
  } catch (error) {
    return handleApiError(error);
  }
}
