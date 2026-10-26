import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { productSchema } from "@/lib/validations";
import { handleApiError } from "@/lib/api-error";
import { getStockStatus, toNumeric } from "@/lib/utils";
import { performStockIn } from "@/lib/inventory";
import { BusinessRuleError } from "@/lib/inventory";

export async function GET(req: Request) {
  try {
    await requireUser();
    const { searchParams } = new URL(req.url);

    const rawSearch = (searchParams.get("search") || "").trim();
    const search = rawSearch.toLocaleLowerCase("tr-TR");
    const categoryId = searchParams.get("categoryId") || "";
    const statusFilter = searchParams.get("status") || ""; // "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK"
    const showArchived = searchParams.get("archived") === "true";
    const sortBy = searchParams.get("sortBy") || "updatedAt"; // "name" | "quantity" | "unitCost" | "updatedAt"
    const sortDir = searchParams.get("sortDir") === "asc" ? "asc" : "desc";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(
      500,
      Math.max(1, parseInt(searchParams.get("pageSize") || "15", 10))
    );

    const products = await prisma.product.findMany({
      where: {
        isArchived: showArchived,
        ...(categoryId ? { categoryId } : {}),
      },
      include: {
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, companyName: true } },
      },
    });

    // Apply Turkish-aware search & computed stock status filter
    const filtered = products
      .map((p) => {
        const quantity = toNumeric(p.quantity);
        const minStockLevel = toNumeric(p.minStockLevel);
        const unitCost = toNumeric(p.unitCost);
        const stockStatus = getStockStatus(quantity, minStockLevel);
        return {
          ...p,
          quantity,
          minStockLevel,
          unitCost,
          stockStatus,
        };
      })
      .filter((p) => {
        if (search) {
          const matchName = p.name.toLocaleLowerCase("tr-TR").includes(search);
          const matchSku = p.sku.toLocaleLowerCase("tr-TR").includes(search);
          const matchBarcode = (p.barcode || "")
            .toLocaleLowerCase("tr-TR")
            .includes(search);
          const matchCategory = p.category.name
            .toLocaleLowerCase("tr-TR")
            .includes(search);
          if (!matchName && !matchSku && !matchBarcode && !matchCategory)
            return false;
        }
        if (statusFilter && p.stockStatus !== statusFilter) {
          return false;
        }
        return true;
      });

    // Sort
    filtered.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "name") {
        cmp = a.name.localeCompare(b.name, "tr");
      } else if (sortBy === "quantity") {
        cmp = a.quantity - b.quantity;
      } else if (sortBy === "unitCost") {
        cmp = a.unitCost - b.unitCost;
      } else {
        cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      }
      return sortDir === "asc" ? cmp : -cmp;
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

export async function POST(req: Request) {
  try {
    const user = await requireUser("canManageProducts");
    const body = await req.json();
    const parsed = productSchema.parse(body);

    // Check unique SKU
    const existingSku = await prisma.product.findUnique({
      where: { sku: parsed.sku },
    });
    if (existingSku) {
      throw new BusinessRuleError(
        `"${parsed.sku}" stok kodu (SKU) başka bir üründe kullanılmaktadır. Stok kodu benzersiz olmalıdır.`
      );
    }

    // Check unique barcode when provided
    if (parsed.barcode) {
      const existingBarcode = await prisma.product.findUnique({
        where: { barcode: parsed.barcode },
      });
      if (existingBarcode) {
        throw new BusinessRuleError(
          `"${parsed.barcode}" barkod numarası başka bir üründe (${existingBarcode.name}) kayıtlıdır. Barkod benzersiz olmalıdır.`
        );
      }
    }

    // Auto-generate dynamic SVG product image if user left imageUrl empty
    let finalImageUrl = parsed.imageUrl;
    if (!finalImageUrl) {
      const cat = await prisma.category.findUnique({
        where: { id: parsed.categoryId },
      });
      const isRifle = cat?.name.toLocaleLowerCase("tr-TR").includes("tüfek");
      const brandWord = parsed.name.trim().split(/\s+/)[0] || "ÇAVUŞ";
      const modelWords =
        parsed.name.trim().split(/\s+/).slice(1, 4).join(" ") || parsed.sku;
      finalImageUrl = isRifle
        ? `/api/product-image?kind=rifle&brand=${encodeURIComponent(
            brandWord
          )}&model=${encodeURIComponent(modelWords)}&caliber=12`
        : `/api/product-image?kind=shell&brand=${encodeURIComponent(
            brandWord
          )}&model=${encodeURIComponent(modelWords)}&caliber=12&gram=32&shot=5`;
    }

    const created = await prisma.product.create({
      data: {
        name: parsed.name,
        sku: parsed.sku,
        barcode: parsed.barcode,
        categoryId: parsed.categoryId,
        supplierId: parsed.supplierId,
        description: parsed.description,
        imageUrl: finalImageUrl,
        unit: parsed.unit,
        minStockLevel: parsed.minStockLevel,
        unitCost: parsed.unitCost,
        quantity: 0, // Initial quantity will be recorded via StockIn transaction if > 0
      },
      include: {
        category: true,
        supplier: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "PRODUCT_CREATE",
        entityType: "Product",
        entityId: created.id,
        userId: user.id,
        summary: `Yeni ürün oluşturuldu: ${created.name} (${created.sku}).`,
        metadata: JSON.stringify({
          sku: created.sku,
          barcode: created.barcode,
          unit: created.unit,
          minStockLevel: parsed.minStockLevel,
          unitCost: parsed.unitCost,
        }),
      },
    });

    if (parsed.initialQuantity && parsed.initialQuantity > 0) {
      await performStockIn({
        productId: created.id,
        quantity: parsed.initialQuantity,
        unitCost: parsed.unitCost,
        supplierId: parsed.supplierId,
        referenceNo: "ACILIS-STOK",
        notes: "Ürün kartı açılış başlangıç stoğu",
        userId: user.id,
      });
    }

    const finalProduct = await prisma.product.findUnique({
      where: { id: created.id },
      include: { category: true, supplier: true },
    });

    return NextResponse.json({ product: finalProduct }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
