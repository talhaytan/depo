import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { productSchema } from "@/lib/validations";
import { handleApiError } from "@/lib/api-error";
import { BusinessRuleError } from "@/lib/inventory";
import { getStockStatus, toNumeric } from "@/lib/utils";
import { subDays, format, startOfDay } from "date-fns";
import { tr } from "date-fns/locale";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireUser();
    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const periodDays = Math.min(
      90,
      Math.max(7, parseInt(searchParams.get("days") || "30", 10))
    );

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        supplier: true,
        movements: {
          orderBy: { movementDate: "desc" },
          take: 50,
          include: {
            user: { select: { id: true, name: true, email: true } },
            supplier: { select: { id: true, companyName: true } },
          },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Ürün bulunamadı." }, { status: 404 });
    }

    const quantity = toNumeric(product.quantity);
    const minStockLevel = toNumeric(product.minStockLevel);
    const unitCost = toNumeric(product.unitCost);
    const stockStatus = getStockStatus(quantity, minStockLevel);

    // Build stock history over selected period
    const now = new Date();
    const startDate = startOfDay(subDays(now, periodDays - 1));
    const periodMovements = await prisma.stockMovement.findMany({
      where: {
        productId: id,
        movementDate: { gte: startDate },
      },
      orderBy: { movementDate: "asc" },
    });

    const historyPoints: Array<{
      date: string;
      stockAfter: number;
      giris: number;
      cikis: number;
    }> = [];

    for (let i = periodDays - 1; i >= 0; i--) {
      const d = subDays(now, i);
      const dayKey = format(d, "yyyy-MM-dd");
      const label = format(d, "dd MMM", { locale: tr });

      const dayMovs = periodMovements.filter(
        (m) => format(new Date(m.movementDate), "yyyy-MM-dd") === dayKey
      );
      let giris = 0;
      let cikis = 0;
      let lastBalance =
        historyPoints.length > 0
          ? historyPoints[historyPoints.length - 1].stockAfter
          : periodMovements.length > 0
          ? toNumeric(periodMovements[0].stockBefore)
          : quantity;

      for (const m of dayMovs) {
        const q = toNumeric(m.quantity);
        if (m.type === "IN") giris += q;
        if (m.type === "OUT") cikis += q;
        lastBalance = toNumeric(m.stockAfter);
      }

      historyPoints.push({
        date: label,
        stockAfter: lastBalance,
        giris,
        cikis,
      });
    }

    return NextResponse.json({
      product: {
        ...product,
        quantity,
        minStockLevel,
        unitCost,
        stockStatus,
        movements: product.movements.map((m) => ({
          ...m,
          quantity: toNumeric(m.quantity),
          stockBefore: toNumeric(m.stockBefore),
          stockAfter: toNumeric(m.stockAfter),
          unitCost: m.unitCost !== null ? toNumeric(m.unitCost) : null,
        })),
      },
      history: historyPoints,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser("canManageProducts");
    const { id } = await context.params;
    const body = await req.json();

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new BusinessRuleError("Güncellenecek ürün bulunamadı.", 404);
    }

    // Handle archive/restore toggle if only isArchived is passed
    if (typeof body.isArchived === "boolean" && Object.keys(body).length === 1) {
      const updated = await prisma.product.update({
        where: { id },
        data: { isArchived: body.isArchived },
      });

      await prisma.auditLog.create({
        data: {
          action: body.isArchived ? "PRODUCT_ARCHIVE" : "PRODUCT_RESTORE",
          entityType: "Product",
          entityId: id,
          userId: user.id,
          summary: `${existing.name} (${existing.sku}) ürünü ${
            body.isArchived ? "arşivlendi" : "arşivden çıkarıldı"
          }.`,
        },
      });

      return NextResponse.json({ product: updated });
    }

    const parsed = productSchema.omit({ initialQuantity: true }).parse(body);

    // Check unique SKU excluding current product
    const skuConflict = await prisma.product.findFirst({
      where: {
        sku: parsed.sku,
        id: { not: id },
      },
    });
    if (skuConflict) {
      throw new BusinessRuleError(
        `"${parsed.sku}" stok kodu başka bir üründe kullanılmaktadır.`
      );
    }

    // Check unique Barcode excluding current product
    if (parsed.barcode) {
      const barcodeConflict = await prisma.product.findFirst({
        where: {
          barcode: parsed.barcode,
          id: { not: id },
        },
      });
      if (barcodeConflict) {
        throw new BusinessRuleError(
          `"${parsed.barcode}" barkodu başka bir üründe (${barcodeConflict.name}) kayıtlıdır.`
        );
      }
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        name: parsed.name,
        sku: parsed.sku,
        barcode: parsed.barcode,
        categoryId: parsed.categoryId,
        supplierId: parsed.supplierId,
        description: parsed.description,
        imageUrl: parsed.imageUrl || existing.imageUrl,
        unit: parsed.unit,
        minStockLevel: parsed.minStockLevel,
        unitCost: parsed.unitCost,
      },
      include: { category: true, supplier: true },
    });

    await prisma.auditLog.create({
      data: {
        action: "PRODUCT_UPDATE",
        entityType: "Product",
        entityId: id,
        userId: user.id,
        summary: `${updated.name} (${updated.sku}) ürün bilgileri güncellendi.`,
        metadata: JSON.stringify({
          before: {
            name: existing.name,
            sku: existing.sku,
            barcode: existing.barcode,
            minStockLevel: toNumeric(existing.minStockLevel),
            unitCost: toNumeric(existing.unitCost),
          },
          after: {
            name: updated.name,
            sku: updated.sku,
            barcode: updated.barcode,
            minStockLevel: parsed.minStockLevel,
            unitCost: parsed.unitCost,
          },
        }),
      },
    });

    return NextResponse.json({ product: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser("canManageProducts");
    const { id } = await context.params;

    const existing = await prisma.product.findUnique({
      where: { id },
      include: { _count: { select: { movements: true } } },
    });

    if (!existing) {
      throw new BusinessRuleError("Ürün bulunamadı.", 404);
    }

    // Never permanently delete products referenced by historical inventory transactions
    if (existing._count.movements > 0) {
      const archived = await prisma.product.update({
        where: { id },
        data: { isArchived: true },
      });

      await prisma.auditLog.create({
        data: {
          action: "PRODUCT_ARCHIVE",
          entityType: "Product",
          entityId: id,
          userId: user.id,
          summary: `${existing.name} (${existing.sku}) geçmiş stok hareketlerine sahip olduğu için kalıcı olarak silinmedi, güvenli şekilde arşivlendi.`,
        },
      });

      return NextResponse.json({
        archived: true,
        message:
          "Bu ürüne ait geçmiş stok hareketleri bulunduğu için kalıcı olarak silinmedi, arşivlendi.",
        product: archived,
      });
    }

    await prisma.product.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        action: "PRODUCT_DELETE",
        entityType: "Product",
        entityId: id,
        userId: user.id,
        summary: `Hiç stok hareketi bulunmayan ${existing.name} (${existing.sku}) ürünü silindi.`,
      },
    });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
