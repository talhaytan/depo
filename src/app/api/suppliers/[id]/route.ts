import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { supplierSchema } from "@/lib/validations";
import { handleApiError } from "@/lib/api-error";
import { BusinessRuleError } from "@/lib/inventory";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser("canManageSuppliers");
    const { id } = await context.params;
    const body = await req.json();

    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) {
      throw new BusinessRuleError("Tedarikçi bulunamadı.", 404);
    }

    if (typeof body.isArchived === "boolean" && Object.keys(body).length === 1) {
      const updated = await prisma.supplier.update({
        where: { id },
        data: { isArchived: body.isArchived },
      });

      await prisma.auditLog.create({
        data: {
          action: body.isArchived ? "SUPPLIER_ARCHIVE" : "SUPPLIER_RESTORE",
          entityType: "Supplier",
          entityId: id,
          userId: user.id,
          summary: `${existing.companyName} tedarikçisi ${
            body.isArchived ? "arşivlendi" : "aktifleştirildi"
          }.`,
        },
      });

      return NextResponse.json({ supplier: updated });
    }

    const parsed = supplierSchema.parse(body);
    const updated = await prisma.supplier.update({
      where: { id },
      data: parsed,
    });

    await prisma.auditLog.create({
      data: {
        action: "SUPPLIER_UPDATE",
        entityType: "Supplier",
        entityId: id,
        userId: user.id,
        summary: `${updated.companyName} tedarikçi bilgileri güncellendi.`,
      },
    });

    return NextResponse.json({ supplier: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
