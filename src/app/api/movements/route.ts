import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { toNumeric } from "@/lib/utils";
import { startOfDay, endOfDay } from "date-fns";

export async function GET(req: Request) {
  try {
    await requireUser();
    const { searchParams } = new URL(req.url);

    const search = (searchParams.get("search") || "").trim().toLocaleLowerCase("tr-TR");
    const type = searchParams.get("type") || "";
    const productId = searchParams.get("productId") || "";
    const userId = searchParams.get("userId") || "";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(
      500,
      Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10))
    );

    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (startDate) {
      dateFilter.gte = startOfDay(new Date(startDate));
    }
    if (endDate) {
      dateFilter.lte = endOfDay(new Date(endDate));
    }

    const movements = await prisma.stockMovement.findMany({
      where: {
        ...(type ? { type } : {}),
        ...(productId ? { productId } : {}),
        ...(userId ? { userId } : {}),
        ...(Object.keys(dateFilter).length > 0
          ? { movementDate: dateFilter }
          : {}),
      },
      include: {
        product: {
          select: { id: true, name: true, sku: true, barcode: true, unit: true, imageUrl: true },
        },
        user: { select: { id: true, name: true, email: true } },
        supplier: { select: { id: true, companyName: true } },
      },
      orderBy: [{ movementDate: "desc" }, { createdAt: "desc" }],
    });

    const filtered = movements
      .map((m) => ({
        ...m,
        quantity: toNumeric(m.quantity),
        stockBefore: toNumeric(m.stockBefore),
        stockAfter: toNumeric(m.stockAfter),
        unitCost: m.unitCost !== null ? toNumeric(m.unitCost) : null,
      }))
      .filter((m) => {
        if (!search) return true;
        return (
          m.movementCode.toLocaleLowerCase("tr-TR").includes(search) ||
          m.product.name.toLocaleLowerCase("tr-TR").includes(search) ||
          m.product.sku.toLocaleLowerCase("tr-TR").includes(search) ||
          (m.product.barcode || "").toLocaleLowerCase("tr-TR").includes(search) ||
          (m.referenceNo || "").toLocaleLowerCase("tr-TR").includes(search) ||
          (m.reason || "").toLocaleLowerCase("tr-TR").includes(search) ||
          m.user.name.toLocaleLowerCase("tr-TR").includes(search)
        );
      });

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const items = filtered.slice((page - 1) * pageSize, page * pageSize);

    return NextResponse.json({
      items,
      pagination: {
        total,
        page,
        pageSize,
        totalPages,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
