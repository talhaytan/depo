import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { supplierSchema } from "@/lib/validations";
import { handleApiError } from "@/lib/api-error";
import { toNumeric } from "@/lib/utils";

export async function GET(req: Request) {
  try {
    await requireUser();
    const { searchParams } = new URL(req.url);
    const includeArchived = searchParams.get("includeArchived") === "true";

    const suppliers = await prisma.supplier.findMany({
      where: includeArchived ? {} : { isArchived: false },
      include: {
        products: {
          where: { isArchived: false },
          select: { id: true, name: true, sku: true, quantity: true, unit: true },
        },
        movements: {
          where: { type: "IN" },
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            product: { select: { id: true, name: true, sku: true, unit: true } },
            user: { select: { id: true, name: true } },
          },
        },
        _count: {
          select: { products: true, movements: true },
        },
      },
      orderBy: { companyName: "asc" },
    });

    return NextResponse.json({
      suppliers: suppliers.map((s) => ({
        ...s,
        products: s.products.map((p) => ({
          ...p,
          quantity: toNumeric(p.quantity),
        })),
        movements: s.movements.map((m) => ({
          ...m,
          quantity: toNumeric(m.quantity),
          unitCost: m.unitCost !== null ? toNumeric(m.unitCost) : null,
        })),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser("canManageSuppliers");
    const body = await req.json();
    const parsed = supplierSchema.parse(body);

    const supplier = await prisma.supplier.create({
      data: parsed,
    });

    await prisma.auditLog.create({
      data: {
        action: "SUPPLIER_CREATE",
        entityType: "Supplier",
        entityId: supplier.id,
        userId: user.id,
        summary: `Yeni tedarikçi eklendi: ${supplier.companyName}.`,
      },
    });

    return NextResponse.json({ supplier }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
