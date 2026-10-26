import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { categorySchema } from "@/lib/validations";
import { handleApiError } from "@/lib/api-error";
import { BusinessRuleError } from "@/lib/inventory";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser("canManageCategories");
    const { id } = await context.params;
    const body = await req.json();

    const existing = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: { select: { products: true } },
      },
    });

    if (!existing) {
      throw new BusinessRuleError("Kategori bulunamadı.", 404);
    }

    if (typeof body.isArchived === "boolean" && Object.keys(body).length === 1) {
      if (body.isArchived && existing._count.products > 0) {
        const activeProductsCount = await prisma.product.count({
          where: { categoryId: id, isArchived: false },
        });
        if (activeProductsCount > 0) {
          throw new BusinessRuleError(
            `Bu kategoriye bağlı ${activeProductsCount} adet aktif ürün bulunmaktadır. Aktif ürünleri olan bir kategori arşivlenemez veya kaldırılamaz.`
          );
        }
      }

      const updated = await prisma.category.update({
        where: { id },
        data: { isArchived: body.isArchived },
        include: { _count: { select: { products: true } } },
      });

      await prisma.auditLog.create({
        data: {
          action: body.isArchived ? "CATEGORY_ARCHIVE" : "CATEGORY_RESTORE",
          entityType: "Category",
          entityId: id,
          userId: user.id,
          summary: `${existing.name} kategorisi ${
            body.isArchived ? "arşivlendi" : "aktifleştirildi"
          }.`,
        },
      });

      return NextResponse.json({ category: updated });
    }

    const parsed = categorySchema.parse(body);

    const duplicate = await prisma.category.findFirst({
      where: { name: parsed.name, id: { not: id } },
    });
    if (duplicate) {
      throw new BusinessRuleError(
        `"${parsed.name}" adında başka bir kategori zaten mevcuttur.`
      );
    }

    const updated = await prisma.category.update({
      where: { id },
      data: {
        name: parsed.name,
        description: parsed.description,
      },
      include: { _count: { select: { products: true } } },
    });

    await prisma.auditLog.create({
      data: {
        action: "CATEGORY_UPDATE",
        entityType: "Category",
        entityId: id,
        userId: user.id,
        summary: `${updated.name} kategorisi güncellendi.`,
      },
    });

    return NextResponse.json({ category: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser("canManageCategories");
    const { id } = await context.params;

    const existing = await prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });

    if (!existing) {
      throw new BusinessRuleError("Kategori bulunamadı.", 404);
    }

    if (existing._count.products > 0) {
      throw new BusinessRuleError(
        `Bu kategoriye kayıtlı ${existing._count.products} ürün bulunduğu için kategori silinemez.`
      );
    }

    await prisma.category.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        action: "CATEGORY_DELETE",
        entityType: "Category",
        entityId: id,
        userId: user.id,
        summary: `Kullanılmayan ${existing.name} kategorisi silindi.`,
      },
    });

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
