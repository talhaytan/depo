import { prisma } from "./prisma";
import { getStockStatus, toNumeric } from "./utils";
import { subDays, format, startOfDay, endOfDay } from "date-fns";
import { tr } from "date-fns/locale";

export async function getDashboardMetrics() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const sevenDaysAgo = startOfDay(subDays(now, 6));

  const [
    products,
    todayMovements,
    recentMovements,
    last7DaysMovements,
    unreadNotificationCount,
  ] = await Promise.all([
    prisma.product.findMany({
      where: { isArchived: false },
      include: {
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, companyName: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.stockMovement.findMany({
      where: {
        movementDate: {
          gte: todayStart,
          lte: todayEnd,
        },
        isReversed: false,
      },
    }),
    prisma.stockMovement.findMany({
      take: 10,
      orderBy: { movementDate: "desc" },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            unit: true,
            imageUrl: true,
          },
        },
        user: { select: { id: true, name: true } },
      },
    }),
    prisma.stockMovement.findMany({
      where: {
        movementDate: {
          gte: sevenDaysAgo,
          lte: todayEnd,
        },
        isReversed: false,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            unit: true,
            imageUrl: true,
          },
        },
      },
    }),
    prisma.notification.count({
      where: { isRead: false },
    }),
  ]);

  let totalStockQuantity = 0;
  let totalInventoryValue = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  const criticalProducts: Array<{
    id: string;
    name: string;
    sku: string;
    imageUrl: string | null;
    categoryName: string;
    supplierName: string | null;
    quantity: number;
    minStockLevel: number;
    unit: string;
    unitCost: number;
    status: "LOW_STOCK" | "OUT_OF_STOCK";
  }> = [];

  for (const p of products) {
    const qty = toNumeric(p.quantity);
    const min = toNumeric(p.minStockLevel);
    const cost = toNumeric(p.unitCost);
    const status = getStockStatus(qty, min);

    totalStockQuantity += qty;
    totalInventoryValue += qty * cost;

    if (status === "OUT_OF_STOCK") {
      outOfStockCount += 1;
      criticalProducts.push({
        id: p.id,
        name: p.name,
        sku: p.sku,
        imageUrl: p.imageUrl,
        categoryName: p.category.name,
        supplierName: p.supplier?.companyName || null,
        quantity: qty,
        minStockLevel: min,
        unit: p.unit,
        unitCost: cost,
        status: "OUT_OF_STOCK",
      });
    } else if (status === "LOW_STOCK") {
      lowStockCount += 1;
      criticalProducts.push({
        id: p.id,
        name: p.name,
        sku: p.sku,
        imageUrl: p.imageUrl,
        categoryName: p.category.name,
        supplierName: p.supplier?.companyName || null,
        quantity: qty,
        minStockLevel: min,
        unit: p.unit,
        unitCost: cost,
        status: "LOW_STOCK",
      });
    }
  }

  // Sort critical products: OUT_OF_STOCK first, then lowest ratio of quantity/minStockLevel
  criticalProducts.sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === "OUT_OF_STOCK" ? -1 : 1;
    }
    return a.quantity - b.quantity;
  });

  let dailyStockInQty = 0;
  let dailyStockInCount = 0;
  let dailyStockOutQty = 0;
  let dailyStockOutCount = 0;

  for (const m of todayMovements) {
    const q = toNumeric(m.quantity);
    if (m.type === "IN") {
      dailyStockInQty += q;
      dailyStockInCount += 1;
    } else if (m.type === "OUT") {
      dailyStockOutQty += q;
      dailyStockOutCount += 1;
    }
  }

  // Build 7-day chart data
  const chartMap = new Map<
    string,
    { dateLabel: string; giris: number; cikis: number }
  >();
  for (let i = 6; i >= 0; i--) {
    const dayDate = subDays(now, i);
    const key = format(dayDate, "yyyy-MM-dd");
    const label = format(dayDate, "dd MMM", { locale: tr });
    chartMap.set(key, { dateLabel: label, giris: 0, cikis: 0 });
  }

  // Also calculate most frequently moved products
  const productMovementMap = new Map<
    string,
    {
      productId: string;
      name: string;
      sku: string;
      unit: string;
      imageUrl: string | null;
      movementCount: number;
      totalIn: number;
      totalOut: number;
    }
  >();

  for (const m of last7DaysMovements) {
    const key = format(new Date(m.movementDate), "yyyy-MM-dd");
    const entry = chartMap.get(key);
    const q = toNumeric(m.quantity);
    if (entry) {
      if (m.type === "IN") entry.giris = Number((entry.giris + q).toFixed(2));
      if (m.type === "OUT") entry.cikis = Number((entry.cikis + q).toFixed(2));
    }

    if (m.product) {
      const existing = productMovementMap.get(m.productId) || {
        productId: m.productId,
        name: m.product.name,
        sku: m.product.sku,
        unit: m.product.unit,
        imageUrl: m.product.imageUrl,
        movementCount: 0,
        totalIn: 0,
        totalOut: 0,
      };
      existing.movementCount += 1;
      if (m.type === "IN") existing.totalIn += q;
      if (m.type === "OUT") existing.totalOut += q;
      productMovementMap.set(m.productId, existing);
    }
  }

  const mostMovedProducts = Array.from(productMovementMap.values())
    .sort(
      (a, b) =>
        b.totalIn + b.totalOut - (a.totalIn + a.totalOut) ||
        b.movementCount - a.movementCount
    )
    .slice(0, 5);

  return {
    summary: {
      totalProductTypes: products.length,
      totalStockQuantity: Number(totalStockQuantity.toFixed(2)),
      totalInventoryValue: Number(totalInventoryValue.toFixed(2)),
      lowStockCount,
      outOfStockCount,
      dailyStockInQty: Number(dailyStockInQty.toFixed(2)),
      dailyStockInCount,
      dailyStockOutQty: Number(dailyStockOutQty.toFixed(2)),
      dailyStockOutCount,
      unreadNotificationCount,
    },
    criticalProducts: criticalProducts.slice(0, 12),
    recentMovements: recentMovements.map((m) => ({
      id: m.id,
      movementCode: m.movementCode,
      type: m.type,
      quantity: toNumeric(m.quantity),
      stockBefore: toNumeric(m.stockBefore),
      stockAfter: toNumeric(m.stockAfter),
      reason: m.reason,
      referenceNo: m.referenceNo,
      createdAt: m.movementDate.toISOString(),
      product: m.product,
      user: m.user,
    })),
    chartData: Array.from(chartMap.values()),
    mostMovedProducts,
  };
}
