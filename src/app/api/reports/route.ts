import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { getStockStatus, toNumeric } from "@/lib/utils";
import { startOfDay, endOfDay } from "date-fns";

export async function GET(req: Request) {
  try {
    await requireUser("canViewReports");
    const { searchParams } = new URL(req.url);

    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";
    const productId = searchParams.get("productId") || "";

    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (startDate) {
      dateFilter.gte = startOfDay(new Date(startDate));
    }
    if (endDate) {
      dateFilter.lte = endOfDay(new Date(endDate));
    }

    const [products, movements, users] = await Promise.all([
      prisma.product.findMany({
        where: { isArchived: false },
        include: {
          category: { select: { id: true, name: true } },
          supplier: { select: { id: true, companyName: true } },
        },
        orderBy: { name: "asc" },
      }),
      prisma.stockMovement.findMany({
        where: {
          ...(Object.keys(dateFilter).length > 0
            ? { movementDate: dateFilter }
            : {}),
          ...(productId ? { productId } : {}),
        },
        include: {
          product: { select: { id: true, name: true, sku: true, unit: true } },
          user: { select: { id: true, name: true, email: true, role: true } },
          supplier: { select: { id: true, companyName: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true, isActive: true },
      }),
    ]);

    const currentInventory = products.map((p) => {
      const quantity = toNumeric(p.quantity);
      const minStockLevel = toNumeric(p.minStockLevel);
      const unitCost = toNumeric(p.unitCost);
      const totalCostValue = Number((quantity * unitCost).toFixed(2));
      const status = getStockStatus(quantity, minStockLevel);

      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        categoryName: p.category.name,
        supplierName: p.supplier?.companyName || "-",
        unit: p.unit,
        quantity,
        minStockLevel,
        unitCost,
        totalCostValue,
        status,
        updatedAt: p.updatedAt,
      };
    });

    const lowStockProducts = currentInventory.filter(
      (p) => p.status === "LOW_STOCK"
    );
    const outOfStockProducts = currentInventory.filter(
      (p) => p.status === "OUT_OF_STOCK"
    );

    const totalInventoryValuation = Number(
      currentInventory
        .reduce((acc, item) => acc + item.totalCostValue, 0)
        .toFixed(2)
    );

    // Valuation by category
    const categoryValuationMap = new Map<
      string,
      { categoryName: string; productCount: number; totalQuantity: number; totalValuation: number }
    >();
    for (const item of currentInventory) {
      const entry = categoryValuationMap.get(item.categoryName) || {
        categoryName: item.categoryName,
        productCount: 0,
        totalQuantity: 0,
        totalValuation: 0,
      };
      entry.productCount += 1;
      entry.totalQuantity = Number((entry.totalQuantity + item.quantity).toFixed(2));
      entry.totalValuation = Number(
        (entry.totalValuation + item.totalCostValue).toFixed(2)
      );
      categoryValuationMap.set(item.categoryName, entry);
    }

    // Stock-in and Stock-out activity summary
    let totalStockInCount = 0;
    let totalStockInQty = 0;
    let totalStockInCost = 0;
    let totalStockOutCount = 0;
    let totalStockOutQty = 0;
    let totalAdjustmentCount = 0;

    // Activity by employee
    const employeeMap = new Map<
      string,
      {
        userId: string;
        name: string;
        email: string;
        role: string;
        stockInCount: number;
        stockOutCount: number;
        adjustmentCount: number;
        reversalCount: number;
        totalOperations: number;
        lastOperationAt: Date | null;
      }
    >();

    for (const u of users) {
      employeeMap.set(u.id, {
        userId: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        stockInCount: 0,
        stockOutCount: 0,
        adjustmentCount: 0,
        reversalCount: 0,
        totalOperations: 0,
        lastOperationAt: null,
      });
    }

    const formattedMovements = movements.map((m) => {
      const qty = toNumeric(m.quantity);
      const cost = m.unitCost !== null ? toNumeric(m.unitCost) : 0;

      if (!m.isReversed) {
        if (m.type === "IN") {
          totalStockInCount += 1;
          totalStockInQty = Number((totalStockInQty + qty).toFixed(2));
          totalStockInCost = Number((totalStockInCost + qty * cost).toFixed(2));
        } else if (m.type === "OUT") {
          totalStockOutCount += 1;
          totalStockOutQty = Number((totalStockOutQty + qty).toFixed(2));
        } else if (m.type === "ADJUSTMENT") {
          totalAdjustmentCount += 1;
        }
      }

      const emp = employeeMap.get(m.userId);
      if (emp) {
        emp.totalOperations += 1;
        if (m.type === "IN") emp.stockInCount += 1;
        else if (m.type === "OUT") emp.stockOutCount += 1;
        else if (m.type === "ADJUSTMENT") emp.adjustmentCount += 1;
        else if (m.type === "REVERSAL") emp.reversalCount += 1;

        if (!emp.lastOperationAt || m.createdAt > emp.lastOperationAt) {
          emp.lastOperationAt = m.createdAt;
        }
      }

      return {
        id: m.id,
        movementCode: m.movementCode,
        type: m.type,
        quantity: qty,
        stockBefore: toNumeric(m.stockBefore),
        stockAfter: toNumeric(m.stockAfter),
        unitCost: cost,
        reason: m.reason,
        referenceNo: m.referenceNo,
        movementDate: m.movementDate,
        createdAt: m.createdAt,
        isReversed: m.isReversed,
        product: m.product,
        user: m.user,
        supplier: m.supplier,
      };
    });

    return NextResponse.json({
      valuationMethodology:
        "Envanter Değeri = Σ (Mevcut Stok Miktarı × Kayıtlı Birim Alış Maliyeti). Bu değer yalnızca alış maliyeti üzerinden stok değerlemesini ifade eder; perakende satış fiyatı veya kâr tahmini değildir.",
      summary: {
        totalProducts: currentInventory.length,
        lowStockCount: lowStockProducts.length,
        outOfStockCount: outOfStockProducts.length,
        totalInventoryValuation,
        totalStockInCount,
        totalStockInQty,
        totalStockInCost,
        totalStockOutCount,
        totalStockOutQty,
        totalAdjustmentCount,
      },
      currentInventory,
      lowStockProducts,
      outOfStockProducts,
      categoryValuation: Array.from(categoryValuationMap.values()),
      movements: formattedMovements,
      employeeActivity: Array.from(employeeMap.values()).sort(
        (a, b) => b.totalOperations - a.totalOperations
      ),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
